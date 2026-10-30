# HAZA-AIOS — EPIC 16
## Tool Security, Human Approvals & Data Governance

### 1. Security Principles

1. **Default Deny (Zero Trust):**
   - By default, an AI agent has zero tools available.
   - Marketplace installation does not implicitly grant tool access.
   - Every tool must be explicitly listed in the agent's pinned configuration revision (`toolsAllowlist`).
   - Every tool must be enabled in the organization's tool policy (`ai_agent_tool_tenant_policies`).
   - The executing user must possess the necessary domain permissions in their active session.

2. **No Direct Database Access:**
   - AI agents are never given raw SQL query access, connection pooling handles, or database credentials.
   - All database operations are wrapped in strongly typed domain adapters using existing application services (`SisService`, `AcademicLessonPlanRepository`).

3. **No Arbitrary Network or Shell Execution:**
   - The platform strictly forbids dynamic command execution (`eval`, `child_process.exec`, bash/cmd shells).
   - Domain adapters are bound to internal in-process function calls.

---

### 2. Risk Classification Framework

| Risk Level | Description | Example Operation | Approval Policy Default |
|:---|:---|:---|:---|
| **Low** | Read-only operations retrieving sanitized structural or pedagogical data. Zero state mutation. | Read academic structures, list subjects, query curriculum benchmarks. | `none` |
| **Medium** | Reversible, non-public state mutations (e.g., drafts, sandbox data). | Create draft lesson plan, update draft lesson plan. | `none` (or `tenant_configured`) |
| **High** | Material state mutations, public publishing, or irreversible actions affecting live educational environments. | Publish lesson plan to live LMS, assign homework to active student rosters. | `always` |

---

### 3. Human Approval Gate & Separation of Duties

High-risk operations (such as publishing a lesson plan to the active LMS) trigger the human approval workflow before execution:

1. **Approval Request Creation:**
   - When an agent invokes a high-risk tool (`education.lesson_plans.publish`), the Gateway halts execution.
   - An approval request record is created in `ai_agent_approval_requests` with a deterministic input snapshot and SHA-256 digest.
   - The tool execution record is marked `pending_approval`.
   - The agent run yields control or pauses until an authorized human decides on the request.

2. **Separation of Duties (SoD):**
   - The initiating user / agent requester cannot approve their own high-risk mutations if strict SoD is enforced.
   - Approvals require authorized roles (e.g., Lead Teacher, Department Head, School Administrator) with explicit `education.lesson_plan.publish` permissions.

3. **Cryptographic Binding:**
   - Approval requests bind to the exact normalized argument hash (`inputDigest`).
   - Any tampering or modification of parameters between approval request and execution results in an immediate hash mismatch rejection (`DIGEST_MISMATCH`).

4. **Timeouts and Expirations:**
   - Approval requests have an automated expiration window (default: 48 hours). Expired requests are automatically cancelled to prevent stale executions.

---

### 4. Zero Student PII Guarantee

- Education tool definitions and schemas strictly prohibit student identifiers (`studentId`, `admissionNumber`, `nationalId`), student records, grades, attendance histories, or contact details.
- Tools only expose academic structure (`academicYear`, `gradeLevel`, `subject`), curriculum standards, and pedagogical plan documents.
- Output adapters sanitize all returned objects through field projection, ensuring no personal identifiable information is ingested by LLM context windows.
