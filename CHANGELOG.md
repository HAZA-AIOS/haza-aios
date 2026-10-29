## [0.14.0-epic14] - 2026-10-29

### Added
- **Epic 14: AI Agent Runtime & Execution Engine — Full Production Release**
  - **Database Migration 0024 (`0024_agent_runtime_execution_engine.sql`):**
    - Extended MySQL enum column `agent_run_status` on `ai_agent_runs` to support comprehensive lifecycle states: `queued`, `running`, `waiting`, `awaiting_approval`, `completed`, `failed`, `cancelled`, `rejected`.
    - Added lease fencing, concurrency, worker allocation, token tracking, and cancellation attribution columns to `ai_agent_runs`: `priority`, `execution_mode`, `worker_id`, `lease_token`, `lease_expires_at`, `attempt_count`, `total_input_tokens`, `total_output_tokens`, `total_cost_micros`, `cancellation_reason`, `cancelled_by`, `cancelled_at`.
    - Created `ai_agent_run_attempts` table tracking attempt lineage, worker leases, duration ms, and error classification.
    - Created `ai_agent_run_events` table persisting detailed timeline events (`run_created`, `run_queued`, `worker_claimed`, `run_started`, `model_invoked`, `model_responded`, `approval_requested`, `approval_approved`, `approval_rejected`, `run_resumed`, `run_cancelled`, `run_completed`, `run_failed`).
    - Created `ai_agent_approval_requests` and `ai_agent_approval_decisions` tables for human-in-the-loop authorization with policy parameters, expiration, and separation of duties enforcement.
    - Created `ai_agent_runtime_usage` table for per-invocation token and micro-cost accounting across providers and models.
    - Added high-performance indexes on tenant, agent, run, status, priority, and lease expiration timestamps.
  - **Backend Runtime Execution Architecture & Services (`apps/api/src/modules/agents`):**
    - `AgentRuntimeRepository`: Complete persistence engine managing durable run claims with UUID lease fencing, attempt tracking, event timeline emission, human approval resolution, usage logging, and real-time monitoring aggregation.
    - `AgentRuntimeService`: Robust execution orchestration handling run creation with revision snapshot pinning, inline & background worker execution, state machine validation, cancel, manual retry, separation of duties policy enforcement, and operational metrics calculation.
    - `ApiRouter`: Enhanced route registration ordering static segments before parameterized segments (`:param`), completely eliminating route shadowing.
    - 14 authenticated REST API endpoints registered under `/api/v1/organizations/:organizationId/agents/*` (`/runs`, `/runs/:runId`, `/runs/:runId/cancel`, `/runs/:runId/retry`, `/runs/:runId/events`, `/runs/:runId/attempts`, `/runs/:runId/usage`, `/approvals`, `/approvals/:approvalId`, `/approvals/:approvalId/approve`, `/approvals/:approvalId/reject`, `/runtime/monitoring`, `/runtime/worker/tick`).
  - **Frontend Shared Primitives (`packages/ui`):**
    - Implemented enterprise UI primitives in `@haza-aios/ui/components/agent-runtime-primitives.tsx`: `AgentRunStatusBadge`, `AgentExecutionTimeline`, `AgentRunMetricCard`, `AgentApprovalCard`, `AgentAttemptHistory`, `AgentExecutionResultViewer`, `AgentRuntimeEmptyState`.
  - **Frontend Runtime Suite & Views (`apps/web`):**
    - `AgentRuntimeService`: Fully typed client library covering all runtime API endpoints.
    - 5 dedicated runtime views:
      1. `AgentExecutionConsolePage.tsx`: Agent header, dual text/JSON input modes, execution trigger, active run status, live output viewer, and timeline.
      2. `AgentRunHistoryPage.tsx`: Status filters, execution mode, attempts, duration, tokens, timestamps, cancel/retry actions.
      3. `AgentRunDetailsPage.tsx`: Granular telemetry view with metric tiles, input/output inspection, attempt history, timeline, and usage cost breakdown.
      4. `AgentApprovalInboxPage.tsx`: Human-in-the-loop authorization desk with risk badges, payload inspector, reason capture, and separation of duties alert banner preventing self-approval.
      5. `AgentRuntimeMonitoringPage.tsx`: Live telemetry dashboard tracking queue depth, active running concurrency, approval backlog, 24h success rate, average latency, token volume, cost, and manual worker dispatch.
    - Registered routes in `apps/web/src/App.tsx`:
      - `/workspace/agents/:id/execute` & `/workspace/agents/:id/run`
      - `/workspace/agents/:id/runs` & `/workspace/agents/:id/history`
      - `/workspace/agents/runs`
      - `/workspace/agents/runs/:runId`
      - `/workspace/agents/approvals`
      - `/workspace/agents/runtime/monitoring` & `/workspace/agents/monitoring`

