# Stage 19A.2.2: production schema compatibility checkpoint (2026-09-27)

**Decision: RECONCILIATION REQUIRED.** Production remains unchanged and
Stage 19B remains blocked. The production schema matches the verified
`origin/main` 0010 baseline, but the exact pending migration chain cannot run
on production-equivalent MySQL 9.4.0. Migrations 0012 and 0014 contain
fractional-timestamp columns whose `ON UPDATE CURRENT_TIMESTAMP` expressions
omit the `(3)` precision required by MySQL 9.4.

## Safety and repository scope

- Authoritative root: `D:/HAZA-APPS/HAZA-AIOS`.
- Branch: `release/stage19-production-reconciliation`.
- Rehearsal starting commit: `f39b687ca05745da7c4bbf7af94a9e4fa26d7350`.
- Production SQL access remained read-only. The operator supplied only
  `information_schema` results; no business rows were inspected.
- No production migration, schema/data/journal write, backup, restore,
  deployment, Railway change, Cloudflare change, PR, or merge occurred.
- All executable rehearsal work used local disposable MySQL databases.
- The authoritative checkout already had unrelated deletions under
  `apps/api/src` and `apps/api/tests`. They were not restored, staged, or
  discarded. Validation ran from clean disposable Git archives of `HEAD`.

## Production evidence

Stage 19A.2.1 established:

- MySQL `9.4.0`, database `railway`.
- 11 journal rows through `0010_many_sandman`; every hash matches
  `origin/main`.
- 62 base tables including `__drizzle_migrations`, exactly the main 0010
  table set.

The operator-supplied metadata export remains:

- `D:/HAZA-APPS/HAZA_Stage19A22_Production_Metadata/00-production-schema-metadata-all.txt`
- SHA-256
  `acd2bce1c96b0c3fb34e4328fc2ed2e1b47b2fbd092de8e7dcc1cfdc4cab6065`
- 661 column rows, 435 index rows, 152 foreign-key rows, and 266 constraint
  rows; no application records.

The two additional read-only production queries close the remaining metadata
gaps:

- `organizations.id`, `workspaces.id`, `users.id`,
  `ai_agent_definitions.id`, and `ai_agent_runs.id` are `utf8mb4` /
  `utf8mb4_0900_ai_ci`.
- The production database default is also `utf8mb4` /
  `utf8mb4_0900_ai_ci`.
- All 15 targeted existing foreign keys report `UPDATE CASCADE` and
  `DELETE RESTRICT`.

## Production schema comparison

The 61 application tables contain 658 columns. Against the executed main
0010 lineage, table/column names, types, nullability, effective defaults,
primary keys, declared indexes, unique constraints, and foreign-key mappings
match after normalizing MySQL aliases such as `boolean` / `tinyint(1)`.

The only textual default difference remains
`organization_settings.preferences`: snapshot `('{}')` versus production
`_utf8mb4'{}'`. Both represent an empty JSON object and pending migrations do
not touch that field.

The 0010 Drizzle snapshot contains a few foreign-key declarations that differ
from the executed main SQL. Production matches the executed SQL, which is the
authoritative migration behavior. This is snapshot debt, not production drift.

For all ten existing tables referenced by 0011-0014, required parent columns,
indexes, uniqueness, collation, and referential actions are present. All 15
new target tables, all 11 columns added by 0013, and all new index/constraint
names are absent in production as expected.

**Production drift classification: none material to 0011-0014.** The failure
described below is in pending repository SQL, not in production state.

## Production-equivalent MySQL 9.4 rehearsal

The Windows MySQL 9.4.0 archive was obtained from Oracle's official archive
and its MD5 `6D64FB54D93410AD8B91F55AC7FF8FCA` matched Oracle's published
checksum. A local server ran on `127.0.0.1:3310`; it had no production or
Railway connection.

A fresh database used production's default `utf8mb4_0900_ai_ci`. Exact
`origin/main` migrations 0000-0010 applied sequentially and produced 61
application tables. A disposable Drizzle journal was seeded with the 11
verified production hashes/timestamps. Two synthetic organizations,
workspaces, users, roles, agents, runs, deliveries, and notifications were
inserted before pending migration testing.

| Step | Exact SQL result on MySQL 9.4 | Evidence |
| --- | --- | --- |
| Main 0000-0010 | PASS | 62 base tables including journal; 11 journal rows; production collation; two baseline tenants preserved. |
| `0011_dazzling_zaran` | PASS | 64 base tables; 12 journal rows; two source/chunk pairs; zero tenant mismatch. |
| `0012_certain_argent` | **FAIL** | First `CREATE TABLE workflow_definitions` returns MySQL `ERROR 1294 (HY000): Invalid ON UPDATE clause for 'updated_at' column`. Journal remains at 12 rows. |
| `0013_abnormal_johnny_storm` | PASS in diagnostic scaffold only | Exact 0013 SQL succeeds after a non-journaled disposable 0012 scaffold qualifies timestamp precision. Three tables and 11 additive columns appear; two original deliveries/notifications remain; defaults and event tenant links are correct. |
| `0014_third_rawhide_kid` | **FAIL** | First `CREATE TABLE billing_accounts` returns the same `ERROR 1294`; zero 0014 tables are created. |

