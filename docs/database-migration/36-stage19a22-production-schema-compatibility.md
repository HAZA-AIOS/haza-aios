# Stage 19A.2.2: production schema compatibility checkpoint (2026-09-22)

**Decision: ADDITIONAL EVIDENCE REQUIRED.** Stage 19B remains blocked. This
report combines operator-supplied read-only Railway MySQL metadata, exact
repository SQL, and a disposable local MariaDB rehearsal. Codex did not
connect to production SQL or change production.

## Repository and evidence

- Root: `D:/HAZA-APPS/HAZA-AIOS`. The obsolete checkout was not used.
- Branch: `release/stage19-production-reconciliation`.
- Starting HEAD: `fe50e47b5de1f5b6e597b0539f5da5ef24df31d7`; clean and
  aligned with `origin/release/stage19-production-reconciliation`.
- Production fingerprint from Stage 19A.2.1: MySQL 9.4.0, database `railway`,
  11 applied migrations through `0010_many_sandman`. All eleven hashes match
  `origin/main`, not this branch's historical 0000-0010 SQL. Production has
  62 base tables including the journal, exactly the main 0010 table set.
- Metadata export: `D:/HAZA-APPS/HAZA_Stage19A22_Production_Metadata/00-production-schema-metadata-all.txt`,
  SHA-256 `acd2bce1c96b0c3fb34e4328fc2ed2e1b47b2fbd092de8e7dcc1cfdc4cab6065`.
  This operator-supplied SELECT output was read locally and not committed.
- The export contains 661 column rows, 435 index rows, 152 foreign-key rows
  and 266 table-constraint rows. It contains no application rows.

## Production schema versus executed main 0010

The 61 application tables contain 658 columns. Against the main 0010
snapshot, all table/column names, types, nullability and effective defaults
match after normalizing MySQL's `boolean`/`tinyint(1)` aliases and main's
applied `CURRENT_TIMESTAMP(3)` rewrite. The only textual default difference
is `organization_settings.preferences`: snapshot `('{}')` versus MySQL
`_utf8mb4'{}'`, both the empty JSON object. This field is not touched by
0011-0014.

All 137 declared main indexes and 61 application primary keys exist with
expected columns, order and uniqueness. Production has 51 application
unique constraints and 152 FKs, plus a primary and unique constraint for
`__drizzle_migrations`. All 152 production FK names, source columns,
referenced tables and referenced columns match the **executed main SQL**.

The 0010 Drizzle snapshot is not a perfect record of the executed main
migration: it lists additional `communication_deliveries` foreign keys and
a differently named `sis_notifications` FK that main SQL did not install.
Production matches the actual main SQL, so these snapshot discrepancies
are not production drift.

For the ten existing tables used by pending migrations - `organizations`,
`workspaces`, `users`, `ai_agent_definitions`, `ai_agent_runs`,
`permissions`, `roles`, `role_permissions`, `communication_deliveries`
and `sis_notifications` - the 117 columns, declared index definitions,
15 FK mappings and 35 constraints are compatible with main 0010.
The referenced parent IDs are `char(36)` primary keys. The RBAC insert
columns and the uniqueness of `permissions.permission_key` and
`role_permissions(role_id,permission_id)` are present.

**Drift classification: no material migration-relevant drift found in
the supplied metadata.** The export omits FK update/delete rules and
character-set/collation metadata. These details remain unverified, not
implicitly matching. New `char(36)` FK columns will inherit the database
default collation, which must be compatible with the existing parent IDs.

The remaining production metadata is narrowly scoped. In the Railway
MySQL console, run only these read-only SELECT statements; do not query
business rows or run a migration:

