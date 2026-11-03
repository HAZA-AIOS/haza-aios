# HAZA-AIOS — EPIC 18 COST CONTROLS & USAGE GOVERNANCE
## Configurable Pricing, Fail-Closed Budgets & Real-Time Ledger Metering

**Document ID:** `HAZA-EPIC-18-COST-001`  
**Target Release:** `v0.18.0-epic18`  
**Classification:** `FINANCIAL & OPERATIONAL CONTROLS`  
**Status:** `ACTIVE & ENFORCED`  
**Author:** Antigravity AI Systems Architect & Platform Economist  
**Date:** 2026-11-02  

---

## 1. Executive Cost Governance Mandate

The primary financial risk of live AI integration is unexpected consumption spikes resulting from high-frequency agent loops, runaway streaming sessions, large context windows, or unmonitored user requests.

Epic 18 implements an uncompromising **fail-closed financial governance engine**. When an organization reaches its configured spending ceiling, AI inference is halted immediately. Under no circumstances is a budget boundary bypassed.

---

## 2. Configurable Pricing Catalog

Model pricing fluctuates over time and varies across provider agreements. HAZA-AIOS eliminates permanently hardcoded rates by introducing `ai_model_pricing_catalog`:

### 2.1 Schema Definition
- `provider_id`: Unique provider identifier (`openai`, `mock`).
- `model_id`: Target model (`gpt-4o-mini`, `gpt-4o`, `text-embedding-3-small`).
- `prompt_per_thousand_tokens_usd`: Ingress token rate ($ / 1K tokens).
- `completion_per_thousand_tokens_usd`: Egress token rate ($ / 1K tokens).
- `embedding_per_thousand_tokens_usd`: Vector embedding rate ($ / 1K tokens).
- `context_window` & `max_output_tokens`: Token boundary constraints.
- `is_active`: Operational toggle.

### 2.2 Default Baseline Rates (USD)

| Model ID | Input / 1K Tokens | Output / 1K Tokens | Embedding / 1K Tokens | Context Window |
|---|---|---|---|---|
| `gpt-4o-mini` | $0.00015 | $0.00060 | — | 128,000 |
| `gpt-4o` | $0.00500 | $0.01500 | — | 128,000 |
| `gpt-4-turbo` | $0.01000 | $0.03000 | — | 128,000 |
| `text-embedding-3-small` | — | — | $0.00002 | 8,191 |
| `mock-gpt-4o` | $0.00000 | $0.00000 | $0.00000 | 128,000 |

---

## 3. Real-Time Token Metering & Cost Calculations

Every invocation response computes exact token usage:

$$\text{Cost}_{\text{inference}} = \left(\frac{T_{\text{prompt}}}{1000} \times P_{\text{prompt}}\right) + \left(\frac{T_{\text{completion}}}{1000} \times P_{\text{completion}}\right)$$

$$\text{Cost}_{\text{embedding}} = \left(\frac{T_{\text{total}}}{1000} \times P_{\text{embedding}}\right)$$

For streaming responses, token counts are derived from token chunks emitted during the SSE lifecycle and recorded upon stream termination.

---

## 4. Multi-Tenant Budget Enforcement Architecture

### 4.1 Spending Hierarchy
1. **Per-Request Cost Ceiling:** Default $1.00 USD. Rejects single payloads estimated to exceed the safety cap.
2. **Daily Spending Limit:** Default $10.00 USD. Prevents intraday spikes from draining monthly allocations.
3. **Monthly Spending Limit:** Default $50.00 USD. Sets the maximum allowable aggregate spend per calendar month.

### 4.2 Fail-Closed Boundary Verification
Before any model invocation is dispatched to a live provider, `UnifiedAiProviderGateway.checkBudget()` evaluates current cumulative spend:

$$\text{AllowInvocation} = (\text{Spend}_{\text{day}} < \text{Limit}_{\text{day}}) \land (\text{Spend}_{\text{month}} < \text{Limit}_{\text{month}})$$

If false, execution is halted immediately:
- HTTP 429 `BUDGET_EXCEEDED` returned to caller.
- Zero external requests sent to live provider.
- Failure event logged in audit trail.
- System **never falls back to an unapproved bypass**.

---

## 5. Granular Usage Ledger (`ai_usage_ledger`)

Every AI operation creates an immutable row in `ai_usage_ledger`:
- `organization_id`: Tenant context.
- `workspace_id`: Local workspace context.
- `agent_id`: Initiating agent.
- `run_id`: Execution attempt ID.
- `provider_id` & `model_id`: Consumed AI service.
- `operation_type`: `chat_completion`, `streaming_completion`, `embedding`.
- `prompt_tokens`, `completion_tokens`, `total_tokens`.
- `estimated_cost_usd` & `actual_cost_usd`.
- `latency_ms`: Duration of upstream call.
- `is_live_mode`: Boolean flag distinguishing mock vs live spend.
- `correlation_id`: Distributed tracing key.
