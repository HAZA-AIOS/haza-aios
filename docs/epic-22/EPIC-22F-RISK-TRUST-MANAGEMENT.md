# HAZA-AIOS — Epic 22F: Enterprise Agent Risk & Trust Management

## 1. Architectural Overview & Threat Model

### 1.1 Objective
Epic 22F introduces an enterprise-grade Agent Risk & Trust Management architecture into HAZA-AIOS. It integrates with existing Governance Foundation (22A), Policy Engine (22B), Human Approvals (22C), Security Controls & Sandboxing (22D), and Compliance & Audit Evidence (22E) to provide deterministic risk assessment, multidimensional trust profiling, operational behavioral anomaly detection, and risk-based governance recommendations.

```
+--------------------------------------------------------------------------------------------------+
|                                    HAZA-AIOS Agent Ecosystem                                     |
|  [Agent Runtime] -> [Tool Gateway] -> [Policy Engine 22B] -> [Approvals 22C] -> [Security 22D]   |
+--------------------------------------------------------------------------------------------------+
                                                |
                                    Operational Signals Stream
                                                v
+--------------------------------------------------------------------------------------------------+
|                          Enterprise Risk & Trust Management (Epic 22F)                           |
|                                                                                                  |
|   +------------------------------------+          +------------------------------------------+   |
|   |         Risk Register (10 Cats)    |          |        Deterministic Assessment Engine   |   |
|   |   - Security, Privacy, Compliance  |          |   - Inherent = Likelihood x Impact (1-25)|   |
|   |   - Operational, Financial, etc.   |  =====>  |   - Verified Controls Effectiveness      |   |
|   |   - Tenant-Scoped & Versioned      |          |   - Residual Score Capped at 85% Reduct. |   |
|   +------------------------------------+          +------------------------------------------+   |
|                     |                                                   |                        |
|                     v                                                   v                        |
|   +------------------------------------+          +------------------------------------------+   |
|   |   Multidimensional Trust Profiles  |          |       Behavioral Risk Detection          |   |
|   |   - 7 Operational Dimensions       |          |   - 10 Deterministic Rules               |   |
|   |   - 0-100 Continuous Score         |          |   - Fingerprinted Alert Deduplication    |   |
|   |   - Neutral Baseline (70) < 5 Ops  |          |   - Hourly Rate Window Deduplication     |   |
|   |   - LOW / MED / HIGH Confidence    |          |   - Acknowledge / Resolve Workflows      |   |
|   +------------------------------------+          +------------------------------------------+   |
|                     |                                                   |                        |
|                     v                                                   v                        |
|   +------------------------------------+          +------------------------------------------+   |
|   |    Mitigations & Exception Hub     |          |       Risk-Based Governance Engine       |   |
|   |   - Compensating Controls & Actions|          |   - Recommendations: ALLOW/MONITOR/APPROV|   |
|   |   - Verified Reviewer Evidence     |          |   - RESTRICT / SUSPEND                   |   |
|   |   - No Permanent Exceptions        |          |   - Security Denial Absolute Precedence  |   |
|   |   - Self-Approval Prevention       |          |   - Simulation Mode (Default Disabled)   |   |
|   +------------------------------------+          +------------------------------------------+   |
+--------------------------------------------------------------------------------------------------+
```

### 1.2 Threat Model & Inherent Safety Safeguards
- **Threat Vector 1: False Trust Attribution (Cold-Start Problem)**
  - *Risk:* New or unverified agents given 0 operations could be mistakenly marked untrustworthy, breaking business workflows, or given arbitrary high trust without proof.
  - *Mitigation:* Agents with fewer than `minOperationsForConfidence` (default 5) are assigned a neutral baseline trust score (70) with `trustConfidence = "LOW"` and `isInsufficientEvidence = true`.
- **Threat Vector 2: Control Effectiveness Fallacy**
  - *Risk:* Organizations listing unverified or ineffective controls to artificially depress residual risk scores.
  - *Mitigation:* Ineffective controls receive 0% reduction. Partially effective controls yield 20%, effective controls yield 40%, and total control reduction is strictly capped at 85% (`residualScore >= 1`).
- **Threat Vector 3: Security Bypass via Trust Level**
  - *Risk:* An agent with a 100/100 trust score attempting an unauthorized system action (e.g., SSRF, forbidden file modification) claiming immunity due to trust score.
  - *Mitigation:* Explicit security denials take absolute precedence (`mandatorySecurityOverrideApplied = true`). Risk scores can never bypass mandatory security boundaries, sandboxing, or RBAC.
- **Threat Vector 4: Self-Approval of High-Risk Exceptions**
  - *Risk:* An operator or developer creating a high-risk exception and self-approving it to bypass governance checks.
  - *Mitigation:* Self-approval is cryptographically and procedurally prohibited (`requestedBy === approvedBy` throws HTTP 400). All exceptions must have an explicit future expiration date.

