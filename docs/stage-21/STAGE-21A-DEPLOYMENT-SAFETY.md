# HAZA AIOS — STAGE 21A
## STAGING DEPLOYMENT SAFETY, BRANCH ISOLATION & ROLLBACK RUNBOOK

**Document ID:** HAZA-AIOS-STG-21A-SAFE-001  
**Version:** 1.0  
**Date:** October 14, 2026  
**Status:** Approved for Local Baseline  
**Classification:** Internal — Deployment Governance  
**Target Release:** Post v0.9.0-alpha.2

---

## 1. Core Safety Principles

The integrity of the HAZA AIOS production system is strictly protected by the following non-negotiable principles:

1. **Production Isolation:** No commit, push, or action executed on a feature or staging branch shall trigger a production build, deployment, or database migration.
2. **Database Non-Contamination:** Staging and rehearsal workflows must never connect to, alter, or read from the production database `haza_aios`.
3. **Zero PII:** No production user, customer, teacher, or student personal information shall ever be ingested into staging.
4. **Explicit Operator Authorization:** Remote infrastructure changes, branch pushes to GitHub, and DNS changes require operator approval.

---

## 2. Railway Git Integration & Branch Tracking

### 2.1 Current Production Service Configuration
- **Project:** `HAZA-AIOS`
- **Environment:** `production`
- **Tracked Branch:** `main` (only)
- **Watch Paths:** `/apps/api/**`, `/package.json`, `/pnpm-lock.yaml`
- **Trigger Behavior:** Railway deploys to `production` ONLY when a commit lands on `main`.

### 2.2 Staging Service Isolation Rules
To guarantee that staging activity never triggers production:
- Create a dedicated Railway Environment named `staging`.
- Link `haza-aios-api-staging` to the dedicated staging branch or trigger it exclusively via manual CLI deployments (`railway up -e staging`).
- In the Railway dashboard under `production` Environment Settings:
  - Verify `Auto-deploy on branch push` is configured strictly for branch `main`.
  - Ensure wildcard deployment triggers (such as `*` or `feature/*`) are disabled for production.

---

## 3. Cloudflare Workers Deployment Safety

### 3.1 Production Worker Configuration
- **Worker Script / Asset Domain:** `www.haza-aios.com` & `haza-aios.com`
- **Production Trigger:** Branch `main` pushes or direct authorized release script deployments.

### 3.2 Staging Worker Isolation Rules
- **Staging Deployment:** Must target worker environment `staging` with custom route `staging.haza-aios.com/*`.
- **Configuration Boundary:**
  - Build command specifies `VITE_API_URL=https://api-staging.haza-aios.com`.
  - Asset upload is isolated to staging worker storage.
  - Zero modification to production route bindings or DNS apex records.

---

## 4. Database Safety and Fail-Closed Safeguards

### 4.1 Staging Database Guard Architecture
The codebase incorporates `assertSafeStagingDatabaseConfig` in `apps/api/src/config/staging-database-guard.ts`:
- **Forbidden Names:** `haza_aios`, `production`, `mysql`. Any connection string targeting these databases throws a fatal `StagingDatabaseGuardError` immediately prior to pool initialization.
- **Enforced Substrings:** Requires `staging` or `test` in the database name.
- **Host Endpoint Verification:** Blocks remote host strings containing `production` unless specifically designated as staging.

### 4.2 Migration Safety Rules
- Migrations targeting staging must execute with:
  `NODE_ENV=staging DATABASE_NAME=haza_aios_staging`
- Staging migration dry-runs must be reviewed prior to live schema creation.
- Staging migrations use the identical migration files from `apps/api/src/database/migrations/` to guarantee schema parity with production.

---

## 5. Secret Scanning & Credential Safety

1. **Non-Secret Configuration Templates:**
   - Staging templates (`.env.staging.example`) contain descriptive placeholders only.
   - Real passwords, tokens, and keys are generated at deployment time and stored exclusively in Railway/Cloudflare environment secrets managers.
2. **Pre-Commit Verification:**
   - Git working-tree scans confirm zero `.env` or secret-bearing files are staged.
   - `.gitignore` explicitly ignores `.env`, `.env.*`, with exceptions only for `.env.example` and `.env.staging.example`.

---

## 6. Rollback & Emergency Teardown Procedures

If staging infrastructure experiences unexpected behavior or resource runaway:

### 6.1 Instant Staging Service Teardown
```bash
# In Railway CLI:
railway down -e staging

# Or scale staging services to 0 replicas via dashboard.
```

### 6.2 Staging Database Reset
Because the staging database contains exclusively synthetic fixtures, a full database reset can be performed safely at any time:
1. Terminate active staging API sessions.
2. Drop and recreate database `haza_aios_staging`.
3. Re-run migration suite.
4. Execute `staging-validate.ts` fixture seed script.
5. Zero impact on production operations.

### 6.3 Incident Response Protocol
If any staging script or configuration inadvertently targets a production endpoint:
1. `StagingDatabaseGuard` immediately halts execution (fail-closed).
2. If network egress to production occurs, operator is alerted immediately.
3. Review audit logs on `api.haza-aios.com` to confirm zero unauthorized mutations occurred.
