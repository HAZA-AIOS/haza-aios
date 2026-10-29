# HAZA-AIOS — EPIC 14: AI AGENT RUNTIME & EXECUTION ENGINE
## ARCHITECTURE SPECIFICATION & IMPLEMENTATION PLAN

---

### 1. Executive Summary & Baseline

- **Workspace:** `C:\HAZA-APPS\HAZA-AIOS`
- **Repository:** `HAZA-AIOS/haza-aios`
- **Source Baseline:** `v0.13.0-epic13` (commit `f059b8d`)
- **Target Release:** `v0.14.0-epic14`
- **Feature Branch:** `feature/epic-14-agent-runtime-execution`
- **Objective:** Design, implement, test, rehearse, deploy, and verify the production-grade **AI Agent Runtime & Execution Engine** for HAZA-AIOS. Enable authorized tenant users to execute configured agents through a durable, secure, multi-tenant execution system with controlled provider inference, background job processing, human approval workflows, auditability, recovery, and operational monitoring.

---

### 2. State Machine & Execution Lifecycle

#### Allowed States:
- `queued`: Awaiting worker pickup or scheduled retry.
- `running`: Actively executing within a leased worker attempt.
- `awaiting_approval`: Execution paused pending designated human approver decision.
- `rejected`: Approval rejected by designated approver; run terminated.
- `completed`: Successfully finished with validated output and accounting records.
- `failed`: Terminal failure after exhausting max retries or unrecoverable error.
- `cancelled`: Explicitly aborted by authorized actor or system timeout.

```
                  ┌──────────────┐
                  │    queued    │◀──────────────┐
                  └──────┬───────┘               │
                         │ (claim / lease)       │ (approved resume /
                         ▼                       │  retry attempt)
                  ┌──────────────┐               │
           ┌─────▶│   running    │───────────────┼──────────────┐
           │      └──────┬───────┘               │              │
           │             │                       │              │
(worker    │             ├──▶ [awaiting_approval]┘              ├──▶ [completed]
 recovery) │             │            │                         │
           │             │            └──▶ [rejected]           ├──▶ [failed]
           │             │                                      │
           └─────────────┴──────────────────────────────────────┴──▶ [cancelled]
```

#### Central Legal State Transitions:
```typescript
export const RUNTIME_STATE_TRANSITIONS: Record<AgentRunStatus, AgentRunStatus[]> = {
  queued: ["running", "cancelled"],
  running: ["awaiting_approval", "completed", "failed", "cancelled"],
  awaiting_approval: ["queued", "rejected", "cancelled"],
  rejected: [],   // Terminal
  completed: [],  // Terminal
  failed: ["queued"], // Explicit retry ONLY (creates new attempt/lineage)
  cancelled: [],  // Terminal
};
```
*Invariants: Terminal states (`completed`, `rejected`, `cancelled`) are strictly immutable. Retries never overwrite prior history; they increment attempt counters or establish explicit child run lineage.*

---

### 3. Database Schema & Migration 0024

Migration `0024_agent_runtime_execution_engine.sql` introduces additive schema entities with complete multi-tenant scoping (`organization_id`, `workspace_id`):

1. **`ai_agent_runs` Extensions:**
   - `configuration_revision_id` (`char(36) NULL`, FK to `ai_agent_configuration_revisions.id`): Pin exact immutable revision.
   - `configuration_snapshot` (`json NULL`): Immutable copy of configuration at time of execution.
   - `attempt_count` (`int NOT NULL DEFAULT 0`): Completed attempts.
   - `max_attempts` (`int NOT NULL DEFAULT 3`): Retry budget.
   - `lease_token` (`varchar(80) NULL`): Worker fencing token.
   - `lease_expires_at` (`timestamp(3) NULL`): Concurrency fencing lease timestamp.
   - `worker_id` (`varchar(120) NULL`): Identity of claiming worker node.
   - `priority` (`int NOT NULL DEFAULT 0`): Queue scheduling priority.
   - `total_input_tokens` (`int NOT NULL DEFAULT 0`): Aggregated prompt tokens.
   - `total_output_tokens` (`int NOT NULL DEFAULT 0`): Aggregated completion tokens.
   - `total_cost_micros` (`bigint NOT NULL DEFAULT 0`): Estimated micro-USD spend.
   - `cancelled_by` (`char(36) NULL`): Attribution FK to `users.id`.
   - `cancelled_at` (`timestamp(3) NULL`): Timestamp of cancellation.
   - `cancellation_reason` (`varchar(500) NULL`): Human or system cancellation rationale.