```sql
SELECT c.TABLE_NAME, c.COLUMN_NAME, c.CHARACTER_SET_NAME, c.COLLATION_NAME,
       s.DEFAULT_CHARACTER_SET_NAME, s.DEFAULT_COLLATION_NAME
FROM information_schema.COLUMNS AS c
JOIN information_schema.SCHEMATA AS s ON s.SCHEMA_NAME = c.TABLE_SCHEMA
WHERE c.TABLE_SCHEMA = DATABASE()
  AND c.COLUMN_NAME = 'id'
  AND c.TABLE_NAME IN ('organizations','workspaces','users',
    'ai_agent_definitions','ai_agent_runs')
ORDER BY c.TABLE_NAME;

SELECT TABLE_NAME, CONSTRAINT_NAME, UPDATE_RULE, DELETE_RULE
FROM information_schema.REFERENTIAL_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('workspaces','ai_agent_definitions','ai_agent_runs',
    'roles','role_permissions','communication_deliveries',
    'sis_notifications')
ORDER BY TABLE_NAME, CONSTRAINT_NAME;
```

## Pending migration prerequisites and local results

All four pending SQL files were read completely. Their 15 target tables
are absent in production. Migration 0013's six delivery and five
notification columns are absent, as are its new existing-table index/FK
names. No top-level destructive DDL occurs. Migrations 0012-0014 also
insert RBAC rows; no such write was executed against production.

| Migration | Prerequisites from production metadata | Local MariaDB 10.4 result |
| --- | --- | --- |
| `0011_dazzling_zaran` | `organizations.id` and `users.id` compatible; two target tables absent. | PASS: 2 tables, 4 FKs, 2 indexes, 1 unique constraint. |
| `0012_certain_argent` | `organizations`, `workspaces`, `users`, agent definitions/runs and RBAC keys present; five target tables absent. | PASS: 5 tables, 23 FKs, 13 indexes, 3 unique constraints, 3 permission rows. |
| `0013_abnormal_johnny_storm` | Existing deliveries/notifications and their referenced columns exist; 11 new columns and target names absent. | PASS: 3 tables, 11 FKs, 20 indexes, 1 unique constraint, 11 added columns; existing rows preserved. |
| `0014_third_rawhide_kid` | Organization/workspace parents and RBAC keys present; five target tables absent. | PASS: 5 tables, 8 FKs, 6 indexes, 4 unique constraints, 2 permission rows. |

Structural prerequisites are supported by the export, but **none of the
four migrations is verified safe to execute on production MySQL 9.4**.
In particular, pending SQL 0012-0014 still has fractional-timestamp
`DEFAULT (now())` and unqualified `ON UPDATE CURRENT_TIMESTAMP` forms,
whereas main's already-applied MySQL 9 compatibility change rewrote
0000-0010. Whether pending forms execute on MySQL 9.4 must be established
in a disposable MySQL 9.4 rehearsal, not inferred from MariaDB.

## Disposable rehearsal and quality gates

A new local XAMPP database, `haza_aios_stage19a22_local_20260922`, was
created on MariaDB 10.4.32. It is **not** Railway or production. The exact
`origin/main` SQL 0000-0010 was applied in order, yielding 61 application
tables. The 11 main-family hashes/timestamps from the verified fingerprint
were inserted into a disposable journal to model the starting state. This
was a manual SQL/journal rehearsal, not a Drizzle migration invocation.

Before upgrade, two synthetic organizations, workspaces, users, roles,
agents, agent runs, communication deliveries and SIS notifications were
seeded. Pending files 0011 -> 0012 -> 0013 -> 0014 were then applied
**individually**; after each, the disposable journal was advanced with
the exact branch SQL hash and journal timestamp. Synthetic knowledge,
workflow, event and billing/usage records were added for both tenants.
No production application data was copied.

| After migration | Base tables including journal | Journal rows | Preservation/integrity checkpoint |
| --- | ---: | ---: | --- |
| Main 0010 | 62 | 11 | Two tenants and related records seeded. |
| 0011 | 64 | 12 | Two knowledge source/chunk pairs; no cross-tenant mismatch. |
| 0012 | 69 | 13 | Two workflow sets; no cross-tenant run mismatch. |
| 0013 | 72 | 14 | Both original deliveries and notifications preserved; new `attempt_number=1`; events linked within tenants. |
| 0014 | 77 | 15 | Two billing/usage sets; no tenant mismatch. |

