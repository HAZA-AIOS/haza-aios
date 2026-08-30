# DB-3 Organization / Workspace / Tenant Core

**Phase:** DB-3 — Organization / Workspace / Tenant Core  
**Status:** Implemented as backend platform-core persistence  
**Database:** MySQL  
**ORM:** Drizzle ORM  
**Application path:** `apps/api`

DB-3 introduces the first real persistent multi-tenant platform domain for HAZA AIOS. It remains multi-industry and does not create SIS, auth/session/RBAC, finance, communication, portal, analytics, or agent persistence.

---

## Entities

DB-3 adds these platform-core tables:

| Table | Purpose |
| --- | --- |
| `organizations` | Tenant identity, lifecycle, industry/type, owner reference, localization defaults |
| `workspaces` | Organization-owned workspace records |
| `organization_settings` | Generic organization timezone, locale, currency, preferences |
| `organization_modules` | Persistent organization module activation/configuration state |
| `organization_memberships` | Pre-auth membership foundation using external `user_id` strings until DB-4 creates real users |

`internal_database_checks` from DB-2 remains unchanged.

---

## Relationships

```text
organizations
  -> workspaces
  -> organization_settings
  -> organization_modules
  -> organization_memberships
```

Foreign keys use `restrict` deletes to avoid destructive tenant data removal.

---

## Status Values

Organization lifecycle:

```text
active
suspended
archived
```

Workspace lifecycle:

```text
active
archived
```

Module activation:

```text
activated
deactivated
```

---

## Constraints

Important constraints:

- `organizations.slug` is globally unique.
- `workspaces.organization_id + code` is unique.
- `organization_settings.organization_id` is unique.
- `organization_modules.organization_id + module_key` is unique.
- `organization_memberships.organization_id + user_id` is unique.

These constraints support multi-tenant isolation and idempotent activation workflows.

---

## API Routes

DB-3 adds:

```text
GET    /api/v1/organizations
POST   /api/v1/organizations
GET    /api/v1/organizations/:organizationId
PATCH  /api/v1/organizations/:organizationId
GET    /api/v1/organizations/:organizationId/settings
PATCH  /api/v1/organizations/:organizationId/settings
GET    /api/v1/organizations/:organizationId/workspaces
POST   /api/v1/organizations/:organizationId/workspaces
GET    /api/v1/organizations/:organizationId/workspaces/:workspaceId
PATCH  /api/v1/organizations/:organizationId/workspaces/:workspaceId
GET    /api/v1/organizations/:organizationId/modules
POST   /api/v1/organizations/:organizationId/modules
DELETE /api/v1/organizations/:organizationId/modules/:moduleKey
```

The DB-1 router now supports path params such as `:organizationId`.

---

## Repositories

DB-3 follows the DB-2 repository context pattern:

- `OrganizationRepository`
- `WorkspaceRepository`
- `OrganizationModuleRepository`

Tenant-owned repository methods require `organizationId` for scoped access. For example:

```text
getByIdForOrganization(organizationId, workspaceId)
```

This avoids unsafe unscoped workspace reads.

---

## Services

DB-3 services:

- `OrganizationService`
- `WorkspaceService`
- `OrganizationModuleService`

Organization creation is transactional:

```text
Create Organization
  -> Primary Workspace
  -> Organization Settings
  -> Owner Membership Foundation
```

If any child insert fails, the transaction rolls back.

---

## Tenant Context

DB-3 establishes a server-side tenant context abstraction:

```text
TenantContext {
  scope: "tenant",
  organizationId
}
```

Real authentication is still deferred to DB-4. DB-3 does not treat tenant IDs as authorization. It only establishes the scoping pattern that DB-4 will combine with authenticated membership checks.

Temporary pre-auth mechanism:

- Route organization IDs define tenant scope for DB-3 API tests.
- Optional `x-haza-organization-id` exists only as a development/test bridge for future adapters.
- Production authorization must not rely on arbitrary tenant headers.

---

## Frontend Integration

Frontend visual design is unchanged.

Runtime frontend org/workspace localStorage remains in place for now because real auth/users/sessions are DB-4. Switching the current frontend organization provider to DB-backed records before DB-4 would make tenant access depend on unauthenticated browser state.

DB-3 therefore makes the backend database authoritative for new platform-core APIs while deferring full frontend adapter replacement until DB-4 can provide authenticated identity and membership context.

---

## LocalStorage

LocalStorage was not removed in DB-3.

Reason:

- Auth/session persistence is still mock/browser-local.
- Organization switching depends on current frontend auth/org providers.
- DB-4 owns users, sessions, memberships, RBAC, and safe authorization.

DB-4 should migrate frontend organization access to API-backed authenticated services.

---

## Module Activation

`organization_modules` persists:

- module key
- enabled/deactivated state
- settings JSON
- activation timestamp
- optional activated-by string

Global module definitions remain code/static registry definitions. DB-3 persists only tenant module activation state.

---

## Seed Behavior

No runtime auto-seeding is added.

Development/test records are created explicitly by tests and API calls. Production demo data must never be auto-seeded.

---

## Security

DB-3 verifies:

- tenant-owned repository methods require organization scope
- workspace cross-tenant access returns not found
- organization module activation is organization-scoped
- no DB credentials are exposed to `apps/web`
- no secrets or connection strings are committed
- no destructive cascade deletes are introduced
- raw SQL/driver errors are mapped safely

---

## Tests

DB-3 integration tests cover:

- organization create/retrieve/update
- duplicate slug prevention
- workspace bootstrap and tenant isolation
- module activation enable/disable
- transaction rollback
- reconnect durability
- API route validation and request IDs

Run DB integration tests with:

```text
RUN_DB_INTEGRATION_TESTS=true npm run test:api
```

---

## DB-4 Handoff

DB-4 owns:

- real users
- authentication
- sessions
- RBAC/permissions
- membership authorization
- frontend org/workspace API adapter activation

DB-4 should use DB-3 membership and tenant context foundations instead of inventing a second tenancy model.