The exact production candidate chain therefore stops at 0012. No journal row
was inserted for a failed or transformed migration.

For diagnosis only, a non-journaled disposable scaffold changed
`ON UPDATE CURRENT_TIMESTAMP` to `ON UPDATE CURRENT_TIMESTAMP(3)` in 0012 and
0014. It produced the expected 77-table target schema, 198 foreign keys, and
two complete synthetic tenant data sets. Baseline data remained present.
Equivalent explicit-alias checks reported 198 foreign-key groups and zero
orphans. All seven repository tenant checks returned zero failures. This
proves the target model is structurally coherent; it does **not** make the
original migration chain executable or authorize that transformation.

## Root cause and required reconciliation

The incompatible clauses are on `timestamp(3)` `updated_at` columns:

- five occurrences in `0012_certain_argent.sql`;
- three occurrences in `0014_third_rawhide_kid.sql`.

Each uses `ON UPDATE CURRENT_TIMESTAMP` without `(3)`. MySQL 9.4 rejects the
precision mismatch. `DEFAULT (now())` itself executed in the diagnostic
scaffold; the failing expression is the unqualified `ON UPDATE` clause.

An ordinary 0015 forward migration cannot repair this because Drizzle must
execute 0012 before it can reach 0015. Do not alter production's 0000-0010
lineage or manually edit the production journal.

The smallest separately reviewed remediation is:

1. Treat 0012 and 0014 as **unapplied pending artifacts**, not as applied
   production history.
2. Reissue those pending artifacts with all eight clauses qualified as
   `ON UPDATE CURRENT_TIMESTAMP(3)`, keeping every other DDL/DML statement
   unchanged.
3. Regenerate or synchronize migration snapshot/journal metadata and hashes
   for the reissued pending lineage. Do not change production's first 11
   hashes.
4. Add explicit lowercase aliases in `integrity-check.ts` for
   `TABLE_NAME`, `COLUMN_NAME`, `REFERENCED_TABLE_NAME`,
   `REFERENCED_COLUMN_NAME`, and `CONSTRAINT_NAME`; MySQL 9.4 otherwise
   returns uppercase result keys and the checker builds `undefined`
   identifiers.
5. Repeat a fresh main-0010-to-target MySQL 9.4 rehearsal using the actual
   Drizzle migrator, including fresh-install, upgrade, idempotence, full
   integration, integrity, and old-main rollback-compatibility tests.

No migration or application file was changed in this stage. The remediation
requires a separate explicitly approved implementation and review.

## Repository quality gates

Validation used a clean `HEAD` archive with a fresh lockfile installation,
because the authoritative working tree's API source/test directories were
already deleted and its existing dependency tree could not be trusted.

| Gate | Result |
| --- | --- |
| `npm run db:check` | PASS |
| API TypeScript check | PASS |
| API lint | PASS |
| Unit/default suite | PASS: 7 files passed, 14 skipped; 46 tests passed, 35 skipped (81 total) |
| MySQL 9.4 integration suite | BLOCKED: 13 database suites fail in setup at exact 0012; 7 non-database files pass, 46 tests pass, 31 skip |
| `npm run db:integrity` | TOOLING FAIL: MySQL 9.4 uppercase metadata keys become `undefined`; equivalent explicit-alias execution reports 198 FK and 7 tenant checks with zero data failures |

The 13 integration-suite failures share one root cause and occur before test
bodies: the Drizzle migrator reaches exact 0012 and receives
`ER_INVALID_ON_UPDATE`. They are migration failures, not 13 independent
application regressions. The integrity command failure is a MySQL 9.4 tooling
compatibility defect, not an orphan or tenant-integrity finding.

## Deployment and rollback analysis

| Application/database combination | Assessment |
| --- | --- |
| Current production application + main 0010 | Existing state; unchanged by this stage. |
| Branch application + main 0010 | UNSAFE for complete functionality because required pending tables/columns are absent. |
| Current pending migrator + main 0010 | **NO-GO**: exact 0012 fails on MySQL 9.4. |
| Branch application + diagnostic target scaffold | Structural/tenant checks pass, but not deployable evidence because the scaffold is not the committed migration lineage. |
| Old main application + post-target schema | Not re-verified on exact MySQL 9.4 migration output; rollback compatibility remains unproven. |

No safe production deployment order exists for the current pending artifacts.
After remediation and a successful repeat rehearsal, the candidate order is:
verified recovery point, one Railway deployment whose pre-deploy command runs
the corrected migration chain once, API startup, health/database checks, and
post-deploy validation. That remains provisional and is not Stage 19B
authorization.

Application rollback alone would not reverse additive DDL. Database rollback
would require a verified recovery point or a reviewed forward repair. Backup
and isolated restore verification remain a later, separately authorized
checkpoint.

## Final decision

Production data, schema, migration journal, Railway, Cloudflare, DNS, `main`,
and `develop` are unchanged. Stage 19B must not begin. The next work is a
separately authorized reconciliation of unapplied migration artifacts and the
MySQL 9.4 integrity checker, followed by a complete fresh rehearsal.

**STAGE 19A.2.2 RESULT: RECONCILIATION REQUIRED**
