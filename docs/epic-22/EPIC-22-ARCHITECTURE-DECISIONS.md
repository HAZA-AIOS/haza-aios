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


---

### ADR-022-07: Human-in-the-Loop Approval Request Domain Model and Immutable Decision Audit

**Status:** Approved  
**Date:** 2026-11-05  
**Context:**  
When governed agent operations evaluate to `REQUIRE_APPROVAL` under `ENFORCE` mode, the runtime cannot simply block or fail; it must suspend the operation, persist a tenant-scoped approval request, and route it to human reviewers. Decisions must be recorded as immutable historical entities rather than mutative overwrites.

**Decision:**  
Introduce three dedicated relational entities via migration `0033_agent_human_approval_workflows.sql`:
1. `agent_approval_requests`: Organization-scoped table tracking requested agent action, target tool/action, canonical SHA-256 payload fingerprint, matched policy and version, expiration timestamp, assigned reviewer, and consumption status.
2. `agent_approval_decisions`: Immutable append-only decision audit log recording decision (`approved`, `rejected`, `revoked`), decider identity, justification, policy snapshot, and timestamp.
3. `agent_approval_escalations`: Audit log of reassignments and escalations to agent ownership contacts.

**Consequences:**  
- Complete historical auditability for all human oversight interventions.
- Clear separation between the mutable request state machine and immutable reviewer decision records.

---

### ADR-022-08: Concurrency-Safe State Machine & One-Time Atomic Consumption

**Status:** Approved  
**Date:** 2026-11-05  
**Context:**  
Multiple reviewers may inspect the same pending approval simultaneously, or multiple concurrent attempts may attempt to execute an approved operation, risking replay attacks or duplicate side-effects.

**Decision:**  
Implement atomic compare-and-set queries for all state transitions:
- `PENDING -> APPROVED / REJECTED / REVOKED / EXPIRED`: Only succeeds if `status === 'pending'`.
- `APPROVED -> CONSUMED`: Only succeeds if `status === 'approved'`.
All updates specify exact expected current statuses in database update predicates. If a conflict occurs, the service aborts with HTTP 409 and rejects execution.

**Consequences:**  
- Zero race conditions or duplicate execution side-effects.
- Single-use execution guarantee for all approved requests.

---

### ADR-022-09: Canonical Payload Fingerprinting & Fresh Policy Re-evaluation

**Status:** Approved  
**Date:** 2026-11-05  
**Context:**  
An approval grant could potentially be exploited by submitting modified parameters at execution time, or policy rules could change to strictly block an action while an approval request was pending.

**Decision:**  
Before executing any approved operation via `AgentApprovalContinuationService`:
1. **Fingerprint Verification:** Compute the canonical SHA-256 hash of sorted payload parameters. If the provided payload deviates in any key or value from the approved fingerprint, reject execution immediately with `BAD_REQUEST`.
2. **Fresh Policy Re-evaluation:** Re-run the Policy Evaluation Engine against current active policies. If any mandatory platform restriction is violated or an active policy now explicitly blocks the operation, reject execution with `FORBIDDEN` (`POLICY_INVALIDATED`).

**Consequences:**  
- Complete anti-tampering protection against parameter manipulation.
- Immunity to stale-policy authorization vulnerabilities.

---

### ADR-022-10: Capability Model & Sandboxing Risk Classification

**Status:** Approved  
**Date:** 2026-11-06  
**Context:**  
Agents operate across diverse capabilities (read-only queries, write operations, external network requests, local filesystem access, arbitrary code execution, and system primitives). Without granular risk categorization and deterministic security enforcement, agents risk host compromise, lateral network movement, SSRF attacks, and directory traversal.

