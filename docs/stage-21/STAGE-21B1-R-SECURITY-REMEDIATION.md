# HAZA AIOS — STAGE 21B.1-R: LOCAL SECURITY REMEDIATION REPORT

**Document ID:** STAGE-21B1-R-SECURITY-REMEDIATION  
**Repository:** `C:\HAZA-APPS\HAZA-AIOS`  
**Base Commit:** `d14888661fa8e973302947713190cb45d8823f9e` (Stage 21A baseline)  
**Remediation Branch:** `feature/stage-21b1-r-staging-security`  
**Execution Date:** October 14, 2026  
**Execution Mode:** Local Code Remediation + Automated Verification (No Remote Provisioning)  

---

## 1. Executive Summary

During the Stage 21B.1 Pre-Provisioning Infrastructure & Security Safety Audit, five (5) critical and high-severity security and configuration gaps were uncovered that prevented the safe provisioning of the HAZA AIOS staging environment.

This Stage 21B.1-R remediation has resolved 100% of the audit findings entirely through local architectural, configuration, and security code enhancements without touching production databases, modifying Cloudflare DNS, creating Railway resources, or pushing to remote Git remotes.

| Issue ID | Category | Severity | Description | Remediation Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | Database Guard | CRITICAL | Staging guard (`staging-database-guard.ts`) was unreferenced and never executed by database client or server startup. | **RESOLVED**: Guard integrated into `createDatabaseClient`, executed synchronously prior to MySQL connection pool creation whenever `appEnv === "staging"`. |
| **SEC-02** | Target Validation | HIGH | Staging guard did not inspect URL-encoded targets, Railway internal production hosts, or script-level execution permissions. | **RESOLVED**: Guard strengthened with URL decoding, strict Railway internal host checks, port range validation (1-65535), and mandatory `STAGING_DATABASE_ALLOWED=true` for scripts. |
| **CFG-01** | Configuration | CRITICAL | `apps/api/src/config/env.ts` only permitted `development`, `test`, and `production` in `NODE_ENV`, crashing startup if configured for staging. | **RESOLVED**: Introduced first-class `AppEnv` (`development \| test \| staging \| production`). Staging runs with `APP_ENV=staging` and `NODE_ENV=production\|staging`. Safe mock email transport enabled. |
| **AUTH-01** | Authentication | HIGH | Session cookies used identical cookie names (`haza_session`) across environments, and lacked host-only cookie isolation for staging subdomain architecture. | **RESOLVED**: Isolated cookie naming (`haza_session_staging`), host-only cookie issuance from API (`api-staging.haza-aios.com`), `SameSite=Lax`, `Secure`, `HttpOnly`, and credentialed cross-subdomain CORS. |
| **DEP-01** | Deployment Target | HIGH | `apps/web/wrangler.jsonc` lacked a distinct staging deployment environment, creating risk of overwriting production worker `haza-aios`. | **RESOLVED**: Added explicit `env.staging` block targeting worker `haza-aios-staging` with custom route `staging.haza-aios.com/*`. |
| **DATA-01** | Fixtures | HIGH | Seed scripts lacked schema compatibility with current Drizzle models (missing `ownerId`, `country`, `email`, password hashing, normalizedEmail). | **RESOLVED**: Created dedicated `seed-staging.ts` with scrypt password hashing, deterministic IDs, schema-compliant organization & user records, and safe `--dry-run` mode. |

---

## 2. Technical Remediation Details

### 2.1 SEC-01 & SEC-02: Hardened Runtime Database Guard Enforcement

**Target Files:**
- `apps/api/src/config/staging-database-guard.ts`
- `apps/api/src/database/client.ts`
- `apps/api/src/server.ts`
- `apps/api/src/app.ts`

**Key Improvements:**
1. **Active Invocation**: In `client.ts`, `assertSafeStagingDatabaseConfig(config)` is called synchronously before creating the MySQL pool whenever `options.appEnv === "staging"`.
2. **Deep URL Inspection & Decoding**:
   - Connection URLs (`DATABASE_URL` / `MYSQL_URL`) are parsed with the Node `URL` parser.
   - The database name is extracted from the pathname and decoded via `decodeURIComponent`. Encoded attempts to reference production (e.g., `haza%5Faios`) are rejected.
   - Connection parameters (query string) are parsed to detect embedded database aliases.
3. **Railway Internal Hostname Guard**:
   - Explicitly rejects `mysql.railway.internal`, `mysql.production.railway.internal`, `*.prod.railway.internal`, and production TCP proxy hostnames (`viaduct.proxy.rlwy.net`).
4. **Defense-in-Depth Script Authorization**:
   - Dedicated migration and seed scripts require `STAGING_DATABASE_ALLOWED=true`. If missing or set to `false`, execution terminates immediately before opening any network sockets.
5. **Exact Naming Policy**:
   - Staging database name must strictly equal `haza_aios_staging`. Any other database name triggers a fail-closed exception.

### 2.2 CFG-01: Dual Environment Model (`APP_ENV` + `NODE_ENV`)

**Target Files:**
- `apps/api/src/config/env.ts`
- `apps/api/.env.staging.example`

