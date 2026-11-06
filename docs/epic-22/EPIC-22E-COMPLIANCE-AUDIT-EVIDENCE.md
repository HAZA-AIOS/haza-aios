# HAZA-AIOS — Epic 22E: Enterprise Compliance, Audit Integrity & Evidence Management

## 1. Architectural Overview & Threat Model

### 1.1 Objective
Epic 22E introduces enterprise-grade compliance, cryptographic audit integrity, and controlled evidence management into the HAZA-AIOS multi-agent ecosystem. It unifies the telemetry and event streams established in Epics 19–21 and Phases 22A–22D into an immutable, tamper-evident audit ledger with verifiable evidence packaging, compliance framework control mapping, retention lifecycle policies, legal holds, and audit investigation workflows.

```
+--------------------------------------------------------------------------------------------------+
|                                    HAZA-AIOS Agent Ecosystem                                     |
|  [Agents / Workflows] -> [Policy Engine 22B] -> [Approvals 22C] -> [Security & Secret Vault 22D] |
+--------------------------------------------------------------------------------------------------+
                                                |
                                      Normalized Event Stream
                                                v
+--------------------------------------------------------------------------------------------------+
|                            Enterprise Compliance Service (Epic 22E)                             |
|                                                                                                  |
|   +------------------------------------+          +------------------------------------------+   |
|   |   Normalized Compliance Events     |          |       Cryptographic Audit Ledger         |   |
|   |   - 10 Event Categories            |          |   - Canonical JSON Serialization         |   |
|   |   - Deep Secret Redaction          |  =====>  |   - SHA-256 Monotonic Sequence Chain     |   |
|   |   - Strict Organization Scoping    |          |   - Genesis Block & Range Verification   |   |
|   +------------------------------------+          +------------------------------------------+   |
|                     |                                                   |                        |
|                     v                                                   v                        |
|   +------------------------------------+          +------------------------------------------+   |
|   |       Compliance Frameworks        |          |          Controlled Evidence Hub         |   |
|   |   - ISO 27001:2022                 |          |   - Raw Evidence Collection              |   |
|   |   - ISO/IEC 42001:2023 (AI SMS)    |          |   - Self-Contained Zip-Ready Packages    |   |
|   |   - NIST AI RMF 1.0                |          |   - Deterministic SHA-256 Manifests      |   |
|   |   - SOC 2 Trust Services Criteria  |          |   - Offline Verifier (No DB Required)    |   |
|   +------------------------------------+          +------------------------------------------+   |
|                     |                                                   |                        |
|                     v                                                   v                        |
|   +------------------------------------+          +------------------------------------------+   |
|   |     Retention & Legal Holds        |          |         Audit Investigations             |   |
|   |   - Minimum Retention Periods      |          |   - Case Management & Notes              |   |
|   |   - Hard Legal Hold Overrides      |          |   - Chronological Timeline Synthesis     |   |
|   |   - Non-Destructive Dry-Run Sim    |          |   - Logged Search Access Queries         |   |
|   +------------------------------------+          +------------------------------------------+   |
+--------------------------------------------------------------------------------------------------+
```

### 1.2 Threat Model & Security Boundaries
- **Adversary Capability:**
  1. *Malicious Agent or Prompt Injection:* Attempts to forge or suppress audit events during execution.
  2. *Compromised Tenant User / Operator:* Attempts to retroactively alter execution logs, approve unauthorized actions, or erase proof of policy violations.
  3. *Unauthorized Third-Party / Leaked Export:* Attempts to extract sensitive tenant secrets, API keys, or proprietary data from exported compliance packages.
- **Cryptographic Guarantees:**
  - Every event payload is normalized and recursively scrubbed of API keys and credentials before hashing.
  - Serialization uses deterministic canonical key sorting (`canonicalStringify`), eliminating whitespace and unordered key nondeterminism.
  - Tenant audit chains maintain strict monotonic sequence numbers (`sequence_number = 1, 2, ...`). Each record includes the SHA-256 hash of its payload concatenated with the preceding record's chain hash (`SHA-256(canonicalPayload + prevChainHash)`).
  - Any insertion, deletion, reordering, or payload alteration invalidates the cryptographic chain verification across that sequence range.
- **Explicit Non-Claims:**
  - *No Legal Compliance Self-Certification:* HAZA-AIOS provides technical controls, verification tooling, and evidence artifacts. It does not certify legal compliance or substitute for an accredited independent third-party auditor.
  - *Database Administrative Deletions:* Cryptographic verification detects any modification or deletion in the event stream, but MySQL itself does not constitute physical WORM (Write Once Read Many) storage. External transparency log anchoring is documented in ADR-022-13 as a future roadmap enhancement.

