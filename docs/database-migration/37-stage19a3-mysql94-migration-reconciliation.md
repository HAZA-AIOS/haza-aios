# Stage 19A.3: MySQL 9.4 migration reconciliation

**Decision: RECONCILIATION VERIFIED - READY FOR BACKUP CHECKPOINT.**

## 1. Purpose

Stage 19A.3 makes the verified production upgrade path from the applied
`origin/main` 0010 baseline through 0014 executable on Railway MySQL 9.4.
This stage does not authorize or perform a production migration.

## 2. Starting repository state

Work resumed from the healthy authoritative checkout at
`C:/HAZA-APPS/HAZA-AIOS` on
`release/stage19-production-reconciliation` at
`ec115e4fcd62182dde3def9c96b40dd82f1b2102`. Local and remote branch heads
matched, the worktree was clean, and `git fsck --full` passed.

The prior checkout was abandoned after repeated physical-disk read corruption.
The preserved Stage 19A.3 patch and two new TypeScript files were independently
validated and recovered onto C:. Their hashes matched the preserved copies and
only the intended 19 paths were restored.

## 3. Stage 19A.2.2 findings

The authoritative prior report is
`docs/database-migration/36-stage19a22-production-schema-compatibility.md`.
It established that production is MySQL 9.4.0, matches the executed main 0010
schema and journal, has no material drift, accepts 0011, rejects 0012 and 0014
with `ER_INVALID_ON_UPDATE`, and needs deterministic metadata aliases in
`db:integrity`.

## 4. Production baseline

Production has 62 base tables including `__drizzle_migrations`, 11 applied
journal rows through 0010, `utf8mb4_0900_ai_ci` key columns, and the expected
`ON UPDATE CASCADE / ON DELETE RESTRICT` relationships. Stage 19A.3 used only
local disposable MySQL 9.4 databases and synthetic data.

## 5. Exact MySQL 9.4 failures

Before the fix, the exact 0010-equivalent chain was reproduced locally.
`0012_certain_argent.sql` failed on its first table with:

```text
ERROR 1294 (HY000): Invalid ON UPDATE clause for 'updated_at' column
```

The affected definition combined `timestamp(3)` and
`ON UPDATE CURRENT_TIMESTAMP` without matching fractional precision. The same
defect blocked the first table in 0014.

## 6. Eight affected timestamp clauses

| Migration | Table | Column | Definition before reconciliation |
| --- | --- | --- | --- |
| 0012 | `workflow_definitions` | `updated_at` | `timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP` |
| 0012 | `workflow_runs` | `updated_at` | same |
| 0012 | `workflow_step_runs` | `updated_at` | same |
| 0012 | `workflow_steps` | `updated_at` | same |
| 0012 | `workflow_tasks` | `updated_at` | same |
| 0014 | `billing_accounts` | `updated_at` | same |
| 0014 | `organization_subscriptions` | `updated_at` | same |
| 0014 | `saas_plans` | `updated_at` | same |

All eight tables are new in their respective unapplied migrations. No data
transformation occurs. Nullability, defaults, creation timestamps, and
automatic update semantics remain unchanged.

## 7. Root cause

MySQL 9.4 requires the automatic update expression to use precision compatible
with the fractional timestamp column. `CURRENT_TIMESTAMP(3)` is valid;
unqualified `CURRENT_TIMESTAMP` is rejected for these definitions.

A repository-wide scan also found 56 instances in immutable migrations
0000-0010. Production has already applied those migrations, so changing their
files would invalidate historical lineage. They are a fresh-install
compatibility risk, not a production upgrade blocker.

## 8. Alternatives considered

- Appending 0015 was rejected because 0012 fails before 0015 can run.
- Editing 0000-0010 was rejected because those migrations are applied.
- Removing automatic update behavior was rejected because it changes semantics.
- Splitting 0012/0014 was unnecessary because both are unapplied and fail only
  because of the generated precision expression.
- A runtime compatibility adapter was selected for immutable historical files.
  It changes executable statements in memory while retaining each raw file's
  hash and journal identity.

## 9. Selected strategy and rationale

