# HAZA-AIOS — EPIC 18 IMPLEMENTATION PLAN
## Live AI Provider Integration & Production Agent Intelligence

**Document ID:** `HAZA-EPIC-18-PLAN-001`  
**Target Release:** `v0.18.0-epic18`  
**Baseline Release:** `v0.17.0-epic17`  
**Git Branch:** `feature/epic-18-live-ai-provider-integration`  
**Status:** `IN PROGRESS`  
**Author:** Antigravity AI Systems Architect  
**Date:** 2026-11-02  

---

## 1. Executive Summary & Mission Mandate

Epic 18 elevates HAZA-AIOS from simulated/mock agent intelligence to a **secure, tenant-isolated, production-grade Live AI Provider Integration Platform**. 

Building directly upon Epics 11–17 (Agent Runtime, Configuration Builder, Tool Gateway, and Knowledge & Context Engine), Epic 18 delivers real-time inference, streaming, structured outputs, multi-provider abstraction, configurable model pricing, tenant spending budgets, circuit breakers, and policy-controlled semantic vector embeddings without compromising the approved dark premium design, security posture, or budget boundaries.

### Core Architecture Tenets
1. **Zero Raw Credential Exposure:** API keys and provider secrets are encrypted or referenced via secure secret management. Frontend applications and logs receive only masked tokens (e.g. `sk-...ab12`).
2. **Fail-Closed Budget Enforcement:** If a tenant exhausts their allocated daily or monthly AI spend limit, execution halts immediately with a clear budget error. Under no circumstances is a budget bypass permitted.
3. **Strict Separation of Embedding Spaces:** Vectors produced by different providers (e.g. Mock 64-dim vs OpenAI `text-embedding-3-small` 1536-dim) must never be compared in the same similarity calculation. Vector metadata tracks provider, model, version, and dimensionality.
4. **Governed Tool Execution:** When models invoke tools, all calls pass through the trusted `AgentToolGatewayService` enforcing RBAC permissions, per-agent allowlists, argument schema validation, human approval for consequential actions, execution timeouts, and loop guards.
5. **Configurable Model Pricing:** Model pricing parameters are stored in a dedicated catalog rather than hardcoded, enabling verified audit trails and accurate per-token accounting.
6. **Live Mode Disabled by Default:** Systems default to deterministic mock mode for CI, staging, and zero-cost test runs. Live inference is activated strictly upon explicit authorized policy activation.

---

## 2. Baseline Architecture Audit & Current State

- **Monorepo Baseline:** Commit `c0e84500fcbcf2df009d34b645104c1785e6bb3c` (`main`), tagged `v0.17.0-epic17`.
- **Production Endpoints:**
  - API: `https://api.haza-aios.com` (Online, Node.js + Express/Drizzle)
  - Web: `https://web-production-76faf.up.railway.app` (Online, React + Vite + Tailwind + @haza-aios/ui)
  - Worker: `worker` service (Online, durable job execution)
  - Database: Railway MySQL with 27 applied migrations through `0027_agent_knowledge_context_engine.sql`.
- **Existing Agent Foundation:**
  - `apps/api/src/modules/agents/providers/`: Abstract `AiProvider` interface, `MockAiProvider`, `OpenAiProvider`, `AiProviderRegistry`.
  - `apps/api/src/modules/agents/embeddings/`: Abstract `EmbeddingProvider` interface, `MockEmbeddingProvider`, `OpenAiEmbeddingProvider`, `EmbeddingProviderRegistry`.
  - `apps/api/src/modules/agents/services/`: `AgentRuntimeService`, `KnowledgeService`, `HybridSearchService`, `ContextEngineService`.
  - `apps/api/src/modules/agents/tools/`: `AgentToolGatewayService`, `trusted-tool-registry.ts`.
  - Demo Organization: `HAZA-AIOS Demo Academy` (`00000000-0000-4710-a000-000000000001`) with 31 verified fictional Grade 6 Science LMS learning sections and a dedicated RAG knowledge library.

---

## 3. Sequential Implementation Phases

