# Stage 19 Production Baseline

## 1. Release Manifest
- **Release Version:** `v0.9.0-alpha.1`
- **Release Tag Commit:** `fe1f9c9b0d16779f5e094f91783e89af8f8608f1` (Annotated tag)
- **Target `main` Commit:** `ae8f0e5ef87f196a7f78f46cc0961325077f9690`
- **Railway Deployment ID:** `b2d3661f-c652-4e38-8b78-c359a08bb151` (Status: SUCCESS)
- **Deployment Timestamp:** `2026-10-09 10:08:27 +05:00`

## 2. Infrastructure Configuration
### Environment Variables (Required in Production)
- `RESEND_API_KEY`: Required for dispatching password recovery emails.
- `EMAIL_FROM`: Sender address identity (e.g. `noreply@haza-aios.com`).
- `APP_URL`: Base URL of the frontend application for link generation.
- `DATABASE_URL`: Connection string to the Railway MySQL production instance.

### Service Mappings & Domain Routing
- **Frontend / Client:** Configured via Cloudflare / `haza-aios.com`
- **API Server:** Hosted on Railway (`api.haza-aios.com`), mapping to the `api` service.

## 3. Verification Evidence
### Health & Readiness
- `/api/v1/health` verified `status: ok`
- `/api/v1/readiness` verified `status: ready` with `database: up`
- Database migrations (`0011-0015`) applied cleanly and verified.

### Acceptance Results
- Password Recovery and Auth API endpoints verified as securely responding to requests (`400 VALIDATION_FAILED` on empty payloads, instead of `404 Not Found`).
- Protected UI designs (Landing Page, Login Page, Dashboard) verified untouched from previous baselines.
- Integration test suites ran green (`49 passed`) pre-deployment.

## 4. Recovery Procedures
In the event of a critical failure:
1. Identify the last known good deployment in Railway (e.g., `a4d02a03-08f9-4ccc-8e15-5f7ea22ba559`).
2. Use the Railway dashboard or CLI to rollback the `api` service to the previous deployment.
3. If database schemas were altered destructively, restore from the automated MySQL-rhgS production backup.
4. Do not blindly force-push Git reverts into `main` without auditing schema drift.

## 5. Outstanding Risks & Stage 20 Entry Criteria
- **Outstanding Risks:** Email deliverability heavily relies on Resend's reputation. Production domain metrics should be monitored to ensure password reset emails are not caught by spam filters.
- **Stage 20 Entry Criteria:**
  - Production database remains stable with no unexpected schema drift.
  - End-to-end integration test suite is expanded to resolve skipped tests.
  - Development branches are synchronized from `main` (`git pull origin main`) before starting Stage 20 feature branches.
