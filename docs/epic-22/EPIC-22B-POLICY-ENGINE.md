# HAZA-AIOS — Epic 22B Specification & Implementation Guide
## Enterprise Policy & Permission Engine

**Epic:** Agent Governance & Security  
**Phase:** 22B  
**Branch:** `feature/epic-22-agent-governance-security`  
**Baseline Release:** `v0.21.0-epic21`  
**Target Release:** `v0.22.0-epic22`  

---

## 1. Executive Summary

Phase 22B extends the Phase 22A Enterprise Governance Foundation by delivering a deterministic, tenant-aware policy evaluation and authorization engine. It enforces policy constraints across agent execution, tool invocations, and autonomous tasks while providing safe rollout controls and simulation tooling.

Key capabilities delivered:
1. **Deterministic 5-Level Precedence Engine:** Mandatory Platform Security > Explicit Deny > Require Approval > Allow > Default Fallback (fail-closed).
2. **Context-Aware Permission Resolution:** Validates tenant boundaries, agent governance profile constraints, human ownership state (rejecting orphaned agents), and autonomy level limits.
3. **Safe Rollout Operational Modes:** Per-organization configuration for `DISABLED`, `MONITOR` (default), and `ENFORCE` modes.
4. **Runtime Enforcement Gates:** Server-side enforcement integrated directly into `AgentRuntimeService` and `AgentToolGatewayService`.
5. **Read-Only Simulation & Diffing Sandbox:** Explainable policy simulation without side-effects and immutable policy version comparison.
6. **Governance Center UI Additions:** Operational mode switcher and banner, policy decision simulation sandbox, live decision stream, and policy version comparison diff drawer.
7. **Secret-Redacted Audit Trail:** Immutable logging of all policy decisions to `agent_governance_audit_logs`.

---

## 2. Decision Precedence & Evaluation Rules

The policy engine evaluates actions deterministically using the following order of precedence:

```
[Level 1] Mandatory Platform Security
          ├── Disallowed raw system/network primitives (e.g., 'raw_socket', 'system_exec')
          └── Cross-tenant boundary violations
          ──> Output: DENY (Priority 1)

[Level 2] Explicit Deny Rules
          ├── Active policies with enforcementAction === 'block'
          ├── Unassigned or orphaned agent execution when ownership required
          └── Restricted classification violations
          ──> Output: DENY (Priority 2)

[Level 3] Approval Required Rules
          ├── Active policies with enforcementAction === 'require_approval'
          ├── Agent profile 'requireApprovalForTools' === true
          └── High/critical risk actions requiring human sign-off
          ──> Output: REQUIRE_APPROVAL (Priority 3)

[Level 4] Permissive Allow Rules
          ├── Active policies with explicit allow rules
          └── Verified agent permission allowlists
          ──> Output: ALLOW (Priority 4)

[Level 5] Default Fallback (Fail-Closed)
          └── Governed actions without explicit authorization in enforced scopes
          ──> Output: DENY (Priority 5)
```

If an unhandled exception or malformed payload occurs during evaluation, the engine catches the error, sets `failClosed: true`, and immediately outputs `DENY`.

---

## 3. Operational Enforcement Modes

Each organization can configure its governance enforcement mode dynamically:

| Mode | Evaluation Executed? | Audit Logs Emitted? | Effective Decision | Runtime Blocking Behavior |
|---|---|---|---|---|
| `DISABLED` | No | No | `ALLOW` | No policy checks performed. |
| `MONITOR` *(Default)* | **Yes** | **Yes (redacted)** | `ALLOW` | Violations recorded in audit ledger; runtime execution continues uninterrupted. |
| `ENFORCE` | **Yes** | **Yes (redacted)** | Evaluated decision (`ALLOW` / `DENY` / `REQUIRE_APPROVAL`) | `DENY` blocks execution (`POLICY_VIOLATION` or HTTP 403); `REQUIRE_APPROVAL` halts execution pending sign-off. |

---

## 4. REST API Endpoints

All endpoints are organization-scoped under `/api/v1/organizations/:organizationId/agent-governance/`:

| Method | Endpoint | Description | Permission Required |
|---|---|---|---|
| `POST` | `/agent-governance/evaluate` | Evaluates a context against active policies and returns deterministic decision. | `agent.read` |
| `POST` | `/agent-governance/simulate` | Read-only simulation sandbox evaluating candidate policies without execution. | `agent.read` |
| `GET` | `/agent-governance/mode` | Retrieves the current enforcement mode (`DISABLED`, `MONITOR`, `ENFORCE`). | `agent.read` |
| `PUT` | `/agent-governance/mode` | Updates the enforcement mode and logs an audit event. | `agent.manage` |
| `GET` | `/agent-governance/decisions` | Retrieves decision stream audit logs with optional filters (`decision`, `action`, `limit`). | `agent.read` |
| `GET` | `/agent-governance/policies/:policyId/versions/compare` | Compares two policy versions (`?v1=1&v2=2`) returning rule additions, removals, and modifications. | `agent.read` |

---

## 5. Runtime Enforcement Integration

### 5.1 Agent Tool Gateway (`agent-tool-gateway.service.ts`)
Policy evaluation is mounted at **Gate 1.1**, before tool resolution or execution:
- Evaluates `tool_execution` action for requested `toolKey`.
- Under `ENFORCE` mode:
  - If decision is `DENY`, immediately returns `{ success: false, error: "Tool execution blocked by policy: ...", code: "POLICY_VIOLATION" }`.
  - If decision is `REQUIRE_APPROVAL`, returns `{ success: false, error: "Tool execution requires approval: ...", code: "APPROVAL_REQUIRED" }`.

### 5.2 Agent Runtime (`agent-runtime.service.ts`)
Policy evaluation is mounted at the start of `executeAttempt(...)`:
- Evaluates `agent_execution` action for target `agentId`.
- Under `ENFORCE` mode:
  - If decision is `DENY`, halts attempt immediately and throws `ApiError(403, "FORBIDDEN", "Agent execution blocked by governance policy: ...")`.

---

## 6. Verification and Regression Testing

- **17/17 Unit & Integration Tests Passed:** `apps/api/tests/epic22b-policy-engine.test.ts`
  - 5-level precedence hierarchy validation
  - Fail-closed behavior on exceptions
  - Tenant boundary isolation
  - Orphaned agent execution rejection
  - `DISABLED`, `MONITOR`, and `ENFORCE` mode behavior
  - Tool Gateway Gate 1.1 blocking and approval intercept
  - Agent Runtime execution gating
  - Policy simulation without side-effects
  - Policy version diff comparison
  - Secret redaction in decision audit logs
- **77/77 Total Tests Passed:** Across Epics 19, 20, 21, 22A, and 22B.
- **Zero TypeScript Compiler Errors:** `typecheck:api` and `typecheck:web` both exited with code 0.
