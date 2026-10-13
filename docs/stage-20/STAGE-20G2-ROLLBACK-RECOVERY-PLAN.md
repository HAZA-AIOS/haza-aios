# Stage 20G.2: Rollback and Disaster Recovery Plan

**Repository:** `C:\HAZA-APPS\HAZA-AIOS`  
**Target Release:** `v0.9.0-alpha.2`  
**Production Rollback Target:** `v0.9.0-alpha.1` (`ae8f0e5`)  
**Scope:** Immediate emergency procedures in the event of an unrecoverable failure during Stage 20 deployment.

---

## 1. Emergency Rollback Triggers

Initiate immediate rollback if ANY of the following conditions occur post-merge:

| Severity | Condition | Max Tolerable Duration | Action |
| :--- | :--- | :--- | :--- |
| **P0 - Critical** | Database migration crash during Railway `preDeployCommand` | Immediate | Abort release; API stays on previous container |
| **P0 - Critical** | API container fails readiness check (`/api/v1/readiness`) | 120 seconds | Railway auto-aborts traffic routing; rollback |
| **P0 - Critical** | HTTP 5xx error rate on production API > 1% | 5 minutes | Instant Railway API service rollback |
| **P0 - Critical** | Multi-tenant isolation failure or cross-tenant data leak | Immediate | Instant rollback; take API offline if necessary |
| **P1 - High** | Cloudflare frontend SPA routing failure or blank screen | 5 minutes | Instant Cloudflare Worker deployment rollback |
| **P1 - High** | Core SIS workflow failure (admissions, attendance, grades) | 15 minutes | Service rollback |

---

## 2. Component Rollback Procedures

### A. Railway API Service Rollback (Primary Procedure)
Because Railway maintains versioned container deployments, rolling back the API service takes < 10 seconds:

1. **Access Railway Dashboard:** Navigate to Project `haza-aios` -> Environment `production` -> Service `api`.
2. **Open Deployments:** Click the **Deployments** tab.
3. **Locate Target Deployment:** Identify the previous successful deployment corresponding to commit `ae8f0e5` (Release `v0.9.0-alpha.1`).
4. **Trigger Rollback:** Click the `...` menu on that deployment and select **Rollback to this deployment**.
5. **Verify Routing:**
   - Railway immediately points the ingress router (`https://api.haza-aios.com`) to the previous container image.
   - Run:
     ```bash
     curl -i https://api.haza-aios.com/api/v1/health
     curl -i https://api.haza-aios.com/api/v1/readiness
     ```
   - Verify HTTP 200 OK.

---

### B. Cloudflare Frontend Rollback
1. **Access Cloudflare Dashboard:** Navigate to **Workers & Pages** -> Worker `haza-aios`.
2. **Open Deployments:** Select the **Deployments** / **Versions** tab.
3. **Locate Previous Build:** Select the deployment active prior to the merge of `627f675`.
4. **Deploy Previous Version:** Click **Rollback to this version**.
5. **Edge Verification:**
   - Global edge propagation takes < 15 seconds.
   - Run:
     ```bash
     curl -I https://www.haza-aios.com/
     ```
   - Verify frontend loads without errors.

---

### C. Database Disposition & Non-Transactional DDL Limitations

> [!IMPORTANT]
> **MySQL DDL Non-Transactional Behavior:**  
> In MySQL InnoDB, DDL statements (`CREATE TABLE`, `ALTER TABLE`) execute with an implicit commit. They cannot be automatically rolled back inside a database transaction if a later migration statement fails.

#### Why Database Schema Rollback Is Typically NOT Required
Migrations 0016 and 0017 are **strictly additive**:
- `0016_left_deathstrike.sql` creates a new independent table (`tenant_domains`).
- `0017_youthful_silverclaw.sql` modifies an enum to add extra states and adds a nullable column (`verification_token`).
- Neither migration alters, renames, drops, or locks any preexisting table used by the `v0.9.0-alpha.1` codebase.
- **Therefore, the rolled-back `v0.9.0-alpha.1` API service runs completely normally on the expanded schema without requiring any database rollback.** Leaving the additive schema in place avoids unnecessary database downtime.

#### Emergency Database Recovery via SQL Snapshot (Last Resort Only)

> [!CAUTION]
> **Data Loss Risk:** Restoring a database snapshot restores all tables to the exact point in time when the backup was taken. Any user registrations, attendance marks, sessions, or records created AFTER the backup will be **permanently lost**. Snapshot recovery must only be executed if actual data corruption occurred.

If emergency database restore is strictly necessary:
1. Stop the Railway API container to halt incoming write traffic.
2. Ensure the pre-deployment backup taken in Phase A is verified with matching `.sha256`.
3. Ingest the backup SQL dump over Railway SSH into the production database:
   ```powershell
   # Stream validated backup to production database
   $proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/d /c `"railway ssh -s MySQL -e production -- sh -c 'export MYSQL_PWD=`$MYSQLPASSWORD; mysql -u `$MYSQLUSER `$MYSQLDATABASE'`"" -RedirectStandardInput "C:\Users\theme\HAZA-AIOS-Private\production-backups\stage20\<pre-deploy-backup>.sql"
   ```
4. Verify table count and integrity using `apps/api/src/database/scripts/integrity-check.ts`.
5. Restart the API service on the rolled-back deployment.

---

## 3. Post-Rollback Validation Checklist

- [ ] `GET https://api.haza-aios.com/api/v1/health` returns HTTP 200 `{ status: "ok" }`.
- [ ] `GET https://api.haza-aios.com/api/v1/readiness` returns HTTP 200 `{ status: "ready", database: "connected" }`.
- [ ] `https://www.haza-aios.com/` loads landing page cleanly.
- [ ] Admin login succeeds; dashboard metrics load without exceptions.
- [ ] Student directory (`/workspace/education/students`) loads expected records.
- [ ] Zero database connection exhaustion or lock waits in Railway metrics.
- [ ] Incident post-mortem log opened.