```
+-------------------------------------------------------------------------------------------------------+
|                                    EPIC 18 EXECUTION ROADMAP                                          |
+-------------------------------------------------------------------------------------------------------+
|                                                                                                       |
|  [Phase 18A: Provider Gateway & Config]                                                               |
|  - Unified Gateway, Tenant Configs, Secret Redaction, Auditing, Policy-Driven Embedding Selection    |
|                                       │                                                               |
|                                       ▼                                                               |
|  [Phase 18B: Live Inference & Streaming]                                                              |
|  - Real Model Calling, Streaming SSE / Chunks, Structured JSON Validation, Timeouts, Error Normalization |
|                                       │                                                               |
|                                       ▼                                                               |
|  [Phase 18C: Live Embeddings & RAG Grounding]                                                         |
|  - Explicit Embedding Provider Selection, Dimension Checks, Isolation, Re-indexing, Grounded Citations |
|                                       │                                                               |
|                                       ▼                                                               |
|  [Phase 18D: Intelligent Agent Tool Execution]                                                        |
|  - Model Tool Calls, Parameter Validation, Human Approvals, Loop Prevention, Timeout Handling         |
|                                       │                                                               |
|                                       ▼                                                               |
|  [Phase 18E: Cost, Security & Reliability]                                                            |
|  - Token Metering, Usage Ledger, Tenant Budgets, Fail-Closed Enforcement, Circuit Breakers            |
|                                       │                                                               |
|                                       ▼                                                               |
|  [Phase 18F: Acceptance & Production Release]                                                         |
|  - 18 Verification Scenarios, Demo Academy Acceptance, Docs, PR #57, CI Pass, Deploy & Smoke Test   |
|                                                                                                       |
+-------------------------------------------------------------------------------------------------------+
```

### Phase 18A — Provider Gateway and Configuration
- **Migration 0028:** Add `ai_provider_tenant_configs`, `ai_provider_audit_logs`, `ai_model_pricing_catalog`, `ai_usage_budgets`, and `ai_usage_ledger`.
- **Unified AI Provider Gateway:** Implements tenant-aware model resolution, credential masking, configuration discovery, and health probes.
- **Explicit Embedding Selection:** Replaces auto-selection in `EmbeddingProviderRegistry` with tenant policy control.
- **Admin & Workspace Web UI:** Dark premium configuration views in `apps/web` allowing authorized admins to manage provider keys (masked), select allowed models, toggle live/mock mode, and view health status.

### Phase 18B — Live Inference and Streaming
- **Live Inference Engine:** Upgrades `OpenAiProvider` to support true live invocations with SSE / streaming chunk support, structured JSON validation (Zod-compatible or JSON-schema), tool-call argument extraction, timeouts, and `AbortSignal` cancellation.
- **Provider Error Normalization:** Standardizes upstream HTTP errors (401, 429, 500, 503) into typed `AiProviderError` instances with clear retryable flags and correlation IDs.
- **Deterministic Mock Provider Preservation:** Mock provider remains fully intact for offline environments, zero-cost CI pipelines, and unit tests.

### Phase 18C — Live Embeddings and RAG
- **Dimension & Provider Compatibility Guard:** `HybridSearchService` checks chunk vector metadata before computing cosine similarity. Never blends 64-dim mock with 1536-dim real vectors.
- **Reindexing Pipeline:** Added administrative action to re-embed and re-index knowledge collections when migrating between providers or models.
- **Provenance & Grounding:** Enhances context packaging with explicit chunk IDs, section headings, and citation references verified against retrieved sources.

### Phase 18D — Intelligent Agent Tool Execution
- **Tool Selection Engine:** Converts tool declarations into model function signatures and translates model tool calls into `AgentToolGatewayService` execution requests.
- **Security & Approval Guards:** Enforces agent tool allowlists, verifies tenant boundaries, pauses for human approval on consequential actions (e.g. creating lesson plans, updating marks), and limits max tool calls per attempt (default 5) with infinite loop detection.

