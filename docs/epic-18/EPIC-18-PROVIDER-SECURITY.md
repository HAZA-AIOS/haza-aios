# HAZA-AIOS — EPIC 18 PROVIDER SECURITY ARCHITECTURE
## Zero-Exposure Credentials, Multi-Tenant Boundaries & Defense-in-Depth

**Document ID:** `HAZA-EPIC-18-SEC-001`  
**Target Release:** `v0.18.0-epic18`  
**Classification:** `CONFIDENTIAL — SECURITY & GOVERNANCE`  
**Status:** `ACTIVE & ENFORCED`  
**Author:** Antigravity AI Systems Architect & Chief Security Officer  
**Date:** 2026-11-02  

---

## 1. Executive Security Statement

The integration of live AI providers (such as OpenAI GPT-4o and Text Embeddings) introduces critical threat vectors, including credential leakage, prompt injection, unauthorized consequential actions, runaway billing, and cross-tenant data exfiltration. 

Epic 18 addresses each threat vector with cryptographic, architectural, and operational controls enforcing **fail-closed, zero-raw-exposure security**.

---

## 2. Threat Matrix & Defensive Controls

| Threat Vector | Severity | Attack Scenario | Defensive Control |
|---|---|---|---|
| **Raw Credential Exfiltration** | Critical | Attacker intercepts network response or inspects logs to steal `sk-...` OpenAI keys | Keys are masked (`sk-...ab12`) before reaching API layer; regex redactor sanitizes all logs, errors, and traces |
| **Cross-Tenant Model Access** | Critical | Tenant A attempts to invoke model using Tenant B's credentials or budget | All provider configurations, keys, and budgets are strictly scoped by `organization_id` in SQL queries |
| **Model Hallucination / Unapproved Actions** | High | Autonomous agent performs unauthorized financial mutations or grade modifications | Consequential tools pause for explicit human supervisor approval; per-agent tool allowlists enforce limits |
| **Vector Space Poisoning** | High | Agent computes cosine similarity across mixed mock and real embeddings, yielding garbage | Strict dimension and provider checks; vectors must match dimensions and provider ID or semantic score is 0 |
| **Prompt Injection via Retrieved Context** | High | Attacker embeds adversarial directives (e.g. `Ignore instructions`) in uploaded documents | Untrusted content delimiters (`<<<UNTRUSTED_CONTENT>>>`) and system prompt isolation prevent override |
| **Runaway Billing / DoS** | High | High-frequency inference loop exhausts organization funds | Daily & monthly budgets enforced fail-closed; circuit breaker pauses requests after 5 consecutive upstream 5xx errors |

---

## 3. Zero Raw Credential Exposure Implementation

### 3.1 Masked Presentation Layer
Frontend clients, administrative dashboards, and API responses never receive raw API keys. The `maskApiKey` utility extracts only the leading 3 characters and trailing 4 characters:

$$\text{Masked}(K) = \text{prefix}(K, 3) + \text{"..."} + \text{suffix}(K, 4)$$

Example: `sk-proj-a1b2c3d4e5f6...7890` becomes `sk-...7890`.

### 3.2 Deep Secret Redactor
All outgoing log messages, error objects, and telemetry payloads are processed through `redactSecrets` and `redactObject`:
- Regular expression patterns strip `sk-[a-zA-Z0-9_\-]{16,}` and replace with `[REDACTED_API_KEY]`.
- Bearer tokens are scrubbed to `Bearer [REDACTED]`.
- Sensitive object properties (`apiKey`, `password`, `secret`, `authorization`, `token`) are automatically sanitized.

---

## 4. Tenant Model Allowlists & Governance

Each tenant organization controls which models can be invoked by their installed agents:
- `allowed_models`: JSON array of model identifiers (e.g. `["gpt-4o-mini"]`).
- Default: Restrictive allowlist containing only low-cost, verified models.
- If an agent requests a model not explicitly present in the tenant allowlist:
  $$\text{ModelAllowed}(m, \text{allowed}) = m \in \text{allowed}$$
  If false, the Provider Gateway immediately rejects the request with HTTP 403 `MODEL_FORBIDDEN`.

---

## 5. Consequential Action & Tool Approval Gates

When an AI agent invokes tools through the `AgentToolGatewayService`:
1. **Tool Allowlist:** The tool must be declared in the agent's installed definition.
2. **Permission Check:** The requesting user must hold the required RBAC permission key (e.g. `academic.manage`).
3. **Approval Policy:**
   - Tools with `approvalPolicy: "human_review"` (such as LMS publishing or grade modification) halt execution, transition the attempt to `awaiting_approval`, and dispatch a pending request to the supervisor's inbox.
   - The AI agent cannot resume execution until a human administrator reviews and approves the tool arguments.

---

## 6. Circuit Breaker & Reliability Engineering

To protect upstream provider quotas and prevent cascading system degradation:
- The Gateway tracks consecutive upstream 5xx, 429, or timeout errors per provider.
- When consecutive failures reach the threshold ($N = 5$):
  - Circuit Breaker transitions to **OPEN**.
  - Subsequent calls fail immediately with HTTP 503 `CIRCUIT_BREAKER_OPEN`.
  - Cool-off timer: 60 seconds.
  - After 60 seconds, the breaker enters **HALF-OPEN** to test provider recovery with a single canary request.

---

## 7. Audit Trails & Accountability

All configuration updates, credential rotations, live mode toggles, and spending limit adjustments create immutable audit records in `ai_provider_audit_logs`:
- `organization_id`: Scoped tenant.
- `provider_id`: Target provider (`openai`).
- `action`: Specific operation (`ENABLE_LIVE_MODE`, `UPDATE_CONFIG`, `UPDATE_BUDGET`).
- `performed_by`: User ID of authorized administrator.
- `previous_state` & `new_state`: Sanitized JSON snapshots.
- `ip_address`: Network origin.
- `created_at`: High-precision timestamp.