---

## 2. Normalized Compliance Event Schema

The compliance ledger categorizes all governance, security, and runtime activities across ten normalized categories:

| Category | Typical Source | Triggering Action | Scrubbed Payload Fields |
|---|---|---|---|
| `AGENT_EXECUTION` | `AgentExecutionCoordinator` | Agent run initiated, completed, or failed | `runId`, `agentId`, `parameters`, `model`, `tokenUsage` |
| `TOOL_INVOCATION` | `ToolGatewayService` | External tool or sandbox action invoked | `toolName`, `toolInput`, `riskTier`, `sandboxMode` |
| `POLICY_EVALUATION` | `PolicyEvaluationEngine` | Deterministic policy decision made | `policyId`, `decision`, `violations`, `matchedRules` |
| `HUMAN_APPROVAL` | `ApprovalWorkflowService` | Human reviewer requested, approved, or rejected | `approvalRequestId`, `stepId`, `reviewerId`, `decision` |
| `SECURITY_CONTROL` | `AgentSecurityService` | Sandbox violation, egress block, payload block | `violationType`, `targetUrl`, `detectedPattern`, `actionTaken` |
| `SECRET_ACCESS` | `AgentSecretVaultService` | Runtime secret leased or decrypted | `secretName`, `scope`, `leasedAt`, `leaseDurationMs` |
| `GOVERNANCE_CHANGE` | `GovernanceProfileService` | Policy update, tier change, rule toggle | `profileId`, `previousState`, `newState`, `operatorId` |
| `COMPLIANCE_CHANGE` | `AgentComplianceService` | Control verification status updated | `controlId`, `frameworkCode`, `newStatus`, `verifierId` |
| `EVIDENCE_EXPORT` | `AgentComplianceService` | Evidence package compiled and downloaded | `packageId`, `evidenceIds`, `manifestChecksum`, `recipient` |
| `RETENTION_ACTION` | `AgentComplianceService` | Retention policy updated, hold placed/released | `policyType`, `holdIdentifier`, `action`, `affectedCount` |

