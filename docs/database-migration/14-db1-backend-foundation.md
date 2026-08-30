# DB-1 Backend Application Foundation

**Phase:** DB-1 — Backend Application Foundation  
**Status:** Implemented as backend runtime foundation only  
**Application path:** `apps/api`  
**API base:** `/api/v1`

DB-1 establishes the HAZA AIOS backend application runtime that future database phases will build on. It does not connect to MySQL, install an ORM, create migrations, migrate SIS persistence, or migrate AI Agent persistence.

---

## Framework

DB-0 defined a layered HTTP backend but did not require a specific third-party framework. DB-1 therefore uses a TypeScript Node.js HTTP foundation instead of introducing a heavier framework before database and domain boundaries are proven.

This keeps the approved DB-0 architecture intact:

```text
React frontend
  -> HTTP API
  -> backend application
  -> domain services
  -> repositories
  -> MySQL in DB-2+
```

The framework choice for DB-1 is:

```text
Node.js HTTP server + TypeScript
```

---

## Directory Structure

```text
apps/api/
├── src/
│   ├── common/
│   │   ├── errors/
│   │   ├── http/
│   │   ├── logging/
│   │   └── validation/
│   ├── config/
│   ├── middleware/
│   ├── modules/
│   │   ├── foundation/
│   │   └── health/
│   ├── routes/
│   ├── app.ts
│   └── server.ts
├── tests/
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

The module registration pattern is intentionally small. Future DB phases can add `auth`, `organizations`, `workspaces`, `education`, `agents`, and `audit` modules without rewriting server startup.

---

## Runtime Configuration

Supported DB-1 environment variables:

| Variable | Purpose | Development default |
| --- | --- | --- |
| `NODE_ENV` | Runtime environment: `development`, `test`, or `production` | `development` |
| `API_HOST` | API listen host | `127.0.0.1` outside production |
| `API_PORT` | API listen port | `8000` |
| `WEB_ORIGIN` | Allowed frontend origin for CORS | `http://localhost:3000` outside production |
| `LOG_LEVEL` | `error`, `warn`, `info`, or `debug` | `debug` outside production |
| `API_BODY_LIMIT_BYTES` | Maximum JSON body size | `1048576` |

Production does not silently fall back for `API_HOST` or `WEB_ORIGIN`.

No database credentials are consumed by DB-1.

---

## API Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/health` | Basic service health |
| `GET` | `/api/v1/readiness` | DB-1 readiness: configuration only, database explicitly not configured |
| `GET` | `/api/v1/liveness` | Process liveness |
| `GET` | `/api/v1/foundation/validate?value=...` | Minimal validation foundation proof |

Unknown API routes return a structured 404 JSON response. The API server never serves frontend HTML.

---

## Request and Error Conventions

Each request receives an `x-request-id` response header. A safe incoming `x-request-id` is reused; otherwise the API generates one.

Error responses use this shape:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "API route not found",
    "requestId": "..."
  }
}
```

Production responses do not expose stack traces, local filesystem paths, secrets, or raw internal error details.

---

## Security Foundation

DB-1 includes:

- CORS constrained to `WEB_ORIGIN`.
- HTTP security headers: `x-content-type-options`, `x-frame-options`, `referrer-policy`, and `permissions-policy`.
- JSON request body size limits.
- Structured logging with configurable levels.
- Request IDs in logs and error responses.
- Graceful shutdown hooks for `SIGINT` and `SIGTERM`.

Do not log passwords, tokens, cookies, API secrets, database credentials, or unnecessary student/person data.

---

## Frontend Connectivity

The existing frontend API client already supports a configurable `VITE_API_BASE_URL`. The existing `apps/web/.env.example` points to `http://localhost:8000`, and the new backend exposes versioned routes beneath `/api/v1`.

No visible UI was added for DB-1. Connectivity is proven through backend integration tests that exercise HTTP requests to the running API application.

---

## Scripts

Root scripts:

```text
npm run dev:api
npm run build:api
npm run lint:api
npm run typecheck:api
npm run test:api
```

API workspace scripts:

```text
npm run dev -w apps/api
npm run build -w apps/api
npm run lint -w apps/api
npm run typecheck -w apps/api
npm run test -w apps/api
```

---

## Testing

DB-1 backend tests cover:

- Application boot.
- Health endpoint.
- Readiness and liveness.
- Structured 404.
- Validation failure.
- Request ID behavior.
- CORS.
- Security headers.
- Body size limits.
- Environment validation.

Tests do not require MySQL.

---

## Explicit Non-Goals

DB-1 intentionally does not implement:

- MySQL connection.
- ORM schema or ORM client.
- Migrations.
- Database tables.
- Database seeds.
- SIS persistence conversion.
- Agent persistence conversion.
- Real authentication migration.
- Mock/localStorage removal.

---

## DB-2 Handoff

DB-2 should begin from a clean approved `develop` after DB-1 is merged. DB-2 owns MySQL, ORM selection, migration tooling, baseline schema, connection lifecycle, and repository implementations.