**Decision:**  
Establish 6 risk classifications (`READ_ONLY_DATA`, `CONTROLLED_WRITE`, `EXTERNAL_NETWORK`, `FILESYSTEM_ACCESS`, `CODE_EXECUTION`, `SYSTEM_OPERATION`).
1. **Explicit Sandbox Boundaries:** Arbitrary code execution (`CODE_EXECUTION`) and untrusted host OS modifications (`SYSTEM_OPERATION`) are strictly prohibited and hard-blocked at the platform security gateway without claiming false container-level isolation.
2. **SSRF Destination Validation:** Network requests are checked against allowlists and blocked from accessing loopback (`127.0.0.1`, `localhost`), RFC1918 private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), link-local IPs, and cloud metadata services (`169.254.169.254`).
3. **Filesystem Traversal Prevention:** Storage operations reject directory traversal sequences (`..`), null bytes, and sensitive system directories (`/etc`, `/var`, `/proc`, `C:\Windows`, `C:\Program Files`).
4. **Delegation Attenuation:** Multi-agent delegation verifies that child agents have autonomy levels and capabilities strictly equal to or lower than the delegating parent agent.

**Consequences:**  
- Eliminates SSRF and directory traversal attack vectors.
- Guarantees agents cannot exceed assigned autonomy ceilings or escalate privileges during delegation.
- Clear, honest security posture that does not make false sandbox promises.

---

### ADR-022-11: Opaque Secret Vault Abstraction & Redaction

**Status:** Approved  
**Date:** 2026-11-06  
**Context:**  
Tool calls and autonomous agent workflows require external API credentials, database keys, or third-party service tokens. Persisting plaintext or decryptable secret values in database tables or logs presents severe exfiltration and compliance risks.

**Decision:**  
Implement an opaque secret reference architecture (`agent_secret_references`):
1. **Zero Secret DB Exposure:** The database stores metadata only (opaque key, secret name, provider, status, rotation timestamps, allowed tool IDs).
2. **Secure In-Memory Vault:** Secret values are resolved exclusively within secure in-memory vaults (`AgentSecretVaultService`) or environment-managed synthetic test credential sets.
3. **Scoped Tool Allowlist:** Secrets can only be consumed by tools explicitly listed in their reference scope.
4. **Deep Redaction:** All tool gateway outputs, logs, and telemetry are scrubbed through recursive object redaction (`redactObject`), preventing credential leakage in conversational responses or traces.

**Consequences:**  
- Zero plaintext credentials in database rows, API responses, or UI dashboards.
- Revoking an opaque secret reference immediately prevents any agent from using the credential.
- Deep output redaction prevents prompt extraction leaks.

---

### ADR-022-12: Cryptographic Continuation Proofs & Durable Reconciliation State

**Status:** Approved  
**Date:** 2026-11-06  
**Context:**  
In Phase 22C, tool gateway continuation previously accepted an unverified boolean flag `bypassGovernanceApprovalCheck: true`, creating an attack vector where an unauthenticated or malicious caller could bypass policy checks. Additionally, failures or crashes during post-approval tool execution risked unrecorded partial state transitions.

**Decision:**  
Eliminate the boolean bypass flag:
1. **Cryptographic Proof Token:** Introduce cryptographically signed HMAC-SHA256 continuation tokens (`ContinuationProof`) generated exclusively by `AgentApprovalContinuationService`.
2. **Durable State Machine:** Introduce durable relational tracking via `agent_continuation_records` (storing `continuationStatus`, `reconciliationStatus`, attempt counts, and error payloads).
3. **Gateway Verification:** In `AgentToolGatewayService`, reject any request claiming approval continuation without a valid cryptographic token verified against the database record, and fail closed with audit event `CONTINUATION_BYPASS_ATTEMPT`.
4. **Atomic Reconciliation:** Durable execution state is atomically transitioned from `claimed` to `COMPLETED` on success or `FAILED` on error.

**Consequences:**  
- Closes the approval bypass vulnerability.
- Provides anti-replay protection and crash recovery reconciliation for interrupted approvals.
- Guarantees end-to-end cryptographic integrity.

---

### ADR-022-13: Normalized Compliance Event Model & Idempotent Ingestion

**Status:** Approved  
**Date:** 2026-11-06  
**Context:**  
Enterprise auditability requires collecting events across distinct phases of the agent lifecycle (execution runs, tool invocations, policy evaluations, approval requests, security events, secret accesses, governance mutations, and retention actions). Heterogeneous event shapes prevent uniform compliance querying, cross-stage timeline reconstruction, and deterministic tamper-evident chaining.