### Required Event Metadata
- `eventId`: UUIDv4 primary identifier.
- `organizationId`: Multi-tenant boundary constraint.
- `category`: Enum (one of the 10 categories above).
- `eventType`: Qualified action string (e.g., `agent.policy.violation`).
- `actorType`: Enum (`USER`, `AGENT`, `SYSTEM`, `REVIEWER`).
- `actorId`: Identity of the triggering principal.
- `resourceType` & `resourceId`: Target entity.
- `outcome`: Enum (`SUCCESS`, `DENIED`, `FAILED`, `FLAGGED`, `PENDING`).
- `riskSeverity`: Enum (`INFO`, `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
- `dataClassification`: Enum (`PUBLIC`, `INTERNAL`, `CONFIDENTIAL`, `RESTRICTED`).
- `metadata`: Canonical JSON dictionary scrubbed of secrets.
- `occurredAt`: ISO-8601 UTC timestamp.

---

## 3. Cryptographic Audit Integrity Ledger

### 3.1 Hash-Chain Construction
The audit chain is maintained per organization. When an event is recorded:
1. The metadata payload is scrubbed using `redactObject`.
2. The canonical payload string is computed:
   ```ts
   const canonicalPayload = canonicalStringify({
     eventId,
     organizationId,
     category,
     eventType,
     actorType,
     actorId,
     resourceType,
     resourceId,
     outcome,
     riskSeverity,
     dataClassification,
     metadata,
     occurredAt
   });
   const payloadHash = sha256Hash(canonicalPayload);
   ```
3. The latest chain record for `organizationId` is queried:
   - If no prior record exists, `previousChainHash = "0".repeat(64)` (Genesis Hash) and `sequenceNumber = 1`.
   - If a prior record exists, `sequenceNumber = prev.sequenceNumber + 1` and `previousChainHash = prev.chainHash`.
4. The current chain hash is computed:
   ```ts
   const chainHash = sha256Hash(`${canonicalPayload}|${previousChainHash}`);
   ```
5. The chain record is atomically inserted into `agent_audit_integrity_chains`.

### 3.2 Audit Integrity Verification Algorithm
The verification endpoint (`GET /api/v1/organizations/:organizationId/agent-governance/compliance/audit/verify`) executes deterministic verification:
1. Validates that sequence numbers are strictly continuous (`seq[i] === seq[i-1] + 1`). Any gap indicates record deletion.
2. Fetches the underlying compliance event and recomputes the canonical payload hash. If the recomputed hash differs from `storedPayloadHash`, tampering is detected (`PAYLOAD_TAMPERED`).
3. Recomputes `chainHash = SHA-256(canonicalPayload + prevChainHash)` and compares it against the stored `chainHash`. Any discrepancy flags chain linkage corruption (`CHAIN_BROKEN`).
4. Returns a detailed verification result:
   ```json
   {
     "success": true,
     "valid": true,
     "recordsVerified": 1420,
     "startSequence": 1,
     "endSequence": 1420,
     "tamperedSequences": [],
     "verificationTimestamp": "2026-11-06T20:30:00.000Z"
   }
   ```

---

## 4. Compliance Framework Registry & Control Mapping

The system ships with default baselines for four major governance and security frameworks:

### 4.1 Supported Frameworks
1. **ISO/IEC 27001:2022** — Information Security Management:
   - Focus: A.5.15 (Access Control), A.8.12 (Data Leakage Prevention), A.8.15 (Logging & Monitoring).
2. **ISO/IEC 42001:2023** — Artificial Intelligence Management System (AIMS):
   - Focus: AI Risk Assessment, System Lifecycle Governance, Human Oversight, Continuous Monitoring.
3. **NIST AI Risk Management Framework 1.0 (AI RMF)**:
   - Focus: GOVERN (Policies & Structure), MAP (Context & Impact), MEASURE (Testing & Evaluation), MANAGE (Controls & Incident Response).
4. **SOC 2 Trust Services Criteria (2017)**:
   - Focus: CC6.1 (Logical Access), CC6.6 (Boundary Protection), CC6.7 (Data Transmission Protection), CC7.2 (System Monitoring).

### 4.2 Authorized Verification Workflow
- Automated scanning marks controls as `AUTOMATED_PASS`, `AUTOMATED_FAIL`, or `REQUIRES_REVIEW`.
- Controls **cannot** be marked as fully compliant or satisfied through self-certification.
- Transitions to `VERIFIED` require explicit human review by an authorized administrator (`POST /controls/:controlId/verify`), recording the `reviewerId`, verification rationale, and associated evidence IDs.

---

## 5. Controlled Evidence Hub & Packaging

### 5.1 Evidence Collection
Evidence items (`agent_compliance_evidence`) can be collected manually by authorized reviewers or automatically by system triggers (e.g., policy evaluations, security incidents).
- Each evidence item contains a title, description, category, data classification, and raw metadata/attachments.
- Upon ingestion, the service calculates an immutable SHA-256 content hash (`contentHash`).
- Access to evidence items is logged in the compliance audit trail.

### 5.2 Evidence Package Export
Enterprise auditors require portable, verifiable evidence bundles:
1. The user selects a collection of `evidenceIds` and specifies an export reason and package name.
2. The service verifies tenant ownership for all referenced items.
3. All payloads are recursively scrubbed using `redactObject` to guarantee zero accidental leakage of live credentials.
4. A deterministic export manifest (`manifest.json`) is constructed containing:
   - Package UUID, organization ID, creation timestamp, and metadata.
   - List of items with their individual SHA-256 checksums and classifications.
   - Manifest integrity checksum (`manifestChecksum`).
5. An audit event of category `EVIDENCE_EXPORT` is recorded.
6. The package is returned with a zip-ready JSON bundle.

### 5.3 Offline Package Verifier
Auditors can independently verify package integrity without connecting to the HAZA-AIOS database using the standalone utility:
```ts
import { verifyEvidencePackageOffline } from "./compliance.types.js";

const result = verifyEvidencePackageOffline(manifest, expectedChecksum);
if (result.valid) {
  console.log("Package integrity confirmed by SHA-256 cryptographic manifest.");
} else {
  console.error("Verification failed:", result.error);
}
```

---

## 6. Retention Policies & Legal Holds

### 6.1 Organization-Scoped Retention Policies
Tenants configure minimum retention periods per event category:
- Default retention: 365 days (1 year) for execution events, 2,555 days (7 years) for security, compliance, and governance changes.
- Retention rules specify automated disposal eligibility.

### 6.2 Legal Hold Overrides
- When litigation, regulatory inquiry, or an internal investigation occurs, authorized compliance officers can issue an active **Legal Hold** (`POST /holds`).
- Active legal holds take precedence over all retention expiration rules.
- Any event or evidence item associated with a scope covered by an active legal hold is marked `isLegalHold = 1` and is permanently blocked from automated or manual disposal.
- Releasing a legal hold (`POST /holds/:holdIdentifier/release`) requires an authorized justification and is logged as an immutable audit event.

### 6.3 Dry-Run Disposal Simulation
In Phase 22E, data disposal is strictly non-destructive:
- The endpoint `GET /retention/preview` executes a dry-run calculation.
- It identifies events whose age exceeds the category retention policy **and** are not protected by active legal holds.
- No database rows are deleted. It returns counts, byte estimations, and breakdown by category for governance review.

---

## 7. Audit Investigations & Timeline Reconstruction

### 7.1 Investigation Case Management
Compliance and security teams can open formal investigation cases (`agent_compliance_investigations`):
- Tracks case number, title, status (`OPEN`, `UNDER_REVIEW`, `CLOSED`), severity, assigned investigator, and notes.
- Adding notes or updating status records audit events of category `GOVERNANCE_CHANGE`.

### 7.2 Chronological Timeline Reconstruction
Investigators can reconstruct complete causal timelines for any execution session, agent, or incident:
```
[REQUEST] -> [POLICY EVALUATION] -> [HUMAN APPROVAL] -> [SECURITY CHECK] -> [EXECUTION] -> [OUTCOME]
```
- The service queries all matching compliance events within the target window.
- Search access queries themselves emit compliance audit records, preventing unobserved reconnaissance.

---

## 8. Summary of REST Endpoints

All endpoints are mounted under `/api/v1/organizations/:organizationId/agent-governance/compliance/`:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/overview` | Compliance posture, framework coverage %, audit ledger health |
| `GET` | `/frameworks` | List supported frameworks and compliance stats |
| `GET` | `/controls` | Filter and list compliance controls |
| `GET` | `/controls/:controlId` | Get control details and mapped evidence |
| `POST` | `/controls/:controlId/verify` | Human review verification of a compliance control |
| `GET` | `/audit/events` | Paginated search of normalized compliance events |
| `GET` | `/audit/verify` | Verify cryptographic hash chain integrity |
| `GET` | `/evidence` | List collected evidence items |
| `POST` | `/evidence` | Collect and register a new evidence item |
| `GET` | `/evidence/:evidenceId` | Fetch evidence details (access is audited) |
| `GET` | `/packages` | List generated evidence export packages |
| `POST` | `/packages` | Generate and export a verified evidence package |
| `GET` | `/packages/:packageId` | Download package manifest and contents |
| `POST` | `/packages/verify` | Verify an evidence package manifest checksum |
| `GET` | `/retention/policies` | List retention rules by event category |
| `PUT` | `/retention/policies` | Upsert organization retention duration |
| `GET` | `/retention/preview` | Dry-run disposal simulation (zero deletion) |
| `GET` | `/holds` | List active and historical legal holds |
| `POST` | `/holds` | Create and enforce a legal hold |
| `POST` | `/holds/:holdIdentifier/release` | Release an active legal hold with justification |
| `GET` | `/investigations` | List investigation cases |
| `POST` | `/investigations` | Open a new investigation case |
| `GET` | `/investigations/timeline` | Synthesize chronological causal event timeline |
| `POST` | `/investigations/:caseNumber/notes` | Append notes to an ongoing investigation |

---

## 9. Verification & Test Coverage

The Epic 22E test suite (`apps/api/tests/epic22e-compliance-evidence.test.ts`) verifies 24 scenarios:
- Normalized event ingestion with mandatory metadata and canonical payload hashing.
- Cryptographic hash-chain calculation from genesis block (`0`.repeat(64)) through sequential events.
- Audit integrity verification detecting payload tampering, sequence gaps, and broken linkages.
- Framework registry initialization and authorized human control verification.
- Evidence collection, content hashing, and access logging.
- Deep secret scrubbing during evidence package compilation.
- Package manifest checksum calculation and standalone offline verification.
- Legal hold creation, retention policy overrides, and release workflows.
- Non-destructive dry-run disposal simulation preserving records under hold.
- Investigation case creation, note appending, and chronological timeline synthesis.
- Full multi-tenant isolation across all compliance resources.

**Test Results:**
- `epic22e-compliance-evidence.test.ts`: **24/24 tests passed (100%)**
- Full regression across all 9 Epic 22 suites: **143/143 tests passed (100%)**
- API TypeScript typecheck: **0 errors**
- Web TypeScript typecheck: **0 errors**
- Drizzle schema check (`db:check`): **`Everything's fine 🐶🔥`**
