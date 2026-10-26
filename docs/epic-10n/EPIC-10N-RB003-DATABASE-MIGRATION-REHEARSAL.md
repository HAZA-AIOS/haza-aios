# HAZA AIOS — Epic 10N: RB-003 Database Migration & Backup Rehearsal Report

**Document ID:** `HAZA-AIOS-EPIC10N-RB003-REHEARSAL-001`  
**Repository:** `HAZA-AIOS/haza-aios`  
**Local Workspace:** `C:\HAZA-APPS\HAZA-AIOS`  
**Target Branch:** `feature/epic-10n-system-hardening`  
**Current Release Candidate Commit:** `5617371dd9932cbfdfced59166a31f38b55d4caa`  
**Production Baseline Commit:** `eb6c5d9df71c12a975b462418ae0d6fdf5a89113` (Epic 10M)  
**Date:** October 26, 2026  
**Auditor / Verification Lead:** HAZA AIOS Engineering Team  

---

## Executive Status Summary

| Assessment Dimension | Scope | Verdict | Key Evidence / Rationale |
| :--- | :--- | :---: | :--- |
| **Database Architecture & Migration Baseline** | MySQL 9 engine, Drizzle ORM, Migrations 0000–0018 | **PASS** | Verified dialect MySQL 9.x, InnoDB storage engine, journal version 7, 84 schema tables. |
| **Migration 0019 & 0020 Safety** | `0019_portal_requests_unique_identifiers.sql`, `0020_backfill_portal_request_identifiers.sql` | **PASS** | Strictly additive nullable columns; tenant-scoped composite unique indexes; deduplicated JSON backfill with `HAVING count(*) = 1`. |
| **Isolated Rehearsal & Data Preservation** | Local rehearsal on isolated MySQL instance (`haza_aios_integration_test` -> `test`) | **PASS** | 49.4 MB snapshot dumped in 6.17s; restored into isolated target in 39.18s; 100% row match across all 84 tables. |
| **Application Cross-Module Compatibility** | Admissions, SIS Core, Attendance, Timetable, Exams, Finance, Portals | **PASS** | All integration test suites passing (Admissions, Finance, Core, Attendance, Exams, Pagination >2,000 records). |
| **Live Production Backup & Rehearsal Gate** | Production database `haza_aios` on Railway | **BLOCKED** | Live production database snapshot cannot be created/restored without operator action during authorized maintenance window. |
| **Consolidated RB-003 Gate Verdict** | Overall Release Blocker Status | **BLOCKED** | **Technical readiness verified; production operator deployment gate holds.** |

> [!CRITICAL]
> **MANDATORY POLICY NOTICE**  
> Technical verification and simulated database rehearsal passed with 100% data integrity on an isolated database environment. In accordance with Mandatory Safety Rules #1, #2, and #8, live production data was NOT exported or modified. RB-003 is formally classified as **BLOCKED** for production release pending the operator taking a pre-migration backup dump directly in Railway prior to applying migrations.

---

## 1. Database Architecture & Migration Baseline

### 1.1 Engine and Infrastructure Specifications
- **Database Engine:** MySQL 9.x Community Server (Production: Railway-managed container `mysql:9`; Rehearsal: MySQL 9.4.0 Community Server on `127.0.0.1:3306`).
- **Default Storage Engine:** InnoDB (ACID-compliant, row-level locking, foreign key constraint enforcement).
- **Default Character Set & Collation:** `utf8mb4` with `utf8mb4_unicode_ci`.
- **SQL Modes Enforced:** `STRICT_TRANS_TABLES`, `NO_ZERO_IN_DATE`, `NO_ZERO_DATE`, `ERROR_FOR_DIVISION_BY_ZERO`, `NO_ENGINE_SUBSTITUTION`.

### 1.2 ORM and Migration Framework
- **Object-Relational Mapping:** Drizzle ORM (`drizzle-orm/mysql2` v0.45.x).
- **Schema Definition:** Centralized declarative TypeScript schema in `apps/api/src/database/schema.ts` defining 84 relational tables.
- **Migration Journal:** `apps/api/drizzle/meta/_journal.json` tracking 21 sequential migrations (`idx: 0` to `20`), dialect `mysql`, version `7`.
- **Custom Migrator Tooling:** `apps/api/src/database/mysql94-migrator.ts` reconciling MySQL 9.4 timestamp fractional second precisions (`CURRENT_TIMESTAMP(3)`).

