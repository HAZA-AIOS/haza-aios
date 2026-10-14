# HAZA AIOS — STAGE 21B.1
## INFRASTRUCTURE COST, QUOTA & RESOURCE ASSESSMENT

**Document ID:** HAZA-AIOS-STG-21B1-AUD-005  
**Version:** 1.0  
**Date:** October 14, 2026  
**Status:** Complete  
**Classification:** Internal — Financial & Resource Governance  
**Auditor:** HAZA AIOS Core Agent (Antigravity)  

---

## 1. Executive Summary

This assessment provides an objective breakdown of cloud resource consumption, quotas, and cost impacts associated with provisioning the HAZA AIOS staging environment.

The Stage 21A preliminary estimate of ~$4.50/month assumed a standard Railway paid usage tier. This audit reveals that the Railway account is currently flagged as **`trial`** in active deployment manifests. Under a trial tier, volume and concurrent container quotas are strictly capped. Therefore, creating a second persistent volume for a dedicated staging MySQL database may trigger account limit boundaries unless reviewed and confirmed by the operator.

---

## 2. Four-Tier Classification Framework

### Tier 1: VERIFIED ACCOUNT FACTS (Directly Inspected)
1. **Railway Project:** `haza-aios` (`e28efe9a-f4f0-4ace-8ccf-5cc04baede34`).
2. **Railway Account Tier:** Marked as `"plan": "trial"` in service deployment manifests (`ee0fceb8-02ad-4e48-8f22-fc77ac00ef3b`).
3. **Active Railway Volumes:**
   - Production: `mysql-volume` (500 MB capacity, 194.9 MB used).
   - Rehearsal: `mysql-volume-khCk` (500 MB capacity, 210.9 MB used).
   - *Total existing persistent storage allocated across project:* **1,000 MB (1.0 GB)**.
4. **Active Containers in Production:**
   - 1x API service (`api`, SFO region, Node.js 24 LTS Railpack).
   - 1x MySQL service (`MySQL`, SFO region, MySQL 9.x).
   - 1x Web service (`web`, SFO region).
5. **Cloudflare Apex:** `haza-aios.com` managed on Cloudflare DNS. Free tier DNS records available.

### Tier 2: PROVIDER PUBLISHED PRICING
1. **Railway Commercial Rates:**
   - Trial Tier: $5 one-time credit, subject to service expiration or container concurrency caps (typically max 2-3 services or 1GB total volume).
   - Hobby Plan: $5.00/month flat base fee + usage ($0.000231/GB-hour RAM, $0.000463/vCPU-hour, $0.15/GB/month volume storage).
   - Pro Plan: $20.00/month flat fee + usage with team permissions and multiple environments.
2. **Cloudflare Workers Commercial Rates:**
   - Free Plan: 100,000 requests/day, 10ms CPU time/request, unlimited preview subdomains, free custom domain bindings.
   - Workers Paid: $5.00/month for 10 million requests/month.

### Tier 3: ESTIMATED USAGE FOR STAGING
If an isolated staging environment (`api-staging` + `MySQL-staging` + Cloudflare `staging.haza-aios.com`) is provisioned:
- **Staging MySQL Container:**
  - Continuous running: ~256 MB RAM = ~$0.04/day (~$1.20/month).
  - 500 MB Volume: ~$0.08/month.
- **Staging API Container:**
  - Continuous idle: ~128 MB RAM = ~$0.02/day (~$0.60/month).
  - Automated E2E burst runs: ~512 MB RAM + 0.5 vCPU for 1 hour/day = ~$0.05/day (~$1.50/month).
- **Staging Frontend (Cloudflare):**
  - E2E testing generates < 5,000 requests/day.
  - Cost: **$0.00** (Well within Cloudflare's 100k daily free tier).
- **Total Continuous Running Cost:** ~$3.38 – $4.50/month.

### Tier 4: UNKNOWN / REQUIRES OPERATOR CONFIRMATION
1. **Trial vs Hobby Status:** Has the operator already upgraded the Railway workspace to Hobby/Pro, or is it operating on trial credits?
2. **Volume Limit:** Does Railway trial permit adding a 3rd persistent volume (500 MB) for `MySQL-staging` while `stage19-rehearsal` volume still exists?
   - *Optimization Note:* The `stage19-rehearsal` environment (created for the release rehearsal) contains `MySQL-rhgS` with volume `mysql-volume-khCk` (500 MB). If Railway trial limits volume count to 2, tearing down `stage19-rehearsal` would immediately free up a volume slot for staging without cost!

---

## 3. Recommended Cost-Conscious Deployment Strategy

To eliminate unnecessary cloud spend and prevent exceeding quotas:
1. **Decommission `stage19-rehearsal` First:**
   The release rehearsal for v0.9.0-alpha.2 is complete and verified. Deleting or archiving `stage19-rehearsal` recovers 500 MB volume quota and eliminates idle container usage on Railway.
2. **Scale Staging API to Zero When Inactive:**
   In Railway, staging services can be placed in sleep/paused mode when automated test suites are not executing.
3. **Use Ephemeral Disposable Staging Databases for E2E:**
   Optionally, the staging database can be initialized on demand for test runs rather than running 24/7.
4. **Hard Spending Limit:**
   Configure a Railway monthly soft limit at $10.00 to prevent runaway charges.
