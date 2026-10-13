# Stage 20G.1E: Production Database Restore Rehearsal Report

**Repository:** `C:\HAZA-APPS\HAZA-AIOS`  
**Branch:** `feature/stage-20f-regression-security-validation`  
**Date of Rehearsal:** 2026-10-13  
**Status:** **PASSED (100% VERIFIED & COMPATIBLE)**  
**Release Gate Recommendation:** **RECOVERY VERIFIED — STAGE 20G.2 REMAINS BLOCKED UNTIL EXPLICIT OPERATOR AUTHORIZATION**

---

## 1. Executive Summary

As mandated by Stage 20G release governance, a full database restore rehearsal was conducted using the verified production backup taken in Stage 20G.1. The backup was restored and validated in a completely isolated MySQL 9.7.2 environment without connecting to production, without modifying shared rehearsal databases, without utilizing Docker, and without exposing sensitive user, student, staff, financial, or organization records.

The restore succeeded completely:
- **Checksum Verification:** 100% match against source `.sha256` digest.
- **Restore Duration:** 10.53 seconds.
- **Restore Exit Code:** `0` (Zero errors, zero warnings).
- **Restored Schema Objects:** Exactly 78 base tables, 199 foreign keys, 0 triggers, 0 routines, 0 events.
- **Data Integrity:** 32 populated tables with 274 rows completely preserved with zero data corruption or truncation.
- **Migration Compatibility:** Confirmed migrations 0000–0015 are already applied in production. Rehearsed applying pending migrations 0016 (`tenant_domains`) and 0017 (`verification_token` and status enum update), resulting in 79 tables, 200 foreign keys, 18 migration entries, and confirmed foreign key constraint enforcement.

---

## 2. Backup Identity & Checksum Verification

### Backup Artifact Details
| Property | Value |
| :--- | :--- |
| **Backup Timestamp** | 2026-10-13 08:25:08 UTC |
| **File Location** | `C:\Users\theme\HAZA-AIOS-Private\production-backups\stage20\haza-aios-production-stage20-backup_20261013_082508.sql` |
| **Checksum File** | `C:\Users\theme\HAZA-AIOS-Private\production-backups\stage20\haza-aios-production-stage20-backup_20261013_082508.sql.sha256` |
| **File Size** | 194,288 bytes |
| **Expected SHA-256** | `52DA2935D6B97A1D816E1ED31C81B95CD64A95ED5B7BDB44E7DEE17D212A9E48` |
| **Computed SHA-256** | `52DA2935D6B97A1D816E1ED31C81B95CD64A95ED5B7BDB44E7DEE17D212A9E48` |
| **Verification Result** | **PASS** (Cryptographic match confirmed) |

---

## 3. SQL Dump Structural Analysis

Before initiating the restore, the SQL dump file was inspected structurally without outputting or exposing data records:

- **Total Lines:** 3,067
- **Base Tables Defined:** 78
- **Tables Containing Data:** 32
- **Empty Tables:** 46
- **Database Engine:** InnoDB (`ENGINE=InnoDB`)
- **Default Character Set:** `utf8mb4`
- **Default Collation:** `utf8mb4_0900_ai_ci`
- **Source Dump Tool:** `mysqldump` from Oracle MySQL Community Server 9.7.2
- **Namespace Safety:** The dump contains zero `CREATE DATABASE` or `USE` statements. It cleanly defines tables with drop/create blocks and insert statements, allowing safe restoration into any arbitrarily named destination database.

---

## 4. Isolated MySQL 9.7.2 Environment Identification

To satisfy strict isolation and engine-parity requirements without Docker:

- **Environment Identity:** Railway `stage19-rehearsal` (`c19bac81-2451-43fa-862e-3a527c46f6a5`).
- **Production Environment (Untouched):** Railway `production` (`e1766450-207b-497f-a563-d4a939a0da16`).
- **Service Name:** `MySQL-rhgS` (`41f665b4-4821-432e-8918-102f4331f240`).
- **Engine Version:** Oracle MySQL Community Server 9.7.2 (Linux x86_64).
- **Storage Volume:** Dedicated volume `mysql-volume-khCk` mounted at `/var/lib/mysql`.
- **Network Isolation:** Private Railway internal VPC with no cross-environment routing to production.
- **Docker Policy:** Zero Docker containers or daemons used.
- **Dedicated Target Database:** `haza_aios_stage20_restore`.
  - Created specifically for this rehearsal:
    ```sql
    CREATE DATABASE haza_aios_stage20_restore CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
    ```
  - Shared rehearsal database `railway` was left completely untouched.
  - Verified 100% empty (0 tables) prior to dump ingestion.

