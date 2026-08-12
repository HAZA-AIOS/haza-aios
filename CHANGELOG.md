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
