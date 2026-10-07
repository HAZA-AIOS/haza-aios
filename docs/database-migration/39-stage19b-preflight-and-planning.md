# Stage 19B: Preflight & Execution Planning

## 1. Credential Rotation Plan
During Stage 19A diagnostic workflows, the production `MYSQLPASSWORD` was temporarily exposed into terminal memory on the authoritative development machine. Before or concurrent with the Stage 19B migration, the production database credential must be rotated.

**Coordinated Rotation Procedure:**
1. **Suspend API Writes:** Scale the production API to 0 replicas in Railway, or enable maintenance mode, to ensure no data is written during rotation.
2. **Rotate Database Password:** In the Railway dashboard for the `MySQL` service, locate the `MYSQLPASSWORD` variable. Regenerate or manually update the password to a new secure value.
3. **Propagate to API:** In the Railway dashboard for the `haza-aios-api` service, update the `DATABASE_PASSWORD` variable to match the newly generated database password.
4. **Deploy API (Stage 19B Trigger):** Triggering the API deployment will automatically run the `preDeployCommand = npm run db:migrate`, applying the Stage 19 migrations safely using the newly rotated credentials.

## 2. Integration Test Review (35 Skipped Tests)
During the Stage 19A.4 quality gate checks, 35 integration tests were automatically skipped. 

**Why were they skipped?**
The test runner is configured to skip database integration tests unless the `RUN_DB_INTEGRATION_TESTS=true` environment variable is explicitly provided. This is a critical safety mechanism designed to prevent local test runs from accidentally mutating or polluting remote production/rehearsal databases with synthetic test data.

**What do they cover?**
The 35 tests across 14 test suites cover full-stack persistence behaviors, including:
- **Core Platform & RBAC:** `platform-core`, `auth-rbac`, `database` (Transaction commits/rollbacks, constraint validations).
- **Agent Ecosystem:** `agent-memory`, `agent-runtime`, `agent-registry`, `knowledge`, `workflow-persistence` (Agent context storage, knowledge-base updates, workflow state transitions).
- **SIS (Student Information System):** `sis-core`, `sis-analytics-reporting`, `sis-attendance-timetable`, `sis-examination-results`, `sis-finance-communication-portal` (Core SIS CRUD operations, complex joins for analytics, timetable scheduling rules).
- **Operations:** `operational-persistence` (Logging, audit trails).

**Execution Recommendation:**
These tests should **not** be executed against the `stage19-rehearsal` database, as they mutate state and will inject non-representative synthetic test data (e.g., `randomUUID()` rows) that pollutes the representative data validation we rely on for Stage 19. They should be executed locally only when a dedicated ephemeral database container (e.g., Docker Testcontainers or an isolated local MySQL 9.7 instance) is spun up specifically for automated testing.

## 3. Stage 19B Execution Runbook
Once approval is granted, the execution of Stage 19B will follow this precise sequence:
1. **Pre-flight:** Confirm the production backup (`haza-aios-production-stage19a4.sql`) is safely stored and checksum validated.
2. **Credential Rotation:** Execute the coordinated credential rotation procedure (Section 1).
3. **Initiate Migration (Deployment):** Trigger the API deployment in Railway. The Railway pipeline will execute `npm run db:migrate` prior to spinning up the new API containers.
4. **Verification:**
   - Verify the deployment succeeds.
   - Execute production integrity checks (read-only verification).
   - Verify API health endpoints and core application flows via the web client.
5. **Cleanup:** Once production is fully verified and stable, tear down the temporary `stage19-rehearsal` environment (`MySQL-rhgS`) to avoid unnecessary resource consumption.

## 4. Current Status
**Production Execution is BLOCKED** pending user approval to begin the execution phase based on this plan.
