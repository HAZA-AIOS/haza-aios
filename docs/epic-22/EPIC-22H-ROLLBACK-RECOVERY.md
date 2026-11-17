# HAZA-AIOS — EPIC 22H: ROLLBACK & DISASTER RECOVERY PROCEDURES

**Target Release:** `v0.22.0-epic22`  
**Baseline Release:** `v0.21.0-epic21`  
**Scope:** Forward-Fix Strategy, Database Restoration, and Emergency Containment  

---

## 1. Recovery Strategy Hierarchy

In the event of an operational anomaly during or immediately following deployment, operators must adhere to the following recovery hierarchy:

1. **Non-Destructive Containment (Preferred First Step):**  
   If an agent or policy behaves unexpectedly, do **not** immediately rollback database migrations. Use the **Emergency Stop** switch in the Governance Console (or via API `POST /api/agents/governance/security/emergency-stop`) to immediately halt agent execution across the organization or workspace in under 1 millisecond.
2. **Forward-Fix Protocol (Preferred for Software Bugs):**  
   Because all Epic 22 migrations use additive, non-breaking schema patterns (`CREATE TABLE IF NOT EXISTS`, nullable foreign keys), software bugs in policy evaluation or API routing should be patched forward via a hotfix commit rather than rolling back database state.
3. **Database Restore (Disaster Recovery Only):**  
   Used only if data corruption occurs in existing core business tables (which Epic 22 does not modify).

---

## 2. Emergency Containment Procedure

To immediately suspend all autonomous agent executions without taking down the web platform or database:

1. **Console Action:**
   - Navigate to **Agent Governance Console** -> **Security Operations** tab.
   - Click the **Emergency Stop** toggle button.
   - Enter incident rationale (e.g., "Investigating anomalous policy evaluation").
2. **API Action (if Web Console unreachable):**
   ```bash
   curl -X POST https://api.haza-aios.com/api/agents/governance/security/emergency-stop \
     -H "Authorization: Bearer <ADMIN_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{"reason": "Emergency operational pause", "scope": "ORGANIZATION"}'
   ```
3. **Effect:**
   - `PolicyEvaluationEngine` and `AgentSecurityGatewayService` immediately return `503 Service Unavailable` for all agent actions.
   - Core non-agent SIS functions (admissions, attendance, grading) remain completely unaffected.

---

## 3. Database Restoration Protocol (Disaster Scenario)

If catastrophic data loss requires restoring the pre-deployment baseline snapshot:

1. **Pause Ingress Traffic:**
   In the Railway dashboard, set the API service to Maintenance Mode or scale API replicas to 0.
2. **Identify Verified Pre-Deployment Backup:**
   Locate the pre-flight MySQL snapshot created prior to applying migration `0032`.
3. **Restore Database:**
   Initiate point-in-time recovery via Railway MySQL console or restore from SQL dump:
   ```bash
   mysql -u root -p -h <RAILWAY_HOST> -P <PORT> <DATABASE_NAME> < pre_epic22_backup.sql
   ```
4. **Re-deploy Previous Baseline:**
   Rollback API and Web services to commit `1dd11fb` (tag `v0.21.0-epic21`).
5. **Verify Baseline Operations:**
   Run the Epic 21 smoke verification suite to confirm full restoration.
