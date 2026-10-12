# Stage 20G: Production Release & Deployment Plan

**Target Application:** HAZA AIOS  
**Target Release Version:** `v0.9.0-alpha.2`  
**Source Branch:** `feature/stage-20f-regression-security-validation`  
**Target Branch:** `main`  
**Status:** **PREPARATION ONLY (NOT EXECUTED)**  
**Release Gate Recommendation:** **CONDITIONAL GO**

---

## 1. Preconditions & Approval Checkpoint

> [!IMPORTANT]
> This release plan is preparatory. Production deployment must NOT be triggered until explicit user confirmation and formal approval is provided. Do not merge into `main` without completing the preconditions below.

### Pre-Deployment Checklist
- [x] **Release Gate Approval:** Formal sign-off on Stage 20F.4 CONDITIONAL GO recommendation.
- [x] **Backup Script & Tooling:** `scripts/backup-production.ps1` validated with clean dry-run.
- [ ] **Production Database Backup Execution (BLOCKING):** Execute manual snapshot of Railway production MySQL 9.7.2 database using `scripts/backup-production.ps1` (see `docs/stage-20/STAGE-20G1B-BACKUP-RECOVERY-VERIFICATION.md` for checkpoint details).
- [x] **Environment Variables Inspection:**
  - `DATABASE_URL`, `DATABASE_NAME` verified active (`railway`).
  - `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL` verified active.
  - `JWT_SECRET` verified active.
  - `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ZONE_ID` deferred post-release for GAP-002.
- [x] **Local Clean Working Tree:** Confirmed zero unstaged changes or credentials in local repository.
- [x] **Build & Test Gates:** 315/315 automated tests passing; TypeScript and production builds clean.

---

## 2. Database Migration Plan

### Migrations to Apply
1. `0015_loose_longshot.sql` (Creates `password_reset_tokens` table with FK constraint to `users.id`).
2. `0016_left_deathstrike.sql` (Creates `tenant_domains` table with FK constraint to `organizations.id`).
3. `0017_youthful_silverclaw.sql` (Adds `verification_token` and updates `tenant_domain_status` enum).

### Migration Characteristics
- **Type:** Additive schema extensions.
- **Data Loss Risk:** None. No columns dropped or renamed.
- **Estimated Duration:** < 3 seconds.
- **Execution Mechanism:** Railway executes `npm run db:migrate` automatically as the `preDeployCommand` specified in `apps/api/railway.toml`.
- **Failure Behavior:** If migrations fail, Railway aborts container deployment before starting traffic routing, leaving the current production version running.

---

## 3. Step-by-Step Deployment Sequence

### Step 1: Git Branch Merge Preparation
1. Ensure working tree is clean on `feature/stage-20f-regression-security-validation`.
2. Pull latest `main` references.
3. Create pull request or merge `feature/stage-20f-regression-security-validation` into `main` using fast-forward or squash merge as approved.
4. Push `main` to GitHub (`origin/main`).

### Step 2: Railway API Deployment
1. Railway detects push to `main` (matching `/apps/api/**` watch pattern).
2. Build phase executes: `npm install --include=dev && npm run build`.
3. Pre-deploy phase executes: `npm run db:migrate`.
4. Start phase executes: `npm run start`.
5. Health check monitors `/api/health` (300s timeout).

### Step 3: Cloudflare Workers Frontend Deployment
1. Cloudflare Workers Builds detects push to `main` on `apps/web`.
2. Build command executes: `npm run build` in `apps/web` (or `npm run build:web`).
3. Output directory deployed: `apps/web/dist` as static assets with SPA routing (`not_found_handling = "single-page-application"`).
4. Rollback capability: One-click rollback in Cloudflare Dashboard under Workers & Pages deployments.

---

## 4. Post-Deployment Verification (Smoke Tests)

Immediately following deployment, execute the following smoke verification tests against the production URL:

1. **API Readiness Check:**
   - `GET https://<api-domain>/api/v1/readiness` → Expect HTTP 200 `{ status: "ready", database: "connected" }`.
2. **API Health Check:**
   - `GET https://<api-domain>/api/v1/health` → Expect HTTP 200 `{ status: "ok" }`.
3. **Public Landing & Authentication:**
   - Load public landing page at `https://<web-domain>/` → Verify hero, pricing cards, footer links.
   - Load `/login` → Log in with production admin credentials → Confirm dashboard shell renders without console errors.
4. **SIS Data Inspection:**
   - Navigate to `/workspace/education/students` → Verify student directory renders.
   - Navigate to `/workspace/education/finance` → Verify fee structures and invoices load.
5. **Domain Verification Check:**
   - Navigate to `/workspace/settings/domains` → Verify custom domains list loads without errors.

---

## 5. Recovery & Rollback Strategy

In the event of an unrecoverable failure during deployment:

### API Service Rollback
1. In the Railway dashboard, select the previous successful deployment and click **Rollback**.
2. Railway immediately routes ingress traffic to the previous container image.

### Frontend Rollback
1. In the Cloudflare Pages dashboard, locate the previous production deployment.
2. Click **Rollback to this deployment**. Rollback takes effect globally in < 15 seconds.

### Database Recovery
- Because migrations 0016 and 0017 are additive, code rollback can proceed without rolling back database migrations (backward compatibility is preserved).
- In the unlikely event of data corruption, restore from the snapshot created during Precondition Step 1.

---

## 6. Release Tagging

Following successful smoke test verification:
```bash
git tag -a v0.9.0-alpha.2 -m "HAZA AIOS Production Release v0.9.0-alpha.2 (Stage 20 Complete)"
git push origin v0.9.0-alpha.2
```

> [!CAUTION]
> Do NOT execute these commands until formal sign-off is given.