**Decision:**  
Implement a normalized compliance event schema (`agent_compliance_events`):
1. **Normalized Event Envelope:** Captures organization ID, workspace ID, unique event ID, category (10 supported categories), event type, event/ingestion timestamps, actor ID/type, agent ID, execution ID, policy ID/version, approval request ID, security event reference, correlation ID, trace ID, outcome, risk severity, data classification, and scrubbed metadata.
2. **Idempotent Ingestion:** Duplicate event IDs are identified at the database boundary and returned without mutating existing records or generating duplicate hash chain links.
3. **Deep Telemetry Redaction:** All incoming metadata passes through recursive credential scrubbing (`redactObject`), masking API keys and bearer tokens prior to persistence.

**Consequences:**  
- Unified querying across runtime, policy, security, and approval dimensions.
- Eliminates duplicate entries caused by network retries or distributed workers.
- Guarantees zero credential leakage into permanent compliance records.

---

### ADR-022-14: Tenant-Isolated Cryptographic Audit Ledger & Tamper Evidence

**Status:** Approved  
**Date:** 2026-11-06  
**Context:**  
Traditional database audit tables are vulnerable to undetected retroactive alteration, sequence truncation, or record omission by malicious actors or compromised application accounts. Compliance frameworks (SOC 2, ISO 27001, ISO 42001) require verifiable assurance that audit records have not been tampered with or modified.

**Decision:**  
Implement a tenant-isolated cryptographic hash chain (`agent_audit_integrity_chains`):
1. **Monotonic Sequences:** Every organization maintains an independent, strictly monotonic sequence number ($1, 2, 3, \dots$).
2. **Deterministic Payload Hashing:** Event fields are deterministically sorted via canonical JSON serialization (`canonicalStringify`) and hashed via SHA-256 (`payloadHash`).
3. **Cryptographic Linkage:** Each record computes `currentEventHash = sha256(previousEventHash + ":" + sequenceNumber + ":" + payloadHash)`. Sequence 1 begins with a known 64-character zero genesis hash.
4. **Range Verification Engine:** `verifyAuditIntegrity()` scans chain records, verifies sequence continuity, compares stored payload hashes against live event records, and validates previous-hash references.
5. **Architectural Disclaimer & External Anchoring:** System distinguishes cryptographic tamper-evidence from true WORM / hardware anchoring. Ledger schema includes `hashAlgorithm` and `schemaVersion` to support future external RFC 6962 transparency log or ledger anchoring without requiring paid external infrastructure now.

**Consequences:**  
- Mathematical proof of event sequence continuity and payload immutability.
- Immediate detection of modified payloads, deleted records, or broken links.
- Fully tenant-isolated chains preventing cross-tenant leakage.

---

### ADR-022-15: Controlled Evidence Packaging, Independent Offline Verification & Legal Holds

**Status:** Approved  
**Date:** 2026-11-06  
**Context:**  
External compliance auditors and legal investigators require verifiable proof of agent governance without direct access to live multi-tenant production databases. Furthermore, standard data retention policies risk disposing of critical audit evidence during pending regulatory reviews or active litigation.

**Decision:**  
Implement a controlled evidence registry, packaging engine, and legal hold system:
1. **Hashed Evidence Registry (`agent_compliance_evidence`):** Stores structured payloads with canonical SHA-256 content hashes, classifications, and mapped compliance control IDs.
2. **Self-Contained Export Packages (`agent_compliance_evidence_packages`):** Generates JSON manifests containing individual evidence checksums, audit event hashes, export authorization records, and overall manifest checksums.
3. **Offline Independent Verification:** Standalone verification (`verifyEvidencePackageOffline`) validates package integrity without requiring network or database connectivity.
4. **Legal Holds Override Disposal:** Active legal holds (`agent_compliance_legal_holds`) mark matching records as protected, causing retention previews to mark candidates as `RETAIN_UNDER_LEGAL_HOLD` and preventing disposal.
5. **Dry-Run Disposal Safety:** Retention disposal operations are strictly dry-run simulations in Phase 22E; zero destructive purge queries are executed.

**Consequences:**  
- Auditors can independently verify exported evidence offline.
- Total immunity of litigation-critical evidence against premature retention expiration.
- Zero risk of unintended data destruction during compliance evaluations.


