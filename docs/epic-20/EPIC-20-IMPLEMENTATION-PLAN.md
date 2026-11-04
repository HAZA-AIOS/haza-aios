# HAZA-AIOS — EPIC 20 IMPLEMENTATION PLAN
## Advanced Autonomous Agents & Continuous Operations

**Epic:** Epic 20 — Advanced Autonomous Agents & Continuous Operations  
**Baseline:** `v0.19.0-epic19`  
**Target Release:** `v0.20.0-epic20`  
**Git Branch:** `feature/epic-20-autonomous-continuous-operations`  
**Deployment Platform:** Railway Production (API, Web, Worker, MySQL)

---

## 1. Executive Summary & Purpose

Epic 20 builds an enterprise-grade Autonomous Task & Continuous Operations Platform in HAZA-AIOS that enables AI agents and multi-agent workflow DAGs to run autonomously according to time schedules, application event triggers, and continuous execution policies, with strict human-in-the-loop oversight, fail-closed security, and automatic crash recovery.

Key Architectural Guarantees:
1. **Zero Competing Runtimes:** Reuses the existing `AgentRuntimeService` and `AgentOrchestrationService`.
2. **Autonomy Guardrails (L0–L3):** Explicit levels of autonomy preventing unapproved consequential actions or prompt injection drift.
3. **Fail-Closed Lease Architecture:** Distributed locking and worker leasing prevent duplicate execution during container restarts.
4. **Adaptive Recovery:** Differentiates retryable transient errors from terminal failures and supports bounded replanning with permission revalidation.
5. **Comprehensive Operator Console:** 6 dedicated operational views within the dark premium dashboard.

---

## 2. Phase Breakdown

### Phase 20A: Autonomous Task Foundation
- Data schema for `autonomous_task_definitions` and `autonomous_task_policies`.
- Domain types (`autonomy_level`: L0, L1, L2, L3; `task_status`: draft, active, paused, disabled, archived).
- Execution policies (limits on runtime, retries, concurrency, tokens, cost).
- Approval policies (approval on mutations, approval on replanning).
- Emergency stop and pause controls.

### Phase 20B: Scheduling and Event Triggers
- Data schema for `autonomous_task_triggers`.
- Timezone-aware cron scheduling and one-time execution timestamps.
- Application event subscriptions (e.g. `academic.lesson_plan.submitted`).
- Deduplication keys (`idempotency_key = <task_id>:<timestamp_or_event_id>`).
- Missed schedule handling policies (`run_once`, `skip`, `run_all`).
- Rate limits and concurrency bounds.

### Phase 20C: Continuous Execution Engine
- Data schema for `autonomous_task_runs`, `autonomous_task_checkpoints`, and `autonomous_task_events`.
- Integration with dedicated background `Worker` service (`apps/api/src/worker.ts`).
- Worker leasing protocol (`worker_id`, `leased_at`, `lease_expires_at`, `heartbeat_at`).
- Automatic crash recovery for abandoned or expired worker leases.
- Graceful shutdown handlers flushing checkpoints upon SIGTERM/SIGINT.

### Phase 20D: Adaptive Planning & Controlled Recovery
- Failure classification: retryable (network, timeout, rate limit) vs terminal (auth, schema, policy).
- Bounded replanning engine: allows agent teams to adapt steps while strictly preserving original objectives and user intent.
- No privilege expansion: adapted plans cannot invoke tools or agents outside the task definition scope.
- Renewal of human approval when an adapted plan introduces or changes consequential actions.
- Compensation action execution for rolling back partial changes.

### Phase 20E: Continuous Operations Console
- 6-tab unified operational cockpit in `@haza-aios/ui`:
  1. *Autonomous Tasks:* Task definitions, autonomy badges, quick pause/resume/kill switches.
  2. *Schedules & Triggers:* Recurring cron timers, event subscriptions, next execution countdown.
  3. *Active Operations:* Live worker leases, active steps, heartbeats, real-time duration.
  4. *Approvals & Exceptions:* Human approval queue with plan diffs, error stack inspect.
  5. *Execution History:* Historical runs, token consumption, timeline inspection.
  6. *Policies & Limits:* Global concurrency settings, organization budget caps, emergency freeze.

### Phase 20F: Acceptance Testing & Production Readiness
- Integration test suite in `apps/api/tests/epic20-autonomous-operations.test.ts`.
- Verification against Demo Academy tenant.
- Deterministic mock providers (zero paid AI tokens in CI).
- Isolated migration rehearsal and production deployment rehearsal.

---

## 3. Database Migration Architecture

Migration **0030_autonomous_continuous_operations.sql**:
- `autonomous_task_policies`
- `autonomous_task_definitions`
- `autonomous_task_triggers`
- `autonomous_task_runs`
- `autonomous_task_checkpoints`
- `autonomous_task_events`

All constraint names strictly under 50 characters to comply with MySQL 64-character limit.
Index coverage optimized for organization scoping, status queries, and lease polling.
