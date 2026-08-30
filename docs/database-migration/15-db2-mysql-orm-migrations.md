# DB-2 MySQL, ORM & Migration Foundation

**Phase:** DB-2 — MySQL, ORM & Migration Foundation  
**Status:** Implemented as backend database infrastructure only  
**Application path:** `apps/api`  
**Database:** MySQL  
**ORM:** Drizzle ORM with `mysql2`  
**Migration tooling:** Drizzle Kit plus explicit API-owned migration scripts

DB-2 establishes the real persistence foundation for HAZA AIOS. It does not migrate tenant, auth, SIS, finance, communication, portal, analytics, or agent data into MySQL.

---

## Architecture Fit

DB-2 extends the DB-1 backend foundation:

```text
Node.js HTTP API
  -> modules/routes
  -> domain services in future DB phases
  -> repository context
  -> Drizzle ORM
  -> mysql2 pool
  -> MySQL
```

The frontend remains unchanged by DB-2. Existing web localStorage/mock services remain expected until later phases.

---

## Dependencies

Runtime dependencies:

```text
drizzle-orm
mysql2
```

Development tooling:

```text
drizzle-kit
tsx
```

`tsx` is used only to execute TypeScript API/dev and database scripts that use NodeNext import specifiers.

---

## Database Configuration

Database configuration is loaded by `apps/api/src/config/env.ts` and is server-side only.

Supported variables:

| Variable | Purpose | Development default |
| --- | --- | --- |
| `DATABASE_HOST` | MySQL host | `127.0.0.1` |
| `DATABASE_PORT` | MySQL port | `3306` |
| `DATABASE_NAME` | Development database | `haza_aios` |
| `TEST_DATABASE_NAME` | Test database override | `haza_aios_test` |
| `DATABASE_USER` | MySQL user | `root` |
| `DATABASE_PASSWORD` | MySQL password | empty string |
| `DATABASE_POOL_LIMIT` | MySQL pool size | `10` |

Production requires explicit API host/origin and database settings. Database credentials are never exposed through `VITE_` variables or frontend configuration.

---

## ORM Client Lifecycle

`createDatabaseClient` owns:

- a single `mysql2` connection pool
- a Drizzle ORM database instance
- `ping()` for readiness checks
- `transaction()` for reusable transaction boundaries
- `close()` for shutdown cleanup

The API server creates one database client during startup and injects it into route context. It does not construct a new ORM client per request.

---

## Migration Workflow

Scripts:

```text
npm run db:create
npm run db:generate
npm run db:check
npm run db:migrate
npm run db:migrate:status
```

Migration behavior:

- `db:create` safely creates the configured database if missing.
- `db:generate` generates migrations from Drizzle schema.
- `db:check` verifies migration metadata consistency.
- `db:migrate` applies migrations explicitly.
- `db:migrate:status` verifies database connectivity and reports applied Drizzle migrations.

Migrations do not run automatically during API startup.

---

## Foundational Migration

DB-2 creates one non-domain foundation table:

```text
internal_database_checks
```

This table exists only to prove schema, migration, timestamp, ID, connection, and transaction conventions. It is not a tenant, SIS, auth, finance, communication, or agent table.

Drizzle also manages its own migration metadata table.

---

## Health and Readiness

Liveness remains process-only:

```json
{
  "status": "alive"
}
```

Readiness now checks database connectivity:

```json
{
  "status": "ready",
  "checks": {
    "config": "ok",
    "database": "up"
  },
  "dependencies": {
    "database": "up"
  }
}
```

If the database is unavailable, the API starts but readiness returns HTTP `503` with `database: down`. Credentials, host details, SQL text, and raw driver errors are not exposed.

---

## Transaction Pattern

`withTransaction(database, work)` provides the future transaction boundary:

```text
Payment
  -> Invoice update
  -> Receipt
```

The helper maps rollback/transaction failures into safe database errors.

---

## Repository Pattern

DB-2 introduces a lightweight repository context:

```text
Route/Controller
  -> Domain Service
  -> Repository
  -> RepositoryContext
  -> Drizzle ORM / transaction
  -> MySQL
```

DB-2 intentionally avoids a broad generic repository abstraction that would hide Drizzle capabilities. DB-3+ repositories should accept either the root DB client or a transaction context.

---

## Error Handling

Database errors are mapped into safe categories:

- `DATABASE_UNAVAILABLE`
- `DATABASE_UNIQUE_CONSTRAINT`
- `DATABASE_FOREIGN_KEY_CONSTRAINT`
- `DATABASE_TRANSACTION_FAILED`
- `DATABASE_QUERY_FAILED`

API responses do not expose connection strings, credentials, SQL text, filesystem paths, or raw driver payloads.

---

## Schema Conventions

ID strategy:

- Application-generated UUID strings.
- MySQL storage convention: `char(36)`.

Naming:

- tables: `snake_case`
- columns: `snake_case`
- timestamps: `created_at`, `updated_at`
- soft delete/archive fields when needed: `deleted_at` or `archived_at`
- migration files: Drizzle-generated numbered SQL files

Timestamp strategy:

- MySQL `timestamp(3)` for millisecond precision.
- Store UTC.
- Use ORM/database defaults for `created_at` and `updated_at`.

Money strategy:

- Future financial amounts must use fixed precision `DECIMAL`, not floating point.
- Recommended baseline: `decimal(19, 4)` unless a domain-specific precision requires documentation.

Soft-delete/archive guidance:

- Do not automatically soft-delete every table.
- Preserve history for students, enrollments, attendance, results, finance, communication, portal access changes, audit, and agent execution records.

---

## Test Database

`NODE_ENV=test` defaults to:

```text
haza_aios_test
```

Integration tests are opt-in:

```text
RUN_DB_INTEGRATION_TESTS=true npm run test:api
```

The integration suite verifies:

- MySQL connection
- migration application/idempotency
- transaction commit
- transaction rollback

---

## Seed Policy

DB-2 creates seed policy infrastructure only.

Rules:

- development seeds must be explicit
- test fixtures use the test database
- production must never auto-seed demo accounts or mock data

No broad demo data is introduced in DB-2.

---

## Security Review

DB-2 keeps database credentials server-side. It does not:

- expose credentials to `apps/web`
- add `VITE_` database variables
- log passwords or connection strings
- run destructive reset workflows
- use schema sync shortcuts
- run migrations automatically in production
- add raw query patterns for domain data

---

## Explicit Non-Goals

DB-2 does not implement:

- organizations/workspaces/tenants
- users/auth/sessions/RBAC
- SIS tables
- finance tables
- communication tables
- portal tables
- analytics/reporting persistence
- agent persistence
- frontend API adapter migration
- localStorage removal
- Docker or Docker Compose

---

## DB-3 Handoff

DB-3 should begin from clean `develop` after DB-2 is merged. It can now use:

- typed MySQL configuration
- Drizzle schema and migrations
- database client lifecycle
- readiness dependency checks
- transaction helper
- repository context
- safe database error mapping

DB-3 owns Organization / Workspace / Tenant Core and should introduce the first real tenant-owned domain tables.
