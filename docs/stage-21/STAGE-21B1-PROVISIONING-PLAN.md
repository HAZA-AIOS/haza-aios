# HAZA AIOS — STAGE 21B.1
## DEPENDENCY-ORDERED STAGING PROVISIONING PLAN (STAGE 21B.2)

**Document ID:** HAZA-AIOS-STG-21B1-PLAN-001  
**Version:** 1.0  
**Date:** October 14, 2026  
**Status:** Proposed for Operator Approval  
**Classification:** Internal — Operational Runbook  
**Auditor:** HAZA AIOS Core Agent (Antigravity)  

---

## 1. Execution Overview

This document defines the strict, dependency-ordered sequence for executing **Stage 21B.2: Controlled Remote Staging Provisioning**.

**Safety Mandate:** No remote provision command shall be executed until Phase 0 (Code & Guard Remediation) is complete and explicit operator approval is granted.

---

## 2. Dependency-Ordered Step-by-Step Runbook

### STEP 0: Local Code & Guard Remediation (Pre-Provisioning Prerequisite)
- **Preconditions:** Clean working tree on `feature/stage-21a-staging-foundation`.
- **Target Resource:** Local codebase (`apps/api/src/config/env.ts`, `apps/api/src/database/client.ts`, `apps/api/src/modules/auth/services/token.service.ts`).
- **Actions:**
  1. Add `"staging"` to `allowedNodeEnvs` in `apps/api/src/config/env.ts`.
  2. Wire `assertSafeStagingDatabaseConfig` into `apps/api/src/database/client.ts` (`createDatabaseClient`) when `NODE_ENV === "staging"`.
  3. Create dedicated staging migration script `apps/api/src/database/scripts/migrate-staging.ts` with mandatory fail-closed guard assertion.
  4. Parameterize `sessionCookieName` in `token.service.ts` to allow `haza_session_staging`.
  5. Add environment block for `staging` in `apps/web/wrangler.jsonc`.
- **Expected Outcome:** Codebase fully supports staging runtime without errors or guard bypass.
- **Verification Method:** `npm run typecheck:api`, `npm run typecheck:web`, and unit tests pass 100%.
- **Failure Response:** Abort. Do not push to remote.
- **Operator Authorization Required:** NO (Local code changes within stage scope).

---

### STEP 1: GitHub Staging Branch Publication
- **Preconditions:** Step 0 verified and committed locally.
- **Target Resource:** GitHub remote `HAZA-AIOS/haza-aios`.
- **Action:** Push branch `feature/stage-21a-staging-foundation` to remote origin.
- **Expected Outcome:** Branch visible on GitHub. Zero production deployments triggered.
- **Verification Method:** `git ls-remote origin feature/stage-21a-staging-foundation`. Confirm Railway production remains idle.
- **Failure Response:** If push fails, inspect permissions. If production triggers (impossible), cancel deployment immediately.
- **Operator Authorization Required:** **YES**.

---

### STEP 2: Railway Staging Environment Creation
- **Preconditions:** Step 1 complete. Operator logged in to Railway CLI.
- **Target Resource:** Railway Project `haza-aios` (`e28efe9a-f4f0-4ace-8ccf-5cc04baede34`).
- **Action:** Execute `railway environment new staging` (NEVER use `--duplicate production`).
- **Expected Outcome:** New isolated environment `staging` created with 0 services and 0 copied variables.
- **Verification Method:** `railway environment list --json`. Confirm `staging` exists and is empty.
- **Failure Response:** If environment creation fails, check quota. If duplicated accidentally, delete environment immediately.
- **Operator Authorization Required:** **YES**.

---

### STEP 3: Provision Staging MySQL Database
- **Preconditions:** Step 2 complete. Environment `staging` active.
- **Target Resource:** Railway `staging` environment.
- **Action:** Add service `MySQL-staging` running image `mysql:9` with 500 MB persistent volume.
- **Expected Outcome:** MySQL instance running with generated internal credentials.
- **Verification Method:** `railway status -e staging`. Confirm `MySQL-staging` is Online.
- **Failure Response:** Check volume quotas. If quota exceeded, decommission `stage19-rehearsal` volume.
- **Operator Authorization Required:** **YES**.

---

### STEP 4: Configure Staging Environment Variables
- **Preconditions:** Step 3 complete. Staging database credentials generated.
- **Target Resource:** Railway `staging` environment variables for API service.
- **Action:** Set variables:
  `NODE_ENV=staging`, `APP_ENV=staging`, `API_HOST=0.0.0.0`, `DATABASE_NAME=haza_aios_staging`, `DATABASE_HOST=<staging-internal-host>`, `DATABASE_USER=...`, `DATABASE_PASSWORD=...`, `WEB_ORIGIN=https://staging.haza-aios.com`, `WEB_ORIGINS=https://staging.haza-aios.com`, `SESSION_COOKIE_NAME=haza_session_staging`, `RESEND_API_KEY=""`.