---

## 5. Restore Execution & Metrics

The backup file was streamed from the local secure storage directory directly into the remote MySQL client over Railway SSH standard input:

- **Command Pattern:** Binary stdin streaming via `railway ssh` directly to remote `mysql` client targeting `haza_aios_stage20_restore`.
- **Restore Duration:** 10.53 seconds.
- **Process Exit Code:** `0` (Success).
- **Errors / Warnings:** 0 errors, 0 warnings.
- **Post-Restore Cleanliness:** Pre-existing databases in the rehearsal service remained untouched; zero production impact.

---

## 6. Schema and Object Validation

Restored schema objects were audited against `information_schema`:

| Object Type | Restored Count | Status |
| :--- | :--- | :--- |
| **Base Tables** | 78 | Verified (100% match with dump `CREATE TABLE` statements) |
| **Foreign Keys** | 199 | Verified active in `table_constraints` |
| **Triggers** | 0 | Verified (Dump contains no triggers) |
| **Stored Routines** | 0 | Verified (Dump contains no stored procedures/functions) |
| **Scheduled Events** | 0 | Verified (Dump contains no MySQL events) |
| **Migration Records**| 16 | Verified (IDs 1–16 present in `__drizzle_migrations`) |

### Table-by-Table Row Count Audit (Sensitive Data Masked)
All 32 populated tables in the dump were verified to contain the exact expected row counts:

| Table Name | Restored Row Count | Data Type Category |
| :--- | :--- | :--- |
| `__drizzle_migrations` | 16 | System Migration Journal |
| `academic_terms` | 4 | Academic Calendar |
| `academic_years` | 2 | Academic Calendar |
| `ai_agent_conversations` | 2 | AI System State |
| `ai_agent_definitions` | 1 | AI System Definitions |
| `ai_agent_messages` | 4 | AI System State |
| `ai_agent_runs` | 2 | AI Execution Log |
| `ai_agent_templates` | 2 | AI Template Registry |
| `auth_sessions` | 5 | Session Store |
| `finance_fee_categories` | 1 | Finance Configuration |
| `grade_levels` | 5 | SIS Curriculum |
| `grading_rules` | 5 | SIS Grading Configuration |
| `membership_roles` | 3 | Organization RBAC |
| `organization_memberships` | 3 | Multi-Tenant Membership |
| `organization_modules` | 1 | Tenant Module Provisioning |
| `organization_settings` | 3 | Tenant Configuration |
| `organizations` | 3 | Tenant Master Registry |
| `password_reset_tokens` | 1 | Auth Security Tokens |
| `permissions` | 20 | Platform RBAC Permissions |
| `platform_modules` | 4 | Core Platform Modules |
| `role_permissions` | 135 | Platform RBAC Mappings |
| `roles` | 9 | Platform Roles |
| `school_schedules` | 1 | SIS Schedule Configuration |
| `sections` | 4 | SIS Class Sections |
| `security_events` | 22 | Audit Log Records |
| `staff_departments` | 3 | Staff Management |
| `staff_members` | 2 | Staff Directory |
| `subjects` | 2 | SIS Curriculum |
| `time_periods` | 2 | SIS Bell Schedule |
| `users` | 1 | Platform Accounts |
| `workspace_memberships` | 3 | Workspace RBAC |
| `workspaces` | 3 | Workspace Registry |
| **Total Populated Rows** | **274** | **100% Restored Without Loss** |

---

## 7. Migration History & Compatibility Analysis

### Current Production Baseline
Inspection of `__drizzle_migrations` in the restored database revealed that production has applied **16 migrations**:

| Migration ID | Journal Tag | Created At Timestamp | SHA-256 Digest Match |
| :--- | :--- | :--- | :--- |
| 1 | `0000_calm_agent_zero` | 1787037977818 | Confirmed |
| 2 | `0001_friendly_lord_hawal` | 1787042238699 | Confirmed |
| 3 | `0002_long_bruce_banner` | 1787046176071 | Confirmed |
| 4 | `0003_zippy_venom` | 1787556716023 | Confirmed |
| 5 | `0004_smart_dazzler` | 1787679324819 | Confirmed |
| 6 | `0005_quiet_examiner` | 1787800000000 | Confirmed |
| 7 | `0006_firm_bursar` | 1787801000000 | Confirmed |
| 8 | `0007_absent_firebrand` | 1787888655462 | Confirmed |
| 9 | `0008_naive_killraven` | 1787934170278 | Confirmed |
| 10 | `0009_tearful_morlun` | 1788198180185 | Confirmed |
| 11 | `0010_many_sandman` | 1788799001273 | Confirmed |
| 12 | `0011_dazzling_zaran` | 1789665486335 | Confirmed |
| 13 | `0012_certain_argent` | 1789924385214 | Confirmed |
| 14 | `0013_abnormal_johnny_storm` | 1789962104676 | Confirmed |
| 15 | `0014_third_rawhide_kid` | 1789978889085 | Confirmed |
| 16 | `0015_loose_longshot` | 1791360568301 | `fa43fd1a8639...` (Confirmed) |

