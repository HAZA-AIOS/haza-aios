# HAZA-AIOS — Epic 22D: Enterprise Agent Security Controls, Sandboxing & Secret Protection

**Module:** Enterprise Agent Security Controls  
**Target Release:** v0.22.0-epic22  
**Database Migration:** 0034 (`0034_agent_security_controls_sandboxing.sql`)  
**Baseline Verification:** Passed (119/119 tests green across 8 test suites)  

---

## 1. Overview & Threat Model

Enterprise agents operate autonomously across organizational workspaces, invoking external tools, querying databases, handling sensitive knowledge bases, and executing multi-step workflows. As agents gain greater autonomy, they become targets for sophisticated threats:
- **SSRF (Server-Side Request Forgery):** Malicious inputs causing agents to probe private cloud subnets, local loopback services (`127.0.0.1`), or cloud metadata endpoints (`169.254.169.254`).
- **Path Traversal & Data Exfiltration:** Unauthorized file reading/writing via traversal sequences (`../`) targeting sensitive host configuration or system directories.
- **Credential Theft & Secret Exposure:** Storing API keys or access tokens directly in databases, leaking them into LLM conversational contexts, or returning them in API responses.
- **Privilege Escalation:** Lower-autonomy subagents delegating to higher-autonomy agents to circumvent organizational policies.
- **Approval Bypass & Continuation Tampering:** Forging continuation tokens or replaying approvals with modified payloads to execute unauthorized actions.
- **Rogue Agent Runaway:** Agents entering infinite loops or executing destructive operations during unexpected external events.

Epic 22D establishes defense-in-depth security boundaries around all agent runtime executions, tool gateway calls, autonomous workers, approval continuations, and multi-agent teams.

---

## 2. Capability Model & Risk Classification

Every agent in HAZA-AIOS can be assigned an `agent_security_profiles` configuration defining its capability boundaries:
- **Resource Classification:** `PUBLIC`, `INTERNAL`, `CONFIDENTIAL`, `RESTRICTED`
- **Network Access Mode:** `DISABLED`, `ALLOWLIST_ONLY`, `PUBLIC_ONLY`, `FULL`
- **Storage Access Mode:** `DISABLED`, `WORKSPACE_SCOPED`, `SHARED_TEMP`, `FULL`
- **Execution Budget:** Max runtime seconds, max tokens per run, max cost per execution
- **Autonomy Ceiling:** `L0` (Assisted), `L1` (Guided), `L2` (Supervised), `L3` (Autonomous)

### Tool Risk Categories

Every platform tool is deterministically classified into one of six risk categories:

| Category | Description | Platform Behavior |
| :--- | :--- | :--- |
| `READ_ONLY_DATA` | Safe data retrieval (e.g., search, query, metrics) | Allowed subject to normal policy evaluation |
| `CONTROLLED_WRITE` | Workspace-scoped mutations (e.g., ticket creation, doc edit) | Allowed subject to policy and approvals |
| `EXTERNAL_NETWORK` | Outbound HTTP/API calls (e.g., webhook, external API) | Subject to SSRF validation and domain allowlists |
| `FILESYSTEM_ACCESS` | Local file reading or writing | Subject to path traversal checks & workspace confinement |
| `CODE_EXECUTION` | Arbitrary code execution (e.g., python eval, bash) | **STRICTLY BLOCKED** at platform security gateway |
| `SYSTEM_OPERATION` | OS-level modifications (e.g., process spawning, system configs) | **STRICTLY BLOCKED** at platform security gateway |

### Honest Sandboxing Boundaries

HAZA-AIOS does not make false marketing claims regarding sandbox containment. In environments without hardware-isolated microVMs or lightweight hypervisors (e.g. Firecracker/gVisor), executing untrusted arbitrary code or running root shell primitives presents unacceptable host compromise risks. Consequently:
- Arbitrary code execution (`CODE_EXECUTION`) is **disabled by default and hard-blocked**.
- Direct OS system operations (`SYSTEM_OPERATION`) are **disabled by default and hard-blocked**.
- Tools categorized as such fail immediately with a `SECURITY_VIOLATION` audit log.

---

## 3. Sandboxing & Gateway Defenses