## [0.13.0-epic13] - 2026-10-29

### Added
- **Epic 13: AI Agent Configuration & Builder — Full Production Release**
  - **Database Migration 0023 (`0023_agent_configuration_builder.sql`):**
    - Extended `ai_agent_definitions` with `active_revision_number` (int, default 1) and `active_revision_id` (char(36), foreign key to active configuration snapshot).
    - Created `ai_agent_configuration_revisions` table with immutable snapshot fields, audit attribution (`created_by`, `published_by`, `published_at`), validation status, changelog, and unique constraint on `(agent_id, revision_number)`.
    - Added automated, idempotent SQL backfill migrating existing agent definitions to Revision 1 baseline.
    - Verified with clean isolated rehearsal on Railway MySQL (`haza_epic13_rehearsal`).
  - **Backend Builder Architecture & Services (`apps/api/src/modules/agents`):**
    - `AgentBuilderRepository`: Complete persistence engine managing draft/published revisions, auto-incrementing revision numbers, audit events, and atomic transactions.
    - `AgentBuilderValidation`: Comprehensive server-side rules engine validating identity format/length, provider and model context limits, temperature/token boundaries, high-risk capability approval requirements, secret scanning (blocking credential leakage), and tenant knowledge source isolation.
    - `AgentBuilderService`: Full multi-tenant lifecycle service providing catalog options, new custom agent creation, draft saving, publishing with version promotion, agent duplication, semantic revision diffing, rollback/restore to draft, and safe mock preview simulation via `MockAiProvider` (guaranteeing zero external AI charges).
    - 12 new authenticated REST API endpoints registered under `/api/v1/organizations/:organizationId/agents/builder/*`.
  - **Frontend 10-Section Visual Builder (`apps/web` & `@haza-aios/ui`):**
    - Dense dark enterprise UI primitives in `@haza-aios/ui/components/agent-builder-primitives.tsx`: `BuilderContainer`, `BuilderSidebar`, `BuilderNavItem`, `BuilderHeaderBar`, `ModelParameterSliders`, `InstructionTextarea`, `CapabilityCard`, `ToolDeclarationCard`, `ApprovalPolicySelector`, `ValidationSummaryAlert`, `MockPreviewConsole`, `RevisionHistoryList`.
    - 10-Section Builder View (`AgentBuilderSections.tsx` & `AgentBuilderPage.tsx`):
      1. Identity & Persona (name, key, description, category, tags, avatar).
      2. Model & Settings (provider selection, model tier, temperature, token limits, timeouts).
      3. Structured Instructions (role, objectives, boundary constraints, behavioral rules, prohibited actions, escalation protocols).
      4. Capabilities (system-level capabilities, danger levels, approval requirements).
      5. Tools & Permissions (utility declarations, permission mappings, risk tiers).
      6. Knowledge Grounding (tenant knowledge base attachments, retrieval controls).
      7. Human Approval & Governance (policy selector, threshold triggers, approver roles, escalation timeout).
      8. Real-Time Validation Console (detailed section error and warning breakdown).
      9. Safe Mock Preview Sandbox (interactive simulation testing without AI provider cost).
      10. Version History & Diff Viewer (chronological audit log, side-by-side semantic diff comparison modal, one-click rollback/restore).
    - Direct builder entry points added to `AgentDetailsPage` ("Visual Builder" button) and `WorkspaceDiscoverPage` ("Build Custom Agent" banner).
  - **Production Deployment & Verification:**
    - GitHub PR: `#48` (Merged into `main` at commit `60c3ac2`).
    - Fresh pre-release production logical backup: `haza-aios-production-stage20-backup_20261029_112341.sql` (247,856 bytes, SHA-256: `7053471C28B5919DBA0F8BCBF56C384CB936E11D40BB25FB0C76B21930F10EE3`).
    - Isolated migration rehearsal on Railway MySQL (`haza_epic13_rehearsal`): 100% verified all 13 migration statements, column additions, and foreign-key/unique constraints.
    - Railway API deployment: `Online` at `https://api.haza-aios.com`.
    - Railway Web deployment: `Online` at `https://www.haza-aios.com`.
    - Quality gates: 43/43 API test suites (335 tests) passed (100%), 50/50 Web test suites (289 tests) passed (100%).
    - Live production smoke tests: 17/17 end-to-end tests passed (100%) covering landing page, API readiness, auth resolution, catalog options, new agent creation, context loading, validation rules, secret blocking, mock preview, publishing v1.0.0, draft v1.1.0, publishing v1.1.0, history, visual diffing, rollback/restore, duplication, and cross-tenant security isolation.

