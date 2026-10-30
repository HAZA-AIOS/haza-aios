# HAZA-AIOS — EPIC 16 IMPLEMENTATION PLAN
## Agent Tools & Organizational Data Integration

**Target Release:** v0.16.0-epic16  
**Baseline:** v0.15.0-epic15 (commit `b585f07`)  
**Branch:** `feature/epic-16-agent-tools-org-data`  
**Status:** Completed (Implementation, Automated Testing, and Build Verification 100% Passed)  

---

## 1. Executive Summary & Mission
Epic 16 introduces **Agent Tools & Organizational Data Integration** to HAZA-AIOS. This capability allows autonomous and human-supervised AI agents to discover, authorize, and invoke explicitly allowlisted, versioned tools that interact with real organizational data through existing application domain services.

The primary production integration targets the **Education Academics/LMS** domain, enabling the **HAZA Academic Planning Assistant** (Epic 15) to dynamically discover authorized academic structures, classes, and subjects, query existing lesson plans and curriculum benchmarks, and generate, update, or publish lesson plans through safe, audited domain service APIs.

### Strict Architectural Boundaries:
1. **No Direct SQL Execution:** AI agents are never given SQL access or database connections. All interactions go through trusted, server-side TypeScript domain adapters.
2. **No Unrestricted Network Access:** Tools execute pre-defined internal domain adapters or strictly allowlisted endpoints. Arbitrary outbound HTTP and shell executions are prohibited.
3. **No Implicit Administrative Permissions:** The agent's permissions are the strict *intersection* of tenant activation policies, agent configuration revisions, and the initiating user's RBAC permissions.
4. **Human Approval Gates for High-Risk Writes:** Mutating organizational data (such as publishing a lesson plan to the active LMS) requires explicit human approval bound to exact arguments, preventing unauthorized execution.
5. **No Invented Curriculum Standards:** When a tenant lacks connected curriculum standards, tools return explicit `not_connected` / `unavailable` status rather than hallucinating external alignments.

---

## 2. Baseline Architecture Audit & Reuse Points

### 2.1 Existing Platform Components Reused:
- **Epic 11 (Agent Platform Foundation):** Agent definitions, templates, configuration revisions, and provider registry.
- **Epic 12 (Marketplace):** Agent catalog, versioning, installation, and tenant governance.
- **Epic 13 (Agent Builder):** Visual builder, parameter schemas, and assignment models (`ai_agent_tool_assignments`).
- **Epic 14 (Durable Runtime & Approvals):**
  - Durable job polling, atomic claims, lease fencing, worker heartbeats, and background daemon (`apps/api/src/worker.ts`).
  - Separation of duties approval engine (`ai_agent_approval_requests`, `ai_agent_approval_decisions`).
  - Event streams (`ai_agent_run_events`) and attempt tracking (`ai_agent_run_attempts`).
- **Epic 15 (Academic Planning Assistant):**
  - 17-point structured JSON lesson-plan schema.
  - Draft repository (`AcademicLessonPlanRepository` in `apps/api/src/modules/agents/repositories/academic-lesson-plan.repository.ts`).
  - Draft editing, pedagogical review approval, and LMS publishing workflows.
- **Education Domain Services:**
  - `SisService` (`apps/api/src/modules/education/sis.service.ts`): provides `listAcademicYears`, `listGradeLevels`, `listSubjects`, and `getClassSubjects`.
  - Tables: `academic_years`, `grade_levels`, `sections`, `subjects`, `class_subjects`, `academic_lesson_plans`.

### 2.2 Gaps Identified & To Be Built in Epic 16:
1. **Tool Registry & Versioning:** Standalone tool definitions with semver versioning, schemas, risk levels, and timeout/retry bounds (`ai_agent_tools`, `ai_agent_tool_versions`).
2. **Tenant Tool Policies:** Explicit tenant-level activation, approval overrides, and agent restrictions (`ai_agent_tool_tenant_policies`).
3. **Tool Execution Gateway:** Central secure gateway that authenticates the run, verifies RBAC and tenant policies, validates JSON schemas, manages rate limits, triggers human approvals, executes domain adapters, and records execution logs (`ai_agent_tool_executions`).
4. **Multi-Step Agent Runtime Loop:** Extending `AgentRuntimeService` and `MockAiProvider`/`OpenAiProvider` to support cyclical tool calling (`agent run -> model tool_calls -> gateway execution -> tool response messages -> model final response`).
5. **Education Domain Adapters:** Four read tools and three controlled write tools connecting to `SisService` and `AcademicLessonPlanRepository`.
6. **Tool Management UI:** Web interface for browsing tools, inspecting schemas, configuring tenant policies, and reviewing execution telemetry.
7. **Shared UI Components:** Production-grade primitives in `@haza-aios/ui`.

---

## 3. Tool Domain Model

Every tool is uniquely identified and strictly versioned.