2. **`ai_agent_run_attempts`:**
   - Tracks individual execution attempts per run.
   - Fields: `id`, `organization_id`, `workspace_id`, `run_id`, `attempt_number`, `status`, `worker_id`, `lease_token`, `started_at`, `completed_at`, `duration_ms`, `error_code`, `error_message`, `error_details`, `input_tokens`, `output_tokens`, `metadata`.

3. **`ai_agent_run_events`:**
   - Granular event timeline for every lifecycle transition.
   - Fields: `id`, `organization_id`, `workspace_id`, `run_id`, `attempt_id`, `event_type`, `payload` (JSON), `created_at`.
   - Event types: `run_created`, `run_queued`, `worker_claimed`, `run_started`, `model_invoked`, `model_responded`, `tool_executed`, `approval_requested`, `approval_approved`, `approval_rejected`, `run_resumed`, `run_completed`, `run_failed`, `run_cancelled`, `retry_scheduled`, `lease_recovered`.

4. **`ai_agent_approval_requests`:**
   - Persistent governance checkpoints for high-risk tools and capabilities.
   - Fields: `id`, `organization_id`, `workspace_id`, `run_id`, `attempt_id`, `action_name`, `action_type`, `action_payload` (JSON), `risk_level` (`low`, `medium`, `high`), `policy` (`always`, `risk_threshold`), `required_roles` (JSON array), `status` (`pending`, `approved`, `rejected`, `expired`), `requested_by` (FK `users.id`), `expires_at`, `created_at`, `updated_at`.

5. **`ai_agent_approval_decisions`:**
   - Immutable audit trail of human oversight decisions.
   - Fields: `id`, `organization_id`, `workspace_id`, `approval_request_id`, `decision` (`approved`, `rejected`), `reason` (`varchar(1000)`), `decided_by` (FK `users.id`), `decided_at`.

6. **`ai_agent_runtime_usage`:**
   - Detailed accounting records for token, compute, and latency metrics.
   - Fields: `id`, `organization_id`, `workspace_id`, `run_id`, `agent_id`, `provider`, `model`, `input_tokens`, `output_tokens`, `total_tokens`, `duration_ms`, `cost_micros`, `created_at`.

---

### 4. Queue Architecture & Worker Lease Engine

- **Queue Paradigm:** Durable MySQL transactional table queue using `SELECT ... FOR UPDATE SKIP LOCKED` or atomic update leases:
  ```sql
  UPDATE ai_agent_runs
  SET status = 'running',
      worker_id = :workerId,
      lease_token = :leaseToken,
      lease_expires_at = DATE_ADD(NOW(3), INTERVAL :leaseSeconds SECOND),
      attempt_count = attempt_count + 1,
      updated_at = NOW(3)
  WHERE id = :candidateRunId
    AND (status = 'queued' OR (status = 'running' AND lease_expires_at < NOW(3)))
  ```
- **Fencing Tokens:** Unique UUID lease token generated on every claim; subsequent step execution verifies lease ownership before persisting intermediate state.
- **Lease Expiration & Crash Recovery:** Heartbeat updates lease expiration. Stale uncompleted runs with expired leases are recovered during worker polling ticks into `queued` for retry or flagged as `failed` if `attempt_count >= max_attempts`.
- **Concurrency & Rate Limits:** Tenant-level bounded concurrency (max active runs per organization) prevents resource exhaustion.
- **Graceful Shutdown:** Process traps `SIGTERM`/`SIGINT`, drains active attempt step or releases un-started lease back to `queued`.

---

### 5. Provider Execution Layer & Safe Mocking

- **Interface Reuse:** Integrates directly with `AiProvider`, `AiProviderRegistry`, `ModelInvocationRequest`, `ModelInvocationResponse` from Epic 11.
- **Mock vs. Live Guardrails:**
  - `MockAiProvider`: Deterministic zero-cost simulated inference for tests, staging, and demo environments.
  - Live AI Provider: Instantiated only if valid server-side API keys exist in environment or vault. Never hallucinate provider keys.
  - Transparent Metadata: Every execution run records `provider`, `model`, and boolean `simulatedExecution` in output metadata.

---

### 6. Human Approval & Governance Engine

- **Policy Evaluation:** Assesses `humanApprovalPolicy` (`always`, `risk_threshold`, `never`) and declared tool/capability risk levels (`low`, `medium`, `high`).
- **Separation of Duties:** Requesters cannot self-approve high-risk actions when separation of duties is configured.
- **Re-Verification on Resume:** When an approval is granted, permissions and agent active status are re-checked immediately before transitioning the run back to `queued`/`running`.

---

### 7. Security, RBAC & Multi-Tenant Isolation

