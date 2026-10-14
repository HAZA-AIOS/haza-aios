# HAZA AIOS — STAGE 21B.1
## DATABASE ISOLATION & FAIL-CLOSED GUARD SECURITY AUDIT

**Document ID:** HAZA-AIOS-STG-21B1-AUD-002  
**Version:** 1.0  
**Date:** October 14, 2026  
**Status:** Complete  
**Classification:** Internal — Security & Isolation Audit  
**Auditor:** HAZA AIOS Core Agent (Antigravity)  

---

## 1. Executive Summary

A comprehensive security audit of the HAZA AIOS database connectivity layer and the Stage 21A `staging-database-guard.ts` implementation was conducted.

**Audit Verdict:** **`FAIL-CLOSED GUARD INSUFFICIENT — REMEDIATION REQUIRED BEFORE PROVISIONING`**

While `staging-database-guard.ts` successfully implements string and regex assertions against explicit production database names (`haza_aios`, `production`, `mysql`), the guard is currently a **standalone utility** that is **not wired** into the runtime database client initialization (`createDatabaseClient`), migration scripts (`migrate.ts`), or server startup (`server.ts`). Furthermore, several critical boundary conditions (including `DATABASE_URL` strings, external proxy endpoints, and credential reuse) are unhandled.

---

## 2. Review of Application Database Entry Points

Every entry point through which code connects to MySQL was analyzed:

| Entry Point | File Path | Guard Wired? | Vulnerability / Risk |
|---|---|---|---|
| **Runtime Client Initialization** | `apps/api/src/database/client.ts` (`createDatabaseClient`) | **NO** | Pool initializes without calling `assertSafeStagingDatabaseConfig`. If staging environment inadvertently inherits production variables, runtime connects to production. |
| **API Server Startup** | `apps/api/src/server.ts` | **NO** | Instantiates `createDatabaseClient` directly. |
| **Main Migration Runner** | `apps/api/src/database/scripts/migrate.ts` | **NO** | Loads `process.env` and immediately applies migrations. Could mutate production if run in misconfigured shell. |
| **Migration Status Inspector** | `apps/api/src/database/scripts/migration-status.ts` | **NO** | Connects directly without guard verification. |
| **Database Creation Utility** | `apps/api/src/database/scripts/create-database.ts` | **NO** | Uses raw `mysql2` connection to create database without guard check. |
| **Integrity Check Utility** | `apps/api/src/database/scripts/integrity-check.ts` | **NO** | Connects directly without staging guard assertion. |
| **Staging Validation Script** | `apps/api/src/database/scripts/staging-validate.ts` | **YES** | Validates guard assertions against mocked configurations. |

---

## 3. Evaluation Against Required Guard Protections

| Protection Requirement | Guard Status | Severity | Technical Assessment & Gap |
|---|---|---|---|
| **1. Production DATABASE_URL values** | **UNPROTECTED** | **CRITICAL** | Guard expects parsed `DatabaseConfig` object (`host, port, name`). Does not parse or inspect raw `DATABASE_URL` strings (e.g. `mysql://user:pass@host:port/haza_aios`). |
| **2. Production DATABASE_HOST values** | **PARTIAL** | **HIGH** | Checks if `host.includes("production")`. Does not check specific known Railway production hosts (e.g. `roundhouse.proxy.rlwy.net`, internal DNS). |
| **3. Production DATABASE_NAME values** | **PROTECTED** | **LOW** | Blocks `haza_aios`, `production`, `mysql` and enforces `*staging*` or `*test*`. |
| **4. Production credentials reused in staging** | **UNPROTECTED** | **MEDIUM** | Guard does not compare supplied user/password against known production secret fingerprints. |
| **5. Missing database configuration** | **PARTIAL** | **MEDIUM** | Guard throws on `undefined` property access rather than structured error. |
| **6. Ambiguous / Conflicting connection variables** | **UNPROTECTED** | **MEDIUM** | Does not verify if both `DATABASE_URL` and `DATABASE_HOST` are present with conflicting targets. |
| **7. Production Railway internal hostnames** | **PARTIAL** | **HIGH** | Detects `.includes("production")`, but misses environment-specific service hashes. |
| **8. Production external TCP proxy hostnames** | **UNPROTECTED** | **CRITICAL** | Railway assigns external TCP proxies (e.g. `roundhouse.proxy.rlwy.net:PORT`). Guard does not recognize external production proxy hostnames. |
| **9. URL-encoded connection strings** | **UNPROTECTED** | **MEDIUM** | URL-encoded database names (`haza%5Faios`) bypass simple string equality checks. |
| **10. Incorrect NODE_ENV or APP_ENV combinations** | **UNPROTECTED** | **CRITICAL** | Guard does not assert that `NODE_ENV` or `APP_ENV` is set to `staging`. |
| **11. Accidental production migration execution** | **UNPROTECTED** | **CRITICAL** | `migrate.ts` has zero guard enforcement. |
| **12. Accidental production database reset / seed** | **UNPROTECTED** | **CRITICAL** | Fixture scripts have no pre-execution guard hook into live database connections. |

---

## 4. Severity Classification & Summary

### 4.1 Critical Severity Weaknesses (Must Remediate Before Remote Provisioning)
1. **Unwired Entry Points:** The guard is an orphaned utility. Neither `client.ts`, `server.ts`, nor `migrate.ts` calls `assertSafeStagingDatabaseConfig`.
2. **Migration Bypass Risk:** Running `npm run db:migrate` in staging executes raw migrations without verifying that the target database contains `staging`.
3. **Unchecked Connection Strings:** If Railway injects `DATABASE_URL` or `MYSQL_URL`, the guard cannot parse or validate it.

### 4.2 High Severity Weaknesses
1. **Proxy Endpoint Blindness:** Railway external proxies (`roundhouse.proxy.rlwy.net`) do not contain the substring `"production"` and would bypass the host check unless host is explicitly verified against the production port.

### 4.3 Medium & Low Severity Weaknesses
1. **URL-encoding edge cases.**
2. **Missing `NODE_ENV` consistency check.**

---

## 5. Mandatory Remediation Specification

Before remote staging provisioning is authorized, the following code changes must be implemented in the codebase:

1. **Auto-Trigger Guard in `createDatabaseClient`:**
   In `apps/api/src/database/client.ts`, evaluate if running in a staging context or running staging scripts, and execute `assertSafeStagingDatabaseConfig(config)` before `createPool(config)` is called.
2. **Explicit Staging Migration Script:**
   Add `apps/api/src/database/scripts/migrate-staging.ts` (and corresponding npm script `npm run db:migrate:staging`) that explicitly invokes the guard before running migrations.
3. **Parse `DATABASE_URL`:**
   Enhance `staging-database-guard.ts` to accept either `DatabaseConfig` or a raw connection URL string, parsing the URL using Node's standard `URL` parser.
4. **Environment Consistency Check:**
   Enforce that if `APP_ENV === "staging"`, the database name MUST contain `staging`.
