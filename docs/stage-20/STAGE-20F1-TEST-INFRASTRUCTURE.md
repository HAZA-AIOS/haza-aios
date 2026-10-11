# Stage 20F.1: Reliable MySQL Integration Test Infrastructure

**Date:** October 11, 2026  
**Status:** Completed  
**Branch:** `feature/stage-20f-regression-security-validation`  
**Gap Resolution:** GAP-006 (Elimination of remote Railway SSH tunnel dependency for integration testing)

---

## 1. Overview & Root Cause Analysis (GAP-006)

Prior to Stage 20F.1, API integration tests were dependent on a remote Railway MySQL instance reached via an SSH tunnel (`127.0.0.1:33061`). This setup caused critical friction and reliability issues:
1. **Network Drops & Reset Errors:** High latency, reset packets, and abrupt SSH tunnel drops caused tests to intermittently fail with `ECONNRESET`, `ECONNREFUSED`, or migration timeout errors.
2. **Environment Contamination Risk:** Running test suites against a remote host incurred the constant risk of interacting with shared rehearsal/staging databases (`railway`, `stage19-rehearsal`).
3. **Execution Blockers:** Because the remote tunnel was unstable, 35+ integration test suites had to be disabled or skipped (`describe.skip`), leaving critical multi-tenant isolation, SIS, auth, and analytics flows unverified in CI/CD and local environments.

Stage 20F.1 completely resolves GAP-006 by establishing a local, deterministic, high-performance MySQL integration test infrastructure running directly on the development environment without Docker.

---

## 2. Local MySQL Infrastructure

- **Engine:** MariaDB 10.4.32 / MySQL Compatible (running as local service via Windows XAMPP on `127.0.0.1:3306`).
- **Database:** Dedicated integration test database `haza_aios_integration_test`.
- **User & Permissions:** Dedicated restricted test user `haza_test_runner`, granted all privileges specifically on `haza_aios_integration_test.*` with loopback connection restriction.
- **Port:** Local port `3306` (eliminating tunnel port `33061`).
- **External Dependencies:** All external Railway SSH tunnels were terminated. No Docker containers or cloud connections required.

---

## 3. Test Configuration & Fail-Closed Guard

### 3.1 Environment Configuration (`apps/api/.env.test.local`)
The test environment uses a gitignored configuration file (`apps/api/.env.test.local`):
```env
RUN_DB_INTEGRATION_TESTS=true
NODE_ENV=test
LOG_LEVEL=error
DATABASE_HOST=127.0.0.1
DATABASE_PORT=3306
DATABASE_NAME=haza_aios_integration_test
TEST_DATABASE_NAME=haza_aios_integration_test
DATABASE_USER=haza_test_runner
DATABASE_PASSWORD=<REDACTED_LOCAL_PASSWORD>
DATABASE_CONNECTION_LIMIT=5
PORT=4001
JWT_SECRET=integration-test-secret-value-never-use-in-production-32char
```

### 3.2 Fail-Closed Environment Guard (`tests/helpers/test-database-guard.ts`)
To prevent accidental connection to production, rehearsal, or external database targets, a dual-layer guard was implemented:

1. **Pre-flight Config Assertion (`assertSafeDatabaseConfig`):**
   - Requires explicit `NODE_ENV === "test"`.
   - Requires loopback host (`127.0.0.1` or `localhost`).
   - Rejects any remote or Railway hostnames (matching `/railway/i`, `/proxy\.rlwy\.net/i`).
   - Rejects known SSH tunnel port `33061`.
   - Requires approved test database name (`haza_aios_integration_test` or `haza_aios_test`).
   - Rejects production/rehearsal names (`haza_aios`, `stage19-rehearsal`, `production`, etc.).

2. **Runtime Live Identity Assertion (`assertSafeConnectedDatabase`):**
   - Executes `SELECT DATABASE() AS currentDatabase, @@hostname AS serverHostname, USER() AS currentUser` against the active MySQL connection.
   - Asserts that the currently selected database is strictly an approved test database.
   - Throws `TestDatabaseGuardError` immediately if any discrepancy is detected.

Unit tests in `tests/test-database-guard.test.ts` verify that every guard failure mode aborts execution immediately.

---

## 4. Drizzle Migration Strategy

Migrations are managed through Drizzle ORM and executed using the custom MySQL migrator (`src/database/mysql94-migrator.ts`), ensuring compatibility with timestamp precisions and schema constraints.

### Validation Results:
All 18 migrations (`0000_left_valkyrie.sql` through `0017_sharp_maverick.sql`), covering all core, SIS, finance, communication, examination, analytics, and custom domain verification tables, were applied cleanly to `haza_aios_integration_test`.
- **Table Count:** 49 tables created and verified.
- **Migration Tracking:** Verified via `__drizzle_migrations` table.

---

## 5. Test Fixtures & Safe Cleanup Architecture

