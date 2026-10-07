# Stage 19A.4: Production Backup, Restore Verification & Recovery Readiness

## 1. Stage Objective
The primary objective of Stage 19A.4 was to establish a fully verified recovery capability for the production database before executing Stage 19B (Production Migration). This required producing a safe logical backup of the live database, independently verifying its integrity, and rehearsing the exact 0011–0014 migration sequence against an identical, isolated MySQL environment.

## 2. Production Safety Boundary
All diagnostic and extraction operations were performed via non-interactive, read-only SSH tunnels to Railway.
**Strictly enforced invariants during this stage:**
- No deployments, redeployments, or restarts of the production API.
- No execution of migrations against production data.
- No modification of production environment variables.
- Production access was strictly READ-ONLY.

## 3. Production MySQL Upgrade Discovery
- **Previous Observation (Stage 19A.1/19A.2):** MySQL Community Server 9.4.0
- **Current Production Reality:** The production Railway MySQL service has been silently upgraded to **9.7.2**.
- This validates the requirement for our rehearsal environment to match `9.7.2` precisely.

## 4. Railway Native Backup Limitation
Native Railway backups and Point-in-Time Recovery (PITR) features are unavailable on the project's current Railway plan. Consequently, custom logical backup and recovery protocols are the only line of defense for data preservation.

## 5. Logical Backup Procedure
A logical backup was captured utilizing the Oracle MySQL 9.7.2 `mysqldump` utility inside the production container, safely streamed via `railway ssh` to the local authoritative machine.

## 6. Backup Location
`C:\Users\theme\HAZA-AIOS-Private\production-backups\stage19a4\haza-aios-production-stage19a4.sql`

## 7. Backup Size
**144,655 bytes**

## 8. SHA-256 Checksum
`158837B33919F281ED4645BB8328BECC343E7B23E2621A262C52B10BA2CFBFE8`

## 9. Dump Options
The following critical safety and consistency flags were used during the `mysqldump` process:
- `--single-transaction` (Ensure InnoDB snapshot consistency without locking tables)
- `--quick` (Prevent memory exhaustion on large tables)
- `--routines`
- `--triggers`
- `--events`
- `--set-gtid-purged=OFF`
- `--no-tablespaces`
- `--default-character-set=utf8mb4`

## 10. Local Restore Verification
Local restore functionality against MySQL 8.4.9 was previously independently verified, confirming structural compatibility across major versions.

## 11. Exact Railway MySQL 9.7.2 Rehearsal
To guarantee absolute fidelity, a temporary, isolated Railway environment was provisioned:
- **Environment:** `stage19-rehearsal` (`c19bac81-2451-43fa-862e-3a527c46f6a5`)
- **Service:** `MySQL-rhgS` (`41f665b4-4821-432e-8918-102f4331f240`)
- **Version:** MySQL 9.7.2

## 12. Baseline Restore Verification
The logical backup was successfully restored into the rehearsal environment. 

## 13. Pre-Migration Baseline Metrics
- **MySQL Version:** 9.7.2
- **Base Tables:** 62
- **Foreign Keys:** 152
- **Migration Journal Rows:** 11 (`__drizzle_migrations`)

## 14. Representative Row-Count Verification (Baseline)
- `organizations`: 3
- `workspaces`: 3
- `organization_memberships`: 3
- `workspace_memberships`: 3
- `roles`: 9
- `permissions`: 11
- `role_permissions`: 72
- `grade_levels`: 4
- `sections`: 4
- `subjects`: 2
- `staff_members`: 2
- `ai_agent_templates`: 2
- `ai_agent_conversations`: 2
- `ai_agent_messages`: 4
- `ai_agent_runs`: 2

## 15. Migration Rehearsal Result
The 0011–0014 migration sequence was executed using the repository's native `db:migrate` tooling against the rehearsal database.
**Result:** SUCCESS (Exit code 0).

## 16. Post-Migration Metrics
- **Base Tables:** 77
- **Foreign Keys:** 198
- **Migration Journal Rows:** 15 (`__drizzle_migrations`)
*(All existing baseline representative data remained safely preserved.)*