## [0.12.0-epic12] - 2026-10-28

### Added
- **Epic 12: AI Agent Registry & Marketplace — Full Production Release**
  - **Database Migration 0022 (`0022_agent_registry_marketplace.sql`):**
    - Extended `ai_agent_templates` with publisher metadata (`publisher_type`, `publisher_organization_id`, `publisher_user_id`), distribution controls (`visibility`, `publishing_status`), summary, semver tracking (`latest_version`, `min_platform_version`), and review tracking (`review_notes`, `reviewed_by`, `reviewed_at`, `published_at`).
    - Created `ai_agent_template_versions` table for immutable semantic version history with unique constraint `(template_id, version)`, schemas, permissions, changelog, and review metadata.
    - Extended `ai_agent_definitions` with installation provenance tracking (`installed_version`, `template_version_id`, `installed_from_marketplace`).
    - Created `ai_agent_installations` table tracking multi-tenant runtime instance installations, upgrades, and safe uninstalls.
    - Applied cleanly to production MySQL via Railway pre-deploy hook.
  - **Marketplace Backend API (`apps/api/src/modules/marketplace`):**
    - Catalog Discovery: Paginated search and filtering (`GET /organizations/:id/marketplace/catalog`) with tenant isolation and visibility scoping (`platform`, `private_organization`, `approved_shared`).
    - Profile & Versioning: Detailed agent profile lookup (`GET /organizations/:id/marketplace/agents/:id`), version resolution, and explicit semver validation.
    - Safe Installation & Upgrades: Idempotent installation (`POST /organizations/:id/marketplace/install`), installed agent discovery (`GET /organizations/:id/marketplace/installed`), explicit version upgrades (`POST /organizations/:id/marketplace/installed/:id/upgrade`), and decommission safeguards (`POST /organizations/:id/marketplace/installed/:id/uninstall`).
    - Publisher Workspace: Authoring dashboard (`GET/POST /organizations/:id/marketplace/publisher/templates`), version authoring (`POST .../versions`), and submission for platform review (`POST .../submit`).
    - Platform Governance: Dedicated administrative review desk (`GET /platform/marketplace/reviews`), review decision state machine (`POST .../decision` supporting `under_review`, `approved`, `published`, `rejected`, `deprecated`, `withdrawn`) guarded by `platform.admin` authorization.
    - Aggregate Analytics: Real-time marketplace aggregates (`GET /organizations/:id/marketplace/analytics`, `GET /platform/marketplace/analytics`) computing published agent counts, installations, active instances, industry breakdowns, and version adoption.
  - **Frontend Marketplace Experience (`apps/web` & `@haza-aios/ui`):**
    - Reusable UI primitives: `PublishingStatusBadge`, `VersionBadge`, `PublisherBadge`, `UpgradeNoticeBadge`, `MarketplaceMetricCard`, `CapabilityTagList`.
    - Discover Page (`WorkspaceDiscoverPage`): Enhanced catalog discovery with real-time API binding, badges, and install modal integration.
    - Agent Profile Page (`MarketplaceAgentProfilePage`): Comprehensive profile view with overview, capabilities, requirements, version history table, compatibility, and install/upgrade workflows.
    - Installation Modal (`MarketplaceInstallModal`): Version selector, instance custom naming, capability review, and policy configuration.
    - Installed Agents Desk (`InstalledAgentsPage`): Version status tracking, update available badges, upgrade modal, and safe decommission safeguards.
    - Publisher Workspace (`PublisherWorkspacePage`): Listing authoring, version management, submission workflow, and review feedback monitoring.
    - Platform Review Desk (`MarketplaceReviewPage`): Administrative governance desk with aggregate metrics, pending submissions list, and review decision modals.
  - **Production Deployment & Verification:**
    - GitHub PR: `#47` (Merged into `main` at `ba043a76b0e3212f2e2f778179b2e26df48b182d`).
    - Fresh pre-release production logical backup: `haza-aios-production-stage20-backup_20261028_133901.sql` (230,408 bytes, SHA-256: `C854FAAF2DB6C42B0F4B102A95F0FCD97125090FAB44ED1147F980452A4020AD`).
    - Isolated rehearsal on local MySQL (`haza_epic12_rehearsal`): Migration 0022 applied with idempotency verified, 220 FK checks and 7 tenant checks passed (0 failures), 8/8 integration test workflows passed.
    - Railway API deployment ID: `556d7de2-f080-4e34-b557-f52709a3bca1` (SUCCESS).
    - Railway Web deployment ID: `3bbd4282-9ef1-4c09-b028-11adfc7868da` (SUCCESS).
    - Live production smoke tests: 31/31 end-to-end tests passed (100%) on `api.haza-aios.com` and `www.haza-aios.com`.