### 5.1 Deterministic Fixture Factory (`tests/helpers/test-fixtures.ts`)
Provides structured, tenant-isolated fixture generation with unique UUID-based identifiers:
- `createIsolatedTenant`: Registers an isolated organization, workspace, and owner user.
- `createAcademicClassFixture`: Creates academic year, grade, section, subject, teacher, student, and active enrollment.
- `createAttendanceFixture`: Generates attendance sessions and records.
- `createFinanceFixture`: Generates fee categories, structures, assignments, invoices, and payments.
- `createExaminationFixture`: Generates examinations, subjects, marks, and calculated class results.

### 5.2 Dependency-Aware Cleanup (`tests/helpers/test-cleanup.ts`)
Provides safe, tracked cleanup of test entities:
- Operates strictly on tracked IDs (`organizationIds`, `userIds`).
- Deletes records in reverse foreign-key dependency order (from marks, receipts, payments down to enrollments, students, and organizations).
- Never issues `TRUNCATE`, `DROP DATABASE`, or un-scoped `DELETE`.
- Enforces runtime database identity validation before executing any delete statements.

---

## 6. Vitest Configuration (`apps/api/vitest.config.ts`)

- **Setup Hook:** `tests/helpers/test-setup.ts` automatically loads `.env.test.local` and validates the database guard.
- **Concurrency Control:** `fileParallelism: false` runs test files sequentially, preventing pool exhaustion and cross-file race conditions on the local database while keeping unit tests fast.
- **Timeouts:** Realistic timeouts configured (`testTimeout: 30000`, `hookTimeout: 30000`).

---

## 7. Test Execution Results

All 25 test files and 100 tests executed and passed without errors or skips:

| Suite Name | Type | Tests | Status | Duration |
|------------|------|-------|--------|----------|
| `config.test.ts` | Unit | 18 | Passed | 32ms |
| `app.test.ts` | Unit | 11 | Passed | 483ms |
| `domain.service.test.ts` | Unit | 11 | Passed | 66ms |
| `database.test.ts` | Unit | 5 | Passed | 22ms |
| `test-database-guard.test.ts` | Unit | 5 | Passed | 9ms |
| `knowledge.test.ts` | Unit | 4 | Passed | 18ms |
| `workflow-validation.test.ts` | Unit | 3 | Passed | 19ms |
| `registration-policy.test.ts` | Unit | 3 | Passed | 13ms |
| `operational-sanitization.test.ts` | Unit | 2 | Passed | 20ms |
| `mysql94-migrator.test.ts` | Unit | 2 | Passed | 10ms |
| `database.integration.test.ts` | Integration | 4 | Passed | 1010ms |
| `auth-rbac.integration.test.ts` | Integration | 5 | Passed | 2798ms |
| `auth-recovery.integration.test.ts` | Integration | 1 | Passed | 543ms |
| `platform-core.integration.test.ts` | Integration | 8 | Passed | 1779ms |
| `agent-memory.integration.test.ts` | Integration | 1 | Passed | 1824ms |
| `agent-registry.integration.test.ts` | Integration | 1 | Passed | 1937ms |
| `agent-runtime.integration.test.ts` | Integration | 1 | Passed | 1803ms |
| `knowledge.integration.test.ts` | Integration | 1 | Passed | 1330ms |
| `operational-persistence.integration.test.ts` | Integration | 1 | Passed | 1732ms |
| `workflow-persistence.integration.test.ts` | Integration | 1 | Passed | 1411ms |
| `sis-core.integration.test.ts` | Integration | 3 | Passed | 2585ms |
| `sis-attendance-timetable.integration.test.ts` | Integration | 3 | Passed | 1997ms |
| `sis-finance-communication-portal.integration.test.ts` | Integration | 2 | Passed | 1989ms |
| `sis-examination-results.integration.test.ts` | Integration | 2 | Passed | 1679ms |
| `sis-analytics-reporting.integration.test.ts` | Integration | 2 | Passed | 3479ms |
| **Total** | **All Suites** | **100** | **100% Passed (0 Skipped, 0 Failed)** | **90.72s** |

---

## 8. Guidance for Subsequent Stages

1. **Running Unit Tests Only:**
   ```bash
   cd apps/api
   npm test
   ```
   (Runs in ~1-2 seconds with integration tests automatically skipped when `RUN_DB_INTEGRATION_TESTS` is unset).

2. **Running Full Integration & Regression Test Suite (Stage 20F.2):**
   ```powershell
   cd apps/api
   $env:RUN_DB_INTEGRATION_TESTS="true"
   npx vitest run
   ```
   This automatically loads `.env.test.local`, validates the fail-closed guard, and verifies all database persistence, RBAC, domain verification, and SIS integrations against `haza_aios_integration_test`.

3. **Re-running Migrations on Test Database (if new migrations are added):**
   ```powershell
   cd apps/api
   npx tsx src/database/scripts/migrate.ts
   ```