## 17. Integrity Result
The repository's native `db:integrity` checker was executed against the post-migration rehearsal database.
- **Foreign-Key Checks:** 198 evaluated
- **Tenant-Integrity Checks:** 7 evaluated
- **Failures:** 0
- **Status:** PASS

## 18. Timestamp Behavior Result
Tested the `updated_at` behavior introduced in migrations 0012/0014 (`timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP(3)`).
- Automatic `updated_at` triggers dynamically upon row modification: PASS
- Millisecond precision (`.xxx`) is properly preserved: PASS
- MySQL 9.7.2 `ER_INVALID_ON_UPDATE` strict-mode error completely avoided: PASS

## 19. Recovery Procedure
If Stage 19B fails and corrupts the production database, the recovery procedure is:
1. **Identify Incident & Halt Writes:** Identify database corruption. Take the application offline to prevent further writes (e.g., scale API service to 0 replicas).
2. **Preserve Current DB State:** Take a post-mortem dump of the corrupted DB state for forensics (do not overwrite the original backup).
3. **Verify Backup:** Re-verify the SHA-256 hash of `haza-aios-production-stage19a4.sql`.
4. **Provision Isolated Recovery MySQL:** Do not restore directly over the corrupted production database immediately. Spin up a new MySQL service in Railway.
5. **Restore Logical Backup:** Stream the `.sql` backup into the new recovery database.
6. **Verify Restore Metrics:** Confirm 62 tables, 152 FKs, and 11 migration rows.
7. **Run Integrity Checks:** Ensure the restored baseline passes all 152 FK / 7 tenant checks.
8. **Validate Representative Data:** Spot-check core application rows (organizations, users, roles).
9. **Apply Forward Migrations:** ONLY if the incident was resolved and the codebase requires the schema change. (If rolling back the codebase entirely, leave the DB at the 0010 baseline).
10. **Validate Application Connectivity:** Reconnect the API to the new recovered database and run integration tests.
11. **Controlled Traffic Restoration:** Swap the production database connection string to point to the new recovered database. Scale the API service back up.
12. **Incident Documentation:** Record the RTO and incident details in an RCA document.

## 20. Rollback/Forward-Repair Strategy
Drizzle does not support automatic down-migrations. If a migration partially applies or introduces logical corruption, **Forward-Repair** (writing a new migration to fix the issue) is preferred for non-destructive errors. If the database schema is left in a fundamentally broken state (destructive errors, dropped tables, etc.), **Rollback** is required, executing the full Recovery Procedure (Step 19) to restore from the verified logical backup.

## 21. Recovery Point Objective (RPO)
The RPO is explicitly bound to the exact timestamp of the logical backup creation (Stage 19A.4). Since PITR and transaction logs are inaccessible, any data written to production *after* the backup and *before* an incident will be permanently lost if a rollback is triggered. 

## 22. Recovery Time Objective (RTO)
Given the database size (~144KB), restoration via SSH tunnel into a freshly provisioned Railway MySQL service takes approximately **5-10 minutes**, followed by 10 minutes of manual verification. Expected RTO is **under 30 minutes**.

## 23. Credential-Rotation Requirement
**SECURITY NOTICE:** The production MySQL credential was exposed in terminal memory during earlier diagnostic extraction workflows. 
*Production database credential rotation is required after the Stage 19A.4 recovery checkpoint and before/alongside controlled production activation, using a coordinated API/database rotation procedure.*

## 24. Remaining Risks
- The API's `preDeployCommand = npm run db:migrate` means the next deployment to production WILL automatically run migrations 0011-0014 against the live database.
- Credential rotation must be executed flawlessly to avoid downtime.
- Because RPO relies entirely on the point-in-time backup, the backup must be taken as close to the Stage 19B deployment window as possible, ideally during a maintenance window.

## 25. Explicit Stage 19B Gate
All criteria for Stage 19A.4 have been successfully met. 
**STAGE 19B IS READY FOR SEPARATE APPROVAL.**
