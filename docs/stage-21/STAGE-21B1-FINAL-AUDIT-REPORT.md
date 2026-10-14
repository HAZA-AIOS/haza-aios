# HAZA AIOS — STAGE 21B.1
## PRE-PROVISIONING INFRASTRUCTURE & SECURITY SAFETY AUDIT — FINAL REPORT

**Document ID:** HAZA-AIOS-STG-21B1-RPT-001  
**Version:** 1.0  
**Date:** October 14, 2026  
**Auditor:** HAZA AIOS Core Agent (Antigravity)  
**Repository:** `C:\HAZA-APPS\HAZA-AIOS`  
**GitHub:** `HAZA-AIOS/haza-aios`  
**Current Branch:** `feature/stage-21a-staging-foundation`  
**Commit SHA:** `d14888661fa8e973302947713190cb45d8823f9e`  
**Production Release Baseline:** `241d711a0a9737dd1973a80c5a51eb418d74a1e6` (Tag `v0.9.0-alpha.2`)  

---

### FINAL AUDIT DISPOSITION
```
B. CONDITIONAL GO — REMEDIATION REQUIRED
```

**Reasoning for Disposition:**
The audit confirms that the Railway and Cloudflare architecture safely supports dedicated staging isolation without risking production disruption. However, remote provisioning is strictly **blocked** until 4 specific code and configuration remediations are implemented in the local repository:
1. The database fail-closed guard must be actively wired into database connection initialization and migration scripts.
2. `apps/api/src/config/env.ts` must be updated to permit `NODE_ENV=staging`.
3. The session cookie configuration must use Host-Only cookies with a parameterized name (`haza_session_staging`), rather than attempting an unroutable sibling subdomain attribute.
4. `apps/web/wrangler.jsonc` must define a dedicated `staging` environment target to prevent accidental worker overwrites.

---

## 1. Verified Railway Infrastructure Findings

- **Project Identity:** `haza-aios` (`e28efe9a-f4f0-4ace-8ccf-5cc04baede34`) under account `mussawarhussain@gmail.com`.
- **Existing Environments:** Two environments exist: `production` (`e1766450-207b...`) and `stage19-rehearsal` (`c19bac81-2451...`). Staging environment does not exist yet.
- **Production Services:**
  - `api`: Service ID `6eb47d5c-e93b-4e8a-8f94-acb41aa2ae74`, Deployment `ee0fceb8-02ad...` (Release `v0.9.0-alpha.2`).
  - `web`: Service ID `d81d71f2-e07f-4f3e-bd68-00571e86c559`.
  - `MySQL`: Service ID `fbab30e4-7c99-42b6-87da-33f98b5ab77d` with volume `mysql-volume` (500 MB capacity, 194.9 MB used).
- **Branch Tracking:** Production `api` tracks strictly `main` with watch pattern `["/apps/api/**"]`. Commits to `feature/*` do not trigger production builds.
- **Migration Safety:** Production manifest confirms `preDeployCommand: null`. Railway does not execute automatic migrations during deployment.
- **Account Tier:** Marked as `"plan": "trial"` in deployment manifests.

---

## 2. Verified Cloudflare Infrastructure Findings

- **Zone:** `haza-aios.com` managed via Cloudflare authoritative DNS.
- **Live Records:** `www.haza-aios.com` and `api.haza-aios.com` resolve to Cloudflare Anycast edge proxies.
- **Proposed Staging Subdomains:** `staging.haza-aios.com` and `api-staging.haza-aios.com` have zero existing DNS records (completely free and unassigned; zero conflict).
- **Worker Configuration:** `apps/web/wrangler.jsonc` targets worker `haza-aios` using Static Assets. Lacks an `env.staging` block.

---

## 3. Database Guard Security Assessment

- **Current Implementation:** `apps/api/src/config/staging-database-guard.ts` implements string checks blocking `haza_aios`, `production`, and `mysql`.
- **Major Gap:** The guard is an orphaned utility. Neither `apps/api/src/database/client.ts` (`createDatabaseClient`), `apps/api/src/server.ts`, nor `apps/api/src/database/scripts/migrate.ts` calls the guard.
- **Missing Protections:** Does not parse raw `DATABASE_URL` strings, does not check Railway external TCP proxy hostnames (`roundhouse.proxy.rlwy.net`), and does not verify `NODE_ENV`.
- **Severity:** **CRITICAL**. Must be wired and enhanced before provisioning.

---

## 4. Authentication, Cookie & CORS Assessment

- **Cookie Delivery Dynamics:**
  - Omitting the `Domain` attribute in `buildSessionCookie` creates a Host-Only cookie bound to `api-staging.haza-aios.com`.
  - Because `staging.haza-aios.com` and `api-staging.haza-aios.com` share the registrable domain `haza-aios.com` under HTTPS, requests with `credentials: "include"` and `SameSite=Lax` will successfully deliver the session cookie to the API.
  - Setting `Domain=staging.haza-aios.com` (as proposed in the Stage 21A template) is rejected by browsers when emitted from `api-staging.haza-aios.com`.
- **Cookie Name Parameterization:** `sessionCookieName` is currently hardcoded as `"haza_session"`. It must be parameterized to `haza_session_staging` to prevent session confusion.
- **CORS:** `apps/api/src/middleware/cors.ts` correctly validates `config.webOrigins` and echoes `access-control-allow-credentials: "true"`.

