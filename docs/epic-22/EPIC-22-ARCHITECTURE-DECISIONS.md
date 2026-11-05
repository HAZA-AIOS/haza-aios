# Epic 22 — Architecture Decision Records (ADRs)
## Enterprise Agent Governance & Security

### ADR-022-01: Organization-Scoped Multi-Tenant Governance Domain Model

**Status:** Approved  
**Date:** 2026-11-05  
**Context:**  
Enterprise agents operate autonomously across organizational workspaces, invoking external tools, querying sensitive knowledge bases, and executing multi-step workflows. Without strict governance controls, organizations risk data exfiltration, regulatory non-compliance (SOC2, HIPAA, GDPR), and unmonitored operational liabilities.

**Decision:**  
Introduce five core governance entities strictly scoped by `organizationId`:
1. `agent_governance_profiles`: Defines security classification (`public`, `internal`, `confidential`, `restricted`), risk tier (`low`, `medium`, `high`, `critical`), compliance frameworks, maximum autonomy levels, tool approval policies, and review cadence.
2. `agent_ownership_assignments`: Mandates explicit human accountability (primary owner, technical owner, business owner, escalation contact, accountability status).
3. `agent_governance_policies`: Centralized policy registry with unique `policyKey` per organization, policy types, severity, enforcement action, and version tracking.
4. `agent_governance_policy_versions`: Immutable historical snapshots of policy rules whenever a policy is revised.
5. `agent_governance_audit_logs`: Append-only immutable audit trail capturing actor, action, target entity, before/after states, and metadata for every governance event.

**Consequences:**  
- Organizations maintain full autonomy over their agent safety postures.
- Multi-tenant isolation is enforced at the database level and verified via index structures and foreign keys.
- Complete regulatory traceability for all agent configuration changes.

---

### ADR-022-02: Phased Governance Rollout (Foundation First, Enforcement Second)

**Status:** Approved  
**Date:** 2026-11-05  
**Context:**  
Introducing hard policy enforcement (e.g. blocking agent tool calls or aborting runs) simultaneously with data model introduction risks sudden breaking changes to running production agents and continuous operations tasks.

**Decision:**  
Split Epic 22 into sequential phases:
- **Phase 22A (Foundation):** Schema migration 0032, domain models, policy registry, ownership assignment, version history, audit ledger, and Governance Center UI console. Policy enforcement actions remain non-blocking (passive monitoring / telemetry / audit).
- **Phase 22B (Enforcement Engine):** Policy evaluation engine intercepting runtime agent invocations, tool execution authorization checks, dynamic approval routing, and enforcement blocks.

**Consequences:**  
- Zero disruption to existing production agents, continuous operations, or orchestration workflows during Phase 22A deployment.
- Teams can establish governance profiles, declare policies, and assign ownership before enforcement rules are activated.

---

### ADR-022-03: Forward-Only Database Migration 0032

**Status:** Approved  
**Date:** 2026-11-05  
**Context:**  
The repository adheres to strict forward-only database migrations managed via Drizzle ORM and MySQL.

**Decision:**  
Create migration `0032_agent_governance_foundation.sql` containing idempotent `CREATE TABLE IF NOT EXISTS` statements, composite uniqueness constraints (`org_key_unique`), foreign keys referencing `organizations` and `workspaces`, and optimized lookup indexes (`idx_agp_org_agent`, `idx_ago_org_agent`, `idx_agp_org_key`, `idx_agpv_policy`, `idx_agal_org_target`).

**Consequences:**  
- Migration runs safely against fresh or existing databases.
- Full compatibility with existing Drizzle migration journal.

---

### ADR-022-04: Deterministic 5-Level Policy Precedence and Fail-Closed Evaluation

**Status:** Approved  
**Date:** 2026-11-05  
**Context:**  
Agent execution, autonomous workflows, and tool invocations operate in sensitive corporate environments. Inconsistent or ambiguous permission resolution creates security vulnerabilities. The authorization model requires a strict, deterministic hierarchy for conflicting rules and must fail-closed on unhandled errors.

**Decision:**  
Implement a 5-level deterministic policy evaluation hierarchy:
1. **Mandatory Platform Security:** Hard platform-level restrictions (e.g. cross-tenant access violation, dangerous primitive invocations like `raw_socket` or `system_exec`) immediately produce `DENY`, overriding any lower configurations.
2. **Explicit Deny Rules:** Any active policy matching the execution context with an explicit `block` action evaluates to `DENY` with precedence over permissive rules.
3. **Approval Required Rules:** Any active policy or agent profile specifying `require_approval` or `requireApprovalForTools` produces `REQUIRE_APPROVAL`.
4. **Permissive Allow Rules:** Explicit active policies or matching allowlists result in `ALLOW`.
5. **Default Fallback:** If no rule matches a governed action in an enforced scope without authorization, default to `DENY` (fail-closed principle). If any exception occurs during policy evaluation, the engine immediately yields `DENY` with `failClosed: true`.

**Consequences:**  
- Completely deterministic authorization decisions with zero ambiguity.
- Secure by default: unhandled runtime evaluation failures block execution rather than allowing unintended access.

---

### ADR-022-05: Safe Rollout Enforcement Modes (DISABLED, MONITOR, ENFORCE)

**Status:** Approved  
**Date:** 2026-11-05  
**Context:**  
Transitioning directly to blocking policy enforcement in production can abruptly disrupt live agents and continuous operations workflows. A phased operational mechanism is required to observe and validate policy decisions without service interruption.

**Decision:**  
Implement three operational modes configured per organization:
- `DISABLED`: Policy evaluation is bypassed entirely; decisions evaluate to `ALLOW` (`mode: "DISABLED"`).
- `MONITOR` (Default): The full policy engine evaluates rules deterministically, produces decisions, and emits secret-redacted audit logs to `agent_governance_audit_logs`, but the `effectiveDecision` remains permissive (`ALLOW`), allowing execution while logging violations.
- `ENFORCE`: Strict runtime enforcement. A `DENY` halts agent execution or tool invocation with `POLICY_VIOLATION` (or HTTP 403), and `REQUIRE_APPROVAL` halts execution pending authorization.

Mode persistence is stored as a versioned, audited governance policy entity (`sys-enforcement-mode`) within `agent_governance_policies`, eliminating the need for schema modifications while retaining full auditability.

**Consequences:**  
- Operators can safely simulate and monitor policy rules against real production workloads prior to enforcing restrictions.
- Zero risk of unintended outages during governance rule rollouts.

---

### ADR-022-06: Read-Only Simulation Sandbox and Version Diffing

**Status:** Approved  
**Date:** 2026-11-05  
**Context:**  
Security officers and workspace administrators need to dry-run proposed policies, verify precedence, and analyze version differences prior to applying changes in live environments.

**Decision:**  
Provide dedicated read-only policy simulation and version diff services:
- `PolicySimulationService.simulate()`: Evaluates candidate execution contexts against active or proposed policies in-memory with `simulated: true`, generating full rule match explanations without triggering side-effects or blocking runs.
- `PolicySimulationService.comparePolicyVersions()`: Performs deterministic diffing between two immutable snapshots from `agent_governance_policy_versions`, identifying added, removed, and modified rules and parameter shifts.

**Consequences:**  
- Administrators gain complete visibility into policy impacts before deployment.
- Clear explainability of which rule in the precedence stack caused an `ALLOW`, `DENY`, or `REQUIRE_APPROVAL`.