### Phase 18E — Cost, Security and Reliability
- **Usage Metering & Ledger:** Records tokens, duration, and calculated costs for every inference and embedding operation in `ai_usage_ledger`.
- **Budget Enforcer:** Checks daily and monthly limits before dispatching requests. Fails closed when budget is exhausted.
- **Circuit Breaker:** Tracks consecutive failures per provider (trip threshold: 5 consecutive failures, cool-off: 60s) to prevent cascading downtime or wasteful retries.

### Phase 18F — Acceptance and Production Release
- **18 Required Acceptance Scenarios:** Executed on the fictional HAZA-AIOS Demo Academy.
- **Regression Testing:** Full test suite execution across API and Web packages.
- **Production Lifecycle:** Verified backup, isolated dry-run migration rehearsal, pull request creation, CI verification, merge, release tag `v0.18.0-epic18`, Railway deployment, and live production smoke testing.

---

## 4. Database Schema Specifications (Migration `0028`)

### 4.1 `ai_provider_tenant_configs`
Stores tenant-specific provider credentials (encrypted/masked), status, and mode flags.
- `id` (char 36, PK)
- `organization_id` (char 36, FK to `organizations.id`)
- `provider_id` (varchar 60, e.g. `openai`, `mock`)
- `live_mode_enabled` (boolean, default `false`)
- `environment_mode` (varchar 30, default `'mock'`)
- `api_key_encrypted` (text, nullable)
- `api_key_masked` (varchar 60, nullable, e.g. `sk-...ab12`)
- `default_model` (varchar 120, default `'gpt-4o-mini'`)
- `allowed_models` (json, default `'["gpt-4o-mini", "gpt-4o"]'`)
- `embedding_model` (varchar 120, default `'text-embedding-3-small'`)
- `embedding_live_enabled` (boolean, default `false`)
- `status` (varchar 40, default `'inactive'`)
- `status_message` (varchar 500, nullable)
- `last_health_check_at` (timestamp, nullable)
- `updated_by` (char 36, FK to `users.id`)
- `created_at` / `updated_at` (timestamp)
- Unique: `(organization_id, provider_id)`

### 4.2 `ai_provider_audit_logs`
Immutable audit trail for all provider configuration and security changes.
- `id` (char 36, PK)
- `organization_id` (char 36, FK to `organizations.id`)
- `provider_id` (varchar 60)
- `action` (varchar 60)
- `performed_by` (char 36, FK to `users.id`)
- `previous_state` (json, masked)
- `new_state` (json, masked)
- `ip_address` (varchar 45, nullable)
- `created_at` (timestamp)

### 4.3 `ai_usage_budgets`
Tenant-level spending caps and current period tracking.
- `id` (char 36, PK)
- `organization_id` (char 36, FK to `organizations.id`)
- `workspace_id` (char 36, FK to `workspaces.id`, nullable)
- `monthly_budget_usd` (decimal 10,4, default 50.0000)
- `daily_budget_usd` (decimal 10,4, default 10.0000)
- `per_request_max_cost_usd` (decimal 10,4, default 1.0000)
- `current_month_spend_usd` (decimal 10,4, default 0.0000)
- `current_day_spend_usd` (decimal 10,4, default 0.0000)
- `month_reset_at` (timestamp)
- `day_reset_at` (timestamp)
- `enforce_hard_limit` (boolean, default `true`)
- `notify_threshold_percent` (int, default 80)
- `status` (varchar 40, default `'active'`)
- `updated_by` (char 36, FK to `users.id`)
- `created_at` / `updated_at` (timestamp)
- Unique: `(organization_id, workspace_id)`

### 4.4 `ai_model_pricing_catalog`
Configurable model pricing parameters.
- `id` (char 36, PK)
- `provider_id` (varchar 60)
- `model_id` (varchar 120)
- `prompt_per_thousand_tokens_usd` (decimal 10,6)
- `completion_per_thousand_tokens_usd` (decimal 10,6)
- `embedding_per_thousand_tokens_usd` (decimal 10,6, default 0)
- `context_window` (int)
- `max_output_tokens` (int)
- `supports_streaming` (boolean, default `true`)
- `supports_tools` (boolean, default `true`)
- `supports_vision` (boolean, default `false`)
- `supports_json_mode` (boolean, default `true`)
- `is_active` (boolean, default `true`)
- `updated_at` (timestamp)
- Unique: `(provider_id, model_id)`

