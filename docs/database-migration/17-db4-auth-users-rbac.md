# DB-4 Authentication, Users, Roles & Permissions

**Phase:** DB-4 — Authentication, Users, Roles & Permissions  
**Status:** Implemented as persistent backend identity and authorization foundation  
**Database:** MySQL  
**ORM:** Drizzle ORM  
**Application path:** `apps/api`

DB-4 replaces browser-only/mock identity authority with server-backed users, password hashing, sessions, organization membership authorization, and RBAC. SIS and agent persistence remain unchanged for later database phases.

---

## User Model

DB-4 adds `users` as the global authentication identity table.

User records include:

- global normalized email uniqueness
- `password_hash`
- first name, last name, display name
- email verification flag
- controlled user status
- last login timestamp
- created/updated timestamps

Password hashes are never returned in DTO responses.

---

## Password Hashing

Password hashing uses Node.js `crypto.scrypt` with a per-password random salt and timing-safe verification.

Stored format:

```text
scrypt$<salt>$<derived-key>
```

Plain text passwords are not stored, logged, or returned.

---

## Session Strategy

DB-4 uses opaque random session tokens.

Runtime token handling:

- API generates a random session token.
- MySQL stores only a SHA-256 token hash in `auth_sessions`.
- The token is returned to the frontend for API compatibility and also sent as an HttpOnly cookie.
- Logout revokes the stored session.
- `/api/v1/auth/me` returns safe session metadata with an empty access token field.

Cookie attributes:

```text
HttpOnly
Path=/
SameSite=Lax
Secure in production
Expires=<session expiry>
```

---

## Auth Endpoints

DB-4 adds:

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/logout
GET  /api/v1/auth/me
```

Registration transactionally creates:

```text
User
  -> Organization
  -> Primary Workspace
  -> Organization Settings
  -> Owner Membership
  -> Owner Role
  -> Role Permissions
  -> Membership Role
  -> Workspace Membership
  -> Session
```

---

## Membership Model

DB-4 uses DB-3 `organization_memberships` as the tenant access boundary and adds RBAC assignment through `membership_roles`.

Users can belong to multiple organizations. Tenant context is established only after the backend verifies active membership for the requested organization.

`workspace_memberships` provides a persistent workspace-membership foundation. Organization-level permissions currently drive workspace API access.

---

## Roles And Permissions

DB-4 adds:

| Table | Purpose |
| --- | --- |
| `permissions` | Controlled permission catalog |
| `roles` | Platform or organization role records |
| `role_permissions` | Role-to-permission many-to-many links |
| `membership_roles` | Membership-to-role assignments |

Core permissions:

```text
platform.admin
organization.read
organization.manage
workspace.read
workspace.manage
module.read
module.manage
member.read
member.manage
```

Baseline organization roles:

```text
Owner
Admin
Member
```

Roles are configurable records; services check permissions, not only role names.

---

## Server-Side Authorization

DB-3 platform APIs are now protected server-side:

```text
GET/PATCH organization
GET/PATCH settings
GET/POST/PATCH workspaces
GET/POST/DELETE modules
```

Authorization combines:

```text
authenticated user
  -> active organization membership
  -> role permissions
  -> requested organization ownership
```

Cross-tenant access returns not found to avoid IDOR disclosure.

---

## Platform Admin Boundary

DB-4 introduces a platform permission namespace with `platform.admin` and platform-scoped role support. No route disables tenant isolation globally. Cross-tenant capabilities must be granted explicitly by platform-scoped permission checks in future platform-admin APIs.

---

## Frontend Migration

The frontend auth provider now calls the real API-backed auth service while preserving the existing provider interface and visual design.

Updated behavior:

- login calls `/api/v1/auth/login`
- registration calls `/api/v1/auth/register`
- current-user hydration calls `/api/v1/auth/me`
- logout calls `/api/v1/auth/logout`
- API client sends credentials for the HttpOnly cookie

Local/session storage remains only as a UX/test cache for current provider compatibility. It is no longer the production authority for authentication.

---

## Security Events

DB-4 adds `security_events` for safe audit/security hooks.

Recorded events include:

```text
auth.register
login.success
login.failed
login.blocked
logout
```

Events do not store passwords or session tokens.

---

## Tests

DB-4 integration tests cover:

- user persistence
- password hash not plain text
- login success/failure
- session persistence and logout revocation
- organization membership persistence
- role/permission assignment
- tenant isolation
- IDOR protection
- auth API routes
- reconnect durability

Run with:

```text
RUN_DB_INTEGRATION_TESTS=true npm run test:api
```

---

## Explicit Non-Goals

DB-4 does not migrate:

- SIS domain persistence
- finance domain persistence
- communication persistence
- portal persistence
- analytics persistence
- agent persistence
- knowledge/file persistence

Password reset and email verification endpoints remain future work.

---

## DB-5 Handoff

DB-5 should start from clean `develop` after DB-4 is merged. It can use:

- authenticated user identity
- active organization membership
- server-side permission checks
- tenant-safe repository patterns
- persistent workspace and organization context

DB-5 owns SIS core persistence.
