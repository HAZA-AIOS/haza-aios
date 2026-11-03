# HAZA-AIOS — EPIC 19 SECURITY & GOVERNANCE MATRIX
## Threat Analysis, Isolation Boundaries & Human Approval Controls

**Document ID:** `HAZA-EPIC-19-SEC-001`  
**Target Release:** `v0.19.0-epic19`  
**Status:** `VERIFIED`  
**Author:** Antigravity AI Systems Architect  
**Date:** 2026-11-03  

---

## 1. Security Architecture & Threat Model

Multi-agent systems introduce complex security boundaries: unauthorized task dispatch, cross-tenant data leaks, recursive loops / denial of service, prompt injection across agents, and unreviewed execution of consequential actions.

HAZA-AIOS enforces five non-negotiable security controls:

| Security Threat | Threat Vector | Defense Mechanism | Implementation Status |
|---|---|---|---|
| **Cross-Tenant Escalation** | Agent in Tenant A queries or runs workflow in Tenant B | Strict SQL tenant filtering on every query (`eq(organizationId, orgId)`). Zero cross-tenant repository methods. | **VERIFIED** |
| **Infinite Recursion / Resource Drain** | Malformed workflow causes infinite loops or uncontrolled agent spawning | Kahn's algorithm cycle detection at creation time; max retries (2) and step timeout (300s) limits. | **VERIFIED** |
| **Agent Prompt Injection** | Upstream step output contains adversarial prompt commands that hijack downstream agent | Upstream outputs are sanitized and isolated inside structured `upstreamOutputs` JSON blocks rather than interpolated directly into system instructions. | **VERIFIED** |
| **Unsupervised Consequential Action** | Agent publishes unreviewed curriculum or modifies live database state | Mandatory Human-in-the-Loop (`requiresApproval = true`) pause gate; execution cannot proceed without explicit reviewer signature. | **VERIFIED** |
| **Privilege Escalation via Team Roles** | Low-privilege user configures agent with administrative tools | Step execution inherits exact initiator user credentials and tenant-level tool authorization policies. | **VERIFIED** |

---

## 2. RBAC Permission Mapping

Orchestration endpoints are guarded by existing platform permissions:

| Endpoint Path | Method | Permission Key | Required Role |
|---|---|---|---|
| `/api/v1/organizations/:orgId/agent-teams` | GET | `agent.read` | Viewer, Member, Admin, Owner |
| `/api/v1/organizations/:orgId/agent-teams` | POST | `agent.manage` | Admin, Owner |
| `/api/v1/organizations/:orgId/agent-teams/:teamId` | PATCH, DELETE | `agent.manage` | Admin, Owner |
| `/api/v1/organizations/:orgId/agent-workflows` | GET | `agent.read` | Viewer, Member, Admin, Owner |
| `/api/v1/organizations/:orgId/agent-workflows` | POST | `agent.manage` | Admin, Owner |
| `/api/v1/organizations/:orgId/agent-workflows/:wfId/runs` | POST | `agent.manage` | Coordinator, Teacher, Admin, Owner |
| `/api/v1/organizations/:orgId/agent-workflow-runs/:runId` | GET | `agent.read` | Viewer, Member, Admin, Owner |
| `/api/v1/organizations/:orgId/agent-workflow-runs/:runId/cancel` | POST | `agent.manage` | Initiator, Admin, Owner |
| `/api/v1/organizations/:orgId/agent-workflow-runs/:runId/steps/:stepKey/approval` | POST | `agent.manage` | Authorized Reviewer, Admin, Owner |

---

## 3. Human Approval Gate Verification

Consequential actions (such as LMS curriculum publication, live student record modifications, or budget authorizations) must specify `requiresApproval: true`.

When reached:
1. Step transitions to `waiting_approval`.
2. Workflow run transitions to `waiting_approval`.
3. Event `approval_requested` is recorded in audit ledger.
4. Downstream steps are blocked from dispatch.
5. If reviewer selects **Reject**:
   - Step is marked `failed`.
   - Workflow run is marked `failed` (Fail-Closed).
   - Rejection feedback is preserved in audit ledger.
6. If reviewer selects **Approve**:
   - Step is marked `completed`.
   - Workflow run resumes execution.
   - Downstream dependent steps are immediately dispatched.

