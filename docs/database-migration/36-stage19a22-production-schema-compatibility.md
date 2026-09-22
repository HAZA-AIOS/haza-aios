# Stage 19A.2.2: production schema compatibility checkpoint (2026-09-22)

**Decision: ADDITIONAL READ-ONLY METADATA REQUIRED.** Stage 19B remains blocked.
This report is a static analysis of repository migrations plus the operator's
Stage 19A.2.1 production fingerprint. Codex had no verified read-only SQL
connection to production and did not inspect production columns, indexes,
foreign keys, or constraints in this stage. No production write occurred.

## Repository and production baseline

- Root: `D:/HAZA-APPS/HAZA-AIOS` (the old checkout is not used).
- Branch: `release/stage19-production-reconciliation`.
- Starting HEAD: `0fef3b3bbda98913379780538d55232add057990`; clean.
- Production: MySQL 9.4.0, selected database `railway`.
- Journal: 11 rows through `0010_many_sandman`; all 0000-0010 hashes match
  `origin/main`, none match this branch's corresponding SQL files.
- Production table names: the 62 names supplied in Stage 19A.2.1 exactly
  match the main 0010 inventory. All 15 tables introduced by 0011-0014 are
  absent by name. This does not establish full structural compatibility.
- Railway volume backup/schedule and PITR: no recovery point verified in the
  previous audit. No backup was created here.

## Exact pending SQL and dependencies

| Migration | Existing production tables touched or referenced | New tables | Static assessment |
| --- | --- | --- | --- |
| `0011_dazzling_zaran.sql` | `organizations`, `users` referenced by FKs | `knowledge_chunks`, `knowledge_sources` | Additive DDL; no existing-table alteration or data DML. FK parent IDs must be compatible. |
| `0012_certain_argent.sql` | `organizations`, `workspaces`, `users`, `ai_agent_definitions`, `ai_agent_runs` referenced; `permissions`, `roles`, `role_permissions` read/inserted | `workflow_definitions`, `workflow_runs`, `workflow_step_runs`, `workflow_steps`, `workflow_tasks` | New tables, indexes, FKs, unique keys plus `INSERT IGNORE` permission/role rows. Requires compatible parent IDs, RBAC columns/unique keys, and MySQL 9 timestamp-default rehearsal. |
| `0013_abnormal_johnny_storm.sql` | `organizations`, `workspaces`, `users`, `ai_agent_runs` referenced; `communication_deliveries`, `sis_notifications` altered; `permissions`, `roles`, `role_permissions` read/inserted | `audit_logs`, `domain_events`, `operational_events` | Adds six columns to deliveries and five to notifications, indexes, a notification FK, and RBAC rows. Existing column/index/FK collisions or altered-table drift could stop execution. |
| `0014_third_rawhide_kid.sql` | `organizations`, `workspaces` referenced; `permissions`, `roles`, `role_permissions` read/inserted | `billing_accounts`, `billing_statements`, `organization_subscriptions`, `saas_plans`, `usage_meter_events` | New tables, unique keys, FKs and two permission rows. Parent IDs and RBAC schema must match. |

All four files were read completely. There is no top-level `DROP`,
`TRUNCATE`, or existing-column rewrite in them. Migrations 0012-0014 do
contain production data writes (`INSERT IGNORE` into RBAC tables); they were
**not** run in this read-only stage. The five added notification columns are
`source_event_id`, `read_at`, `acknowledged_at`, `dismissed_at`, `expires_at`.
The six added delivery columns are `attempt_number`, `provider_reference`,
`safe_error_code`, `safe_error_message`, `attempted_at`, `completed_at`.

Main rewrote historical fractional-second defaults to
`CURRENT_TIMESTAMP(3)` for MySQL 9, but pending SQL 0012-0014 still contains
`timestamp(3) DEFAULT (now())` and `ON UPDATE CURRENT_TIMESTAMP` without
precision. This is a **specific compatibility risk**, not a proven failure;
it needs testing against disposable MySQL 9.4. Do not silently rewrite
historical 0000-0010 SQL. Any pending-SQL change needs its own review and
fresh-install plus production-baseline rehearsal before deployment.

## Targeted production metadata still needed

Only these ten existing tables are in scope: `organizations`, `workspaces`,
`users`, `ai_agent_definitions`, `ai_agent_runs`, `permissions`, `roles`,
`role_permissions`, `communication_deliveries`, `sis_notifications`.
Their parent ID types/keys, RBAC columns and uniqueness, and altered-table
columns/indexes/FKs must be compared with a disposable main 0010 schema.
No application rows or credentials are needed. In the already-open Railway
production MySQL console, run **SELECT statements only**, one at a time:

```sql
SELECT TABLE_NAME, COLUMN_NAME, ORDINAL_POSITION, COLUMN_TYPE,
       IS_NULLABLE, COLUMN_DEFAULT, EXTRA
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('organizations','workspaces','users',
    'ai_agent_definitions','ai_agent_runs','permissions','roles',
    'role_permissions','communication_deliveries','sis_notifications')
ORDER BY TABLE_NAME, ORDINAL_POSITION;

SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX,
       COLUMN_NAME, INDEX_TYPE
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('organizations','workspaces','users',
    'ai_agent_definitions','ai_agent_runs','permissions','roles',
    'role_permissions','communication_deliveries','sis_notifications')
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

SELECT k.TABLE_NAME, k.CONSTRAINT_NAME, k.COLUMN_NAME,
       k.REFERENCED_TABLE_NAME, k.REFERENCED_COLUMN_NAME,
       r.UPDATE_RULE, r.DELETE_RULE
FROM information_schema.KEY_COLUMN_USAGE AS k
LEFT JOIN information_schema.REFERENTIAL_CONSTRAINTS AS r
  ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA
 AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
 AND r.TABLE_NAME = k.TABLE_NAME
WHERE k.TABLE_SCHEMA = DATABASE()
  AND k.TABLE_NAME IN ('organizations','workspaces','users',
    'ai_agent_definitions','ai_agent_runs','permissions','roles',
    'role_permissions','communication_deliveries','sis_notifications')
  AND k.REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY k.TABLE_NAME, k.CONSTRAINT_NAME, k.ORDINAL_POSITION;

SELECT TABLE_NAME, CONSTRAINT_NAME, CONSTRAINT_TYPE
FROM information_schema.TABLE_CONSTRAINTS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('organizations','workspaces','users',
    'ai_agent_definitions','ai_agent_runs','permissions','roles',
    'role_permissions','communication_deliveries','sis_notifications')
ORDER BY TABLE_NAME, CONSTRAINT_NAME;
```

The Stage 19A.2.1 table-name inventory already establishes that the 15
target tables are absent; no repeat of broad database inventory is needed.

## Comparison and migration classifications

| Gate | Finding |
| --- | --- |
| Relevant production columns vs main 0010 | UNKNOWN: column metadata not supplied. |
| Relevant primary/unique/ordinary indexes vs main 0010 | UNKNOWN: index metadata not supplied. |
| Relevant FKs and update/delete rules vs main 0010 | UNKNOWN: FK metadata not supplied. |
| Relevant constraints vs main 0010 | UNKNOWN: constraint metadata not supplied. |
| Schema drift | UNKNOWN beyond matching table names. No difference is asserted without metadata. |
| 0011 | UNKNOWN pending parent key verification and MySQL 9.4 rehearsal. |
| 0012 | UNKNOWN pending parent/RBAC verification and fractional timestamp rehearsal. |
| 0013 | UNKNOWN pending altered-table metadata, collision checks and fractional timestamp rehearsal. |
| 0014 | UNKNOWN pending parent/RBAC verification and fractional timestamp rehearsal. |

No migration is classified `SAFE_TO_REHEARSE` against an *actual verified*
production-equivalent baseline yet. The journal-pending order is 0011 ->
0012 -> 0013 -> 0014, but the **safe executable production path remains
UNKNOWN**. Whether a new forward-only reconciliation migration is needed is
also UNKNOWN. No reconciliation migration or journal repair was created.

## Disposable baseline and application compatibility

A production-equivalent disposable MySQL 9.4 baseline was **not** built:
relevant production structural metadata is missing and the installed local
MySQL-compatible server used in earlier tests is MariaDB 10.4, not MySQL 9.4.
The earlier 0000-0014 fresh-install/restore drill proves local regression,
not a main-0010-to-branch-0014 upgrade. Consequently synthetic-data seeding,
per-migration rehearsal, record preservation, tenant isolation, post-upgrade
integrity, and `db:check` for this exact upgrade were **not run**. No new
migration/code changed, so a separate fresh-install regression was not needed
for this documentation-only checkpoint.

| Application and database | Compatibility |
| --- | --- |
| Current production application + current main 0010 schema | Existing deployed state, but this stage did not independently exercise workflows. |
| Current production application + post-0014 schema | UNKNOWN; rollback compatibility is not proven. |
| New branch application + current 0010 schema | Not a complete working combination: code for 0011-0014 features expects absent tables/columns. |
| New branch application + post-0014 schema | UNKNOWN until exact MySQL 9.4 rehearsal and application/integrity tests. |

No evidence-supported Stage 19B deployment order can be selected. The
Railway API has a pre-deploy migration command, so any deployment could run
DDL before a separate backup or review. Stage 19B must remain blocked until
the schema comparison, isolated upgrade rehearsal, application matrix and
recovery-point checkpoint are resolved. Rolling back application code does
not reverse database DDL. Old-main rollback classification: **UNKNOWN**.

## Safety and next checkpoint

Production data, schema and migration journal: **unchanged**. Railway,
Cloudflare, DNS, `main` and `develop`: **unchanged**. No migration command,
production backup, restore or deploy was run. This report contains no
connection string, token, credential or business record. After the four
targeted query results are available, compare them to a disposable main 0010
MySQL 9.4 baseline and rehearse 0011-0014 individually using synthetic data.
Only then revisit reconciliation, deployment order, rollback and backup.

**STAGE 19A.2.2 RESULT: ADDITIONAL READ-ONLY METADATA REQUIRED**
