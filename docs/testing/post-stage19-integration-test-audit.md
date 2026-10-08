# Post-Stage 19 Integration Test Audit

## Summary
- **Total Skipped Integration Tests**: 35
- **Test Files Containing Skipped Tests**: 14

## Skipped Tests Details

### 1. `agent-memory.integration.test.ts`
- **Tests Skipped**: 1
- **Reason for skipping**: Requires persistent vector or memory store.
- **Missing dependency**: Memory database/Redis setup in test environment.
- **Runnable locally/rehearsal**: Locally if memory store is mocked or ephemeral.
- **Required action**: Configure test memory store or mock it.

### 2. `agent-registry.integration.test.ts`
- **Tests Skipped**: 1
- **Reason for skipping**: Needs comprehensive agent lifecycle mock.
- **Missing dependency**: Integration with agent definitions.
- **Runnable locally/rehearsal**: Yes, once mocks are established.
- **Required action**: Implement robust mocks.

### 3. `auth-rbac.integration.test.ts`
- **Tests Skipped**: 5
- **Reason for skipping**: Stage 19B database schema migrations changed some RBAC references, tests are pending updates.
- **Missing dependency**: Updated test fixtures.
- **Runnable locally/rehearsal**: Yes, if schema differences are fixed.
- **Required action**: Update test fixtures to match Stage 19B schema.

### 4. `agent-runtime.integration.test.ts`
- **Tests Skipped**: 1
- **Reason for skipping**: Agent runtime execution triggers complex state changes.
- **Missing dependency**: Sandboxed runtime execution context.
- **Runnable locally/rehearsal**: Yes, with proper sandboxing.
- **Required action**: Introduce runtime sandboxing for tests.

### 5. `database.integration.test.ts`
- **Tests Skipped**: 4
- **Reason for skipping**: Needs direct DB writes that might interfere with ongoing Stage 19 changes.
- **Missing dependency**: Isolated integration database for tests.
- **Runnable locally/rehearsal**: Yes, requires a dedicated test database (e.g. SQLite memory or Dockerized MySQL).
- **Required action**: Set up isolated test DB.

### 6. `operational-persistence.integration.test.ts`
- **Tests Skipped**: 1
- **Reason for skipping**: Requires operational audit log table verification.
- **Missing dependency**: Consistent state in audit tables.
- **Runnable locally/rehearsal**: Yes, in isolated DB.
- **Required action**: Clear audit tables before running.

### 7. `knowledge.integration.test.ts`
- **Tests Skipped**: 1
- **Reason for skipping**: Knowledge vector storage is not yet available in tests.
- **Missing dependency**: Vector DB mock/instance.
- **Runnable locally/rehearsal**: Requires vector DB.
- **Required action**: Use a local mock vector DB for tests.

### 8. `platform-core.integration.test.ts`
- **Tests Skipped**: 8
- **Reason for skipping**: Broad integration across multiple modules; currently unstable due to Stage 19 schema changes.
- **Missing dependency**: Stable baseline test data.
- **Runnable locally/rehearsal**: Yes, after fixing test data.
- **Required action**: Update test setup to seed the new schema structure.

### 9. `sis-analytics-reporting.integration.test.ts`
- **Tests Skipped**: 2
- **Reason for skipping**: Heavy querying on unindexed test data causes timeouts.
- **Missing dependency**: Proper test data volume and indexes.
- **Runnable locally/rehearsal**: Yes, with limited test data.
- **Required action**: Optimize test queries or reduce mock data volume.

### 10. `sis-attendance-timetable.integration.test.ts`
- **Tests Skipped**: 3
- **Reason for skipping**: Complex foreign key relationships from Stage 19.
- **Missing dependency**: Updated fixture factories.
- **Runnable locally/rehearsal**: Yes.
- **Required action**: Refactor fixture generation.

### 11. `sis-core.integration.test.ts`
- **Tests Skipped**: 3
- **Reason for skipping**: Relies on specific core tenant/organization setup which was modified.
- **Missing dependency**: Correct tenant seeding.
- **Runnable locally/rehearsal**: Yes.
- **Required action**: Update test setup for tenants.

### 12. `sis-examination-results.integration.test.ts`
- **Tests Skipped**: 2
- **Reason for skipping**: Grading engine integration needs isolation.
- **Missing dependency**: Grading service mock.
- **Runnable locally/rehearsal**: Yes, with mock.
- **Required action**: Implement grading mock.

### 13. `sis-finance-communication-portal.integration.test.ts`
- **Tests Skipped**: 2
- **Reason for skipping**: External payment/email gateway dependencies.
- **Missing dependency**: Gateway mocks.
- **Runnable locally/rehearsal**: Yes, with mocks.
- **Required action**: Mock external services.

### 14. `workflow-persistence.integration.test.ts`
- **Tests Skipped**: 1
- **Reason for skipping**: Long-running workflow state validation is flaky.
- **Missing dependency**: Deterministic workflow runner for tests.
- **Runnable locally/rehearsal**: Yes.
- **Required action**: Fix test timing/synchronization.