1. Correct the eight still-unapplied 0012/0014 clauses to
   `ON UPDATE CURRENT_TIMESTAMP(3)`.
2. Preserve 0000-0010 byte-for-byte.
3. Read migrations with Drizzle, normalize legacy unqualified fractional
   `ON UPDATE` expressions in memory, preserve the raw `MigrationMeta.hash`,
   and pass the resulting statements to the existing MySQL dialect migrator.
4. Use the same adapter in the production migration command and database
   integration tests.
5. Alias MySQL `information_schema` metadata fields explicitly.

This is the smallest approach that makes both production upgrades and fresh
MySQL 9.4 installations executable without rewriting applied history.

## 10. Files changed

- `apps/api/src/database/migrations/0012_certain_argent.sql`
- `apps/api/src/database/migrations/0014_third_rawhide_kid.sql`
- `apps/api/src/database/mysql94-migrator.ts`
- `apps/api/src/database/scripts/migrate.ts`
- `apps/api/src/database/scripts/integrity-check.ts`
- `apps/api/tests/mysql94-migrator.test.ts`
- 13 database integration tests now use the shared migrator.
- `apps/api/tests/operational-persistence.integration.test.ts` also accepts
  MySQL JSON returned either as parsed data or text.

No application endpoint, production configuration, or frontend behavior
changed.

## 11. Migration history and hash safety

Migrations 0000-0010 remain byte-for-byte untouched. Their existing production
journal rows remain unchanged and are skipped by timestamp exactly as before.

0011 and 0013 are unchanged. Their current SHA-256 hashes are:

- 0011: `700dabf33dbd13e74a245a1cf037586bd496480e2d60208958f66ca3eecd9d59`
- 0013: `3ca90f2da46d84b131cb99b64308a713ecbb6cb73c94d399568328b859e4defb`

0012 and 0014 changed because they are unapplied production candidates:

- 0012: `4e610918e5f1f6ba88bf33b081d2e9d5a5fe6e53d27e46689df4d446999e1074`
- 0014: `06145eac66656902a63974f2a98038c099540e06d6e570b45873490006429d2d`

The runtime adapter does not recompute hashes after statement normalization.
Fresh installations record the raw migration file hash; production retains its
existing 11 rows and adds only the four pending rows. No new migration was
created.

## 12. Timestamp compatibility changes

Every affected definition now has:

```sql
updated_at timestamp(3) NOT NULL
  DEFAULT (now())
  ON UPDATE CURRENT_TIMESTAMP(3)
```

MySQL reports `DATETIME_PRECISION = 3`, default `now()`, and
`on update CURRENT_TIMESTAMP(3)` for all eight columns.

## 13. db:integrity compatibility change

The foreign-key metadata query now aliases `TABLE_NAME`, `COLUMN_NAME`,
`REFERENCED_TABLE_NAME`, `REFERENCED_COLUMN_NAME`, and
`CONSTRAINT_NAME` to deterministic lowercase names. No check was removed or
weakened.

## 14. Fresh database validation

The shared migrator executed 0000 through 0014 on a new MySQL 9.4 database:

- 15 journal rows
- 77 base tables
- all migrations successful
- `npm run db:check`: PASS
- migrator unit tests: 2/2 PASS
- second migration run: no-op/idempotent

## 15. Production-equivalent rehearsal procedure

A disposable baseline was constructed from exact `origin/main` SQL through
0010 using production collation. Its journal was set to the 11 verified
production hashes/timestamps. Two synthetic tenants, users, workspaces, roles,
permissions, agent definitions/runs, messages, deliveries, and notifications
were inserted. No production credentials or records were used.

The corrected chain was run once migration-by-migration for detailed evidence,
then independently through the actual shared migrator. A second actual
migrator run proved idempotence.

## 16. Migration-by-migration results

| Step | Journal rows | Tables | Foreign keys | Synthetic baseline |
| --- | ---: | ---: | ---: | --- |
| Production-equivalent 0010 | 11 | 62 | 152 | present |
| 0011 | 12 | 64 | 156 | preserved |
| reconciled 0012 | 13 | 69 | 179 | preserved |
| 0013 | 14 | 72 | 190 | preserved |
| reconciled 0014 | 15 | 77 | 198 | preserved |