## [0.11.0-epic11] - 2026-10-28

### Added
- **Epic 11: AI Agent Platform Foundation & Full Production Release**
  - **Domain Model & Migration 0021 (`0021_agent_platform_foundation.sql`):** Added explicit `suspended` lifecycle state to `ai_agent_templates` and `ai_agent_definitions`, and added `default_approval_policy` and `human_approval_policy` JSON contracts for governance and oversight. Applied cleanly via Railway pre-deploy hook.
  - **AI Provider Abstraction Layer:** Implemented provider-neutral contracts (`AiProvider`, `AiModel`, `ModelInvocationRequest`, `ModelInvocationResponse`, `AiUsageMetadata`), deterministic `MockAiProvider` with cancellation/timeout enforcement, and `AiProviderRegistry` singleton.
  - **Security, Validation & Governance:** Server-side credential redaction (`redactSensitiveConfig`), prerequisite validation before agent activation (`validateActivationPrerequisites`), default-deny capability authorization (`assertCapabilityPermitted`), and human approval policy validation.
  - **Agent Management API:** Tenant-isolated endpoints for listing templates and agents with pagination and filtering, reading details, updating configurations with credential redaction, updating lifecycle status (draft, active, suspended, paused, disabled, archived), fetching audit history, and querying available AI providers.
  - **Frontend Workspace & Shared UI Primitives:** Updated `@haza-aios/ui` with enhanced `AgentStatus`, `HumanApprovalBadge`, `AgentAuditTimeline`, and `AgentEmptyState`. Added search, filter, and lifecycle management to `WorkspaceActiveAgentsPage` and comprehensive overview, model configuration, approval policy, and audit trail tabs to `AgentDetailsPage`.
  - **Production Deployment & Verification:**
    - Railway API deployment `622020af-fc78-4265-bba1-aae1ae6a0329` (SUCCESS).
    - Railway Web deployment `31475ae2-e2d9-40b7-bb10-5354e3e1e3ad` (SUCCESS).
    - Fresh pre-release production logical backup `haza-aios-production-stage20-backup_20261028_092552.sql` (228,157 bytes, SHA-256: `F74ED0459165DAB26595EEDF3061B813E907732589D3DFAE06DFBE6112E8E534`).
    - Isolated rehearsal on MySQL 8.4 (`haza_epic11_rehearsal`): Migration 0021 applied with idempotency verified, 207 FK checks and 7 tenant checks passed (0 failures).
    - Full test suite: 91 test files, 621/621 tests passed (100%).
    - Live production smoke tests: 17/17 end-to-end tests passed on `api.haza-aios.com` and `www.haza-aios.com`.

