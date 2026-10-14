# HAZA AIOS — STAGE 21B.1
## DEPLOYMENT TRIGGER & BRANCH SAFETY AUDIT MATRIX

**Document ID:** HAZA-AIOS-STG-21B1-AUD-004  
**Version:** 1.0  
**Date:** October 14, 2026  
**Status:** Complete  
**Classification:** Internal — Deployment Governance  
**Auditor:** HAZA AIOS Core Agent (Antigravity)  

---

## 1. Overview

This document analyzes the exact deployment trigger pathways across GitHub, Railway, and Cloudflare. It addresses the critical safety question:
**What happens if `feature/stage-21a-staging-foundation` or a future staging branch is pushed to GitHub?**

---

## 2. Trigger Evaluation by Provider

### 2.1 GitHub Actions
- **Inspection of `.github/workflows/`:** Contains only `.gitkeep`.
- **Finding:** There are **zero automated CI/CD workflows** configured in GitHub Actions. Pushing any branch to GitHub triggers no automated Actions runners.

### 2.2 Railway Git Integration
- **Integration Mechanism:** Railway GitHub App installed on `HAZA-AIOS/haza-aios`.
- **Production Service Tracking:**
  - Service `api` in environment `production`: Configured with `branch: "main"`, `rootDirectory: "/apps/api"`, `watchPatterns: ["/apps/api/**"]`.
  - Service `web` in environment `production`: Configured with `branch: "main"`.
- **Finding:** Railway strictly compares the Git commit ref against the tracked branch. Commits on `feature/stage-21a-staging-foundation` or `staging` do NOT match `main` and will **never trigger a production deployment**.

### 2.3 Cloudflare Workers Builds
- **Integration Mechanism:** Cloudflare Git Integration for Worker `haza-aios`.
- **Production Worker Tracking:** Set to branch `main`.
- **Finding:** Production worker serving `www.haza-aios.com` will not deploy from feature branches.
- **Preview Deployment Caveat:** If Cloudflare Workers "Automatic Preview Deployments" are enabled for all branches on the `haza-aios` worker, pushing a feature branch may cause Cloudflare to run a preview build (`<branch>.haza-aios.workers.dev`). Because `apps/web/wrangler.jsonc` does not have environment-specific secrets, a preview build would build with default web environment variables.

---

## 3. Comprehensive Deployment Trigger Risk Matrix

| Git Event | Railway Production (`api` / `web`) | Cloudflare Production (`haza-aios`) | Railway Staging (Future) | Cloudflare Staging (Future) | Risk Level | Safety Action Required |
|---|---|---|---|---|---|---|
| **Push `feature/stage-21a-staging-foundation`** | **NO TRIGGER** (Ignored) | **NO TRIGGER** (Ignored) | **NO TRIGGER** (Env does not exist) | **NO TRIGGER** (Env does not exist) | **VERY LOW** | Confirm Cloudflare preview build behavior before pushing. |
| **Push new commit to `docs/*`** | **NO TRIGGER** (Outside watch pattern) | **NO TRIGGER** (Outside watch pattern) | **NO TRIGGER** | **NO TRIGGER** | **NONE** | None. Safe for docs publication. |
| **Push to future `staging` branch** | **NO TRIGGER** (Ignored: tracks `main`) | **NO TRIGGER** (Ignored: tracks `main`) | **TRIGGERS** (When linked to staging) | **TRIGGERS** (When linked to staging) | **CONTROLLED** | Verify staging env variables and database guard before linking. |
| **Merge into `main`** | **TRIGGERS PRODUCTION DEPLOY** | **TRIGGERS PRODUCTION DEPLOY** | **NO TRIGGER** | **NO TRIGGER** | **CRITICAL** | **PROHIBITED** during staging stages. Protected by branch rules. |
| **Tag creation (`v*`)** | **NO TRIGGER** (Railway triggers on branch commits, not tags) | **NO TRIGGER** | **NO TRIGGER** | **NO TRIGGER** | **LOW** | Tagging deferred until authorized. |

---

## 4. Required Provider Configuration Safeguards

Prior to executing any remote staging deployment:
1. **In Railway Dashboard (`production` Environment Settings):**
   - Confirm that `Deploy on branch push` remains locked strictly to `main`.
   - Verify that wildcard deployments (e.g. `*` or `feature/*`) are disabled.
2. **In Cloudflare Dashboard (`Workers & Pages` > `haza-aios` > `Settings` > `Builds`):**
   - Confirm production branch is set to `main`.
   - If preview deployments are enabled, configure preview builds to be manual or comment-triggered only.
3. **In GitHub Repository Settings:**
   - Enforce branch protection on `main` requiring pull request reviews and preventing direct pushes.