---

## 2. Risk Assessment Engine

### 2.1 Formula & Thresholds
- **Inherent Risk:**
  $$\text{Inherent Score} = \text{Likelihood} \times \text{Impact} \quad (1 \le \text{Likelihood, Impact} \le 5, \quad 1 \le \text{Score} \le 25)$$
- **Default Threshold Mapping:**
  - $1 \le \text{Score} \le 5 \implies \text{LOW}$
  - $6 \le \text{Score} \le 11 \implies \text{MEDIUM}$
  - $12 \le \text{Score} \le 19 \implies \text{HIGH}$
  - $20 \le \text{Score} \le 25 \implies \text{CRITICAL}$
- **Residual Risk:**
  $$\text{Residual Score} = \max\left(1, \text{round}\left(\text{Inherent Score} \times (1 - \min(0.85, \text{Total Control Reduction}))\right)\right)$$
  - `EFFECTIVE`: 40% reduction
  - `PARTIALLY_EFFECTIVE`: 20% reduction
  - `INEFFECTIVE`: 0% reduction

---

## 3. Multidimensional Agent Trust Profiles

### 3.1 Dimensions & Weights
1. **Execution Reliability (20%):** Task completion and execution success rate.
2. **Policy Adherence (20%):** Rate of policy evaluation passes vs denials.
3. **Security Incident History (20%):** Sandbox, injection, and authorization compliance.
4. **Human Approval Outcomes (10%):** Human approval pass rate vs rejections.
5. **Tool Execution Safety (10%):** Tool invocation success vs failures.
6. **Compliance Evidence Quality (10%):** Ratio of verified compliance evidence.
7. **Operational Consistency (10%):** Cost and runtime predictability.

### 3.2 Confidence Levels
- $< 5$ operations: `LOW` confidence (neutral score 70)
- $5 - 19$ operations: `MEDIUM` confidence
- $\ge 20$ operations: `HIGH` confidence

---

## 4. Behavioral Risk Detection Rules (10 Rules)
1. `REPEATED_POLICY_DENIALS`: $\ge 3$ policy evaluation denials in lookback window.
2. `EXCESSIVE_FAILED_TOOL_INVOCATIONS`: $\ge 5$ tool execution failures in window.
3. `REPEATED_UNAUTHORIZED_ACCESS`: $\ge 2$ 403 Forbidden / unauthorized attempts.
4. `SUDDEN_TOOL_USAGE_SPIKE`: $\ge 20$ tool invocations in short observation window.
5. `UNUSUAL_EXTERNAL_NETWORK_DESTINATIONS`: Non-whitelisted external network traffic.
6. `REPEATED_APPROVAL_REJECTIONS`: $\ge 2$ human review rejections.
7. `UNEXPECTED_PRIVILEGE_ESCALATION`: Unauthorized capability transition attempts.
8. `SECURITY_CONTROL_VIOLATIONS`: Breaches of sandbox, SSRF, or credential controls.
9. `EXCESSIVE_EXECUTION_COST_OR_RUNTIME`: Cost budget or timeout breaches.
10. `AGENT_EXECUTION_FAILURE_SPIKES`: Execution failure rate exceeding 50% across $\ge 4$ runs.

### 4.1 Deduplication & Suppression
- Fingerprint Formula: `SHA-256(organizationId + agentId + rule + dateBucket)`
- Recurrent anomalies increment `occurrenceCount` and update `lastDetectedAt` without flooding the database.
- Acknowledge and resolve workflows provide human-in-the-loop audit notes and status tracking.

---

## 5. Risk-Based Governance Integration
- Recommendations: `ALLOW`, `MONITOR`, `REQUIRE_APPROVAL`, `RESTRICT`, `SUSPEND`.
- Enforcement is disabled by default (`riskEnforcementEnabled = false`), operating in simulation mode (`[SIMULATION MODE]`).
- Mandatory security denials (`explicitSecurityDenial = true`) override any trust score or risk exception, enforcing immediate `SUSPEND`.

---

## 6. Database Migration 0036
- Relational schema defined in `0036_agent_risk_trust_management.sql`:
  - `agent_risk_configurations`
  - `agent_risk_register`
  - `agent_risk_assessments`
  - `agent_trust_profiles`
  - `agent_trust_assessment_history`
  - `agent_behavioral_risk_alerts`
  - `agent_risk_mitigations`
  - `agent_risk_exceptions`
  - `agent_risk_review_history`

---

## 7. Verification & Operational Readiness
- Dedicated test suite: `apps/api/tests/epic22f-risk-trust.test.ts` (25/25 passing).
- Regression suite: 183 tests passing across Epics 18–22.
- Web UI tab added to `AgentGovernancePage.tsx` with 8 sub-views and 4 modal dialogs.