## [0.10.14-epic10n] - 2026-10-27

### Added
- **Epic 10N: Enterprise System Hardening & Full Production Release**
  - **Security Hardening (SEC-001 – SEC-005):** Strict authenticated actor context derived from server session, multi-tier login rate limiting (IP abuse and per-account failed attempts), HTTP security headers (CSP, Permissions-Policy, X-Frame-Options, X-Content-Type-Options), and configurable proxy trust resolution (`trustProxy`).
  - **Transactional Integrity (TX-001 – TX-003):** Atomic transaction boundaries across SIS student lifecycle, admissions conversion, grade/section enrollments, student transfers, examination results publishing, and fee billing generation.
  - **Database Migrations 0019 & 0020:** Unique tenant identifiers for portal update requests (`0019`) and deduplicated JSON identifier backfill (`0020`), verified with 207 foreign-key and 7 tenant-isolation checks.
  - **Pagination & Completeness (PAG-001 – PAG-003):** Strict pagination validation, bounds checking, and truthful total-count metadata across all SIS endpoints.
  - **Frontend UX Robustness (UX-001 – UX-002):** Double-submission safeguards (`useAsyncSubmission`) across admissions, examinations, and fee collection forms, along with consolidated attendance route handling.
  - **Railway Production Infrastructure:** Pre-deploy migration execution via Railway hooks, container network binding to `0.0.0.0:$PORT` with `allowedHosts: true`, and live health/readiness monitoring.

## [Unreleased]

### Added


- **DB-18: Backup and Recovery Hardening**
  - Added guarded disposable MySQL backup/restore rehearsal and read-only foreign-key and tenant integrity checks.
  - Documented production backup prerequisites and incident recovery decisions; no production backup or restore was executed.

- **DB-17: Usage, Metering & SaaS Billing Persistence**
  - Added tenant-scoped immutable usage facts for terminal agent and workflow runs, with idempotency and summary APIs.
  - Added an unseeded SaaS plan catalog, billing accounts, subscriptions, and statements without charging or payment integration.
  - Added Owner/Admin usage and billing read permissions and disposable-MySQL integration coverage.

- **DB-16: Audit, Events, Notifications & Operational Persistence**
  - Added immutable tenant-scoped audit logs, domain events, and operational diagnostics with correlation and sanitization.
  - Extended DB-8 notifications and delivery attempts with event linkage, durable user state, expiry, and safe provider metadata.
  - Added organization-scoped audit/event APIs, user-scoped notification APIs, and DB-4 permission integration.
  - Integrated workflow task assignments, workflow transitions, and failed workflow/agent runs with transactional operational records.
  - Replaced the admin audit page's static source with persisted organization audit data and added disposable-MySQL integration coverage.

- **DB-15: Workflow, Tasks & Orchestration Persistence**
  - Added tenant-scoped MySQL persistence for workflow definitions, immutable step revisions, runs, step outcomes, and human tasks.
  - Added optimistic revision checks, immutable run snapshots, idempotent starts, lifecycle concurrency protection, and workflow RBAC permissions.
  - Replaced workflow localStorage persistence with authenticated API operations while retaining the existing workspace design.
  - Added validation, unit coverage, and disposable-database integration coverage for tenant isolation and durable orchestration state.