- **Default-Deny:** All endpoints require authenticated session and organization permission (`agent.read`, `agent.execute`, `agent.manage`).
- **Workspace Scoping:** Every run, attempt, event, and approval is constrained by `organization_id` AND `workspace_id`. Cross-tenant queries are blocked at the database repository query level.
- **Data Protection:** Redaction of all known secret keys (`apiKey`, `password`, `secret`, `token`) from input and output payloads before persistence and logging.

---

### 8. API Endpoints Specification

| Method | Path | Required Permission | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/organizations/:id/agents/:agentId/runs` | `agent.execute` | Create and enqueue an agent execution run |
| `GET` | `/api/v1/organizations/:id/agents/:agentId/runs` | `agent.read` | List runs for an agent (with pagination, status filters) |
| `GET` | `/api/v1/organizations/:id/agents/runs/:runId` | `agent.read` | Get run details, attempts, and latest output |
| `POST` | `/api/v1/organizations/:id/agents/runs/:runId/cancel` | `agent.execute` | Cancel an active or queued run |
| `POST` | `/api/v1/organizations/:id/agents/runs/:runId/retry` | `agent.execute` | Re-queue a failed run with new attempt |
| `GET` | `/api/v1/organizations/:id/agents/runs/:runId/events` | `agent.read` | Fetch chronological audit event stream |
| `GET` | `/api/v1/organizations/:id/agents/runs/:runId/usage` | `agent.read` | Fetch granular token/duration usage records |
| `GET` | `/api/v1/organizations/:id/agents/approvals` | `agent.read` | List pending approval requests for organization |
| `POST` | `/api/v1/organizations/:id/agents/approvals/:id/approve`| `agent.manage` | Approve a pending action request |
| `POST` | `/api/v1/organizations/:id/agents/approvals/:id/reject` | `agent.manage` | Reject a pending action request |
| `GET` | `/api/v1/organizations/:id/agents/runtime/monitoring` | `agent.read` | Aggregate queue depth, latency, tokens, error rates |
| `POST` | `/api/v1/organizations/:id/agents/runtime/worker/tick` | `agent.manage` | Worker dispatch trigger (queue processor tick) |

---

### 9. Frontend Architecture (@haza-aios/ui & apps/web)

- **Reusable Primitives (`packages/ui/src/components/agent-runtime-primitives.tsx`):**
  - `AgentRunStatusBadge`
  - `AgentExecutionTimeline`
  - `AgentRunMetricCard`
  - `AgentApprovalCard`
  - `AgentAttemptHistory`
  - `AgentExecutionResultViewer`
  - `AgentRuntimeEmptyState`
- **Application Views (`apps/web/src/pages/workspace/agents/runtime/`):**
  1. `AgentExecutionConsolePage.tsx`: Interactive prompt execution console, parameter overrides, live status polling, cancellation button, and structured output viewer.
  2. `AgentRunHistoryPage.tsx`: Searchable, filterable table of runs with date, duration, provider, status, and retry lineage.
  3. `AgentRunDetailsPage.tsx`: Deep-dive inspector displaying state timeline, attempt history, inputs/outputs, approval checkpoints, and raw event stream.
  4. `AgentApprovalInboxPage.tsx`: Operational desk for administrators to review, approve, or reject high-risk execution checkpoints.
  5. `AgentRuntimeMonitoringPage.tsx`: Operational dashboard charting total throughput, error rates, queue latency, and token consumption.

---

### 10. Implementation Plan & Phases

1. **Phase 1: Baseline Audit & Setup** (Current)
2. **Phase 2: Runtime Domain Types & Central State Transitions**
3. **Phase 3: Database Migration 0024 & Drizzle Schema Updates**
4. **Phase 4: Agent Runtime Repository & Storage Layer**
5. **Phase 5: Durable Queue Engine & Worker Lease Service**
6. **Phase 6: AI Provider Execution & Tool Call Pipeline**
7. **Phase 7: Human Approval Engine & Governance Checks**
8. **Phase 8: Security, Tenant Scoping & Secret Redaction**
9. **Phase 9: API Module & Route Registration**
10. **Phase 10: Frontend Primitives in `@haza-aios/ui`**
11. **Phase 11: Web Frontend Execution Pages in `apps/web`**
12. **Phase 12: Automated Integration & Unit Tests**
13. **Phase 13: Local Verification (Build, Typecheck, Test Suites)**
14. **Phase 14: GitHub Commit, Feature Branch Push, and PR Creation**
15. **Phase 15: Production Backup & Isolated Migration Rehearsal**
16. **Phase 16: PR Merge & Railway Production Deployment**
17. **Phase 17: Live Production Smoke Tests & Release Tag `v0.14.0-epic14`**
