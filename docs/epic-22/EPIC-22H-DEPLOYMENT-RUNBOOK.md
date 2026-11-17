# HAZA-AIOS — EPIC 22H: PRODUCTION DEPLOYMENT RUNBOOK

**Target Release:** `v0.22.0-epic22`  
**Platform:** Railway Production  
**Execution Authorization:** Requires explicit project owner sign-off prior to step execution.  

---

## 1. Pre-Deployment Verification Checklist

Before triggering production rollout or merging PR:
- [ ] Confirm `feature/epic-22-agent-governance-security` has clean working tree and zero uncommitted files.
- [ ] Verify GitHub Actions CI status on PR is green (Build, Typecheck, Test).
- [ ] Perform a full pre-flight backup of the production MySQL database on Railway.
- [ ] Verify production environment variables (specifically `AGENT_SECURITY_HMAC_SECRET`).

---

## 2. Release & Deployment Sequence

### Step 1: Merge Feature Branch to Main
Once explicit user authorization is granted:
```bash
git checkout main
git pull origin main
git merge --no-ff feature/epic-22-agent-governance-security -m "chore(release): merge Epic 22 agent governance & security into main"
git push origin main
```

### Step 2: Apply Production Database Migrations
Run the standard production migration command:
```bash
npm run db:migrate -w apps/api
```
*Note: This command invokes Drizzle's official migration runner against the production database, applying migrations `0032_epic22a_governance_foundation.sql` through `0036_epic22f_risk_trust.sql` sequentially.*

### Step 3: Monitor Automated Railway Deployments
1. Monitor `api` deployment logs until service reports healthy.
2. Monitor `web` deployment logs until static bundle is served.
3. Monitor `worker` service restart and message bus subscription.

---

## 3. Post-Deployment Smoke Verification

Execute the following smoke verification tests against the live production environment:

1. **System Health Check:**
   ```bash
   curl -f https://api.haza-aios.com/health
   ```
2. **Governance Console Telemetry:**
   Log into the web application at `https://app.haza-aios.com/agents/governance` and confirm:
   - All 10 KPIs load with real values.
   - All 10 tabs (`Overview`, `Directory`, `Policies`, `Approvals`, `Security`, `Compliance`, `Risk & Trust`, `Activity`, `Action Center`, `Reports`) render cleanly.
3. **Audit Ledger Genesis Verification:**
   Confirm audit ledger reports `auditIntegrityStatus: "INTACT"`.
4. **Emergency Stop Sanity Check:**
   Verify `isEmergencyStopped` is `false`.

---

## 4. Release Tagging & GitHub Release Publication
After post-deployment smoke verification passes:
```bash
git tag -a v0.22.0-epic22 -m "Release v0.22.0-epic22: Enterprise Agent Governance, Security & Compliance"
git push origin v0.22.0-epic22
```
Publish GitHub Release notes matching `CHANGELOG.md`.
