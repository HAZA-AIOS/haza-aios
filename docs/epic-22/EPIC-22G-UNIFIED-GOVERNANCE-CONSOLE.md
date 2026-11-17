# HAZA-AIOS — Epic 22G: Enterprise Governance Console & Unified Operations

## 1. Overview & Objectives

Phase 22G delivers the **Enterprise Governance Console & Unified Operations** layer for HAZA-AIOS, uniting the capabilities of Phases 22A through 22F into a single, cohesive operational control center:
- **Phase 22A**: Agent Governance Foundation (Profiles, Ownership, Lifecycle)
- **Phase 22B**: Policy & Permissions Engine (Deterministic Precedence, Rules, Versioning)
- **Phase 22C**: Human-in-the-Loop Approval Workflows (Dual Sign-off, Escalation, Resume)
- **Phase 22D**: Security Controls, Sandboxing & Secret Protection (Network, Storage, Capabilities, Emergency Stop)
- **Phase 22E**: Compliance, Audit Integrity & Evidence Management (ISO 27001/42001, Hash Chain Ledger, Legal Holds)
- **Phase 22F**: Agent Risk & Trust Management (5x5 Matrix, Dynamic Trust Profiles, Behavioral Alerts, Mitigations, Exceptions)

Phase 22G consolidates all telemetry, evaluation, enforcement, and auditing into an integrated 10-section operational experience with zero fictional data, backed by minimal high-performance REST aggregation endpoints and strict tenant isolation.

---

## 2. 10-Section Information Architecture

The Governance Console provides a structured, multi-domain control center for security officers, compliance auditors, and AI operations leads:

```
+--------------------------------------------------------------------------------------------------+
|                                  HAZA-AIOS GOVERNANCE CONSOLE                                    |
+--------------------------------------------------------------------------------------------------+
| [Overview] [Agent Directory] [Policies] [Approvals] [Security] [Compliance] [Risk] [Activity]   |
| [Action Center] [Reports] [Settings]                                                            |
+--------------------------------------------------------------------------------------------------+
```

1. **Overview (Unified Dashboard)**:
   - **10 Core Operational KPIs**:
     1. `totalGovernedAgents`: Total agents in organization registry.
     2. `activeAgents`: Operational non-suspended agents.
     3. `suspendedAgents`: Agents halted by policy, security event, or manual intervention.
     4. `pendingApprovals`: Pending human approval decisions.
     5. `highAndCriticalRisks`: Active risks scored in High or Critical tiers.
     6. `openSecurityIncidents`: Unresolved security alerts and policy violations.
     7. `auditIntegrityStatus`: Cryptographic audit ledger state (`INTACT` / `COMPROMISED`).
     8. `complianceControlsRequiringReview`: Controls flagged for periodic review or lacking evidence.
     9. `openRiskMitigations`: Active corrective action plans requiring verification.
     10. `expiringExceptions`: Approved risk exceptions expiring within 14 days.
   - **Action Center Callout**: Immediate highlight banner directing operators to pending action items.
   - **Activity Trends**: 7-day volume breakdown across policies, tools, security events, and approvals.
   - **Risk Tier Distribution**: Graphical breakdown across Critical, High, Medium, and Low tiers.
   - **Security Posture & Controls**: Emergency stop status, protected secret references, and incident counts.
   - **Compliance Coverage**: Framework control verification rates and legal holds.
   - **Recent Critical Governance Events Feed**: Real-time cross-domain alert stream.

2. **Agent Governance Directory**:
   - Comprehensive searchable catalog of all governed agents.
   - Filterable by workspace, status (`active`, `suspended`), risk tier (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), and trust tier (`VERY_LOW` to `VERY_HIGH`).
   - Deep inspection drawer displaying:
     - Profile & Review Cadence
     - Accountability & Ownership (Business Owner, Technical Owner, Administrator)
     - Effective Security Sandbox (Network mode, storage mode, allowed domains, disallowed tools, secret references)
     - Trust Profile & Behavioral Telemetry
     - Residual Risk Tier & Mitigations
     - Action buttons: Suspend, Reactivate, Edit Capabilities, Request Exception.

3. **Policy & Permissions**:
   - Central registry of governance rules and mandatory restrictions.
   - Deterministic precedence viewer (`Mandatory Restriction > Explicit Deny > Require Approval > Default Allow`).
   - Version history and side-by-side diffing.
   - Policy Simulation Sandbox for dry-run evaluation without state modification.

4. **Human Approvals**:
   - Pending operational requests requiring human intervention.
   - Role-based routing, review queues, justification tracking, and dual sign-off.
   - Escalation workflows with SLA tracking.
   - Cryptographic fingerprinting and execution continuation.

5. **Security Operations**:
   - Multi-tenant sandboxing and capability matrices.
   - Network egress controls (Blocked, Allowlist, Unrestricted) with domain matching.
   - Storage isolation modes (Blocked, Workspace-Isolated, Temporary-Only).
   - Secret reference lifecycle management (active, rotated, revoked).
   - Organization-wide **Emergency Stop** switch with instant enforcement.