- **Expected Outcome:** Staging environment configured with zero production references.
- **Verification Method:** Verify variable keys via safe node extraction. Confirm `DATABASE_NAME` is strictly `haza_aios_staging`.
- **Failure Response:** If any production secret is copied, purge and recreate variables.
- **Operator Authorization Required:** **YES**.

---

### STEP 5: Apply Staging Migrations
- **Preconditions:** Step 4 complete.
- **Target Resource:** Staging MySQL database `haza_aios_staging`.
- **Action:** Run `npm run db:migrate:staging` (targeting staging TCP proxy or internal runner).
- **Expected Outcome:** All 18 migrations applied successfully to `haza_aios_staging`.
- **Verification Method:** Check migration logs. Verify `StagingDatabaseGuard` confirmed target is `haza_aios_staging`.
- **Failure Response:** If guard halts, inspect connection string. Zero production impact.
- **Operator Authorization Required:** **YES**.

---

### STEP 6: Seed Synthetic Staging Fixtures
- **Preconditions:** Step 5 complete.
- **Target Resource:** Staging MySQL database `haza_aios_staging`.
- **Action:** Run `npm run db:seed:staging` to insert 9 synthetic users, 2 organizations, and SIS records.
- **Expected Outcome:** Synthetic data populated with hashed passwords and referential integrity intact.
- **Verification Method:** Query count of users in `haza_aios_staging` (should equal 9).
- **Failure Response:** Review foreign-key relationships. Fix fixture insert order.
- **Operator Authorization Required:** **YES**.

---

### STEP 7: Deploy Staging API Service
- **Preconditions:** Step 6 complete.
- **Target Resource:** Railway `staging` environment service `haza-aios-api-staging`.
- **Action:** Deploy container linked to `feature/stage-21a-staging-foundation` branch.
- **Expected Outcome:** Service builds and deploys successfully. Healthcheck `/api/v1/readiness` passes.
- **Verification Method:** `curl -s https://api-staging.haza-aios.com/api/v1/readiness` returns `{ status: "ok" }`.
- **Failure Response:** Inspect Railway build logs. Check database connectivity.
- **Operator Authorization Required:** **YES**.

---

### STEP 8: Deploy Cloudflare Staging Frontend
- **Preconditions:** Step 7 verified.
- **Target Resource:** Cloudflare Worker `haza-aios-staging`.
- **Action:** Build with `VITE_API_URL=https://api-staging.haza-aios.com` and deploy to environment `staging`.
- **Expected Outcome:** SPA deployed to Cloudflare edge.
- **Verification Method:** Inspect deployed asset manifest in Cloudflare dashboard.
- **Failure Response:** Check Vite build logs.
- **Operator Authorization Required:** **YES**.

---

### STEP 9: Configure Staging DNS & SSL
- **Preconditions:** Steps 7 & 8 complete.
- **Target Resource:** Cloudflare DNS for `haza-aios.com`.
- **Action:**
  1. Add CNAME `staging.haza-aios.com` -> Cloudflare Worker `haza-aios-staging`.
  2. Add CNAME `api-staging.haza-aios.com` -> Railway custom domain proxy.
- **Expected Outcome:** Both subdomains resolve with valid SSL/TLS certificates.
- **Verification Method:** `Resolve-DnsName staging.haza-aios.com`, `curl -I https://staging.haza-aios.com`.
- **Failure Response:** Check DNS propagation.
- **Operator Authorization Required:** **YES**.

---

### STEP 10: Authenticated Smoke & Isolation Testing
- **Preconditions:** Step 9 complete.
- **Target Resource:** Staging environment.
- **Action:**
  1. Authenticate as `admin.staging@staging.haza-aios.com`.
  2. Verify cookie `haza_session_staging` is issued with `SameSite=Lax; HttpOnly; Secure`.
  3. Authenticate as `teacher.curie@staging.haza-aios.com` (Org Alpha) and confirm Org Beta data is unreachable (HTTP 403/404).
- **Expected Outcome:** 100% of authentication and isolation checks pass.
- **Verification Method:** Automated Playwright / Vitest smoke test run.
- **Failure Response:** If session fails, review CORS origin headers.
- **Operator Authorization Required:** NO (Standard automated test execution).

---

### STEP 11: Emergency Rollback / Teardown Runbook
If staging behaves unexpectedly or quota issues arise:
1. **Teardown Railway Staging:** `railway down -e staging`.
2. **Remove DNS Records:** Delete CNAMEs for `staging.haza-aios.com` and `api-staging.haza-aios.com`.
3. **Reset Database:** Drop `haza_aios_staging` (production completely unaffected).