- Added authenticated multi-organization self-service from the workspace organization switcher, allowing one user identity to create, own, and switch between multiple organizations.

- Added a public HAZA product-family showcase that clearly separates HAZA-AIOS, HAZA-ME, and the standalone live HAZA-SMS application.
- Added centered, icon-led section headings across the public landing page and a secure external link to the HAZA-SMS website.
- Aligned account and organization registration layouts with the public landing page's charcoal and coral visual language.

### Fixed

- Prevented existing organization members from being redirected to organization creation during the brief post-login membership-loading transition.
- Allowed explicitly configured frontend aliases in API CORS so both the root and `www` production domains can authenticate safely.

- **Epic 13: Agent Configuration & Builder**
  - Implemented `AgentConfiguration` schema on `AgentInstance`.
  - Created low-code `AgentBuilderPage` at `/workspace/agents/:id/configure`.
  - Added modular builder sections: General, Instructions, Behavior, Inputs, Outputs, Tools, Model & Memory.
  - Added configuration preview and draft state tracking.
  - Implemented `updateConfiguration` in `AgentService`.
  - Added reusable `agent-builder-primitives` to `@haza-aios/ui`.

- **Epic 12: AI Agent Registry & Marketplace**
  - Created the Agent Marketplace UI foundation at `/workspace/agents`.
  - Implemented discoverable global `AgentTemplate` registry.
  - Implemented Search, Category Navigation, and Industry/Status filters.
  - Added dedicated `/workspace/agents/active` page for managing instantiated agents.
  - Added `AgentDetailsPage` handling both Template inspection and Instance configuration paths.
  - Created reusable UI primitives (`AgentSearch`, `AgentFilters`, `AgentCategoryNav`).

- **Epic 11: AI Agent Platform Foundation**
  - Established generic agent domain models (`AgentTemplate`, `AgentInstance`, `AgentRun`, `Tool`, `Capability`).
  - Implemented `AgentRegistry` for module-agnostic agent discovery and capabilities advertisement.
  - Implemented `AgentService` enforcing organization-isolated agent instantiation and configurations.
  - Added reusable `AgentCard` and `AgentStatus` UI primitives to `@haza-aios/ui`.
  - Added Workspace Agent Management views at `/workspace/agents`.

## [0.8.0-alpha.1] - 2026-08-12

### Added

- Dynamic Industry & Platform Modules framework featuring contract specification (`module.types.ts`), centralized discovery registry (`module-registry.ts`), and tenant-isolated runtime manager (`module-runtime.ts`).
- Platform Module Registry directory page at `/admin/modules` allowing super-admins to inspect all registered platform and industry module contracts, specifications, routes, and permissions.
- Interactive `ModuleCard` and `ModuleDetailsDialog` UI primitives in `@haza-aios/ui` for rendering module capabilities, metadata, navigation manifests, and write-access gated activation toggles.
- Dynamic sidebar navigation integration in `AppShell` automatically injecting active tenant module links into the workspace navigation rail.
- Demo analytics module (`demo-module`) illustrating dynamic client routing, sub-navigation, and configuration options.
- Industry Modules Architecture specification (`docs/architecture/industry-modules.md`).
- Vitest suite for module registry discovery, tenant activation toggling, and multi-tenant isolation.

## [0.7.0-alpha.1] - 2026-08-12

### Added

