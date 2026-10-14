# HAZA AIOS — STAGE 21A
## STAGING INFRASTRUCTURE REQUIREMENTS & SPECIFICATIONS

**Document ID:** HAZA-AIOS-STG-21A-REQ-001  
**Version:** 1.0  
**Date:** October 14, 2026  
**Status:** Approved for Local Baseline  
**Classification:** Internal — Infrastructure Requirements  
**Target Release:** Post v0.9.0-alpha.2

---

## 1. Overview

This document specifies the exact infrastructure, cloud resource allocations, cost implications, and environment variable inventory required to provision the isolated HAZA AIOS Staging Environment.

---

## 2. Cloud Resource Requirements

### 2.1 Railway Staging Environment
Railway supports logical multi-environment isolation within a single project. The staging environment will be provisioned in the existing `HAZA-AIOS` project as environment `staging`:

| Resource | Service ID / Name | Specifications | Volume / Storage | Purpose |
|---|---|---|---|---|
| **Staging MySQL** | `MySQL-staging` | MySQL 9.x compatible image | 5 GB Persistent Volume | Dedicated staging database storing synthetic test data only. |
| **Staging API** | `haza-aios-api-staging` | Node.js 22 LTS / Fastify Container | Ephemeral (Stateless) | Dedicated staging REST API service. |

### 2.2 Cloudflare Staging Frontend
Cloudflare supports multiple worker environments and subdomains under the existing zone `haza-aios.com`:

| Resource | Service Name | Routing Rule | Asset Strategy | Purpose |
|---|---|---|---|---|
| **Staging Worker** | `haza-aios-web-staging` | `staging.haza-aios.com/*` | Workers Static Assets | Serves Vite SPA built with staging API endpoints. |

---

## 3. Cost Analysis & Operational Implications

### 3.1 Railway Cost Model
- **Current Account State:** Railway Hobby / Pro plan with usage-based billing ($5 included credit / month or pay-as-you-go).
- **Staging API Service:**
  - Inactive / Idle Consumption: ~0.1 vCPU, 128 MB RAM (~$1.50/month if running continuously).
  - Test Run Peaks: ~0.5 vCPU, 512 MB RAM during automated E2E suites.
- **Staging MySQL Database:**
  - Continuous Consumption: ~0.2 vCPU, 256 MB RAM + 5GB volume (~$3.00/month).
- **Cost Mitigation Recommendation:**
  - Staging environment can be paused / scaled to zero when automated test suites are not executing, or retained within standard credit allowances.
  - **No new paid external accounts or tier upgrades are required.**

### 3.2 Cloudflare Cost Model
- **Current Account State:** Cloudflare Free Plan / Workers Free Tier (100,000 requests/day).
- **Staging Consumption:** Automated test suites consume < 5,000 requests per run.
- **Cost Impact:** $0.00 additional cost. Fully covered within existing account quotas.

---

## 4. Network and Connectivity Specifications

1. **Ingress:**
   - Frontend: `https://staging.haza-aios.com` (Cloudflare edge proxy with TLS 1.3).
   - API: `https://api-staging.haza-aios.com` (Railway ingress proxy with TLS 1.3).
2. **Egress / Internal Mesh:**
   - Staging API connects to Staging MySQL via Railway internal private networking:
     `mysql-staging.railway.internal:3306`
   - Public TCP Proxy fallback available for local synthetic fixture seeding and migrations if needed.
3. **Firewall / Ingress Restrictions:**
   - Staging endpoints may optionally be protected with HTTP Basic Authentication or Cloudflare Access Zero Trust policies to prevent unauthorized public indexing or probing.

---

## 5. Complete Environment Variable Inventory

### 5.1 Staging API Service (`apps/api/.env.staging`)
All keys must be configured in Railway Staging Environment variables without exposing values in Git:

| Variable Name | Description | Staging Requirement |
|---|---|---|
| `NODE_ENV` | Application runtime environment | Must be `staging` |
| `PORT` | API listening port | `3001` or provided by Railway (`$PORT`) |
| `HOST` | API binding host | `0.0.0.0` |
| `DATABASE_HOST` | MySQL database host | Staging Railway internal host or TCP proxy |
| `DATABASE_PORT` | MySQL database port | Staging MySQL port |
| `DATABASE_NAME` | MySQL database name | Must be `haza_aios_staging` (strictly guarded) |
| `DATABASE_USER` | MySQL database user | Staging dedicated user |
| `DATABASE_PASSWORD` | MySQL database user password | Staging-only secret |
| `DATABASE_CONNECTION_LIMIT` | Max database connections pool | `10` |
| `JWT_SECRET` | Signing secret for authentication tokens | Staging-unique cryptographically secure random string |
| `SESSION_SECRET` | Secret for cookie encryption / signing | Staging-unique cryptographically secure random string |
| `SESSION_COOKIE_NAME` | Name of session cookie | `haza_session_staging` |
| `SESSION_COOKIE_DOMAIN` | Domain attribute for cookie | `staging.haza-aios.com` |
| `CORS_ORIGIN` | Allowed cross-origin sources | `https://staging.haza-aios.com,http://localhost:5173` |
| `LOG_LEVEL` | Logging verbosity | `debug` or `info` |
| `STORAGE_DRIVER` | File upload storage backend | `local` |
| `STORAGE_LOCAL_DIR` | Local storage directory path | `./storage/staging-uploads` |

### 5.2 Staging Web Frontend (`apps/web/.env.staging`)
Configured during Cloudflare build time or staging preview builds:

| Variable Name | Description | Staging Requirement |
|---|---|---|
| `VITE_API_URL` | Base endpoint for API requests | `https://api-staging.haza-aios.com` |
| `VITE_APP_ENV` | Environment identifier for UI banner | `staging` |
| `VITE_APP_VERSION` | Version badge identifier | `v0.9.0-alpha.2-staging` |
| `VITE_ENABLE_DEBUG_TOOLS` | Enables staging test helper overlays | `true` |
| `VITE_ENABLE_ANALYTICS` | Telemetry toggle | `false` |

---

## 6. Pre-Provisioning Checklist

Before issuing commands to provision remote resources:
- [ ] Confirm Railway CLI / UI access to project `HAZA-AIOS`.
- [ ] Confirm Cloudflare DNS edit access for zone `haza-aios.com`.
- [ ] Verify that no production variables or connection strings are present in staging templates.
- [ ] Verify that `staging-database-guard.ts` is imported into database initialization.
