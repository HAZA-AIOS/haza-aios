# HAZA-AIOS — EPIC 16
## Production Deployment, Verification & Smoke Test Plan

### 1. Release Identification
- **Epic:** 16 — Agent Tools & Organizational Data Integration
- **Release Version:** `v0.16.0-epic16`
- **Target Environments:**
  - Railway API: `https://api.haza-aios.com`
  - Railway Web: `https://web-production-76faf.up.railway.app`
  - Railway Dedicated Background Worker: `worker` service
  - Railway MySQL Database: Managed MySQL 9.4

---

### 2. Pre-Deployment Verification
Before applying migrations or merging to `main`:
1. **Full API Test Suite:** 48 test files, 368 tests passed, 0 failures.
2. **Full Web Test Suite:** 51 test files, 292 tests passed, 0 failures.
3. **Monorepo Typechecks:** Both `apps/api` and `apps/web` pass `tsc` with 0 type errors.
4. **Vite Production Bundling:** Clean build completed with gzip output verification.
5. **Local Migration Verification:** Migration 0026 applied cleanly on local database and integration test database.

---

### 3. Production Deployment Protocol
1. **Verified Database Backup:**
   - Execute a complete MySQL dump of production database `railway` before running migrations.
   - Record archive path, file size, timestamp, and SHA-256 checksum.
2. **Isolated Migration Rehearsal:**
   - Run rehearsal script against isolated staging schema `haza_epic16_rehearsal` on the target MySQL instance.
   - Verify table creation:
     - `ai_agent_tools`
     - `ai_agent_tool_versions`
     - `ai_agent_tool_tenant_policies`
     - `ai_agent_tool_executions`
   - Verify index creation, FK constraints, and rollback idempotency.
3. **Apply Production Migration:**
   - Run `migrate.ts` targeting production database. Verify journal record updated for migration 0026.
4. **Deploy Application Services:**
   - Merge `feature/epic-16-agent-tools-org-data` to `main`.
   - Monitor Railway builds for `api`, `web`, and `worker`.
   - Verify all services achieve healthy running state.
5. **Live Smoke Testing:**
   - Execute automated end-to-end smoke test against live production endpoints.
   - Verify:
     - Health checks (`/health`).
     - Tool registry endpoints (`/api/v1/agents/tools`).
     - Tenant policy enforcement.
     - Autonomous tool invocation by agent runtime.
     - Human approval checkpoint for high-risk operations (`education.lesson_plans.publish`).
     - Zero student PII exposure.
   - Cleanly purge any synthetic test records created during verification.
6. **Release Tagging:**
   - Create annotated Git tag `v0.16.0-epic16` and push to remote repository.