- Organization Workspace module under protected `/workspace/*` routes, gated by active organization session checks (`WorkspaceGuard`).
- Adapted AppShell sidebar navigation to display organization-specific overview, members, modules, and settings.
- Adapted AppShell top utility header to display organization name, type, industry, status badge, and initial logo.
- Workspace Overview page at `/workspace` showing logo avatar, type/industry/status details, KPI stats (members, active modules count), activity logs, and quick actions.
- Workspace Members page at `/workspace/members` showing member table (with role badges, joined date), search filter, role filters, and dialogs for Invite, Role Change, and Remove Member.
- Workspace Modules page at `/workspace/modules` listing 5 modules (SIS, HR, Financials, AI Workspace, Patient EHR) with toggle switch controls to activate/deactivate modules.
- Workspace Settings page at `/workspace/settings` providing settings form (Name, Legal Name, Description, Website, Contact Info, Localization, Timezone, Currency) and role-based permissions warning.
- Scoped multi-tenant local storage state management (`workspace-service.ts`) using `organizationId` keys for memberships, logs, and modules activation.
- Role boundaries separating Owner (full control), Admin (limited members/settings control), and Member (read-only view).
- Unit tests verifying memberships CRUD, module toggle activation, tenant isolation, and page rendering (13 tests passing).
- Organization Workspace architecture documentation (`docs/architecture/organization-workspace.md`).

## [0.6.0-alpha.1] - 2026-08-12

### Added

- Platform Administration module with super-admin route protection (`AdminGuard`).
- Platform role model (`super_admin`, `support_agent`, `viewer`) and `usePlatformRole()` / `useIsSuperAdmin()` hooks.
- Mock platform admin service with comprehensive sample data (7 organizations, 11 users, 12 audit entries, 6 services).
- Admin Overview page at `/admin` with platform KPI stat cards, system health monitor grid, and recent audit activity feed.
- Admin Organizations page at `/admin/organizations` with searchable data table, status badges, and suspend/activate actions with confirmation dialog.
- Admin Users page at `/admin/users` with searchable data table, platform role badges, avatar initials, and deactivate/activate actions.
- Admin Audit Log page at `/admin/audit-log` with action type filters (Create, Update, Delete, Login, System) and timestamp-sorted entries.
- Admin System Health page at `/admin/system-health` with summary stats, per-service health cards showing latency/uptime/status, and visual health progress bars.
- Reusable admin UI primitives in `packages/ui`: `DataTable`, `AdminStatCard`, `StatusBadge`, `AdminPageHeader`, `ConfirmDialog`.
- AppShell admin-mode sidebar with context-aware navigation, admin mode badge, and "Back to Dashboard" / "Admin Panel" links.
- Platform administration architecture documentation (`docs/architecture/platform-admin.md`).

## [0.5.0-alpha.1] - 2026-08-12

### Added

- Compact premium Sidebar navigation with data-driven routing, active state highlighting, hover expansions, and collapsed states.
- Reusable top utility Header bar featuring breadcrumbs, notification center with indicator badges, profile dropdown, and organization switcher dropdown.
- Authenticated Dashboard route at `/dashboard` protected by Auth routing gates.
- Reusable presenter components in `packages/ui`: `DashboardCard`, `StatCard` with SVG sparklines, and `AIAssistantWidget`.
- SVG Donut Chart representing distribution of system load, and SVG Bar Chart representing hourly AI Ops activity.
- Floating AI Assistant box foundation at the bottom center.
- Dashboard architecture documentation (`docs/architecture/dashboard.md`).
- Robust Vitest suite checking layout rendering, telemetry metrics, and sidebar functionality.

## [0.4.0-alpha.1] - 2026-08-11

### Added

- Multi-tenant organization data model foundations (`org.types.ts`).
- Organization membership model with role declarations (`Owner`, `Admin`, `Member`).
- Organization context state provider (`OrgProvider.tsx`) and `useOrganization()` hook.
- Standard organization form validation rules and interactive slug generation/deduplication checks.
- Authenticated Organization Registration flow screen at `/organization/create`.
- Reusable UI select dropdown inputs for industries and organization types in `packages/ui`.
- Comprehensive Vitest unit tests for validation, slug generation, service layers, and page renders.
- Tenancy architecture reference document (`docs/architecture/organizations.md`).

## [0.3.0-alpha.1] - 2026-08-11

### Added