### 4.5 `ai_usage_ledger`
Granular invocation telemetry and cost auditing.
- `id` (char 36, PK)
- `organization_id` (char 36, FK to `organizations.id`)
- `workspace_id` (char 36, FK to `workspaces.id`, nullable)
- `agent_id` (char 36, nullable)
- `run_id` (char 36, nullable)
- `provider_id` (varchar 60)
- `model_id` (varchar 120)
- `operation_type` (varchar 40, e.g. `chat_completion`, `streaming_chunk`, `embedding`, `tool_execution`)
- `prompt_tokens` (int, default 0)
- `completion_tokens` (int, default 0)
- `total_tokens` (int, default 0)
- `estimated_cost_usd` (decimal 10,6, default 0)
- `actual_cost_usd` (decimal 10,6, nullable)
- `latency_ms` (int, default 0)
- `finish_reason` (varchar 40, nullable)
- `is_live_mode` (boolean, default `false`)
- `correlation_id` (varchar 120, nullable)
- `created_at` (timestamp)

---

## 5. Acceptance Verification Matrix

| # | Test Scenario | Acceptance Criteria |
|---|---|---|
| 1 | Provider Registration & Config | Admin creates/updates OpenAI config; masked key returned; audit record created |
| 2 | Credential Redaction | Raw key never appears in responses, logs, or error stack traces |
| 3 | Live-Mode Disabled Behavior | When live mode is false, invocation uses deterministic mock without external network calls |
| 4 | Model Capability Validation | Gateway validates model supports tools, json_mode, and bounds check context window |
| 5 | Streaming & Cancellation | Stream produces typed chunks; abort signal cleanly terminates in-flight request |
| 6 | Structured Responses | Model output validates against expected JSON schema; malformed output retries or rejects |
| 7 | Tool Selection & Execution | Model tool call invokes registered tool; result returns to model context |
| 8 | Unauthorized Tool Rejection | Model attempt to invoke tool outside agent allowlist fails closed |
| 9 | Tenant Isolation | Organization A cannot read or invoke Organization B's provider configuration or keys |
| 10 | Mock vs Live Embedding Separation | Cosine similarity rejected if chunk vector dimensions mismatch query vector |
| 11 | RAG Citation Correctness | Generated citations match real retrieved chunks from Demo Academy library |
| 12 | Reindexing & Source Deletion | Reindexing updates vector metadata; source deletion drops associated embeddings |
| 13 | Token Metering | Usage ledger accurately tracks prompt, completion, and total tokens |
| 14 | Budget Enforcement | Request exceeding daily/monthly budget halts with `BUDGET_EXCEEDED` error |
| 15 | Rate Limiting | Gateway throttles high-frequency bursts according to tenant policy |
| 16 | Circuit Breaker & Recovery | 5 consecutive upstream 5xx errors trip breaker; recovers after cool-off |
| 17 | Academic Planning Assistant | Full lesson plan generation with curriculum RAG, tool validation, and grounding |
| 18 | Monorepo Regression Suites | 100% pass across all API and Web unit, integration, and typecheck suites |

---

## 6. Controlled Release Strategy

1. **Feature Branch:** `feature/epic-18-live-ai-provider-integration`
2. **Phase Implementation:** Phases 18A through 18F committed sequentially.
3. **Database Safety:**
   - Production backup via `scripts/backup-production-epic18.ts`.
   - Isolated dry-run migration rehearsal via `scripts/rehearsal-epic18.ts`.
4. **Pull Request:** Open PR from `feature/epic-18-live-ai-provider-integration` to `main`.
5. **Quality Verification:** Automated CI runs `npm run test:api`, `npm run typecheck:api`, `npm run check:web`.
6. **Release Tagging:** Create annotated git tag `v0.18.0-epic18` only after merge into `main`.
7. **Railway Deployment:** Verify API, Web, Worker, and MySQL deployments.
8. **Smoke Testing:** Execute automated production health and smoke tests against live endpoints.