6. **Compliance & Audit**:
   - Automated mapping to ISO 27001, ISO 42001, NIST AI RMF, and SOC 2 frameworks.
   - Cryptographic SHA-256 hash-chained immutable audit ledger.
   - Verified evidence packages with export authorization.
   - Legal holds preventing retention purging.
   - Independent audit investigation dossiers and timeline tracking.

7. **Risk & Trust Management**:
   - Dynamic 5x5 Inherent and Residual Risk Matrix.
   - Multi-dimensional Trust Profiles with neutral baseline for new agents.
   - Behavioral risk anomaly detection (excessive denials, autonomy drift, secret spikes).
   - Corrective mitigation plans and time-bounded risk exceptions with compensating controls.

8. **Unified Activity Timeline**:
   - Cross-domain correlated chronological stream spanning executions, tools, policies, approvals, security events, and compliance logs.
   - Multi-faceted filtering (domain, severity, outcome, date range, correlation ID, trace ID).
   - Deep recursive secret redaction for all inspected metadata payloads.

9. **Governance Reports & Exports**:
   - Executive summaries, security posture audits, compliance reports, and risk assessments.
   - One-click audited exports to JSON and standard RFC 4180 CSV formats.
   - Ingestion audit event automatically logged in compliance ledger upon report generation.

10. **Governance Settings**:
    - Global enforcement mode selection:
      - `MONITOR`: Safe passive evaluation and telemetry logging.
      - `ENFORCE`: Authoritative runtime blocking and approval gates.
      - `DISABLED`: Legacy mode bypassing governance policies while preserving platform baseline security.
    - Emergency stop trigger and resume controls.
    - Risk scoring model configuration and confidence thresholds.

---

## 3. Backend Architecture & REST API Endpoints

### 3.1 REST API Routes
All endpoints require authentication and tenant permission `agent.read` (or `agent.manage` for mutations):

| Method | Path | Description | Required Permission |
|--------|------|-------------|---------------------|
| `GET` | `/api/v1/organizations/:orgId/agent-governance/console/overview` | Aggregated 10 KPIs, trends, and posture summary | `agent.read` |
| `GET` | `/api/v1/organizations/:orgId/agent-governance/console/directory` | Paginated and filtered agent governance directory | `agent.read` |
| `GET` | `/api/v1/organizations/:orgId/agent-governance/console/directory/:agentId` | Enriched single agent governance and sandbox detail | `agent.read` |
| `GET` | `/api/v1/organizations/:orgId/agent-governance/console/activity` | Unified cross-domain activity audit timeline | `agent.read` |
| `GET` | `/api/v1/organizations/:orgId/agent-governance/console/actions` | Prioritized Action Center operational work queue | `agent.read` |
| `GET` | `/api/v1/organizations/:orgId/agent-governance/console/reports` | Comprehensive executive governance report | `agent.read` |
| `POST` | `/api/v1/organizations/:orgId/agent-governance/console/reports/export` | Audited report export in JSON or CSV format | `agent.read` |

### 3.2 Service & Repository Implementation
- **Repository (`agent-governance-console.repository.ts`)**:
  Executes high-efficiency aggregation queries using Drizzle ORM against existing tables (`agentGovernanceProfiles`, `agentSecurityProfiles`, `agentApprovalRequests`, `agentRiskRegister`, `agentTrustProfiles`, `agentComplianceEvents`, etc.) with zero additional migrations.
- **Service (`agent-governance-console.service.ts`)**:
  Coordinates repository queries, applies deep secret sanitization via `redactObject`, audits report exports to the immutable compliance ledger, and formats JSON/CSV output streams.

---

## 4. Frontend Web Implementation

- **Web Client Service (`governance-service.ts`)**:
  Adds strongly-typed client methods: `getConsoleOverview`, `getAgentDirectory`, `getAgentDirectoryDetail`, `getUnifiedActivity`, `getActionCenter`, `getGovernanceReports`, and `exportGovernanceReport`.
- **Governance Console UI (`AgentGovernancePage.tsx`)**:
  Implements the full 10-section operational experience in dark premium styling, with real-time KPI cards, URL tab synchronization (`?tab=...`), interactive drawer dialogs, and instant CSV/JSON browser downloads.

---

## 5. Security & Isolation Controls

1. **Multi-Tenant Isolation**: All aggregation queries bind strictly to `organizationId`. A tenant can never observe another tenant's agents, activity, approvals, or risks.
2. **Workspace Isolation**: Directory and activity queries accept optional `workspaceId` parameters to enforce granular departmental isolation.
3. **Deep Secret Redaction**: All activity log metadata and exported report attributes undergo recursive token and credential masking (`sk-...`, `Bearer [REDACTED]`, `[REDACTED]`).
4. **Audit Immutability**: All report generation and export actions are committed to the SHA-256 hash-chained compliance ledger.
5. **Fail-Safe Emergency Stop**: Emergency stop status is verified at the root of the console and reflects instantaneously across all operational telemetry.
