## [0.21.0-epic21] - 2026-11-04

### Added
- **Epic 21 — Agent Operations Observability, Evaluation & Reliability:**
  - **Distributed Tracing & Context Propagation (`agent-observability.service.ts`):**
    - W3C distributed trace context propagation (`traceparent` format: `00-{traceId}-{spanId}-{flags}`).
    - Parent-child span hierarchy generation (`agent_trace_spans`) tracking agent runs, workflow steps, tool invocations, provider inferences, and autonomous tasks.
    - Deep secret redaction in spans, logs, and attributes automatically scrubbing API keys (`sk-...`), Bearer authentication headers, passwords, secrets, and database connection strings.
    - Non-blocking telemetry ingestion supporting asynchronous span recording and hierarchical trace waterfall assembly.
  - **Agent Evaluation Engine (`agent-evaluation.service.ts`):**
    - Versioned evaluation datasets and benchmark test cases (`agent_evaluation_datasets`, `agent_evaluation_cases`) with input prompts, required citations, expected tool calls, and output schemas.
    - Deterministic multi-dimensional rubric scoring across four dimensions: Context Grounding & Citation Accuracy (35%), Tool Selection & Argument Accuracy (25%), Structural & Schema Compliance (20%), and Safety & Policy Adherence (20%).
    - Automated evaluation runs (`agent_evaluation_runs`) with historical baseline comparisons and regression alert triggering when composite score drop exceeds 5% (`scoreDelta < -5%`).
  - **Reliability & SLO Engine (`agent-reliability.service.ts`):**
    - Configurable Service Level Objectives (`agent_slo_definitions`) defining target availability and latency thresholds across sliding evaluation windows (1h, 24h, 7d, 30d).
    - Latency percentile calculation (p50, p95, p99) and success rate metric rollups stored in `agent_reliability_metrics`.
    - Automated alert rules (`agent_alert_rules`) evaluating metrics against breach thresholds.
    - Incident management engine (`agent_incidents`) with intelligent deduplication by `incidentKey`/title, occurrence counters, severity tagging (`sev1`–`sev4`), and acknowledgement/resolution workflows.
  - **Cost & Performance Intelligence (`agent-cost.service.ts`):**
    - Multi-dimensional spending attribution (by organization, agent, model provider, and workflow run) utilizing existing Epic 18 `ai_usage_ledger` without table duplication.
    - Cost anomaly detection flagging runs exceeding average or configured budget thresholds.
  - **Database Migration 0031 (`0031_agent_observability_evaluation_reliability.sql`):**
    - Created 8 relational tables: `agent_trace_spans`, `agent_evaluation_datasets`, `agent_evaluation_cases`, `agent_evaluation_runs`, `agent_slo_definitions`, `agent_reliability_metrics`, `agent_alert_rules`, and `agent_incidents`.
  - **Operations Intelligence Console (`apps/web` & `@haza-aios/ui`):**
    - 6-view dark premium operations console at `/workspace/agents/observability` covering Operations Overview, Distributed Trace Explorer, Evaluation Center, Reliability & SLOs, Cost Intelligence, and Incidents & Alerts.
    - Reusable UI primitives: `TraceWaterfallViewer`, `SloHealthCard`, `EvaluationBenchmarkCard`, and `IncidentManagerTable`.
  - **18 REST API Endpoints:** Mounted under `/api/v1/organizations/:orgId/observability` with tenant RBAC protection.

### Verification
- 12/12 passing automated unit and integration tests in `apps/api/tests/epic21-observability-reliability.test.ts`.
- Schema verified with `npm run db:check -w apps/api` ("Everything's fine 🐶🔥").
- 0 TypeScript compiler errors across `apps/api` and `apps/web`.
- Zero live paid AI tokens consumed; deterministic rubrics and mock metrics evaluated in-process.

## [0.20.0-epic20] - 2026-11-04

### Added
- **Epic 20 — Advanced Autonomous Agents & Continuous Operations:**
  - **Autonomy Level Governance & Policy Engine (`autonomous-task.service.ts` & `autonomous.types.ts`):**
    - Organization-level autonomy policy with L0–L3 levels: L0 (Read-Only), L1 (Bounded Advisory), L2 (Supervised Execution), and L3 (Continuous Operations).
    - Hard limit enforcement per organization and task: maximum active tasks, concurrency caps, step limits, timeout durations, and daily token/cost caps.
    - Global emergency kill switch (`emergencyStopAll`) and individual task kill switch controls with audit reason tracking.
  - **Scheduling & Domain Event Trigger Engine (`autonomous-scheduler.service.ts`):**
    - Timezone-aware cron scheduling supporting standard 5-part cron expressions, interval specifications (`*/15 * * * *`), and macros (`@daily`, `@hourly`).
    - Missed schedule handling policies (`run_once`, `skip`, `run_all`).
    - Application domain event pattern matcher supporting wildcard expressions (`education.curriculum.*`, `*`).
    - Deterministic idempotency key calculation preventing duplicate executions within the same schedule window.
  - **Continuous Execution Engine & Worker Leasing (`worker.ts` & `autonomous-task.repository.ts`):**
    - Atomic background worker leasing with lease duration expiration and periodic heartbeats.
    - Automatic stale lease detection and crash recovery reclaiming dead worker leases and requeueing tasks up to `maxRetries`.
    - Durable state checkpointing across step transitions, graceful pauses, retry recoveries, and human sign-off gates.
    - Immutable append-only audit event stream recording all task lifecycle milestones.
  - **Adaptive Planning & Recovery Engine (`autonomous-recovery.service.ts`):**
    - Intelligent failure classification: transient / retryable (network errors, 429 rate limits, lock timeouts, deadlocks) versus terminal (permission denied, 401/403, missing required fields).
    - Bounded replanning validation ensuring adapted plans do not cause objective drift, add unapproved agents, or expand privileges.
    - Consequential state mutation gates halting L1/L2 autonomous tasks into `waiting_approval` status.
  - **Database Migration 0030 (`0030_autonomous_continuous_operations.sql`):**
    - Created 6 relational tables: `autonomous_task_policies`, `autonomous_task_definitions`, `autonomous_task_triggers`, `autonomous_task_runs`, `autonomous_task_checkpoints`, and `autonomous_task_events`.
  - **Continuous Operations Console (`apps/web`):**
    - 6-view dark premium operations console at `/workspace/agents/operations` covering Autonomous Tasks, Schedules & Triggers, Active Operations (live heartbeats and worker leases), Approvals & Exceptions, Execution History, and Policies & Limits.
    - Reusable UI primitives in `@haza-aios/ui`: `AutonomyBadge`, `OperationalStatusBadge`, `HeartbeatIndicator`, `TaskMetricCard`, and `ApprovalActionCard`.
  - **23 REST API Endpoints:** Mounted under `/api/v1/organizations/:orgId/autonomous-tasks` and `/autonomous-task-runs` with tenant RBAC protection.

