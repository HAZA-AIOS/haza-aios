# Stage 20G.2: Production Release Manifest

**Proposed Release Version:** `v0.9.0-alpha.2`  
**Candidate Branch:** `feature/stage-20f-regression-security-validation`  
**Candidate Commit SHA:** `627f675df134516e984a808323758f14e5d268fb` (`627f675`)  
**Production Baseline (`origin/main`):** `ae8f0e5ef87f196a7f78f46cc0961325077f9690` (`ae8f0e5`)  
**Merge Base:** `ae8f0e5ef87f196a7f78f46cc0961325077f9690` (Fast-forwardable; 0 commits behind, 18 commits ahead)  
**Total Changes:** 49 files changed, 29,293 insertions(+), 107 deletions(-)

---

## 1. Candidate Commit History (18 Commits Ahead of Main)

```
627f675 docs(stage-20g): document production database restore rehearsal results and verification
1aad577 fix(backup): dynamically resolve MYSQLUSER, MYSQLPASSWORD, and MYSQLDATABASE for production preflight
728b03a fix(backup): repair command quoting, native async stderr reading, and diagnostic failure logging
7f71f70 fix(backup): repair production backup script with secure launcher resolution and credential isolation
4e63335 docs(stage-20g): complete Stage 20G.1B backup & recovery verification and tooling
b9d61a7 docs(stage-20g): complete Stage 20G.1 production preflight and backup verification
003ffd5 docs(release): Stage 20F.4 release readiness assessment and Stage 20G deployment plan
760603b test(regression): end-to-end workflow regression suite across platform and SIS (Stage 20F.3)
06c0291 test(security): automated multi-tenant isolation and rbac security suite (Stage 20F.2)
d47d3c3 feat(test-infra): establish isolated local mysql test db and fail-closed guard (Stage 20F.1)
06b73c4 docs: finalize stage 20E examination and analytics audit
af5cc7b docs: finalize Stage 20D.1 integration tests and isolation audit
234babc feat: complete finance and communication backend integration
f2474d4 feat(stage-20c.1): secure domain ownership verification
636de1b feat(stage-20c): attendance, timetable & domain integration
7d54e84 feat(sis): wire up student and staff UI with real endpoints and fix integration gaps
736eca4 docs(stage-20a): comprehensive integration audit and plan
801a8f2 docs: Establish Stage 19 production baseline
```

---

## 2. Changed Files Categorization

### A. Database Migrations & Schema (Additive)
- `apps/api/src/database/migrations/0016_left_deathstrike.sql` (Creates `tenant_domains` table)
- `apps/api/src/database/migrations/0017_youthful_silverclaw.sql` (Modifies `tenant_domain_status` enum, adds `verification_token`)
- `apps/api/src/database/migrations/meta/0016_snapshot.json` (Drizzle Kit schema snapshot)
- `apps/api/src/database/migrations/meta/0017_snapshot.json` (Drizzle Kit schema snapshot)
- `apps/api/src/database/migrations/meta/_journal.json` (Journal entries for 0016 & 0017)
- `apps/api/src/database/schema.ts` (Adds `tenantDomains` table definition and relations)

### B. Backend Services & Modules
- `apps/api/src/modules/education/education.module.ts` (Wired SIS endpoints for timetable, finance, examination, communication)
- `apps/api/src/modules/platform/platform.module.ts` (Exposed domain verification routes)
- `apps/api/src/modules/platform/services/domain.service.ts` (Domain validation and DNS TXT verification logic)

### C. Frontend UI & Services
- `apps/web/src/App.tsx` (Added route for `/workspace/settings/domains`)
- `apps/web/src/components/AppShell.tsx` (Navigation link to domains configuration)
- `apps/web/src/org/domain-service.ts` (Frontend API client for domain management)
- `apps/web/src/pages/workspace/WorkspaceDomainsPage.tsx` (Custom domains management UI)
- `apps/web/src/pages/education/staff/TeacherDirectoryPage.tsx` (Live backend integration)
- `apps/web/src/pages/education/students/StudentDirectoryPage.tsx` (Live backend integration)