Each migration's declared tables, added columns, indexes, FKs and unique
constraints was present at the end. The final journal has 15 rows and
latest timestamp `1789978889085`. A database integration test invoked
the actual Drizzle migrator on this completed disposable journal and
passed its idempotence check. The full API suite with integration enabled
passed **21 files / 81 tests**. `npm run db:check`, API typecheck and API
lint passed. After the suite, `npm run db:integrity` reported **198 FK
checks, seven tenant checks and zero failures**. Both synthetic baseline
tenants and their original delivery/notification rows remained.

The first Vitest attempt stopped before running tests because the sandbox
could not create its temporary config file in D:. The authorized rerun
passed; this was not a migration failure. No web suite was rerun because
no frontend code changed. No application source or migration SQL changed,
so a separate fresh-install regression was not needed for this
documentation-only update.

**Limit:** MariaDB 10.4.32 is not production-equivalent MySQL 9.4.0.
The local exercise supports schema/order/data-preservation analysis, not
a production execution guarantee. Collation and FK referential-action
metadata are also missing from the supplied production export.

## Reconciliation, application order and rollback

No production structural drift requiring a forward-only reconciliation
migration is shown. The candidate pending path is **0011 -> 0012 ->
0013 -> 0014**, but the exact safe production path remains **UNKNOWN**
until MySQL 9.4 rehearsal and the remaining metadata checks. If pending
SQL fails on MySQL 9.4, revise only unapplied pending SQL or design a
reviewed forward-only correction; do not rewrite applied 0000-0010 or
repair the production journal. Repeat upgrade and fresh-install tests
for any such change. No reconciliation migration was created here.

| Application/database combination | Current assessment |
| --- | --- |
| Current production application + main 0010 | Existing deployed state; no new live functional test in this stage. |
| Current production application + post-0014 | CONDITIONALLY_SAFE at schema level: new tables and additive columns with defaults/NULL; old-main application regression on MySQL 9.4 not yet tested. |
| Branch application + main 0010 | UNSAFE for complete functionality: required tables/columns are absent. |
| Branch application + post-0014 | PASS for 81 API tests on local MariaDB; MySQL 9.4 behavior UNKNOWN. |

The provisional dependency order is **verified recovery point -> one
migration path -> new API deployment -> validation**. Railway's API
`preDeployCommand` already runs `npm run db:migrate`; a future plan must
avoid running the same chain separately and again during deployment.
This is **not** an authorized or final Stage 19B plan. The old main
application is only **CONDITIONALLY_SAFE** as a code rollback candidate
at schema level. A code rollback does not reverse DDL; database rollback
would require a verified recovery point or forward repair.

## Remaining gates and safety

1. Collect the two targeted read-only FK-rule/collation result sets.
2. Recreate the verified main 0010 baseline on disposable **MySQL 9.4**,
   seed synthetic cross-tenant data, run 0011-0014 individually, and
   validate schema, data, integrity, Drizzle and both application versions.
3. If MySQL 9.4 exposes a pending-SQL incompatibility, make the smallest
   reviewable unapplied-SQL/forward-only correction and repeat upgrade
   plus fresh-install regressions.
4. Establish a verified production recovery point and isolated restore in
   a separately approved backup checkpoint. Prior Railway inspection found
   no volume backup, schedule or PITR configuration.
5. Only then determine an exact Stage 19B deployment and rollback order.

Production data, schema and migration journal: **unchanged**. Railway,
Cloudflare, DNS, `main` and `develop`: **unchanged**. No production
migration, backup, restore, deployment, PR or merge occurred. The evidence
file contains schema metadata only and was not copied into Git. Stage 19B
remains blocked.

**STAGE 19A.2.2 RESULT: ADDITIONAL EVIDENCE REQUIRED**