Tenant mismatch checks remained zero after every step. The actual migrator
produced the same 77-table, 198-foreign-key result and retained all synthetic
baseline records.

## 17. Timestamp behavioral test

Synthetic rows were inserted into all eight affected tables. After a 250 ms
wait, a non-timestamp field in each row was updated. Every `updated_at`
became greater than `created_at`, every creation timestamp remained
unchanged, and observed update values contained millisecond fractions. All
eight columns report precision 3.

## 18. Integrity results

The corrected command was run against both required databases:

| Database | Foreign-key checks | Tenant checks | Failures |
| --- | ---: | ---: | ---: |
| Fresh zero-to-latest | 198 | 7 | 0 |
| Production-equivalent upgraded | 198 | 7 | 0 |

The counts exactly match the Stage 19A.2.2 target baseline.

## 19. Automated test and build results

- API typecheck: PASS
- API lint: PASS
- API unit/integration suite: 22 files, 83 tests, all PASS
- API production build: PASS
- Web typecheck: PASS
- Web tests: 34 files, 184 tests, all PASS
- Web production build: PASS
- `db:check`: PASS
- `db:integrity`: PASS on both required databases

The first parallel integration run inherited the production registration
allowlist and exposed a MySQL JSON assertion assumption. Removing the
production-only variable from the test process and making the assertion
driver-neutral produced the clean results above. Web build retains its
existing large-chunk advisory; it is unrelated to Stage 19A.3.

## 20. Deployment-order analysis

1. Complete and verify the production backup/recovery checkpoint.
2. Enter a short controlled migration window. Maintenance mode is prudent
   because MySQL DDL may commit implicitly, although the migrations are
   additive.
3. Run the reconciled migrations before deploying the new API.
4. Verify journal row 15, table/constraint counts, timestamp definitions,
   integrity, and database health.
5. Deploy the new API and verify health, authentication, tenant isolation,
   workflow, event, and billing reads/writes.
6. The frontend may deploy only after API verification; Stage 19A.3 itself
   requires no frontend deployment.

The old API remains compatible with the additive target schema. The new API
must not start before its required tables and columns exist.

## 21. Rollback and forward-repair analysis

- 0011: additive tables/indexes; old-API rollback is possible; destructive
  schema rollback is not recommended.
- 0012: additive workflow tables/permissions; forward repair preferred.
- 0013: additive tables, nullable/defaulted columns, indexes, and permissions;
  old API remains compatible; forward repair preferred.
- 0014: additive billing/usage tables and permissions; forward repair
  preferred.
- Runtime adapter: application rollback restores the prior runner but would
  reintroduce fresh-install incompatibility; no database rollback is needed.

If a future production run partially applies DDL, stop deployment and use a
reviewed forward repair. Restore the verified backup only when forward repair
cannot preserve integrity or when data loss/corruption is detected.

## 22. Backup dependency

Production migration remains prohibited until a recoverable Railway backup or
recovery point and restoration procedure are verified. This stage did not
create or test a production backup.

## 23. Remaining risks

- The adapter uses Drizzle's exposed runtime `dialect` and `session`
  properties; dependency upgrades must rerun the unit, fresh-install, and
  upgrade rehearsals.
- MySQL DDL is not uniformly transactional, so production still needs the
  backup gate and controlled deployment window.
- The repository has six existing moderate npm audit findings and a web chunk
  size advisory; neither was changed by this database stage.

## 24. Production actions explicitly not performed

No production connection, migration, schema/data/journal write, backup,
restore, deployment, Railway change, Cloudflare change, DNS change, secret
rotation, PR, or merge occurred.

## 25. Final Stage 19A.3 decision

The pending migration blockers are corrected, immutable history is preserved,
fresh and production-equivalent paths pass on MySQL 9.4, timestamp behavior is
verified, and integrity and application gates pass.

**STAGE 19A.3 RESULT: RECONCILIATION VERIFIED - READY FOR BACKUP CHECKPOINT**
