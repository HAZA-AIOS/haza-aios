# HAZA AIOS — STAGE 21B.1-R: STAGING PROVISIONING READINESS REPORT

**Document ID:** STAGE-21B1-R-PROVISIONING-READINESS  
**Repository:** `C:\HAZA-APPS\HAZA-AIOS`  
**Base Commit:** `d14888661fa8e973302947713190cb45d8823f9e`  
**Remediation Branch:** `feature/stage-21b1-r-staging-security`  
**Status Disposition:** **READY FOR CONTROLLED STAGING PROVISIONING**  
**Execution Date:** October 14, 2026  

---

## 1. Readiness Assessment Matrix

All technical, security, and architectural prerequisites for controlled staging provisioning have been satisfied in the codebase.

| Domain | Prerequisite | Verification Mechanism | Status |
| :--- | :--- | :--- | :--- |
| **Database Isolation** | Guard intercepts connection pool creation before socket establishment | `client.ts` calls `assertSafeStagingDatabaseConfig` when `appEnv === "staging"`. | **VERIFIED** |
| **Target Protection** | Refusal of production database names, URLs, and Railway internal hosts | Verified via 10 unit tests covering `haza_aios`, `viaduct.proxy.rlwy.net`, `mysql.railway.internal`, and encoded strings. | **VERIFIED** |
| **Runtime Environment** | Dual `APP_ENV=staging` + `NODE_ENV=production` configuration | Verified via `env.ts` and 6 unit tests in `staging-environment.test.ts`. | **VERIFIED** |
| **Auth & Session** | Host-only cookies with distinct cookie name `haza_session_staging` | Parameterized in `token.service.ts` and `auth.module.ts`. No conflicting `Domain` attributes. | **VERIFIED** |
| **Worker Isolation** | Cloudflare staging target separated from production worker `haza-aios` | Distinct `env.staging` target `haza-aios-staging` and route `staging.haza-aios.com/*` in `wrangler.jsonc`. | **VERIFIED** |
| **Fixture Seeder** | Schema-compatible synthetic data with deterministic IDs and scrypt hashes | Tested via `--dry-run` and unit tests in `staging-seed-dryrun.test.ts`. | **VERIFIED** |
| **Migration Runner** | Fail-closed staging migration runner requiring explicit staging flags | `migrate-staging.ts` refuses execution without `APP_ENV=staging` and `STAGING_DATABASE_ALLOWED=true`. | **VERIFIED** |
| **Regression Safety** | Zero regressions introduced into production codebase | Full API (149 tests) and Web (184 tests) test suites passed cleanly (333/333 passed). | **VERIFIED** |

---

## 2. Operator Checklist for Stage 21B.2 (Remote Provisioning)

Stage 21B.1-R code remediation is complete and verified locally. No remote provisioning was executed in this stage. When the operator authorizes **Stage 21B.2**, the following controlled sequence must be executed:

### Step 1: Remote Railway Staging Environment Creation
- [ ] Create or access the dedicated Railway environment: `staging` (distinct from `production`).
- [ ] Deploy a dedicated MySQL 9.x service inside the Railway `staging` environment.
- [ ] Create staging database: `haza_aios_staging`.
- [ ] Verify database credentials and connection parameters are distinct from production.

### Step 2: Configure Staging Environment Variables (Railway API Service)
- [ ] `APP_ENV=staging`
- [ ] `NODE_ENV=production`
- [ ] `DATABASE_NAME=haza_aios_staging`
- [ ] `DATABASE_HOST=<railway-staging-internal-host>`
- [ ] `DATABASE_PORT=3306`
- [ ] `DATABASE_USER=<staging-user>`
- [ ] `DATABASE_PASSWORD=<staging-password>`
- [ ] `API_HOST=0.0.0.0`
- [ ] `PORT=8000`
- [ ] `WEB_ORIGIN=https://staging.haza-aios.com`
- [ ] `WEB_ORIGINS=https://staging.haza-aios.com`
- [ ] `SESSION_COOKIE_NAME=haza_session_staging`
- [ ] `RESEND_API_KEY=` (leave empty to use mock email transport)
- [ ] `AUTH_SECRET=<secure-random-staging-secret>`

### Step 3: DNS & Custom Domain Association
- [ ] Cloudflare DNS CNAME for API: `api-staging.haza-aios.com` -> Railway Staging API service endpoint.
- [ ] Cloudflare DNS CNAME / Route for Frontend: `staging.haza-aios.com` -> Cloudflare Worker `haza-aios-staging`.
- [ ] Verify SSL certificates issue successfully for both staging subdomains.

### Step 4: Staging Database Migration & Seeding
- [ ] Run staging migration: `npm run db:migrate:staging` (with `APP_ENV=staging` and `STAGING_DATABASE_ALLOWED=true`).
- [ ] Run staging seeder: `npm run db:seed:staging` (inserts 9 synthetic users across 2 test organizations).

### Step 5: Frontend Cloudflare Deployment
- [ ] Build web application: `npm run build -w apps/web` (with `VITE_API_URL=https://api-staging.haza-aios.com`).
- [ ] Deploy staging worker: `npx wrangler deploy --env staging` from `apps/web`.

---

## 3. Residual Risks & Blockers

1. **Remote Cloudflare Custom Domain Provisioning**:
   - The custom domain `staging.haza-aios.com` requires DNS routing in Cloudflare dashboard or Wrangler API. Ensure DNS proxying (orange cloud) matches SSL requirements.
2. **Railway Private Networking**:
   - When deploying the staging API service, ensure it resides in the same Railway project and environment as the staging MySQL service so that internal resolution succeeds.
3. **External Integrations**:
   - Staging remains isolated from live Resend email sending (using mock logger) and third-party payment gateways. Synthetic testing only.

---

## 4. Final Disposition

### **DISPOSITION: A. READY FOR CONTROLLED STAGING PROVISIONING**

The codebase is hardened, isolated, and verified. Database guards fail closed against production targets. Authentication cookies and CORS allowlists are strictly separated. The staging Cloudflare Worker target is distinct. All 333 workspace tests pass with 0 regressions.