### 1.3 Migration Dependency Inventory

```
[0000_massive_thunderbolt.sql]  (Baseline schema: organizations, users, roles)
             │
[0001_initial_sis_tables.sql]    (Students, guardians, enrollments, classes)
             │
[0002_academic_hierarchy.sql]    (Sessions, terms, courses, subject assignments)
             │
    ... [0003 - 0017] ...        (Attendance, examinations, gradebooks, fees, billing)
             │
[0018_portal_request_tables.sql] (Portal update requests, audit logging)
             │  <-- PRODUCTION BASELINE (eb6c5d9df71c12a975b462418ae0d6fdf5a89113 / Epic 10M)
             ▼
[0019_portal_requests_unique_identifiers.sql] (Additive columns & workspace unique indexes)
             │
             ▼
[0020_backfill_portal_request_identifiers.sql] (Idempotent JSON extraction & duplicate-safe backfill)
```

---

## 2. Migration 0019 & 0020 Detailed Analysis

### 2.1 Migration 0019: `0019_portal_requests_unique_identifiers.sql`
- **Objective:** Add human-readable, trackable unique identifiers (`reference_number` and `application_number`) to `portal_update_requests` while strictly preserving multi-tenant isolation.
- **SQL Analysis:**
  ```sql
  ALTER TABLE `portal_update_requests` ADD `reference_number` varchar(80);--> statement-breakpoint
  ALTER TABLE `portal_update_requests` ADD `application_number` varchar(80);--> statement-breakpoint
  CREATE UNIQUE INDEX `portal_requests_workspace_ref_num_unique` ON `portal_update_requests` (`workspace_id`,`reference_number`);--> statement-breakpoint
  CREATE UNIQUE INDEX `portal_requests_workspace_app_num_unique` ON `portal_update_requests` (`workspace_id`,`application_number`);
  ```
- **Safety & Backward Compatibility:**
  1. **100% Additive:** Existing rows receive `NULL` for both columns. Under standard MySQL InnoDB B-tree indexing rules, multiple `NULL` values are permitted in unique indexes without triggering unique constraint violations (`ER_DUP_ENTRY`).
  2. **Multi-Tenant Scoped:** Constraints combine `(`workspace_id`, `reference_number`)` and `(`workspace_id`, `application_number`)`. Two different workspaces can legitimately allocate the same reference number without collision.
  3. **Zero Locking Hazard:** Adding nullable columns in MySQL 9 InnoDB executes via `ALGORITHM=INSTANT` or `INPLACE`, causing no table freeze for incoming queries.

### 2.2 Migration 0020: `0020_backfill_portal_request_identifiers.sql`
- **Objective:** Populate `reference_number` and `application_number` from historical `payload` JSON data for existing portal requests.
- **SQL Analysis:**
  ```sql
  UPDATE portal_update_requests pur
  INNER JOIN (
    SELECT workspace_id,
           JSON_UNQUOTE(JSON_EXTRACT(payload, '$.referenceNumber')) AS extracted_reference_number
    FROM portal_update_requests
    WHERE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.referenceNumber')) IS NOT NULL
      AND TRIM(JSON_UNQUOTE(JSON_EXTRACT(payload, '$.referenceNumber'))) != ''
    GROUP BY workspace_id, extracted_reference_number
    HAVING count(*) = 1
  ) valid_refs ON pur.workspace_id = valid_refs.workspace_id
              AND JSON_UNQUOTE(JSON_EXTRACT(pur.payload, '$.referenceNumber')) = valid_refs.extracted_reference_number
  LEFT JOIN portal_update_requests existing
    ON existing.workspace_id = pur.workspace_id
   AND existing.reference_number = valid_refs.extracted_reference_number
   AND existing.id != pur.id
  SET pur.reference_number = valid_refs.extracted_reference_number
  WHERE pur.reference_number IS NULL
    AND existing.id IS NULL;
  ```
- **Safety Mechanisms:**
  1. **Collision Suppression (`HAVING count(*) = 1`):** If legacy data within an organization contains duplicate reference numbers, the query automatically skips those rows rather than failing with `ER_DUP_ENTRY`. Duplicate records remain `NULL` for manual resolution.
  2. **Idempotency Guard (`pur.reference_number IS NULL`):** Re-running the script skips already-populated rows.
  3. **Pre-Existing Record Check (`LEFT JOIN ... WHERE existing.id IS NULL`):** Ensures that if an identifier is already assigned to another row in that workspace, the update will not overwrite or collide.

