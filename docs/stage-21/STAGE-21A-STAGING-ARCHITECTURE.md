# HAZA AIOS — STAGE 21A
## DEDICATED STAGING ENVIRONMENT ARCHITECTURE

**Document ID:** HAZA-AIOS-STG-21A-ARCH-001  
**Version:** 1.0  
**Date:** October 14, 2026  
**Status:** Approved for Local Baseline  
**Classification:** Internal — Infrastructure Architecture  
**Target Release:** Post v0.9.0-alpha.2 (Preparation for Stage 21 End-to-End Validation)

---

## 1. Executive Summary

This document establishes the architecture for the **HAZA AIOS Dedicated Staging Environment**. The primary goal is to provide an isolated, production-parity environment capable of supporting:
- Automated authenticated browser end-to-end (E2E) testing.
- Multi-tenant data and route isolation verification.
- Comprehensive Student Information System (SIS) lifecycle testing across 9 core user roles.
- Safe preview and validation of releases prior to production deployments.

**Zero Impact Rule:** Production systems (`api.haza-aios.com`, `www.haza-aios.com`, and the production MySQL database `haza_aios`) remain entirely untouched and decoupled from staging infrastructure.

---

## 2. Current Architecture vs. Staging Topology

### 2.1 Current Production Architecture (Release v0.9.0-alpha.2)
- **Frontend:** Cloudflare Workers Static Assets serving SPA bundle (`www.haza-aios.com` / `haza-aios.com`).
- **Backend API:** Railway Service (`haza-aios-api`) deployed in `production` environment with custom domain `api.haza-aios.com`.
- **Database:** Railway Managed MySQL 9.7.2 instance with database `haza_aios` and persistent 10GB volume.
- **Git Baseline:** Commit `241d711a0a9737dd1973a80c5a51eb418d74a1e6` on `main`.

### 2.2 Proposed Dedicated Staging Topology

```
+-----------------------------------------------------------+
|                      INTERNET / TEST RUNNER               |
+-----------------------------------------------------------+
                            |
         +------------------+------------------+
         |                                     |
         v                                     v
+-------------------------------+  +-------------------------------+
|       STAGING FRONTEND        |  |          STAGING API          |
|    (Cloudflare Workers Asset) |  |       (Railway Service)       |
|    staging.haza-aios.com      |  |    api-staging.haza-aios.com  |
+-------------------------------+  +-------------------------------+
         |                                     |
         | (CORS: api-staging.haza-aios.com)   | (Fail-Closed Guard)
         +-------------------------------------+
                            |
                            v
+-----------------------------------------------------------+
|                  STAGING MYSQL DATABASE                   |
|           (Railway Managed Database: haza_aios_staging)   |
|         Dedicated Volume / Separate Host & Port           |
+-----------------------------------------------------------+
```

---

## 3. Component Architecture and Hostnames

### 3.1 Component Breakdown
| Layer | Service Name | Provider | Hostname / URL | Isolation Mechanism |
|---|---|---|---|---|
| **Frontend** | `haza-aios-web-staging` | Cloudflare Workers | `https://staging.haza-aios.com` | Dedicated Cloudflare Worker route / asset bundle with staging `.env` pointing exclusively to staging API. |
| **Backend API** | `haza-aios-api-staging` | Railway (Staging Env) | `https://api-staging.haza-aios.com` | Dedicated service running under Railway `staging` environment. Enforces `StagingDatabaseGuard`. |
| **Database** | `MySQL-staging` | Railway (Staging Env) | Railway Internal TCP / Dedicated Proxy | Database name `haza_aios_staging`. Prohibits any connection string matching production. |

### 3.2 DNS and Routing Design
1. **Frontend (`staging.haza-aios.com`):**
   - Cloudflare CNAME pointing to the staging worker deployment.
   - Strict SSL/TLS termination at Cloudflare edge.
   - Staging asset caching policy decoupled from production.
2. **API (`api-staging.haza-aios.com`):**
   - Cloudflare CNAME record pointing to Railway's custom domain proxy for the staging service.
   - Automatic TLS certificate management via Railway/Cloudflare.

---

## 4. Multi-Tenant and Role Hierarchy

The staging environment is partitioned into deterministic multi-tenant clusters to validate complete tenant boundary integrity:

### 4.1 Synthetic Tenant Entities
1. **Organization Alpha (Edu Core):**
   - Identifier: `org-staging-alpha-001`
   - Primary Slug: `staging-alpha`
   - Purpose: Validates standard K-12 and university SIS operations across 2 distinct campuses (`Main Campus`, `North Campus`).
2. **Organization Beta (Enterprise Education):**
   - Identifier: `org-staging-beta-002`
   - Primary Slug: `staging-beta`
   - Purpose: Validates multi-org isolation and cross-tenant boundary rejection.
3. **Standalone Business Units:**
   - `biz-staging-north-retail` (Tenant Alpha)
   - `biz-staging-corporate-ops` (Tenant Beta)

### 4.2 Synthetic Role Matrix
All 9 core user roles are populated with realistic, zero-PII synthetic credentials:
- **Platform Administrator:** Global cross-tenant management and infrastructure status inspection.
- **Organization Owner:** Complete operational authority over Organization Alpha.
- **Standalone Business Owner:** Authority scoped strictly to commercial business entities.
- **Tenant Administrator:** Management of organizational security, users, and module toggles.
- **Education Administrator:** Academic cycles, curriculum, scheduling, and staff assignments.
- **Teacher:** Class attendance, grade entry, timetable review.
- **Staff Member:** Administrative records, support logs, student admissions.
- **Student:** Class enrollments, report cards, fee invoice viewing.
- **Parent / Guardian:** Scoped ward visibility, attendance tracking, fee payment receipts.

---

## 5. Security & Isolation Controls

### 5.1 Fail-Closed Database Guard
The staging API incorporates `assertSafeStagingDatabaseConfig`:
- Evaluates `DATABASE_NAME` against forbidden production names (`haza_aios`, `production`, `mysql`).
- Enforces approved staging patterns (`*staging*`, `*test*`).
- Rejects connection initialization if host strings indicate production endpoints without staging qualifiers.

### 5.2 Session and Cookie Boundaries
- **Cookie Name:** `haza_session_staging` (isolated from production `haza_session`).
- **Domain:** Scoped explicitly to `staging.haza-aios.com` (preventing cookie leakage to root or `www`).
- **Signing Secret:** Independent staging `SESSION_SECRET` and `JWT_SECRET`.
- **CORS Allowlist:** Strictly permits `https://staging.haza-aios.com` and `http://localhost:5173` (for local staging dev). Blocks any requests from `www.haza-aios.com`.

### 5.3 Storage & File Isolation
- Upload directory / S3 bucket scoped to `haza-aios-staging-uploads`.
- Local fallback directory: `./storage/staging-uploads`.
- Prohibits writing to or reading from production object stores.

### 5.4 Logging & Observability
- Service logger output labeled with `service: "haza-aios-api-staging"`.
- Separate Railway log stream with zero ingestion of production telemetry.
- All synthetic test accounts emit sanitized audit log records tagged with `env: "staging"`.