> [!NOTE]
> Migration `0015_loose_longshot` (`password_reset_tokens`) was already applied in the production database prior to this backup. Therefore, the pending migrations for Stage 20 deployment are **strictly 0016 and 0017**.

### Compatibility Rehearsal (Migrations 0016 and 0017)
The pending migrations were executed against `haza_aios_stage20_restore`:
1. **Migration 0016 (`0016_left_deathstrike.sql`):**
   - Created table `tenant_domains` with `id char(36)`, `organization_id char(36)`, `domain varchar(255)`, `tenant_domain_status enum(...)`, `verified_at`, `created_at`, and `updated_at timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP(3)`.
   - Added foreign key constraint `tenant_domains_organization_id_organizations_id_fk` referencing `organizations(id)` on delete restrict on update cascade.
   - Added index `tenant_domains_org_idx` on `organization_id`.
   - Inserted migration entry with hash `7b12e11e9ac8dc98cf92389943ae1e00f6ff6399501f41a6bc495454ba486061` at timestamp `1791528762714`.
2. **Migration 0017 (`0017_youthful_silverclaw.sql`):**
   - Modified column `tenant_domain_status` enum to include `provisioning`, `active`, and `disabled`.
   - Added nullable column `verification_token varchar(128)`.
   - Inserted migration entry with hash `15fec0d69022544f1c863ca8fa1d548f9c2a616d30437186d61fc1c69f5306fd` at timestamp `1791531699174`.

### Post-Migration Integrity Verification
- **Table Count:** Increased cleanly from 78 to **79** (`+1` for `tenant_domains`).
- **Foreign Key Constraints:** Increased cleanly from 199 to **200** (`+1` for `tenant_domains_organization_id_organizations_id_fk`).
- **Migration Journal Rows:** Increased cleanly from 16 to **18**.
- **Data Preservation:** The existing 274 rows across 32 tables remained completely intact and unaltered.
- **Foreign Key Enforcement Tested:**
  - Valid insertion referencing an existing organization UUID succeeded cleanly.
  - Invalid insertion referencing a nonexistent UUID (`00000000-0000-0000-0000-000000000000`) was immediately rejected with `ERROR 1452 (23000): Cannot add or update a child row: a foreign key constraint fails`.
  - Constraint rollback and cleanup completed cleanly.

---

## 8. Operational Limitations & Recovery Guidance

1. **MySQL 9.7 Engine Requirement:**
   - The production dump relies on the modern MySQL 9 collation `utf8mb4_0900_ai_ci` and `timestamp(3)` update precision rules.
   - Restoring directly into local MariaDB 10.4 fails with `ERROR 1273 (HY000): Unknown collation: 'utf8mb4_0900_ai_ci'`.
   - Disasters or restore rehearsals must target MySQL 9.x+ compatible engines (e.g. Railway MySQL 9.7.2 or cloud MySQL 8.4/9.x).
2. **Standard Input Streaming:**
   - Restoring via stdin piping over Railway SSH is significantly faster and safer than staging temporary dump files on container storage, preventing disk exhaustion and command-line length limits.
3. **Migration Idempotency:**
   - Drizzle's migration runner respects existing `__drizzle_migrations` records; migrations 0000–0015 will not be re-run during production deployment. Only 0016 and 0017 will be applied.

---

## 9. Stage 20G.2 Release Gate Status

| Gate Requirement | Status | Evidence |
| :--- | :--- | :--- |
| Verified Production Backup Available | **PASS** | `haza-aios-production-stage20-backup_20261013_082508.sql` (194,288 bytes) |
| Checksum Validated | **PASS** | SHA-256 matches `.sha256` digest exactly |
| Restore Rehearsal Completed | **PASS** | 10.53s duration, 0 errors, 78 tables, 199 FKs, 274 rows restored |
| Migration Compatibility Confirmed | **PASS** | 0016 and 0017 apply cleanly; 79 tables, 200 FKs, FK enforcement verified |
| Production Environment Isolation | **PASS** | Production service untouched; zero data exposure |
| **Stage 20G.2 Authorization** | **BLOCKED** | **Awaiting explicit operator authorization to commence release** |