### SSRF Protection
The `AgentSecurityGatewayService` validates all outbound network destinations:
- **Blocks Loopback:** `127.0.0.1`, `localhost`, `0.0.0.0`, `::1`
- **Blocks Private Subnets (RFC1918):** `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
- **Blocks Link-Local / Cloud Metadata:** `169.254.169.254`, `169.254.0.0/16`
- **Validates Domain Allowlists:** When `networkAccessMode === 'ALLOWLIST_ONLY'`, destinations must match configured domain allowlists.

### Path Traversal Defense
Storage and file operations are strictly verified:
- Rejects paths containing `..` or null byte injections (`%00`, `\0`).
- Rejects absolute paths outside the designated workspace root.
- Rejects paths targeting sensitive system directories (`/etc`, `/proc`, `/sys`, `C:\Windows`, `C:\Program Files`).

### Delegation Privilege Attenuation
When an agent attempts to spawn or delegate work to a child agent (`assertDelegationPrivilegeAttenuation`):
- Child agent autonomy level cannot exceed the delegating agent's autonomy level.
- Child agent security classification cannot exceed the delegating agent's classification.
- Child agent cannot possess network or storage permissions wider than the delegating parent.

---

## 4. Secret Protection & Opaque Vault Abstraction

HAZA-AIOS strictly decouples credential management from database persistence and agent prompts:
1. **Zero Secret Storage in Database:** The `agent_secret_references` table stores only opaque reference keys (`ref:xxx`), secret names, provider types, tool allowlists, status, and expiration timestamps. No plaintext or decryptable secret values ever touch MySQL rows.
2. **In-Memory Vault:** Credentials are held securely in `AgentSecretVaultService` in-memory structures or environment-managed synthetic test credential sets.
3. **Tool-Scoped Resolution:** Secrets are only injected into tool execution adapters if the calling tool ID exists in `allowedToolIds`.
4. **Deep Redaction:** All tool gateway outputs, execution logs, and audit records pass through recursive redaction (`redactObject`), masking any pattern matching API keys, tokens, or known secret values.

---

## 5. Emergency Security Controls & Checkpoints

Operators have immediate, deterministic control over runaway or compromised agents:
- **Agent Suspension & Reactivation:** Suspending an agent instantly halts all running executions, disables tool invocations, and rejects new tasks with `AGENT_SUSPENDED`.
- **Emergency Kill Switch:** Organization-level kill switch that halts all agent executions and tool invocations across all workspaces within milliseconds.
- **In-Flight Cancellation Checkpoints:** Long-running agent loops and autonomous workers verify `checkExecutionCancellationCheckpoint` between loop steps and tool dispatches. If an agent has been suspended or killed, execution aborts immediately without applying side effects.

---

## 6. Phase 22C Security Hardening

Epic 22D eliminates vulnerabilities identified in Phase 22C approval workflows:
1. **Elimination of Boolean Bypass:** The client-provided `bypassGovernanceApprovalCheck: true` flag has been completely removed.
2. **Cryptographically Signed Continuation Tokens:** `AgentApprovalContinuationService` issues HMAC-SHA256 signed continuation proofs containing the approval ID, agent ID, tool ID, payload fingerprint, and cryptographic expiration.
3. **Durable Continuation Records:** Managed in `agent_continuation_records` with status progression (`PENDING` -> `CLAIMED` -> `COMPLETED` / `FAILED`), reconciliation statuses, and attempt counters.
4. **Tool Gateway Enforcement:** `AgentToolGatewayService` validates the continuation token against both HMAC signature and the database continuation record before executing the tool. Unauthenticated continuation claims trigger a `CONTINUATION_BYPASS_ATTEMPT` security event.
5. **Reviewer Authorization Hardening:** Rejects self-approval attempts by requesting owners and enforces that reviewers possess required RBAC privileges regardless of ownership assignments.

---

## 7. Security Operations Center UI

The dark premium Governance Center (`/workspace/governance`) includes a dedicated "Security Controls" dashboard tab:
- **Posture Summary Metrics:** Displays Active Agents, Suspended Agents, Configured Profiles, Registered Secrets, and Security Incidents.
- **Emergency Stop Banner:** Prominently alerts operators when an emergency stop is active, with single-click resume controls.
- **Agent Capability Profiles Table:** Lists all agents with their classification, network access, storage access, autonomy ceiling, and status, with quick actions to Suspend, Reactivate, or Configure Capabilities.
- **Secret References Table:** Lists registered opaque secrets, target tools, provider type, status, and rotation timestamps with zero exposed credential values.
- **Security Audit Event Stream:** Real-time log of security events (suspensions, emergency stops, SSRF blocks, traversal attempts, approval bypass attempts) with severity indicators and actor attribution.
- **Action Modals:**
  - Emergency Stop Modal (with explicit confirmation keyword)
  - Agent Suspension Modal (with reason tracking)
  - Secret Reference Registration Modal (opaque metadata definition)
  - Capability Profile Configuration Modal (70%-width responsive drawer with granular privilege sliders)

---

## 8. Database Schema (Migration 0034)

### `agent_security_profiles`
- `id` (VARCHAR(36), PK)
- `organization_id` (VARCHAR(36), FK -> `organizations.id`)
- `workspace_id` (VARCHAR(36), nullable, FK -> `workspaces.id`)
- `agent_id` (VARCHAR(36), FK -> `agents.id`)
- `security_classification` (VARCHAR(32), default 'INTERNAL')
- `network_access_mode` (VARCHAR(32), default 'ALLOWLIST_ONLY')
- `storage_access_mode` (VARCHAR(32), default 'WORKSPACE_SCOPED')
- `allowed_domains` (JSON)
- `allowed_storage_paths` (JSON)
- `max_execution_time_seconds` (INT, default 300)
- `max_tokens_per_execution` (INT, default 100000)
- `max_cost_per_execution_usd` (DECIMAL(10,4), default 5.0000)
- `autonomy_ceiling` (VARCHAR(16), default 'L2')
- `status` (VARCHAR(32), default 'ACTIVE')
- `suspension_reason` (TEXT, nullable)
- `suspended_at` (TIMESTAMP, nullable)
- `suspended_by` (VARCHAR(36), nullable)
- `created_at`, `updated_at`
- Unique Index: `idx_asp_org_agent` (`organization_id`, `agent_id`)

### `agent_secret_references`
- `id` (VARCHAR(36), PK)
- `organization_id` (VARCHAR(36), FK -> `organizations.id`)
- `secret_key` (VARCHAR(64), unique per org)
- `secret_name` (VARCHAR(128))
- `provider` (VARCHAR(64))
- `allowed_tool_ids` (JSON)
- `allowed_agent_ids` (JSON)
- `status` (VARCHAR(32), default 'ACTIVE')
- `expires_at` (TIMESTAMP, nullable)
- `last_rotated_at` (TIMESTAMP, nullable)
- `created_at`, `updated_at`
- Unique Index: `idx_asr_org_key` (`organization_id`, `secret_key`)

### `agent_security_events`
- `id` (VARCHAR(36), PK)
- `organization_id` (VARCHAR(36), FK -> `organizations.id`)
- `agent_id` (VARCHAR(36), nullable)
- `event_type` (VARCHAR(64))
- `severity` (VARCHAR(16))
- `actor_id` (VARCHAR(36), nullable)
- `details` (JSON)
- `ip_address` (VARCHAR(45), nullable)
- `created_at` (TIMESTAMP)

### `agent_continuation_records`
- `id` (VARCHAR(36), PK)
- `organization_id` (VARCHAR(36), FK -> `organizations.id`)
- `approval_id` (VARCHAR(36), FK -> `agent_approval_requests.id`)
- `agent_id` (VARCHAR(36))
- `tool_id` (VARCHAR(128))
- `payload_fingerprint` (VARCHAR(64))
- `continuation_token_hash` (VARCHAR(64))
- `continuation_status` (VARCHAR(32), default 'CLAIMED')
- `reconciliation_status` (VARCHAR(32), default 'PENDING_EXECUTION')
- `attempt_count` (INT, default 1)
- `last_error` (TEXT, nullable)
- `created_at`, `updated_at`
- Unique Index: `idx_acr_approval` (`approval_id`)

---

## 9. REST API Reference

All endpoints are mounted under `/api/v1/organizations/:organizationId/agent-governance/security/`:

1. `GET /posture` — Retrieve overall security posture, metric counts, and kill switch status.
2. `POST /emergency-stop` — Trigger emergency stop across all agents in the organization.
3. `POST /emergency-stop/resume` — Resume normal operations from emergency stop.
4. `GET /profiles` — List all agent security profiles.
5. `GET /profiles/:agentId` — Get security capability profile for a specific agent.
6. `PUT /profiles/:agentId` — Upsert/configure agent capability profile.
7. `POST /agents/:agentId/suspend` — Suspend a specific agent immediately.
8. `POST /agents/:agentId/reactivate` — Reactivate a suspended agent.
9. `GET /secrets` — List secret references (metadata only, zero secrets exposed).
10. `POST /secrets` — Register an opaque secret reference.
11. `PUT /secrets/:secretKey` — Update an opaque secret reference.
12. `DELETE /secrets/:secretKey` — Revoke/delete an opaque secret reference.
13. `GET /events` — List security audit events with pagination and filtering.

---

## 10. Automated Test Matrix

The test suite (`apps/api/tests/epic22d-security-controls.test.ts`) verifies 20 distinct security scenarios:
1. `GET /posture` returns accurate metrics and emergency stop state.
2. Upsert and retrieve agent security profiles with capability limits.
3. Suspending an agent transitions status to `SUSPENDED` and records reason.
4. Reactivating a suspended agent restores `ACTIVE` status.
5. Organization emergency stop blocks tool invocation across all agents.
6. Resuming from emergency stop allows tool execution to proceed normally.
7. Suspended agent is blocked from invoking any tools.
8. Blocking untrusted arbitrary code execution (`CODE_EXECUTION`).
9. Blocking untrusted operating system primitives (`SYSTEM_OPERATION`).
10. SSRF prevention blocks requests to loopback addresses (`127.0.0.1`).
11. SSRF prevention blocks requests to AWS/GCP cloud metadata IP (`169.254.169.254`).
12. SSRF prevention blocks RFC1918 private subnet IP access.
13. Filesystem sandboxing blocks path traversal attacks (`../etc/passwd`).
14. Filesystem sandboxing blocks access to restricted Windows system directories.
15. Multi-agent delegation privilege attenuation rejects escalation to higher autonomy.
16. Secret reference registration stores metadata with zero secret value in DB.
17. In-memory secret resolution injects secrets only to authorized tools.
18. Revoked secret references block access to credentials.
19. Rejection of unauthenticated boolean `bypassGovernanceApprovalCheck`.
20. Generation, verification, and atomic reconciliation of cryptographic continuation proofs.