### Verification
- 22/22 passing automated unit and integration tests in `apps/api/tests/epic20-autonomous-operations.test.ts`.
- Schema verified with `npm run db:check -w apps/api` ("Everything's fine 🐶🔥").
- 0 TypeScript compiler errors across `apps/api` and `apps/web`.
- All autonomous tasks run via deterministic mock inference with zero paid AI token consumption.

## [0.19.0-epic19] - 2026-11-03

### Added
- **Epic 19 — Multi-Agent Collaboration & Orchestration:**
  - **Agent Team Roster & Specialization (`AgentTeamService` & `AgentTeamRepository`):**
    - Organization-scoped agent teams with support for four distinct functional roles: `planner`, `specialist`, `reviewer`, and `supervisor`.
    - Capability tags, execution priorities, and tenant-isolated membership configurations.
  - **DAG Workflow Definition Engine (`orchestration-validation.ts`):**
    - Versioned workflow definitions supporting sequential, parallel (split-merge), and supervisor-worker patterns.
    - Kahn's topological sort algorithm for dependency graph resolution and cycle detection.
    - Missing dependency, self-referencing step, and team role coverage validation.
  - **Durable Orchestration Coordinator (`AgentOrchestrationService` & `AgentWorkflowRepository`):**
    - Hierarchical execution coordinator traversing the DAG, resolving runnable steps, and dispatching tasks through the existing durable `AgentRuntimeService`.
    - Shared context engine propagating upstream outputs into downstream step prompts via structured `upstreamOutputs` envelopes with prompt injection protection.
    - Structured artifact engine recording immutable `AgentWorkflowArtifactRecord` entries with step provenance and citations.
  - **Human-in-the-Loop Approval Gates:**
    - Consequential action pause gates (`requiresApproval: true`) transitioning runs into `waiting_approval` status.
    - Decision handler (`approveStepRun`) with resume on `approved` and fail-closed termination on `rejected`.
  - **Database Migration 0029 (`0029_multi_agent_orchestration.sql`):**
    - Created 8 relational tables: `agent_teams`, `agent_team_members`, `agent_workflow_definitions`, `agent_workflow_steps`, `agent_workflow_runs`, `agent_workflow_step_runs`, `agent_workflow_artifacts`, and `agent_workflow_events`.
  - **Multi-Agent Orchestration Console (`apps/web`):**
    - 5-screen interactive console at `/workspace/agents/orchestration` covering Agent Teams, DAG Visual Workflow Builder, Execution Monitor, Human Approval Queue, and Artifacts & Provenance.
  - **14 REST API Endpoints:** Mounted under `/api/v1/organizations/:orgId/` for team, workflow, execution run, event, and human approval management.

### Verification
- 13/13 passing automated unit and integration tests in `apps/api/tests/epic19-orchestration.test.ts`.
- Schema verified with `npm run db:check -w apps/api` ("Everything's fine 🐶🔥").
- 0 TypeScript compiler errors across `apps/api` and `apps/web`.
- Grade 6 Science "Cells and Living Systems" unit plan demonstrator scenario validated end-to-end.

## [0.18.0-epic18] - 2026-11-02

### Added
- **Epic 18 — Live AI Provider Integration & Production Agent Intelligence:**
  - **Unified AI Provider Gateway (`UnifiedAiProviderGateway`):** Centralized orchestration layer for AI model inference and embedding operations with automatic provider routing, circuit breaking (5 failures threshold, 60s cool-off), and secret redaction.
  - **Enterprise Credential Vault & Redaction Engine:** Multi-tenant credential storage with masked client exposure (`sk-...xxxx`). Automatic deep redaction scrubs secrets from logs, error messages, and URL parameters.
  - **Zero-Cost Reachability Probing:** Live API reachability validation via provider model catalog probes (`GET https://api.openai.com/v1/models`) without consuming inference tokens or incurring cost.
  - **Tenant Model Allowlists & Governance:** Configurable model permissions per organization, rejecting unapproved model requests with HTTP 403 `MODEL_FORBIDDEN`.
  - **Fail-Closed Budget & Hard Limit Enforcement:** Daily and monthly spending caps (USD) with real-time spend tracking and HTTP 429 `BUDGET_EXCEEDED` halt.
  - **Streaming & Cancellation Protocol:** Real-time Server-Sent Events (SSE) streaming with word and token deltas, tool-call chunk aggregation, and instant client cancellation via `AbortSignal`.
  - **Vector Dimension Mismatch Protection:** Strict dimensionality and provider validation in `HybridSearchService` preventing cross-dimension vector comparisons.
  - **Database Migration 0028 (`0028_live_ai_provider_integration.sql`):** Created 5 tables: `ai_provider_tenant_configs`, `ai_provider_audit_logs`, `ai_model_pricing_catalog`, `ai_usage_budgets`, and `ai_usage_ledger`.
  - **Provider Administration UI (`apps/web`):** Built 4-tab management dashboard at `/workspace/agents/providers` covering Gateway Configuration, Model Catalog & Allowlists, Spending Limits & Budgets, and Usage Telemetry & Ledger.

### Verification
- 52 automated test suites passing with 409 tests in `apps/api`.
- 17 dedicated gateway integration tests in `epic18-provider-gateway.test.ts`.
- 0 TypeScript compiler errors across `apps/api` and `apps/web`.
- Schema verified with Drizzle Kit check.

## [0.17.0-epic17] - 2026-11-01

### Added
- **Epic 17 — Agent Knowledge & Context Engine:** multi-tenant collections, document extraction (TXT/Markdown/HTML/PDF/DOCX), heading-aware chunking and SHA-256 content hashes.
- Provider-neutral embeddings with OpenAI `text-embedding-3-small` adapter and explicitly labeled deterministic fallback.
- Hybrid lexical/vector retrieval, source context and citation validation, trusted `knowledge.search` tool, Academic Planning Assistant knowledge integration and five-tab knowledge workspace.
- Migration `0027_agent_knowledge_context_engine.sql`, reported six production knowledge tables.

