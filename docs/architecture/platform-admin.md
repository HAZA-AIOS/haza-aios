# Platform Administration Architecture

## Overview

Epic 6 adds a Platform Administration foundation to HAZA AIOS. This module provides super-admin oversight of all organizations, users, audit trails, and system health across the entire platform.

## Access Control

### Platform Roles

| Role | Access Level |
|------|------|
| `super_admin` | Full platform administration access |
| `support_agent` | Read-only access to admin views (future) |
| `viewer` | No admin access |

### Route Protection

Admin pages are protected by two layers:

1. **`ProtectedRoute`** — Ensures the user is authenticated (from Epic 3).
2. **`AdminGuard`** — Checks `useIsSuperAdmin()` hook. Non-admins are redirected to `/dashboard`.

## Route Map

| Route | Page | Description |
|-------|------|-------------|
| `/admin` | AdminOverviewPage | Platform-wide KPIs, health monitor, audit log |
| `/admin/organizations` | AdminOrganizationsPage | Organization data table with search and actions |
| `/admin/users` | AdminUsersPage | User data table with search and actions |
| `/admin/audit-log` | AdminAuditLogPage | Full audit trail with action type filters |
| `/admin/system-health` | AdminSystemHealthPage | Service health cards with latency and uptime |

## Architecture

### Module Structure

```
apps/web/src/
├── admin/                          # Admin module
│   ├── AdminGuard.tsx              # Route protection component
│   ├── platform-admin.types.ts     # Type definitions
│   ├── platform-admin-service.ts   # Mock data service
│   └── use-platform-admin.ts       # Role hooks
├── pages/admin/                    # Admin page components
│   ├── AdminOverviewPage.tsx
│   ├── AdminOrganizationsPage.tsx
│   ├── AdminUsersPage.tsx
│   ├── AdminAuditLogPage.tsx
│   └── AdminSystemHealthPage.tsx
```

### Shared UI Components (packages/ui)

| Component | Purpose |
|-----------|---------|
| `DataTable` | Generic data table with sortable columns and row actions |
| `AdminStatCard` | KPI stat card with icon, value, and change indicator |
| `StatusBadge` | Colored pill badge for entity statuses |
| `AdminPageHeader` | Page header with title, breadcrumbs, and actions |
| `ConfirmDialog` | Modal confirmation for destructive actions |

### AppShell Integration

The existing `AppShell` component detects admin mode via `pathname.startsWith("/admin")` and:

1. Renders admin-specific navigation (Overview, Organizations, Users, Audit Log, System Health).
2. Shows an "Admin Mode" badge in the sidebar.
3. Replaces "Tenant Active" badge with "Platform Admin" in the header.
4. Adds a "Back to Dashboard" link at the sidebar bottom.
5. Shows an "Admin Panel" link in the org-level sidebar for super_admin users.

## Backend Connection Guide

The `platformAdminService` in `platform-admin-service.ts` uses mock data. To connect to a real backend:

1. Replace `mockOrganizations`, `mockUsers`, `mockAuditLog`, and `mockSystemHealth` arrays with API calls.
2. Use the `ApiClient` from `apps/web/src/api/` to make authenticated requests.
3. Replace the `usePlatformRole()` mock implementation with a real role lookup from the user's JWT claims or a dedicated API endpoint.
4. Remove the `wait()` delay helper.

## Security Considerations

- Platform admin routes should **never** be accessible to non-admin users in production.
- The mock implementation treats all authenticated users as super_admin for development convenience.
- In production, the `usePlatformRole()` hook must verify the user's role against the backend.
- Destructive actions (suspend org, deactivate user) should require server-side authorization.