```typescript
export type ToolRiskLevel = "low" | "medium" | "high";
export type ToolExecutionMode = "sync" | "async";
export type ToolApprovalPolicy = "none" | "always" | "on_risk" | "tenant_configured";
export type ToolStatus = "draft" | "active" | "deprecated" | "disabled";

export interface ToolDefinition {
  toolId: string;
  toolKey: string;
  name: string;
  description: string;
  category: "academic_structure" | "curriculum" | "lesson_planning" | "system";
  industry: "education" | "cross_industry";
  version: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  executionMode: ToolExecutionMode;
  riskLevel: ToolRiskLevel;
  requiredPermissions: string[];
  supportedScopes: Array<"organization" | "workspace">;
  approvalPolicy: ToolApprovalPolicy;
  timeoutMs: number;
  maxAttempts: number;
  enabled: boolean;
  deprecated: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 4. Database Persistence: Migration 0026

Additive migration `0026_agent_tools_and_organizational_data.sql` introduces:
1. `ai_agent_tools`: Registry of available tools, metadata, permissions, and risk levels.
2. `ai_agent_tool_versions`: Immutable schema definitions per semver release.
3. `ai_agent_tool_tenant_policies`: Per-organization and workspace enablement and approval policies.
4. `ai_agent_tool_executions`: Comprehensive audit logs of tool invocations, inputs, outputs, latencies, and errors.

---

## 5. Trusted Education Domain Adapters

### 5.1 Read-Only Adapters
1. **`education.academic_structure.read`**
   - Retrieves active academic years, grade levels, and sections for the authorized workspace.
   - Enforces `workspace.read` or `education.academic.read`.
2. **`education.subjects.list`**
   - Retrieves available subjects and grade-subject mappings.
   - Enforces `workspace.read` or `education.academic.read`.
3. **`education.curriculum.read`**
   - Checks if verified curriculum standards are configured for the workspace.
   - If not connected, returns `{ connected: false, message: "Curriculum repository not connected for this workspace." }`.
4. **`education.lesson_plans.read`**
   - Retrieves existing lesson plans filtered by grade, subject, and status.
   - Enforces teacher and workspace boundaries.

### 5.2 Controlled Write Adapters
1. **`education.lesson_plans.create_draft`**
   - Creates an editable lesson plan in `draft` status via `AcademicLessonPlanRepository`.
   - Idempotency key prevents duplicate drafts on network retries.
2. **`education.lesson_plans.update_draft`**
   - Updates draft content, preserving revision history. Rejects updates if already `published`.
3. **`education.lesson_plans.publish`**
   - High-risk operation: transitions an `approved` lesson plan to `published`.
   - Requires explicit human approval if triggered autonomously by an agent.

---

## 6. Execution Gateway & Runtime Integration

### Tool Call Lifecycle
```
[Agent Run Scheduled]
       │
       ▼
[Model Invocation] ──(Emits tool_calls)──► [AgentToolGateway]
                                                  │
                ┌─────────────────────────────────┴─────────────────────────────────┐
                ▼                                                                   ▼
       [Security & Policy Gate]                                           [Input Validation]
   - Verify Run & Tenant Scope                                          - Check JSON Schema
   - Verify Agent Assignment                                            - Sanitize Inputs
   - Verify Tenant Policy (Enabled)                                     - Check Rate Limits
   - Verify Requester RBAC Permissions
                │
                ▼
       [Approval Check]
   - If High Risk or Policy=always:
     Queue `ai_agent_approval_requests`
     Pause Run (status: awaiting_approval)
                │
                ▼ (Approved or Low Risk)
       [Domain Adapter Execution]
   - Invoke trusted TypeScript adapter (SisService, etc.)
   - Enforce timeouts (AbortSignal)
   - Apply result sanitization & minimization
                │
                ▼
       [Audit & Telemetry Persistence]
   - Write to `ai_agent_tool_executions`
   - Record run event `tool_executed`
                │
                ▼
       [Continuation Loop]
   - Return tool result message (`role: tool`)
   - Re-invoke Model for final synthesis or next step
   - Enforce max steps limit (Default: 5)
```

---

## 7. Security Model & RBAC

1. **Deny-by-Default:** Tools are inactive until explicitly enabled in tenant policy and assigned to an agent revision.
2. **Effective Permissions:** Computed as:
   $$\text{Permission} = \text{Tenant Policy} \cap \text{Agent Assignment} \cap \text{User RBAC} \cap \text{Resource Scope}$$
3. **Immutability of Approvals:** Once an approval request is created, modifying input parameters generates a different `inputDigest`, invalidating any cached approval decision.
4. **Zero Student PII Access:** Education tools only touch curricular structures and lesson plans. Student profiles, attendance records, medical notes, and grades remain strictly inaccessible to AI agents.

---

## 8. User Interface & Routes

### Web Application Routes:
- `/workspace/agents/tools`: Catalog of installed and available tools.
- `/workspace/agents/tools/:toolId`: Deep inspection of tool metadata, input/output schemas, and permissions.
- `/workspace/agents/tools/executions`: Real-time audit log of tool executions with filters for status, agent, and latency.
- `/workspace/agents/tools/policies`: Organization administrator policy configuration panel.

### UI Primitives (`@haza-aios/ui`):
- `AgentToolCard`
- `AgentToolStatusBadge`
- `AgentToolRiskBadge`
- `ToolSchemaViewer`
- `ToolPermissionMatrix`
- `ToolExecutionTimeline`
- `ToolApprovalSummary`
- `ToolUsageMetricCard`
- `ToolPolicyEditor`
- `ToolExecutionResultViewer`

---

## 9. Quality Gates & Release Procedure

### Phase Gates:
1. **Migration 0026 Creation & Rehearsal:** Applied to local DB and isolated rehearsal schema on Railway MySQL 9.
2. **Comprehensive Test Suite:**
   - Gateway security tests (denial, cross-tenant isolation, prompt injection, invalid schemas).
   - Domain adapter unit tests.
   - End-to-end integration test (`epic16-agent-tools.integration.test.ts`).
   - All existing 640 API and Web tests must pass with 0 regressions.
3. **Documentation:** Implementation plan, architecture specs, security guidelines, and changelog updates.
4. **Git Workflow:** PR from `feature/epic-16-agent-tools-org-data` to `main`, squash merge.
5. **Production Release:** Verified production backup, isolated schema rehearsal, deployment on Railway (`api`, `web`, `worker`), live smoke testing, and release tag `v0.16.0-epic16`.