---

## 5. Secret and Environment Isolation Assessment

- **Environment Enum Limitation:** `apps/api/src/config/env.ts` restricts `NODE_ENV` to `development | test | production`. Supplying `NODE_ENV=staging` throws an uncaught error.
- **Email Sandbox Behavior:** If `NODE_ENV === "production"`, `readEmailConfig` mandates `RESEND_API_KEY`. In staging, email delivery should be explicitly mocked without requiring a live key.
- **Isolation Rule:** Staging must use independent secrets (`JWT_SECRET`, `SESSION_SECRET`, `DATABASE_PASSWORD`) generated at deployment time.

---

## 6. Deployment-Trigger Risk Matrix

- **Pushing `feature/stage-21a-staging-foundation`:** Triggers **0 builds** on Railway production and **0 GitHub Actions**.
- **Merging to `main`:** Would trigger immediate Railway and Cloudflare production deployments. (Strictly prohibited).
- **Deployment Isolation:** Fully verifiable and safe.

---

## 7. Synthetic Fixture Readiness

- **Role & Model Coverage:** 9 distinct user roles, 2 organizations (`Alpha` and `Beta`), 2 campuses, 2 standalone businesses, and SIS entities designed in `staging-fixtures.ts`.
- **Structural Validation:** Verified via `staging-validate.ts` (13 validation rules passed).
- **Schema Insertion Gap:** `staging-fixtures.ts` contains logical representations, but lacks password hashing and `normalizedEmail` computation required to insert directly into the Drizzle `users` table schema.

---

## 8. Cost and Quota Findings

- **Verified Facts:** Railway project is on `trial` plan with 2 existing volumes (`mysql-volume` and `mysql-volume-khCk` totalling 1,000 MB).
- **Quota Risk:** Railway trial plans typically cap persistent storage at 1GB and active container hours.
- **Optimization Strategy:** Decommissioning the completed `stage19-rehearsal` environment will immediately reclaim 500 MB volume storage and eliminate idle container costs.
- **Projected Running Cost:** ~$3.50 – $4.50/month if active; $0.00 if scaled to zero between test runs.

---

## 9. Local Validation Results

| Test Category | Command / Script | Result | Details |
|---|---|---|---|
| **API Typecheck** | `npm run typecheck:api` | **PASS** | 0 TypeScript errors |
| **Web Typecheck** | `npm run typecheck:web` | **PASS** | 0 TypeScript errors |
| **Staging Guard Tests** | `npx vitest run tests/staging-database-guard.test.ts` | **PASS** | 5 passed, 0 failed |
| **Staging Fixtures Validation** | `npx tsx src/database/scripts/staging-validate.ts` | **PASS** | 9 roles, 2 orgs, 2 campuses, 2 businesses validated |
| **DNS Availability** | `Resolve-DnsName` | **PASS** | `staging` & `api-staging` unassigned |

---

## 10. Audit Findings Classification

### Critical Findings (Provisioning Blockers)
1. **[SEC-01] Staging Database Guard Unwired:** The guard does not run during server startup or migration execution.
2. **[CFG-01] `NODE_ENV=staging` Unsupported in `env.ts`:** `loadConfig()` throws if `NODE_ENV` is not `development`, `test`, or `production`.

### High Findings
3. **[AUTH-01] Cookie Domain Misconfiguration:** Attempting `Domain=staging.haza-aios.com` from `api-staging.haza-aios.com` will cause authentication failure. Must use host-only cookies with parameterized name `haza_session_staging`.
4. **[DEP-01] Missing Cloudflare Staging Environment in `wrangler.jsonc`:** Raw wrangler commands would target the production worker.

### Medium Findings
5. **[QUOTA-01] Railway Trial Plan Limits:** Active `stage19-rehearsal` volume consumes quota that should be recovered.
6. **[DATA-01] Fixture Insertion Helper Missing:** Synthetic fixtures require a dedicated seeder script calculating password hashes.

---

## 11. Required Remediations Before Provisioning (Stage 21B.2)

1. **Update `apps/api/src/config/env.ts`:**
   - Add `"staging"` to `NodeEnv` and `allowedNodeEnvs`.
   - Update `readEmailConfig` to treat `"staging"` like `"development"` (allowing mock email without requiring `RESEND_API_KEY`).
2. **Wire Guard in `apps/api/src/database/client.ts`:**
   - Execute `assertSafeStagingDatabaseConfig` whenever `config.nodeEnv === "staging"`.
3. **Add Dedicated Staging Migration Script:**
   - Create `apps/api/src/database/scripts/migrate-staging.ts` with explicit guard assertions.
4. **Parameterize Cookie Name in `apps/api/src/modules/auth/services/token.service.ts`:**
   - Support `config.sessionCookieName` (defaulting to `haza_session_staging` in staging).
5. **Update `apps/web/wrangler.jsonc`:**
   - Add `env.staging` configuration block.

---

## 12. Explicit Operator Approvals Required

Prior to executing Stage 21B.2 remote commands:
1. **Approval to push branch `feature/stage-21a-staging-foundation` to GitHub.**
2. **Approval to decommission or pause `stage19-rehearsal` on Railway.**
3. **Approval to create environment `staging` and service `MySQL-staging` on Railway.**
4. **Approval to add DNS CNAME records for `staging.haza-aios.com` and `api-staging.haza-aios.com` in Cloudflare.**