- Complete authentication and identity foundation (Epic 3)
- `AuthProvider` React context with `useAuth()` and `useCurrentUser()` hooks
- Centralized authentication state (`loading | authenticated | unauthenticated | error`)
- Mock auth service adapter (`auth-service.ts`) implementing the full `AuthService` interface
- Client-side form validation utilities (`auth-validation.ts`)
- Session persistence with `localStorage` (remember-me) and `sessionStorage` (session-only)
- Automatic session expiry detection and cleanup
- `ProtectedRoute` and `PublicOnlyRoute` route guard components
- Public routes: `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`
- Login page with email, password, and remember-me fields
- Registration page with name, email, password, and strength indicator
- Forgot Password page with email field and submission confirmation
- Reset Password page with new password, confirmation, and token validation
- Email Verification page with status display and navigation
- Protected application placeholder at `/app` for future dashboard epics
- `AuthLayout` reusable layout primitive in `packages/ui` (router-agnostic, slot-based)
- `AuthCard` glass card component in `packages/ui`
- `AuthAlert` accessible alert component (`error | success | info`) in `packages/ui`
- `AuthLoading` spinner component in `packages/ui`
- `FormField` accessible label/field/error wrapper in `packages/ui`
- `PasswordField` with show/hide toggle in `packages/ui`
- `PasswordStrength` 5-bar visual indicator with `aria-live` in `packages/ui`
- `ApiClient` class with base URL, auth token injection, 401 handling, and `ApiError`
- Vitest test suite with jsdom environment
- Tests: auth validation, auth storage, mock auth service, `AuthProvider` hooks, route protection

### Architecture

- Authentication is fully isolated from organization and business logic
- Clean layered boundary: UI → AuthProvider → Auth Service → API Client → Backend
- Identity model (`User`, `AuthSession`) separated from profile; `Organization` and `OrganizationMembership` types stubbed for future epics
- All reusable auth UI primitives placed in `packages/ui`; app-specific shell in `apps/web`
- Backend API can be connected by swapping the mock adapter with a real `AuthService` implementation — no UI layer changes required

### Documentation

- Added `docs/architecture/authentication.md` covering architecture, identity model, session model, route protection, security boundaries, and backend connection guide

### Not Implemented (Future Epics)

- Organization registration (next relevant Epic)
- Organization dashboard
- Role/permission enforcement UI
- Platform administration
- Education / SIS modules
- AI Agent Framework

## [0.2.0-alpha.1] - 2026-08-09

### Added

- HAZA AIOS design tokens and shared styling foundation
- Typography and responsive type utilities
- Semantic color palette and gradient system
- Shared form controls, cards, navigation patterns, and badge primitives
- Extended Button variants for HAZA AIOS product styling
- Shared design system preview for component validation
- Design system documentation and development guidance

### Changed

- Centralized visual tokens in the `@haza-aios/ui` package
- Updated the web app to consume shared design system styles and primitives
- Standardized spacing, radius, shadow, and surface treatments

### Architecture

- Preserved monorepo structure and app/package separation
- Kept reusable UI in `packages/ui` and page logic in `apps/web`
- Maintained shadcn/ui patterns and Tailwind + Vite workflow

### Infrastructure

- Confirmed the front-end toolchain passes typecheck, lint, formatting, and production build validation
- Docker remains documented as blocked by host virtualization limits

## [0.1.0-alpha.1] - 2026-08-09

### Added

- HAZA AIOS monorepo foundation
- React/Vite frontend foundation
- Tailwind CSS integration
- shadcn/ui shared component architecture
- Shared `@haza-aios/ui` package
- Frontend application architecture
- TypeScript strict configuration
- ESLint and Prettier tooling
- Frontend environment configuration
- React error boundary
- Frontend testing foundation
- Developer documentation

### Architecture

- Established `apps/web` application workspace
- Established reusable `packages/ui` component library
- Established application/shared-component separation
- Established frontend development quality gates

### Infrastructure

- Docker milestone documented as blocked because host virtualization is unavailable
- Local React/Vite development remains operational
