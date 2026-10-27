# HAZA-AIOS — EPIC 11: AI AGENT PLATFORM FOUNDATION
## Comprehensive Implementation Plan & Architecture Specification

**Project:** HAZA-AIOS  
**Workspace:** `C:\HAZA-APPS\HAZA-AIOS`  
**Repository:** `HAZA-AIOS/haza-aios`  
**Branch:** `feature/epic-11-agent-platform-foundation`  
**Target Branch:** `main`  
**Baseline Release:** `v0.10.14-epic10n` (`271f614`)  
**Proposed Release Tag:** `v0.11.0-epic11`  
**Status:** In Progress — Phase 1 Architecture & Design  
**Date:** October 27, 2026

---

## 1. Executive Summary & Objective

Epic 11 establishes the **AI Agent Platform Foundation** for HAZA-AIOS as a secure, production-grade, extensible, multi-tenant module. The platform provides the architectural core required to support autonomous and human-in-the-loop AI agents across education, healthcare, government, and enterprise domains.

This implementation establishes the foundation cleanly and modularly, avoiding premature coupling to specific external AI vendors while enforcing strict multi-tenant data isolation, declarative capability boundaries, lifecycle state machines, safe configuration management with credential redaction, and complete audit observability.

---

## 2. Non-Negotiable Constraints & Architectural Principles

1. **Design Preservation:** Retain the approved enterprise dark dashboard visual language, design tokens, and typography.
2. **Component Library Centralization:** All new UI primitives are placed in `@haza-aios/ui` before consuming them in feature views.
3. **Multi-Tenant Isolation:** Enforce tenant isolation on every database query, repository method, and API endpoint using `createTenantContext(organizationId)`.
4. **Provider Neutrality:** Zero hardcoded AI vendors, models, or credentials. Model invocations flow through provider-neutral TypeScript contracts.
5. **Reversible & Additive Migrations:** Database migrations are strictly additive with explicit rollbacks, tested against local MySQL 8.4.9 (`127.0.0.1:3307`).
6. **No Production Modification:** Local development only. No production migrations or Railway deployments during development.
7. **Default-Deny Capabilities:** Agents can only invoke explicitly declared capabilities. Undeclared capabilities are blocked by default.
8. **Credential Safety:** Never expose provider API keys or sensitive credentials in client responses, logs, or snapshots.

---

## 3. Domain Model Architecture

### 3.1 Separation of Definitions vs. Instances
To support a future global agent marketplace alongside tenant-specific customizations:
- **Agent Definition (`ai_agent_templates`):** Reusable, cataloged agent template declaring metadata, version, category, industry, required permissions, configuration schema, input/output schemas, and capability declarations.
- **Tenant Agent Instance (`ai_agent_definitions`):** Tenant-owned, workspace-scoped instance instantiated from an agent template (or custom definition) containing tenant-specific instructions, runtime model selection, configuration payload, assigned tools, and lifecycle state.

### 3.2 Lifecycle State Machine
Supported lifecycle states:
- `draft`: Newly instantiated agent instance awaiting initial configuration.
- `configured`: Agent with valid configuration, ready for review or testing.
- `active`: Fully operational agent permitted to process executions and handle runs.
- `suspended`: Temporarily halted agent instance; cannot execute runs until resumed.
- `archived`: Soft-deleted / retired agent instance; preserved for historical records.

```
       ┌───────────┐
       │   draft   │
       └─────┬─────┘
             │ (complete required config)
             ▼
       ┌───────────┐         (activate)          ┌───────────┐
       │configured │ ───────────────────────────► │  active   │
       └─────┬─────┘                              └─────┬─────┘
             │                                          │  ▲
             │                                 (suspend)│  │(resume)
             │                                          ▼  │
             │                                    ┌───────────┐
             │                                    │ suspended │
             │                                    └─────┬─────┘
             │                                          │
             │                 (archive)                │
             └──────────────────────────────────────────┴────► ┌───────────┐
                                                               │ archived  │
                                                               └───────────┘
```

**Activation Safety Gate:** An agent instance cannot transition to `active` unless all required fields declared in the template's `configurationSchema` are fulfilled.

---

## 4. AI Provider Abstraction

### 4.1 Core Provider Contracts (`apps/api/src/modules/agents/providers/`)
- `AiProvider`: Core interface exposing provider metadata, model catalogs, configuration validation, and request invocation.
- `ModelInvocationRequest`: Provider-agnostic invocation structure containing messages (`system`, `user`, `assistant`, `tool`), parameters (`temperature`, `maxTokens`), timeout limits, and `AbortSignal`.
- `ModelInvocationResponse`: Structured response containing content, finish reasons, token usage (`promptTokens`, `completionTokens`, `totalTokens`), latency metrics, and metadata.
- `AiProviderError`: Typed error hierarchy covering timeout, rate-limiting, authentication, validation, and upstream outages.
- `MockAiProvider`: Deterministic, in-memory implementation supporting latency simulation, configurable mock responses, token calculation, and cancellation testing without external API dependencies.
- `AiProviderRegistry`: Thread-safe provider registry providing model resolution, discovery, and capability validation.

---

## 5. Security & Multi-Tenant Authorization Model

### 5.1 RBAC Permissions
- `agent.read`: Permits viewing agent definitions, tenant agent instances, model providers, execution history, and audit history.
- `agent.manage`: Permits creating agent instances, updating configuration, transitioning lifecycle states, and configuring tool assignments.