### D. Test Infrastructure & Test Suites
- `apps/api/tests/helpers/test-setup.ts` (Isolated local test database loader)
- `apps/api/tests/helpers/test-database-guard.ts` (Fail-closed guard preventing production test execution)
- `apps/api/tests/helpers/test-cleanup.ts` (Automated transactional table cleaner)
- `apps/api/tests/helpers/test-fixtures.ts` (Multi-tenant test seeds)
- `apps/api/tests/domain.service.test.ts` (11 unit tests for DNS verification)
- `apps/api/tests/tenant-rbac-security.integration.test.ts` (22 multi-tenant isolation tests)
- `apps/api/tests/workflow-regression.integration.test.ts` (Workflow regression tests)
- `apps/api/tests/auth-recovery.integration.test.ts` (Password recovery integration updates)
- `apps/api/tests/test-database-guard.test.ts` (Guard verification tests)
- `apps/api/vitest.config.ts` (Setup files integration)

### E. Operational Tooling
- `scripts/backup-production.ps1` (Production backup script with secure Railway SSH launcher)

### F. Non-Essential / Diagnostic Artifacts (Audited)
- `apps/api/test_recovery_flow.ts` (Development scratch script for password recovery; harmless local script)
- `clean_tree.txt` (UTF-16 directory listing generated during Stage 20B audit)
- `repo_structure.txt` (UTF-16 directory listing generated during Stage 20B audit)
- `apps/api/tsconfig.tsbuildinfo` (TypeScript incremental build cache)

### G. Documentation Deliverables
- `docs/releases/STAGE-19-PRODUCTION-BASELINE.md`
- `docs/stage-20/API-FRONTEND-MAPPING.md`
- `docs/stage-20/INTEGRATION-GAP-REGISTER.md`
- `docs/stage-20/MODULE-INTEGRATION-MATRIX.md`
- `docs/stage-20/STAGE-20-EXECUTION-PLAN.md`
- `docs/stage-20/STAGE-20A-INTEGRATION-AUDIT.md`
- `docs/stage-20/STAGE-20B-SIS-CORE-INTEGRATION.md`
- `docs/stage-20/STAGE-20C-ATTENDANCE-TIMETABLE-DOMAINS.md`
- `docs/stage-20/STAGE-20D-FINANCE-COMMUNICATION.md`
- `docs/stage-20/STAGE-20E-EXAMINATIONS-ANALYTICS.md`
- `docs/stage-20/STAGE-20F1-TEST-INFRASTRUCTURE.md`
- `docs/stage-20/STAGE-20F2-TENANT-RBAC-SECURITY.md`
- `docs/stage-20/STAGE-20F3-WORKFLOW-REGRESSION.md`
- `docs/stage-20/STAGE-20F4-RELEASE-READINESS.md`
- `docs/stage-20/STAGE-20G-PRODUCTION-RELEASE-PLAN.md`
- `docs/stage-20/STAGE-20G1-PRODUCTION-PREFLIGHT.md`
- `docs/stage-20/STAGE-20G1B-BACKUP-RECOVERY-VERIFICATION.md`
- `docs/stage-20/STAGE-20G1E-RESTORE-REHEARSAL.md`
- `docs/stage-20/TENANT-ISOLATION-AUDIT.md`

---

## 3. Dependency Audit
- **Package Manifest Changes:** 0 package manifest changes between `origin/main` and candidate HEAD. No new third-party dependencies were introduced to `package.json`, `apps/api/package.json`, or `apps/web/package.json`.
- **Lockfile Integrity:** `package-lock.json` is clean and unchanged.
- **Unrelated Work:** Confirmed zero unrelated feature branches or external PRs merged into this release. All changes strictly correspond to Stage 20 integration, security, testing, and operational recovery deliverables.