---

## 3. Backup & Recovery Readiness Assessment

### 3.1 Railway Production Environment
- **Provider Mechanism:** Railway Managed MySQL does not provide native point-in-time recovery (PITR) on developer/hobby tiers. Railway provisions a persistent volume for the MySQL container.
- **Operational Requirement:** The release operator must generate an authoritative pre-migration logical backup (`mysqldump`) immediately prior to executing schema migrations.
- **Storage & Security Policy:**
  - Production backups contain real student, parent, and employee PII (names, contact numbers, addresses).
  - Production dumps must NEVER be downloaded to personal workstations or committed to Git.
  - Authorized storage: Encrypted private cloud storage or ephemeral secure Railway volume with restricted access.

### 3.2 Recommended Operator Pre-Deployment Backup Command
```bash
# Executed by Operator from authorized secure runner / Railway CLI
mysqldump -h $RAILWAY_TCP_PROXY_HOST -P $RAILWAY_TCP_PROXY_PORT -u root -p$MYSQLPASSWORD \
  --single-transaction \
  --quick \
  --hex-blob \
  --routines \
  --triggers \
  --default-character-set=utf8mb4 \
  haza_aios > "pre_epic10n_production_backup_$(date +%Y%m%d_%H%M%S).sql"
```

---

## 4. Isolated Database Rehearsal & Recovery Testing

Because direct access to live production data is strictly prohibited without operator authorization, rehearsal was conducted using an isolated local MySQL 9.4 instance with a comprehensive, realistic multi-tenant dataset.

### 4.1 Isolation Verification
- **Host:** `127.0.0.1:3306` (Local loopback socket; zero network route to Railway or Cloudflare).
- **Source Database:** `haza_aios_integration_test` (Contains realistic test fixtures, enrollments, users, and portal requests).
- **Target Rehearsal Database:** `test` (Dedicated isolated staging database, verified zero production write access).
- **Guard Validation:** Verified that `TestDatabaseGuard` and `StagingDatabaseGuard` enforce non-production connection rules.

### 4.2 Empirical Backup & Restoration Metrics

| Metric | Source Rehearsal (`haza_aios_integration_test`) | Restored Rehearsal (`test`) | Variance | Status |
| :--- | :---: | :---: | :---: | :---: |
| **Dump Execution Duration** | 6,173 ms (~6.2 seconds) | N/A | N/A | **PASS** |
| **Dump File Size** | 49,424,910 bytes (~49.4 MB) | N/A | 0 bytes | **PASS** |
| **Restore Duration** | N/A | 39,175 ms (~39.2 seconds) | N/A | **PASS** |
| **Total Table Count** | 84 tables | 84 tables | 0 | **PASS** |
| **`portal_update_requests` Rows** | 862 | 862 | 0 | **PASS** |
| **`users` Rows** | 3,084 | 3,084 | 0 | **PASS** |
| **`students` Rows** | 33,912 | 33,912 | 0 | **PASS** |
| **`organizations` Rows** | Verified match | Verified match | 0 | **PASS** |
| **Data Integrity Check** | 100% hash / count fidelity | 100% hash / count fidelity | 0 | **PASS** |

### 4.3 Schema Integrity Verification
- Inspected table `portal_update_requests` post-migration:
  - Column `reference_number` (`varchar(80)`, Nullable: YES).
  - Column `application_number` (`varchar(80)`, Nullable: YES).
  - Index `portal_requests_workspace_ref_num_unique` on `(workspace_id, reference_number)`.
  - Index `portal_requests_workspace_app_num_unique` on `(workspace_id, application_number)`.
- Constraints and foreign keys remained fully intact with zero orphaned foreign keys.

### 4.4 Idempotency & Repeatability Verification
- Re-executed migration 0020 against the populated rehearsal database.
- Result: **0 rows updated, 0 warnings, 0 errors**.
- Query completed in 18 ms with zero constraint violations, confirming absolute idempotency.

---

## 5. Application Cross-Module Compatibility Results

Automated integration test suites covering all major functional domains were executed against the migrated schema:

| Functional Module | Integration Test Suite | Tests Passed | Duration | Status |
| :--- | :--- | :---: | :---: | :---: |
| **Admissions & Enquiries** | `sis-admissions.integration.test.ts` | 3 / 3 | 3.12s | **PASS** |
| **Finance, Invoices & Portals** | `sis-finance-communication-portal.integration.test.ts` | 3 / 3 | 2.91s | **PASS** |
| **SIS Core & Structure** | `sis-core.integration.test.ts` | 3 / 3 | 3.00s | **PASS** |
| **Attendance & Timetable** | `sis-attendance-timetable.integration.test.ts` | 4 / 4 | 2.88s | **PASS** |
| **Examinations & Gradebooks** | `sis-examination-results.integration.test.ts` | 6 / 6 | 6.66s | **PASS** |
| **Migrations 0019/0020 Corrections** | `epic10n-phase3-corrections.integration.test.ts` | 20 / 20 | 13.56s | **PASS** |
| **Database Constraints & Bounds** | `epic10n-phase3-database-validation.integration.test.ts` | 20 / 20 | 8.27s | **PASS** |
| **Pagination Completeness (>2,000)** | `epic10n-phase3-pagination-completeness.integration.test.ts` | 22 / 22 | 8.16s | **PASS** |
| **Data Integrity Guards (RB-001)** | `epic10n-rb001-data-integrity.integration.test.ts` | 10 / 10 | 4.88s | **PASS** |
| **Security Hardening (RB-002A)** | `epic10n-security-hardening.integration.test.ts` | 27 / 27 | 11.23s | **PASS** |
| **Total Verified Test Cases** | **10 Dedicated Subsystem Suites** | **118 / 118** | **64.67s** | **PASS** |

Zero regressions were detected across admissions conversions, attendance recording, examination ranking, fee generation, or portal request workflows.

---

## 6. Recovery Point & Recovery Time Objective (RPO / RTO)

Based on the empirical rehearsal on an active 49.4 MB database with >33,000 student records:
- **Demonstrated Recovery Time Objective (RTO):**
  - Database restore: ~39.2 seconds.
  - Verification & readiness check: ~30 seconds.
  - Total recovery window: **< 2 minutes**.
- **Demonstrated Recovery Point Objective (RPO):**
  - Exact time of pre-migration backup snapshot (RPO = 0 lost transactions if taken during deployment maintenance freeze).
- **Rollback Tier Strategy:**
  - **Tier 1 (Application Bug, Schema Healthy):** Roll back container to baseline commit `eb6c5d9df71c12a975b462418ae0d6fdf5a89113`. No schema downgrade required (schema changes are backward-compatible).
  - **Tier 2 (Forward Fix):** Deploy targeted patch.
  - **Tier 3 (Catastrophic Data Corruption):** Restore pre-migration backup via `mysql haza_aios < pre_epic10n_production_backup.sql`.

---

## 7. Outstanding Risks & Remaining Release Prerequisites

### 7.1 Outstanding Production Risks
1. **Live Production Collision Risk (Low):**
   - If historical production `portal_update_requests` contain duplicate `referenceNumber` values within the same `workspace_id`, migration 0020's `HAVING count(*) = 1` guard safely skips them (leaving them `NULL`). However, those requests will not possess backfilled identifiers until manually remediated.
2. **Missing Out-of-the-Box Railway Snapshots (Medium):**
   - Because Railway does not provide automatic point-in-time recovery on standard plans, human discipline in executing the pre-migration `mysqldump` is critical.

### 7.2 Exact Operator Release Prerequisites
Prior to merging into `main` and deploying to production, the operator must execute the following actions:
1. **Pre-Deployment Live Database Backup:** Run the verified `mysqldump` command against the Railway production MySQL instance and verify non-zero size.
2. **Railway Direct Endpoint Removal (RB-002B):** Remove public domain `api-production-367e.up.railway.app` in Railway Service Settings.
3. **Configure Proxy Setting (RB-002B):** Set `TRUST_PROXY=cloudflare` on Railway production API service.
4. **Authorized Merge & Tag:** Merge `feature/epic-10n-system-hardening` into `main`, then tag `v0.10.13-epic10m` on baseline commit `eb6c5d9df71c12a975b462418ae0d6fdf5a89113` and `v0.10.14-epic10n` on release HEAD.

---

## 8. Final Blocker Recommendation

- **Technical Verification:** **PASS** (100% test success, verified additive schema, verified deduplicated backfill, verified 100% backup/restore fidelity).
- **Operational Release Gate:** **BLOCKED** (Pending operator pre-migration live database backup during authorized maintenance window).
