# HAZA-AIOS — Epic 22A Specification & Implementation Guide
## Enterprise Agent Governance Foundation

**Epic:** Agent Governance & Security  
**Phase:** 22A  
**Branch:** `feature/epic-22-agent-governance-security`  
**Baseline Release:** `v0.21.0-epic21`  
**Target Release:** `v0.22.0-epic22`  

---

## 1. Executive Summary

Phase 22A establishes the enterprise governance and accountability architecture for autonomous AI agents within HAZA-AIOS. It introduces:
1. **Agent Governance Profiles:** Risk tiering, data classification, autonomy caps, tool approval rules, and periodic compliance review cadences.
2. **Ownership & Accountability:** Explicit primary, technical, and business owners with mandatory escalation contacts for every agent.
3. **Governance Policy Registry:** Versioned, lifecycle-managed policies covering security, compliance, behavioral guidelines, and tool/model restrictions.
4. **Immutable Audit Ledger:** Append-only log recording actor, before/after snapshots, and metadata for all governance operations.
5. **Governance Center UI Console:** Comprehensive dark-themed dashboard providing visibility into risk distributions, compliance adherence, policy versions, and ownership assignments.

---

## 2. API Specification

All endpoints are organization-scoped under `/api/v1/organizations/:organizationId/agent-governance/`:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/agent-governance/overview` | Returns aggregate governance stats (profiles, active policies, orphaned agents, review backlog, risk distribution, compliance breakdown). |
| `GET` | `/agent-governance/profiles` | Lists agent governance profiles with optional `riskTier` and `complianceStatus` filters. |
| `GET` | `/agent-governance/profiles/:agentId` | Retrieves profile and ownership assignment for an agent. |
| `PUT` | `/agent-governance/profiles/:agentId` | Creates or updates an agent governance profile. |
| `POST` | `/agent-governance/profiles/:agentId/review` | Records a compliance review outcome and recalculates next review due date. |
| `GET` | `/agent-governance/ownership` | Lists all ownership assignments within the organization. |
| `GET` | `/agent-governance/ownership/:agentId` | Retrieves ownership assignment for an agent. |
| `PUT` | `/agent-governance/ownership/:agentId` | Assigns or updates primary/tech/biz owners and escalation contact. |
| `GET` | `/agent-governance/policies` | Lists policies with filters (`policyType`, `lifecycleState`, `severity`, `scopeType`). |
| `POST` | `/agent-governance/policies` | Creates a new governance policy (initializes v1). |
| `GET` | `/agent-governance/policies/:policyId` | Retrieves policy details and version history. |
| `PUT` | `/agent-governance/policies/:policyId` | Updates policy definitions, creating a new version entry and change summary. |
| `PATCH` | `/agent-governance/policies/:policyId/lifecycle` | Transitions policy lifecycle state (`draft` -> `review` -> `active` -> `deprecated` -> `archived`). |
| `GET` | `/agent-governance/audit-logs` | Queries immutable governance audit log events with optional target filtering and limit. |

---

## 3. Policy Authoring Guide & Examples

### 3.1 Security Policy (PII & Secrets Masking)
```json
{
  "name": "PII & Secrets Masking Policy",
  "policyKey": "sec-pii-masking",
  "policyType": "security",
  "severity": "critical",
  "scopeType": "organization",
  "enforcementAction": "block",
  "rules": {
    "maskPatterns": ["SSN", "CREDIT_CARD", "API_KEY", "JWT_TOKEN"],
    "actionOnDetection": "redact_and_alert"
  }
}
```

### 3.2 Compliance Policy (Periodic SOC2 Certification)
```json
{
  "name": "SOC2 Automated Controls Adherence",
  "policyKey": "comp-soc2-controls",
  "policyType": "compliance",
  "severity": "high",
  "scopeType": "organization",
  "enforcementAction": "warn",
  "rules": {
    "requiredFrameworks": ["SOC2_TYPE_II"],
    "maxReviewCadenceDays": 90,
    "auditEvidenceRetentionDays": 365
  }
}
```

### 3.3 Tool Restriction Policy (External Network Access)
```json
{
  "name": "Outbound HTTP Tool Restrictions",
  "policyKey": "tool-outbound-http",
  "policyType": "tool_restriction",
  "severity": "high",
  "scopeType": "workspace",
  "enforcementAction": "require_approval",
  "rules": {
    "disallowedTools": ["bash_exec", "raw_socket_connect"],
    "allowedDomains": ["api.openai.com", "api.anthropic.com", "haza-aios.internal"]
  }
}
```

---

## 4. Verification & Safety Posture

- **No Docker Dependency:** All development and validation utilizes native Node.js and TypeScript tooling.
- **Zero Paid Token Consumption:** 100% of integration and unit tests execute against in-memory stores with zero live LLM network calls.
- **Production Isolation:** No production database alterations; migration 0032 is validated locally with Drizzle Kit.
- **Runtime Preservation:** Policy evaluation is passive in Phase 22A, guaranteeing zero interference with existing agent executions.
