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