**Key Improvements:**
1. **`AppEnv` Introduced**: Allowed values are `"development" | "test" | "staging" | "production"`.
2. **`NodeEnv` Compatibility**: Allowed values are `"development" | "test" | "production" | "staging"`. Staging services may run with standard `NODE_ENV=production` while setting `APP_ENV=staging`, ensuring full compatibility with production runtime optimizations in Node.js and dependencies.
3. **Conflict Prevention**: Rejects invalid combinations (such as `APP_ENV=production` with `NODE_ENV=staging`, or `APP_ENV=staging` with `DATABASE_NAME=haza_aios`).
4. **Mock Email Transport**:
   - When `appEnv === "staging"`, `RESEND_API_KEY` is optional.
   - If omitted, emails are logged to stdout safely using the mock transport, preventing test runs from sending real emails or crashing on missing third-party keys.

### 2.3 AUTH-01: Session Cookie & CORS Isolation

**Target Files:**
- `apps/api/src/modules/auth/services/token.service.ts`
- `apps/api/src/modules/auth/services/auth.service.ts`
- `apps/api/src/modules/auth/auth.module.ts`

**Key Improvements:**
1. **Dynamic Session Cookie Name**:
   - Automatically defaults to `haza_session_staging` when `appEnv === "staging"`.
   - Defaults to `haza_session` for production and development.
   - Eliminates session collision if an operator tests staging and production concurrently in the same browser.
2. **Host-Only Subdomain Security**:
   - The staging API (`api-staging.haza-aios.com`) issues cookies **without** a `Domain` attribute (host-only).
   - In RFC 6265, subdomains cannot set cookies for sibling subdomains. A host-only cookie issued by `api-staging` is stored for `api-staging.haza-aios.com` and automatically attached when requests are sent to that API with `credentials: "include"`.
3. **Cookie Attributes**:
   - `HttpOnly`: Enforced (inaccessible to frontend JS).
   - `Secure`: Enforced for HTTPS (`appEnv === "staging"` or `appEnv === "production"`).
   - `SameSite`: `lax` (permits top-level navigation while securing cross-origin AJAX).
   - `Path`: `/`.
4. **CORS Allowlist**:
   - Staging default web origin: `https://staging.haza-aios.com`.
   - Staging web origins list: `["https://staging.haza-aios.com"]`.
   - Explicit origin matching with `credentials: true`. Wildcards are disallowed.

### 2.4 DEP-01: Cloudflare Staging Worker Environment

**Target Files:**
- `apps/web/wrangler.jsonc`

**Key Improvements:**
1. **Isolated Worker Target**:
   - Configured `env.staging` block inside `wrangler.jsonc`.
   - Worker name: `haza-aios-staging` (production remains `haza-aios`).
2. **Routing Separation**:
   - Staging route: `staging.haza-aios.com/*`.
   - Production routes (`www.haza-aios.com/*` and `haza-aios.com/*`) remain strictly in the root/production block.
3. **Asset Isolation**:
   - Assets build directory: `dist`.
   - Staging deployment command documented: `npm run deploy --prefix apps/web -- --env staging`.

### 2.5 DATA-01 & MIGRATION: Schema-Compatible Fixture Seeder & Dedicated Migration Runner

**Target Files:**
- `apps/api/src/database/scripts/seed-staging.ts` (NEW)
- `apps/api/src/database/scripts/migrate-staging.ts` (NEW)
- `apps/api/package.json`
- `package.json`

**Key Improvements:**
1. **Password Hashing**:
   - Generates production-grade scrypt password hashes using the application's actual cryptographic implementation (`crypto.scryptSync`).
2. **Database Schema Compliance**:
   - Populates required non-null fields on `organizations`: `ownerId`, `country` (`"US"`), `email` (`slug@staging.haza-aios.com`).
   - Populates `normalizedEmail` on all 9 synthetic user records (`platform-admin`, `org-owner`, `biz-owner`, `tenant-admin`, `edu-admin`, `teacher`, `staff`, `student`, `parent`).
3. **Two-Tenant Isolation Testing Architecture**:
   - `org-alpha-trust` (Academic / Education / SIS focus).
   - `org-beta-group` (Business / Commercial focus).
4. **Dry-Run Mode**:
   - Supports `--dry-run` flag to validate fixture generation, password hashing, and data structures without opening a database connection.
5. **Dedicated Staging Migration Runner**:
   - Pre-execution validation verifies `APP_ENV=staging` and `STAGING_DATABASE_ALLOWED=true`.
   - Enforces database guard before connecting.
   - Refuses production targets with immediate process exit code 1.

---

## 3. Files Changed

```text
M  apps/api/.env.staging.example
M  apps/api/package.json
M  apps/api/src/app.ts
M  apps/api/src/config/env.ts
M  apps/api/src/config/staging-database-guard.ts
M  apps/api/src/database/client.ts
M  apps/api/src/modules/auth/auth.module.ts
M  apps/api/src/modules/auth/services/auth.service.ts
M  apps/api/src/modules/auth/services/token.service.ts
M  apps/api/src/server.ts
M  apps/api/tests/staging-database-guard.test.ts
M  apps/web/wrangler.jsonc
M  package.json
+  apps/api/src/database/scripts/migrate-staging.ts
+  apps/api/src/database/scripts/seed-staging.ts
+  apps/api/tests/staging-environment.test.ts
+  apps/api/tests/staging-seed-dryrun.test.ts
+  docs/stage-21/STAGE-21B1-R-SECURITY-REMEDIATION.md
+  docs/stage-21/STAGE-21B1-R-VALIDATION-RESULTS.md
+  docs/stage-21/STAGE-21B1-R-PROVISIONING-READINESS.md
```