### 5.2 Tenant Boundary Enforcement
- Every API endpoint requires an authenticated session and verified active membership in `routeParams.organizationId`.
- Every SQL query filters by `organizationId = tenant.organizationId`.
- All operations verify that the requested agent exists and belongs to the active tenant; cross-tenant operations fail closed with `404 Not Found`.

### 5.3 Credential Redaction
- Configuration payloads and audit snapshots automatically redact sensitive keys matching `api_key`, `apiKey`, `secret`, `password`, `token`, `auth`, `credential`.

### 5.4 Audit Logging
- Every mutation (create agent, update configuration, lifecycle transition) persists an immutable record in `auditLogs` with actor identity, action type, before/after state snapshots, and changed field lists.

---

## 6. API Endpoint Contracts

| Method | Path | Required Permission | Description |
|---|---|---|---|
| `GET` | `/api/v1/organizations/:organizationId/agents/templates` | `agent.read` | List reusable agent templates with filtering (category, industry, status) & pagination |
| `GET` | `/api/v1/organizations/:organizationId/agents` | `agent.read` | List tenant-owned agent instances with filtering (status, search) & pagination |
| `POST` | `/api/v1/organizations/:organizationId/agents` | `agent.manage` | Instantiate an agent from a template with initial config and audit log |
| `GET` | `/api/v1/organizations/:organizationId/agents/:agentId` | `agent.read` | Retrieve full agent details, capabilities, and redacted configuration |
| `PATCH` | `/api/v1/organizations/:organizationId/agents/:agentId/configuration` | `agent.manage` | Update configuration & instructions with validation, redaction, and audit |
| `PATCH` | `/api/v1/organizations/:organizationId/agents/:agentId/status` | `agent.manage` | Transition lifecycle state with activation readiness gate and audit |
| `GET` | `/api/v1/organizations/:organizationId/agents/:agentId/audit-history` | `agent.read` | Retrieve paginated audit events for a specific agent instance |
| `GET` | `/api/v1/organizations/:organizationId/agents/providers` | `agent.read` | List registered AI providers and available model catalogs |

---

## 7. Frontend User Experience Architecture

1. **Agent Marketplace (`/workspace/agents`):** Discover and search agent definitions by industry, category, and capability.
2. **Active Agents Dashboard (`/workspace/agents/active`):** Manage tenant agents with status filter chips (`All`, `Active`, `Configured`, `Draft`, `Suspended`, `Archived`), status badges, and quick actions.
3. **Agent Details & Configuration View (`/workspace/agents/:id`):**
   - Tab 1: **Overview & Capabilities** (declarations, risk levels, human approval policies).
   - Tab 2: **Configuration** (model selection, instructions, configuration parameters with credentials masking).
   - Tab 3: **Audit & Activity History** (chronological event stream from `auditLogs`).
   - Tab 4: **Execution Runs** (historical run executions and latency).
4. **Lifecycle Actions:** Intuitive status transition buttons (`Activate`, `Suspend`, `Resume`, `Archive`) with validation messaging.

---

## 8. Phased Execution Roadmap

- [x] **Phase 1: Repository & Architecture:** Verify release baseline, create feature branch, author implementation plan.
- [x] **Phase 2: Agent Domain Foundation:** Add `suspended` to `agentLifecycleStatus`, author additive migration `0021_agent_platform_foundation.sql`, refine domain models.
- [x] **Phase 3: Security & Authorization:** Implement validation gates, credential redaction, default-deny capability checks, human approval contracts, and audit integration.
- [x] **Phase 4: AI Provider Abstraction:** Implement `AiProvider` interfaces, `MockAiProvider`, and `AiProviderRegistry`.
- [x] **Phase 5: Agent Management API:** Implement/refine endpoints with strict pagination, filtering, structured errors, and audit logs.
- [x] **Phase 6: Frontend Agent Management:** Enhance UI primitives in `@haza-aios/ui`, update workspace agent views with lifecycle controls and audit views.
- [x] **Phase 7: Testing & Validation:** Unit, integration, tenant-isolation, RBAC, lifecycle, and provider tests; 100% test suite pass; typecheck & build verification.
- [x] **Phase 8: GitHub & Documentation:** Document release, update changelog, push branch, open PR.

---

## 9. Test & Verification Metrics

- **API Unit & Integration Tests:** 41 test files, 333 / 333 passed (100%).
- **Web Unit & Component Tests:** 50 test files, 288 / 288 passed (100%).
- **Total Automated Tests:** 91 test files, 621 / 621 passed (100%).
- **Dedicated Epic 11 Suites:**
  - `apps/api/tests/ai-provider.test.ts`: Provider registration, mock model invocation, streaming chunk cancellation, timeout abort signal enforcement, error handling.
  - `apps/api/tests/agent-validation.test.ts`: Credential redaction, activation prerequisite gating, default-deny capability authorization, human approval policy schema checks, pagination normalization.
  - `apps/api/tests/epic11-agent-platform.integration.test.ts`: Lifecycle transitions (`draft` -> `active` -> `suspended` -> `active` -> `archived`), audit event trail generation, human approval policy persistence, tenant isolation boundary checks.
  - `apps/api/tests/agent-registry.integration.test.ts`: End-to-end template instantiation, secret protection against leakage in responses, tenant-scoped query execution.
- **TypeScript Typecheck:**
  - `npm run typecheck:api`: 0 errors.
  - `npm run typecheck:web`: 0 errors.
- **Production Builds:**
  - `npm run build:api`: Clean build (0 errors).
  - `npm run build:web`: Clean production Vite bundle.
- **Database Migration:**
  - `0021_agent_platform_foundation.sql`: Successfully rehearsed and validated on local MySQL container.