### Verification
- PR [#53](https://github.com/HAZA-AIOS/haza-aios/pull/53) merged; annotated release tag `v0.17.0-epic17` points to `ede2e06ce8dcd71bef5d5ba692bf138ddc9904a9`.
- Release report: 386 API + 292 Web = 678 automated tests passing; migration rehearsal 37 DDL statements; 8/8 production smoke steps.
- **Limitations:** the smoke transcript does not establish live semantic embedding inference, an upload-to-cited-answer end-to-end demonstration or deletion propagation. Deterministic mock vectors are not proof of semantic retrieval.

## [0.16.0-epic16] - 2026-10-30

### Added
- **Epic 16: Agent Tools & Organizational Data Integration — Full Production Release**
  - **Database Migration 0026 (`0026_agent_tools_and_organizational_data.sql`):**
    - Created `ai_agent_tools` table storing production tool definitions: `id`, `tool_key`, `name`, `description`, `category`, `industry`, `risk_level` (enum: `low`, `medium`, `high`), `execution_mode` (enum: `sync`, `async`), `required_permissions` (JSON), `approval_policy` (enum: `none`, `always`, `on_risk`, `tenant_configured`), `timeout_ms`, `max_attempts`, `status` (enum: `draft`, `active`, `deprecated`, `disabled`), `created_at`, `updated_at`.
    - Created `ai_agent_tool_versions` table for semver versioning: `id`, `tool_id`, `version`, `input_schema` (JSON), `output_schema` (JSON), `deprecated`, `changelog`, `created_at`.
    - Created `ai_agent_tool_tenant_policies` table for sovereign tenant governance: `id`, `organization_id`, `workspace_id`, `tool_id`, `enabled`, `approval_policy_override`, `custom_rate_limit_per_minute`, `allowed_agent_ids` (JSON), `created_at`, `updated_at`.
    - Created `ai_agent_tool_executions` table for end-to-end execution telemetry & audit: `id`, `organization_id`, `workspace_id`, `run_id`, `attempt_id`, `agent_id`, `configuration_revision_id`, `tool_id`, `tool_version`, `tool_key`, `requested_by`, `input_digest` (SHA-256), `input_snapshot` (JSON), `output_snapshot` (JSON), `status` (enum: `pending_approval`, `running`, `completed`, `failed`, `cancelled`), `approval_request_id`, `started_at`, `completed_at`, `duration_ms`, `error_category`, `error_message`, `correlation_id`, `idempotency_key`, `metadata` (JSON), `created_at`.
    - Added foreign key constraints with `ON DELETE CASCADE` and `ON DELETE RESTRICT` for referential integrity across organizations, workspaces, runs, and tool definitions.
    - Added composite indexes on tenant scoping, run linkage, tool key lookups, and execution status.
  - **Trusted Tool Registry & Domain Adapters (`apps/api/src/modules/agents/tools`):**
    - Registered 7 production-grade Education tools connecting to `SisService` and `AcademicLessonPlanRepository`:
      1. `education.academic_structure.read`: Retrieves active academic years, grade levels, and sections for organizational planning context.
      2. `education.subjects.list`: Lists authorized subjects for a given grade level or workspace.
      3. `education.curriculum.read`: Queries curriculum benchmarks with strict pedagogical honesty (`general_guidance` fallback when disconnected).
      4. `education.lesson_plans.read`: Retrieves existing lesson plans to maintain instructional progression without duplication.
      5. `education.lesson_plans.create_draft`: Creates an editable lesson plan draft adhering to the 17-point schema.
      6. `education.lesson_plans.update_draft`: Modifies draft lesson plans prior to review and approval.
      7. `education.lesson_plans.publish`: Publishes approved lesson plans directly to the active LMS course stream (high-risk, gated by mandatory human approval).
  - **Tool Execution Gateway (`AgentToolGatewayService`):**
    - Enforced the 16-step secure execution pipeline: run resolution, tenant ownership, pinned revision check, agent tool allowlisting, semver compatibility, tenant policy enablement, caller RBAC verification, workspace resource scoping, JSON schema validation, SHA-256 input digest calculation, risk & approval gating, trusted adapter dispatch, output sanitization (zero student PII), persistence in `ai_agent_tool_executions`, and structured canonical return.
    - Exported canonical hashing, validation, and JSON normalization utilities.
  - **Autonomous Tool Calling Runtime Integration (`AgentRuntimeService`, AI Providers):**
    - Extended `AgentRuntimeService` with an autonomous multi-step tool execution loop (up to 5 iterations).
    - Updated `OpenAiProvider` with native tool function declarations and model tool call parsing.
    - Updated `MockAiProvider` to autonomously simulate tool call requests and handle subsequent model completion with tool result contexts.
    - Integrated with Epic 14 Human Approval Engine: high-risk operations pause execution and require explicit teacher authorization.
  - **Tool Management REST APIs (`apps/api/src/modules/agents`):**
    - Added 6 authenticated management endpoints: `GET /tools`, `GET /tools/:toolId/versions`, `GET/PUT /tools/policies`, `GET /tools/monitoring`, `GET /tools/executions`, and `GET /tools/executions/:executionId`.
  - **Frontend Primitives (`packages/ui`):**
    - Implemented 10 reusable dark enterprise primitives in `@haza-aios/ui`: `AgentToolCard`, `AgentToolStatusBadge`, `AgentToolRiskBadge`, `ToolSchemaViewer`, `ToolPermissionMatrix`, `ToolExecutionTimeline`, `ToolApprovalSummary`, `ToolUsageMetricCard`, `ToolPolicyEditor`, `ToolExecutionResultViewer`.
  - **Frontend Web Dashboard (`apps/web`):**
    - Built comprehensive 4-tab Tool Management dashboard at `/workspace/agents/tools` ("Tool Catalog", "Execution History", "Tenant Policies", "Telemetry & Metrics").
    - Added routes for `/workspace/agents/tools/executions` and `/workspace/agents/tools/policies`.
  - **Verification & Testing Suites:**
    - `agent-tool-gateway.test.ts`: 15 comprehensive unit tests covering schema validation, input digestion, default deny, RBAC authorization, and approval checkpoints.
    - `epic16-agent-tools.integration.test.ts`: End-to-end integration test verifying tool discovery, multi-step execution loop, draft lesson plan creation, and execution audit logging.
    - `tools.test.tsx`: Component tests verifying UI catalog rendering and policy tabs.

## [0.15.0-epic15] - 2026-10-30

### Added
- **Epic 15: First Production AI Agent — HAZA Academic Planning Assistant — Full Production Release**
  - **Database Migration 0025 (`0025_academic_lesson_plans.sql`):**
    - Created `academic_lesson_plans` table storing human-supervised educational lesson plans with columns: `id`, `organization_id`, `workspace_id`, `agent_run_id`, `title`, `grade`, `subject`, `topic`, `duration_minutes`, `learning_objectives` (JSON), `content` (JSON 17-point structured plan), `status` (enum: `draft`, `reviewed`, `approved`, `published`, `archived`), `curriculum_reference`, `curriculum_verified`, `created_by`, `approved_by`, `approved_at`, `created_at`, `updated_at`.
    - Added foreign key constraints to `organizations`, `workspaces`, `ai_agent_runs`, and `users` (both creator and approver) with appropriate `CASCADE`, `SET NULL`, and `RESTRICT` delete policies.
    - Added composite and single-column indexes on `(organization_id, workspace_id)`, `(organization_id, status)`, `created_by`, and `agent_run_id`.
  - **Academic Planning Assistant Agent Definition & Validation (`apps/api/src/modules/agents`):**
    - Registered official system template `00000000-0000-4100-8000-000000000104` with slug `academic-planning-assistant` under Education industry and Academic Planning category.
    - Implemented strict input validation with duration bounds (15-240m), length constraints, curriculum reference checking, and safe prompt injection sanitization.
    - Implemented 17-point structured JSON schema parsing and repair validation: `lessonTitle`, `grade`, `subject`, `topic`, `durationMinutes`, `learningObjectives`, `requiredMaterials`, `priorKnowledge`, `lessonIntroduction`, `teachingSequence`, `guidedPractice`, `independentActivities`, `differentiation`, `formativeAssessment`, `exitTicket`, `teacherNotes`, `optionalHomework`.
    - Implemented version-controlled system prompt with strict educational boundaries, zero student profiling, zero unverified curriculum claims, and mandatory draft status.
  - **AI Provider & Dedicated Worker Architecture (`apps/api`):**
    - Enhanced `OpenAiProvider` with secure server-side credentials check, dynamic model routing, timeout/cancellation handling, exponential retry classification, and structured schema generation.
    - Maintained deterministic `MockAiProvider` for automated testing and transparent mock/live attribution.
    - Implemented standalone unattended worker daemon (`apps/api/src/worker.ts`) with durable MySQL lease fencing, atomic claims, heartbeat maintenance, graceful SIGINT/SIGTERM shutdown, and integrated HTTP health check endpoint on `$PORT`.
    - Added `start:worker` and `dev:worker` npm scripts to enable 24/7 background queue processing.
  - **Academic Lesson Plan Repository & API Endpoints (`apps/api`):**
    - `AcademicLessonPlanRepository`: Full persistence lifecycle including draft creation, content merging updates, teacher approval with audit recording, LMS publication, and status-based pagination.
    - 7 new secure endpoints under `/api/v1/organizations/:organizationId/agents/academic-planning`: `/status`, `/generate`, `/lesson-plans`, `/lesson-plans/:id`, `/lesson-plans/:id/draft`, `/lesson-plans/:id/approve`, `/lesson-plans/:id/publish`, and `/lesson-plans/:id/export` (streaming Markdown and JSON downloads).
  - **Frontend Shared Primitives (`packages/ui`):**
    - Implemented dark enterprise UI primitives in `@haza-aios/ui/components/academic-planning-primitives.tsx`: `CurriculumVerificationBadge`, `LessonPlanStatusBadge`, `AcademicPlanningRequestCard`, `LessonPlanViewer` (17-point collapsible accordion sections), `LessonPlanEditor`.
  - **Frontend Academic Assistant Workspace (`apps/web`):**
    - `AcademicPlanningService`: Complete API client with generation polling, draft editing, approval, and browser download triggers.
    - `AcademicPlanningAssistantPage.tsx`: Dense dual-tab teacher workspace ("Generate & Plan" and "Lesson Plan Archive & Drafts") featuring live worker execution telemetry, inline drafting, teacher review & approval flow, LMS publishing, and direct Markdown/JSON export.
    - `AcademicOverviewPage.tsx`: Direct entrypoint card connecting Education → Academics → AI Academic Planning Assistant.
    - Routes registered in `apps/web/src/App.tsx`: `/workspace/education/academic/assistant` and `/workspace/education/academic/lesson-plans`.
  - **Automated Quality Evaluation & Integration Test Suites:**
    - `academic-planning-evaluation.test.ts`: 14 evaluation benchmarks assessing structure completeness, prompt injection defense, edge-case durations, curriculum attribution labeling, and JSON repair.
    - `epic15-first-production-ai-agent.integration.test.ts`: Full end-to-end integration lifecycle test executing agent generation, worker run processing, draft update, approval, LMS publication, and Markdown export against live database.

## [0.14.0-epic14] - 2026-10-29

### Added
- **Epic 14: AI Agent Runtime & Execution Engine — Full Production Release**
  - **Database Migration 0024 (`0024_agent_runtime_execution_engine.sql`):**
    - Extended MySQL enum column `agent_run_status` on `ai_agent_runs` to support comprehensive lifecycle states: `queued`, `running`, `waiting`, `awaiting_approval`, `completed`, `failed`, `cancelled`, `rejected`.
    - Added lease fencing, concurrency, worker allocation, token tracking, and cancellation attribution columns to `ai_agent_runs`: `priority`, `execution_mode`, `worker_id`, `lease_token`, `lease_expires_at`, `attempt_count`, `total_input_tokens`, `total_output_tokens`, `total_cost_micros`, `cancellation_reason`, `cancelled_by`, `cancelled_at`.
    - Created `ai_agent_run_attempts` table tracking attempt lineage, worker leases, duration ms, and error classification.
    - Created `ai_agent_run_events` table persisting detailed timeline events (`run_created`, `run_queued`, `worker_claimed`, `run_started`, `model_invoked`, `model_responded`, `approval_requested`, `approval_approved`, `approval_rejected`, `run_resumed`, `run_cancelled`, `run_completed`, `run_failed`).
    - Created `ai_agent_approval_requests` and `ai_agent_approval_decisions` tables for human-in-the-loop authorization with policy parameters, expiration, and separation of duties enforcement.
    - Created `ai_agent_runtime_usage` table for per-invocation token and micro-cost accounting across providers and models.
    - Added high-performance indexes on tenant, agent, run, status, priority, and lease expiration timestamps.
  - **Backend Runtime Execution Architecture & Services (`apps/api/src/modules/agents`):**
    - `AgentRuntimeRepository`: Complete persistence engine managing durable run claims with UUID lease fencing, attempt tracking, event timeline emission, human approval resolution, usage logging, and real-time monitoring aggregation.
    - `AgentRuntimeService`: Robust execution orchestration handling run creation with revision snapshot pinning, inline & background worker execution, state machine validation, cancel, manual retry, separation of duties policy enforcement, and operational metrics calculation.
    - `ApiRouter`: Enhanced route registration ordering static segments before parameterized segments (`:param`), completely eliminating route shadowing.
    - 14 authenticated REST API endpoints registered under `/api/v1/organizations/:organizationId/agents/*` (`/runs`, `/runs/:runId`, `/runs/:runId/cancel`, `/runs/:runId/retry`, `/runs/:runId/events`, `/runs/:runId/attempts`, `/runs/:runId/usage`, `/approvals`, `/approvals/:approvalId`, `/approvals/:approvalId/approve`, `/approvals/:approvalId/reject`, `/runtime/monitoring`, `/runtime/worker/tick`).
  - **Frontend Shared Primitives (`packages/ui`):**
    - Implemented enterprise UI primitives in `@haza-aios/ui/components/agent-runtime-primitives.tsx`: `AgentRunStatusBadge`, `AgentExecutionTimeline`, `AgentRunMetricCard`, `AgentApprovalCard`, `AgentAttemptHistory`, `AgentExecutionResultViewer`, `AgentRuntimeEmptyState`.
  - **Frontend Runtime Suite & Views (`apps/web`):**
    - `AgentRuntimeService`: Fully typed client library covering all runtime API endpoints.
    - 5 dedicated runtime views:
      1. `AgentExecutionConsolePage.tsx`: Agent header, dual text/JSON input modes, execution trigger, active run status, live output viewer, and timeline.
      2. `AgentRunHistoryPage.tsx`: Status filters, execution mode, attempts, duration, tokens, timestamps, cancel/retry actions.
      3. `AgentRunDetailsPage.tsx`: Granular telemetry view with metric tiles, input/output inspection, attempt history, timeline, and usage cost breakdown.
      4. `AgentApprovalInboxPage.tsx`: Human-in-the-loop authorization desk with risk badges, payload inspector, reason capture, and separation of duties alert banner preventing self-approval.
      5. `AgentRuntimeMonitoringPage.tsx`: Live telemetry dashboard tracking queue depth, active running concurrency, approval backlog, 24h success rate, average latency, token volume, cost, and manual worker dispatch.
    - Registered routes in `apps/web/src/App.tsx`:
      - `/workspace/agents/:id/execute` & `/workspace/agents/:id/run`
      - `/workspace/agents/:id/runs` & `/workspace/agents/:id/history`
      - `/workspace/agents/runs`
      - `/workspace/agents/runs/:runId`
      - `/workspace/agents/approvals`
      - `/workspace/agents/runtime/monitoring` & `/workspace/agents/monitoring`

## [0.13.0-epic13] - 2026-10-29

### Added
- **Epic 13: AI Agent Configuration & Builder — Full Production Release**
  - **Database Migration 0023 (`0023_agent_configuration_builder.sql`):**
    - Extended `ai_agent_definitions` with `active_revision_number` (int, default 1) and `active_revision_id` (char(36), foreign key to active configuration snapshot).
    - Created `ai_agent_configuration_revisions` table with immutable snapshot fields, audit attribution (`created_by`, `published_by`, `published_at`), validation status, changelog, and unique constraint on `(agent_id, revision_number)`.
    - Added automated, idempotent SQL backfill migrating existing agent definitions to Revision 1 baseline.
    - Verified with clean isolated rehearsal on Railway MySQL (`haza_epic13_rehearsal`).
  - **Backend Builder Architecture & Services (`apps/api/src/modules/agents`):**
    - `AgentBuilderRepository`: Complete persistence engine managing draft/published revisions, auto-incrementing revision numbers, audit events, and atomic transactions.
    - `AgentBuilderValidation`: Comprehensive server-side rules engine validating identity format/length, provider and model context limits, temperature/token boundaries, high-risk capability approval requirements, secret scanning (blocking credential leakage), and tenant knowledge source isolation.
    - `AgentBuilderService`: Full multi-tenant lifecycle service providing catalog options, new custom agent creation, draft saving, publishing with version promotion, agent duplication, semantic revision diffing, rollback/restore to draft, and safe mock preview simulation via `MockAiProvider` (guaranteeing zero external AI charges).
    - 12 new authenticated REST API endpoints registered under `/api/v1/organizations/:organizationId/agents/builder/*`.
  - **Frontend 10-Section Visual Builder (`apps/web` & `@haza-aios/ui`):**
    - Dense dark enterprise UI primitives in `@haza-aios/ui/components/agent-builder-primitives.tsx`: `BuilderContainer`, `BuilderSidebar`, `BuilderNavItem`, `BuilderHeaderBar`, `ModelParameterSliders`, `InstructionTextarea`, `CapabilityCard`, `ToolDeclarationCard`, `ApprovalPolicySelector`, `ValidationSummaryAlert`, `MockPreviewConsole`, `RevisionHistoryList`.
    - 10-Section Builder View (`AgentBuilderSections.tsx` & `AgentBuilderPage.tsx`):
      1. Identity & Persona (name, key, description, category, tags, avatar).
      2. Model & Settings (provider selection, model tier, temperature, token limits, timeouts).
      3. Structured Instructions (role, objectives, boundary constraints, behavioral rules, prohibited actions, escalation protocols).
      4. Capabilities (system-level capabilities, danger levels, approval requirements).
      5. Tools & Permissions (utility declarations, permission mappings, risk tiers).
      6. Knowledge Grounding (tenant knowledge base attachments, retrieval controls).
      7. Human Approval & Governance (policy selector, threshold triggers, approver roles, escalation timeout).
      8. Real-Time Validation Console (detailed section error and warning breakdown).
      9. Safe Mock Preview Sandbox (interactive simulation testing without AI provider cost).
      10. Version History & Diff Viewer (chronological audit log, side-by-side semantic diff comparison modal, one-click rollback/restore).
    - Direct builder entry points added to `AgentDetailsPage` ("Visual Builder" button) and `WorkspaceDiscoverPage` ("Build Custom Agent" banner).
  - **Production Deployment & Verification:**
    - GitHub PR: `#48` (Merged into `main` at commit `60c3ac2`).
    - Fresh pre-release production logical backup: `haza-aios-production-stage20-backup_20261029_112341.sql` (247,856 bytes, SHA-256: `7053471C28B5919DBA0F8BCBF56C384CB936E11D40BB25FB0C76B21930F10EE3`).
    - Isolated migration rehearsal on Railway MySQL (`haza_epic13_rehearsal`): 100% verified all 13 migration statements, column additions, and foreign-key/unique constraints.
    - Railway API deployment: `Online` at `https://api.haza-aios.com`.
    - Railway Web deployment: `Online` at `https://www.haza-aios.com`.
    - Quality gates: 43/43 API test suites (335 tests) passed (100%), 50/50 Web test suites (289 tests) passed (100%).
    - Live production smoke tests: 17/17 end-to-end tests passed (100%) covering landing page, API readiness, auth resolution, catalog options, new agent creation, context loading, validation rules, secret blocking, mock preview, publishing v1.0.0, draft v1.1.0, publishing v1.1.0, history, visual diffing, rollback/restore, duplication, and cross-tenant security isolation.

## [0.12.0-epic12] - 2026-10-28

### Added
- **Epic 12: AI Agent Registry & Marketplace — Full Production Release**
  - **Database Migration 0022 (`0022_agent_registry_marketplace.sql`):**
    - Extended `ai_agent_templates` with publisher metadata (`publisher_type`, `publisher_organization_id`, `publisher_user_id`), distribution controls (`visibility`, `publishing_status`), summary, semver tracking (`latest_version`, `min_platform_version`), and review tracking (`review_notes`, `reviewed_by`, `reviewed_at`, `published_at`).
    - Created `ai_agent_template_versions` table for immutable semantic version history with unique constraint `(template_id, version)`, schemas, permissions, changelog, and review metadata.
    - Extended `ai_agent_definitions` with installation provenance tracking (`installed_version`, `template_version_id`, `installed_from_marketplace`).
    - Created `ai_agent_installations` table tracking multi-tenant runtime instance installations, upgrades, and safe uninstalls.
    - Applied cleanly to production MySQL via Railway pre-deploy hook.
  - **Marketplace Backend API (`apps/api/src/modules/marketplace`):**
    - Catalog Discovery: Paginated search and filtering (`GET /organizations/:id/marketplace/catalog`) with tenant isolation and visibility scoping (`platform`, `private_organization`, `approved_shared`).
    - Profile & Versioning: Detailed agent profile lookup (`GET /organizations/:id/marketplace/agents/:id`), version resolution, and explicit semver validation.
    - Safe Installation & Upgrades: Idempotent installation (`POST /organizations/:id/marketplace/install`), installed agent discovery (`GET /organizations/:id/marketplace/installed`), explicit version upgrades (`POST /organizations/:id/marketplace/installed/:id/upgrade`), and decommission safeguards (`POST /organizations/:id/marketplace/installed/:id/uninstall`).
    - Publisher Workspace: Authoring dashboard (`GET/POST /organizations/:id/marketplace/publisher/templates`), version authoring (`POST .../versions`), and submission for platform review (`POST .../submit`).
    - Platform Governance: Dedicated administrative review desk (`GET /platform/marketplace/reviews`), review decision state machine (`POST .../decision` supporting `under_review`, `approved`, `published`, `rejected`, `deprecated`, `withdrawn`) guarded by `platform.admin` authorization.
    - Aggregate Analytics: Real-time marketplace aggregates (`GET /organizations/:id/marketplace/analytics`, `GET /platform/marketplace/analytics`) computing published agent counts, installations, active instances, industry breakdowns, and version adoption.
  - **Frontend Marketplace Experience (`apps/web` & `@haza-aios/ui`):**
    - Reusable UI primitives: `PublishingStatusBadge`, `VersionBadge`, `PublisherBadge`, `UpgradeNoticeBadge`, `MarketplaceMetricCard`, `CapabilityTagList`.
    - Discover Page (`WorkspaceDiscoverPage`): Enhanced catalog discovery with real-time API binding, badges, and install modal integration.
    - Agent Profile Page (`MarketplaceAgentProfilePage`): Comprehensive profile view with overview, capabilities, requirements, version history table, compatibility, and install/upgrade workflows.
    - Installation Modal (`MarketplaceInstallModal`): Version selector, instance custom naming, capability review, and policy configuration.
    - Installed Agents Desk (`InstalledAgentsPage`): Version status tracking, update available badges, upgrade modal, and safe decommission safeguards.
    - Publisher Workspace (`PublisherWorkspacePage`): Listing authoring, version management, submission workflow, and review feedback monitoring.
    - Platform Review Desk (`MarketplaceReviewPage`): Administrative governance desk with aggregate metrics, pending submissions list, and review decision modals.
  - **Production Deployment & Verification:**
    - GitHub PR: `#47` (Merged into `main` at `ba043a76b0e3212f2e2f778179b2e26df48b182d`).
    - Fresh pre-release production logical backup: `haza-aios-production-stage20-backup_20261028_133901.sql` (230,408 bytes, SHA-256: `C854FAAF2DB6C42B0F4B102A95F0FCD97125090FAB44ED1147F980452A4020AD`).
    - Isolated rehearsal on local MySQL (`haza_epic12_rehearsal`): Migration 0022 applied with idempotency verified, 220 FK checks and 7 tenant checks passed (0 failures), 8/8 integration test workflows passed.
    - Railway API deployment ID: `556d7de2-f080-4e34-b557-f52709a3bca1` (SUCCESS).
    - Railway Web deployment ID: `3bbd4282-9ef1-4c09-b028-11adfc7868da` (SUCCESS).
    - Live production smoke tests: 31/31 end-to-end tests passed (100%) on `api.haza-aios.com` and `www.haza-aios.com`.

## [0.11.0-epic11] - 2026-10-28

### Added
- **Epic 11: AI Agent Platform Foundation & Full Production Release**
  - **Domain Model & Migration 0021 (`0021_agent_platform_foundation.sql`):** Added explicit `suspended` lifecycle state to `ai_agent_templates` and `ai_agent_definitions`, and added `default_approval_policy` and `human_approval_policy` JSON contracts for governance and oversight. Applied cleanly via Railway pre-deploy hook.
  - **AI Provider Abstraction Layer:** Implemented provider-neutral contracts (`AiProvider`, `AiModel`, `ModelInvocationRequest`, `ModelInvocationResponse`, `AiUsageMetadata`), deterministic `MockAiProvider` with cancellation/timeout enforcement, and `AiProviderRegistry` singleton.
  - **Security, Validation & Governance:** Server-side credential redaction (`redactSensitiveConfig`), prerequisite validation before agent activation (`validateActivationPrerequisites`), default-deny capability authorization (`assertCapabilityPermitted`), and human approval policy validation.
  - **Agent Management API:** Tenant-isolated endpoints for listing templates and agents with pagination and filtering, reading details, updating configurations with credential redaction, updating lifecycle status (draft, active, suspended, paused, disabled, archived), fetching audit history, and querying available AI providers.
  - **Frontend Workspace & Shared UI Primitives:** Updated `@haza-aios/ui` with enhanced `AgentStatus`, `HumanApprovalBadge`, `AgentAuditTimeline`, and `AgentEmptyState`. Added search, filter, and lifecycle management to `WorkspaceActiveAgentsPage` and comprehensive overview, model configuration, approval policy, and audit trail tabs to `AgentDetailsPage`.
  - **Production Deployment & Verification:**
    - Railway API deployment `622020af-fc78-4265-bba1-aae1ae6a0329` (SUCCESS).
    - Railway Web deployment `31475ae2-e2d9-40b7-bb10-5354e3e1e3ad` (SUCCESS).
    - Fresh pre-release production logical backup `haza-aios-production-stage20-backup_20261028_092552.sql` (228,157 bytes, SHA-256: `F74ED0459165DAB26595EEDF3061B813E907732589D3DFAE06DFBE6112E8E534`).
    - Isolated rehearsal on MySQL 8.4 (`haza_epic11_rehearsal`): Migration 0021 applied with idempotency verified, 207 FK checks and 7 tenant checks passed (0 failures).
    - Full test suite: 91 test files, 621/621 tests passed (100%).
    - Live production smoke tests: 17/17 end-to-end tests passed on `api.haza-aios.com` and `www.haza-aios.com`.

## [0.10.14-epic10n] - 2026-10-27

### Added
- **Epic 10N: Enterprise System Hardening & Full Production Release**
  - **Security Hardening (SEC-001 – SEC-005):** Strict authenticated actor context derived from server session, multi-tier login rate limiting (IP abuse and per-account failed attempts), HTTP security headers (CSP, Permissions-Policy, X-Frame-Options, X-Content-Type-Options), and configurable proxy trust resolution (`trustProxy`).
  - **Transactional Integrity (TX-001 – TX-003):** Atomic transaction boundaries across SIS student lifecycle, admissions conversion, grade/section enrollments, student transfers, examination results publishing, and fee billing generation.
  - **Database Migrations 0019 & 0020:** Unique tenant identifiers for portal update requests (`0019`) and deduplicated JSON identifier backfill (`0020`), verified with 207 foreign-key and 7 tenant-isolation checks.
  - **Pagination & Completeness (PAG-001 – PAG-003):** Strict pagination validation, bounds checking, and truthful total-count metadata across all SIS endpoints.
  - **Frontend UX Robustness (UX-001 – UX-002):** Double-submission safeguards (`useAsyncSubmission`) across admissions, examinations, and fee collection forms, along with consolidated attendance route handling.
  - **Railway Production Infrastructure:** Pre-deploy migration execution via Railway hooks, container network binding to `0.0.0.0:$PORT` with `allowedHosts: true`, and live health/readiness monitoring.

## [Unreleased]

### Added


- **DB-18: Backup and Recovery Hardening**
  - Added guarded disposable MySQL backup/restore rehearsal and read-only foreign-key and tenant integrity checks.
  - Documented production backup prerequisites and incident recovery decisions; no production backup or restore was executed.

- **DB-17: Usage, Metering & SaaS Billing Persistence**
  - Added tenant-scoped immutable usage facts for terminal agent and workflow runs, with idempotency and summary APIs.
  - Added an unseeded SaaS plan catalog, billing accounts, subscriptions, and statements without charging or payment integration.
  - Added Owner/Admin usage and billing read permissions and disposable-MySQL integration coverage.

- **DB-16: Audit, Events, Notifications & Operational Persistence**
  - Added immutable tenant-scoped audit logs, domain events, and operational diagnostics with correlation and sanitization.
  - Extended DB-8 notifications and delivery attempts with event linkage, durable user state, expiry, and safe provider metadata.
  - Added organization-scoped audit/event APIs, user-scoped notification APIs, and DB-4 permission integration.
  - Integrated workflow task assignments, workflow transitions, and failed workflow/agent runs with transactional operational records.
  - Replaced the admin audit page's static source with persisted organization audit data and added disposable-MySQL integration coverage.

- **DB-15: Workflow, Tasks & Orchestration Persistence**
  - Added tenant-scoped MySQL persistence for workflow definitions, immutable step revisions, runs, step outcomes, and human tasks.
  - Added optimistic revision checks, immutable run snapshots, idempotent starts, lifecycle concurrency protection, and workflow RBAC permissions.
  - Replaced workflow localStorage persistence with authenticated API operations while retaining the existing workspace design.
  - Added validation, unit coverage, and disposable-database integration coverage for tenant isolation and durable orchestration state.

- Added authenticated multi-organization self-service from the workspace organization switcher, allowing one user identity to create, own, and switch between multiple organizations.

- Added a public HAZA product-family showcase that clearly separates HAZA-AIOS, HAZA-ME, and the standalone live HAZA-SMS application.
- Added centered, icon-led section headings across the public landing page and a secure external link to the HAZA-SMS website.
- Aligned account and organization registration layouts with the public landing page's charcoal and coral visual language.

### Fixed

- Prevented existing organization members from being redirected to organization creation during the brief post-login membership-loading transition.
- Allowed explicitly configured frontend aliases in API CORS so both the root and `www` production domains can authenticate safely.

- **Epic 13: Agent Configuration & Builder**
  - Implemented `AgentConfiguration` schema on `AgentInstance`.
  - Created low-code `AgentBuilderPage` at `/workspace/agents/:id/configure`.
  - Added modular builder sections: General, Instructions, Behavior, Inputs, Outputs, Tools, Model & Memory.
  - Added configuration preview and draft state tracking.
  - Implemented `updateConfiguration` in `AgentService`.
  - Added reusable `agent-builder-primitives` to `@haza-aios/ui`.

- **Epic 12: AI Agent Registry & Marketplace**
  - Created the Agent Marketplace UI foundation at `/workspace/agents`.
  - Implemented discoverable global `AgentTemplate` registry.
  - Implemented Search, Category Navigation, and Industry/Status filters.
  - Added dedicated `/workspace/agents/active` page for managing instantiated agents.
  - Added `AgentDetailsPage` handling both Template inspection and Instance configuration paths.
  - Created reusable UI primitives (`AgentSearch`, `AgentFilters`, `AgentCategoryNav`).

- **Epic 11: AI Agent Platform Foundation**
  - Established generic agent domain models (`AgentTemplate`, `AgentInstance`, `AgentRun`, `Tool`, `Capability`).
  - Implemented `AgentRegistry` for module-agnostic agent discovery and capabilities advertisement.
  - Implemented `AgentService` enforcing organization-isolated agent instantiation and configurations.
  - Added reusable `AgentCard` and `AgentStatus` UI primitives to `@haza-aios/ui`.
  - Added Workspace Agent Management views at `/workspace/agents`.

## [0.8.0-alpha.1] - 2026-08-12

### Added

- Dynamic Industry & Platform Modules framework featuring contract specification (`module.types.ts`), centralized discovery registry (`module-registry.ts`), and tenant-isolated runtime manager (`module-runtime.ts`).
- Platform Module Registry directory page at `/admin/modules` allowing super-admins to inspect all registered platform and industry module contracts, specifications, routes, and permissions.
- Interactive `ModuleCard` and `ModuleDetailsDialog` UI primitives in `@haza-aios/ui` for rendering module capabilities, metadata, navigation manifests, and write-access gated activation toggles.
- Dynamic sidebar navigation integration in `AppShell` automatically injecting active tenant module links into the workspace navigation rail.
- Demo analytics module (`demo-module`) illustrating dynamic client routing, sub-navigation, and configuration options.
- Industry Modules Architecture specification (`docs/architecture/industry-modules.md`).
- Vitest suite for module registry discovery, tenant activation toggling, and multi-tenant isolation.

## [0.7.0-alpha.1] - 2026-08-12

### Added

- Organization Workspace module under protected `/workspace/*` routes, gated by active organization session checks (`WorkspaceGuard`).
- Adapted AppShell sidebar navigation to display organization-specific overview, members, modules, and settings.
- Adapted AppShell top utility header to display organization name, type, industry, status badge, and initial logo.
- Workspace Overview page at `/workspace` showing logo avatar, type/industry/status details, KPI stats (members, active modules count), activity logs, and quick actions.
- Workspace Members page at `/workspace/members` showing member table (with role badges, joined date), search filter, role filters, and dialogs for Invite, Role Change, and Remove Member.
- Workspace Modules page at `/workspace/modules` listing 5 modules (SIS, HR, Financials, AI Workspace, Patient EHR) with toggle switch controls to activate/deactivate modules.
- Workspace Settings page at `/workspace/settings` providing settings form (Name, Legal Name, Description, Website, Contact Info, Localization, Timezone, Currency) and role-based permissions warning.
- Scoped multi-tenant local storage state management (`workspace-service.ts`) using `organizationId` keys for memberships, logs, and modules activation.
- Role boundaries separating Owner (full control), Admin (limited members/settings control), and Member (read-only view).
- Unit tests verifying memberships CRUD, module toggle activation, tenant isolation, and page rendering (13 tests passing).
- Organization Workspace architecture documentation (`docs/architecture/organization-workspace.md`).

## [0.6.0-alpha.1] - 2026-08-12

### Added

- Platform Administration module with super-admin route protection (`AdminGuard`).
- Platform role model (`super_admin`, `support_agent`, `viewer`) and `usePlatformRole()` / `useIsSuperAdmin()` hooks.
- Mock platform admin service with comprehensive sample data (7 organizations, 11 users, 12 audit entries, 6 services).
- Admin Overview page at `/admin` with platform KPI stat cards, system health monitor grid, and recent audit activity feed.
- Admin Organizations page at `/admin/organizations` with searchable data table, status badges, and suspend/activate actions with confirmation dialog.
- Admin Users page at `/admin/users` with searchable data table, platform role badges, avatar initials, and deactivate/activate actions.
- Admin Audit Log page at `/admin/audit-log` with action type filters (Create, Update, Delete, Login, System) and timestamp-sorted entries.
- Admin System Health page at `/admin/system-health` with summary stats, per-service health cards showing latency/uptime/status, and visual health progress bars.
- Reusable admin UI primitives in `packages/ui`: `DataTable`, `AdminStatCard`, `StatusBadge`, `AdminPageHeader`, `ConfirmDialog`.
- AppShell admin-mode sidebar with context-aware navigation, admin mode badge, and "Back to Dashboard" / "Admin Panel" links.
- Platform administration architecture documentation (`docs/architecture/platform-admin.md`).

## [0.5.0-alpha.1] - 2026-08-12

### Added

- Compact premium Sidebar navigation with data-driven routing, active state highlighting, hover expansions, and collapsed states.
- Reusable top utility Header bar featuring breadcrumbs, notification center with indicator badges, profile dropdown, and organization switcher dropdown.
- Authenticated Dashboard route at `/dashboard` protected by Auth routing gates.
- Reusable presenter components in `packages/ui`: `DashboardCard`, `StatCard` with SVG sparklines, and `AIAssistantWidget`.
- SVG Donut Chart representing distribution of system load, and SVG Bar Chart representing hourly AI Ops activity.
- Floating AI Assistant box foundation at the bottom center.
- Dashboard architecture documentation (`docs/architecture/dashboard.md`).
- Robust Vitest suite checking layout rendering, telemetry metrics, and sidebar functionality.

## [0.4.0-alpha.1] - 2026-08-11

### Added

- Multi-tenant organization data model foundations (`org.types.ts`).
- Organization membership model with role declarations (`Owner`, `Admin`, `Member`).
- Organization context state provider (`OrgProvider.tsx`) and `useOrganization()` hook.
- Standard organization form validation rules and interactive slug generation/deduplication checks.
- Authenticated Organization Registration flow screen at `/organization/create`.
- Reusable UI select dropdown inputs for industries and organization types in `packages/ui`.
- Comprehensive Vitest unit tests for validation, slug generation, service layers, and page renders.
- Tenancy architecture reference document (`docs/architecture/organizations.md`).

## [0.3.0-alpha.1] - 2026-08-11

### Added

- Complete authentication and identity foundation (Epic 3)
- `AuthProvider` React context with `useAuth()` and `useCurrentUser()` hooks
- Centralized authentication state (`loading | authenticated | unauthenticated | error`)
- Mock auth service adapter (`auth-service.ts`) implementing the full `AuthService` interface
- Client-side form validation utilities (`auth-validation.ts`)
- Session persistence with `localStorage` (remember-me) and `sessionStorage` (session-only)
- Automatic session expiry detection and cleanup
- `ProtectedRoute` and `PublicOnlyRoute` route guard components
- Public routes: `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`
- Login page with email, password, and remember-me fields
- Registration page with name, email, password, and strength indicator
- Forgot Password page with email field and submission confirmation
- Reset Password page with new password, confirmation, and token validation
- Email Verification page with status display and navigation
- Protected application placeholder at `/app` for future dashboard epics
- `AuthLayout` reusable layout primitive in `packages/ui` (router-agnostic, slot-based)
- `AuthCard` glass card component in `packages/ui`
- `AuthAlert` accessible alert component (`error | success | info`) in `packages/ui`
- `AuthLoading` spinner component in `packages/ui`
- `FormField` accessible label/field/error wrapper in `packages/ui`
- `PasswordField` with show/hide toggle in `packages/ui`
- `PasswordStrength` 5-bar visual indicator with `aria-live` in `packages/ui`
- `ApiClient` class with base URL, auth token injection, 401 handling, and `ApiError`
- Vitest test suite with jsdom environment
- Tests: auth validation, auth storage, mock auth service, `AuthProvider` hooks, route protection

### Architecture

- Authentication is fully isolated from organization and business logic
- Clean layered boundary: UI → AuthProvider → Auth Service → API Client → Backend
- Identity model (`User`, `AuthSession`) separated from profile; `Organization` and `OrganizationMembership` types stubbed for future epics
- All reusable auth UI primitives placed in `packages/ui`; app-specific shell in `apps/web`
- Backend API can be connected by swapping the mock adapter with a real `AuthService` implementation — no UI layer changes required

### Documentation

- Added `docs/architecture/authentication.md` covering architecture, identity model, session model, route protection, security boundaries, and backend connection guide

### Not Implemented (Future Epics)

- Organization registration (next relevant Epic)
- Organization dashboard
- Role/permission enforcement UI
- Platform administration
- Education / SIS modules
- AI Agent Framework

## [0.2.0-alpha.1] - 2026-08-09

### Added

- HAZA AIOS design tokens and shared styling foundation
- Typography and responsive type utilities
- Semantic color palette and gradient system
- Shared form controls, cards, navigation patterns, and badge primitives
- Extended Button variants for HAZA AIOS product styling
- Shared design system preview for component validation
- Design system documentation and development guidance

### Changed

- Centralized visual tokens in the `@haza-aios/ui` package
- Updated the web app to consume shared design system styles and primitives
- Standardized spacing, radius, shadow, and surface treatments

### Architecture

- Preserved monorepo structure and app/package separation
- Kept reusable UI in `packages/ui` and page logic in `apps/web`
- Maintained shadcn/ui patterns and Tailwind + Vite workflow

### Infrastructure

- Confirmed the front-end toolchain passes typecheck, lint, formatting, and production build validation
- Docker remains documented as blocked by host virtualization limits

## [0.1.0-alpha.1] - 2026-08-09

### Added

- HAZA AIOS monorepo foundation
- React/Vite frontend foundation
- Tailwind CSS integration
- shadcn/ui shared component architecture
- Shared `@haza-aios/ui` package
- Frontend application architecture
- TypeScript strict configuration
- ESLint and Prettier tooling
- Frontend environment configuration
- React error boundary
- Frontend testing foundation
- Developer documentation

### Architecture

- Established `apps/web` application workspace
- Established reusable `packages/ui` component library
- Established application/shared-component separation
- Established frontend development quality gates

### Infrastructure

- Docker milestone documented as blocked because host virtualization is unavailable
- Local React/Vite development remains operational
