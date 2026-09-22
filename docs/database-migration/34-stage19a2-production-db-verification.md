# Stage 19A.2: production database verification (2026-09-22)

**Decision: NO-GO for Stage 19B.** This is a pre-production, read-only
assessment. No production SQL, migration, backup creation, restore, deployment,
or infrastructure change was performed.

## Repository gate and starting blockers

- Root: `D:/HAZA-APPS/HAZA-AIOS`.
- Branch: `release/stage19-production-reconciliation`.
- Starting HEAD: `346fb94c3ecc386dff2113002d4863d4043a2d19`; clean.
- Origin: `https://github.com/HAZA-AIOS/haza-aios.git`.
- `git fsck --full`: exit 0, only dangling unreachable trees/blobs.
- `origin/develop`: `ba58422`; `origin/main`: `706b82c`. Fetch did not
  change either branch or the working tree.

Stage 19A.1 left two decisive unknowns: the actual production migration
journal/schema and a verified production recovery point. Its non-migration
production fixes are still on this candidate branch; its 0000-0010 SQL
conflict is deliberately unresolved.

## Repository migration inventory

Drizzle ORM `0.45.2` uses the journal at
`apps/api/src/database/migrations/meta/_journal.json`. This branch has 15
ordered entries (0000-0014); 0011-0014 exist only on the develop side of the
main/develop comparison. Each entry depends on prior schema objects and must
be applied in journal order. Hashes below are the first 16 hexadecimal
characters of SHA-256 of the raw SQL file, as Drizzle computes it; use the
full 64-character hash for any production equality decision.

| No. | Tag | DB phase and principal schema effect | Branch hash | Main hash |
| --- | --- | --- | --- | --- |
| 0000 | calm_agent_zero | DB-2 foundation check table | 537f600293995ff9 | 8de6dabd4c0790d3 |
| 0001 | friendly_lord_hawal | DB-3 organizations, workspaces, membership/settings | 3082026a5ffc7080 | 27a811445b2c9d61 |
| 0002 | long_bruce_banner | DB-4 users, sessions, roles and permissions | d7650aead4b8c3d2 | 54832bd9d29aedd6 |
| 0003 | zippy_venom | DB-5 SIS academics, students, guardians and staff | 41003646c9b9ef55 | 228b313c7dd27d26 |
| 0004 | smart_dazzler | DB-6 attendance and timetable | 20bc5fb45683e732 | 0e941c1e97fe15cd |
| 0005 | quiet_examiner | DB-7 examinations, marks and results | c166389002e8dea5 | 7ef320e0dd17d312 |
| 0006 | firm_bursar | DB-8 fees, communication and portal | 1b9995433528a9cb | 3e512ea4a3ad5eab |
| 0007 | absent_firebrand | DB-10 platform modules | 27f1e8411b85c33d | c9a5893523ed6b9e |
| 0008 | naive_killraven | DB-11 agent registry, templates and tools | 07f1cd2359d1faa5 | 76ca6400f27861f3 |
| 0009 | tearful_morlun | DB-12 agent runs, conversations and messages | bc59dddfd0f9f720 | be592b09cd644dd7 |
| 0010 | many_sandman | DB-13 agent memory | e3d9cfbf8f28682f | 82aa82ef04339e7d |
| 0011 | dazzling_zaran | DB-14 text knowledge sources/chunks | 700dabf33dbd13e7 | absent |
| 0012 | certain_argent | DB-15 workflow definitions/runs/steps/tasks | c52666c7dfd243e7 | absent |
| 0013 | abnormal_johnny_storm | DB-16 audit/domain/operational events | 3ca90f2da46d84b1 | absent |
| 0014 | third_rawhide_kid | DB-17 usage and SaaS billing foundation | 72ec1cdc19fd0ba | absent |

DB-18 adds backup and integrity tooling, not another SQL migration. The SQL
inventory contains 209 `ALTER TABLE` statements, mostly additive foreign
keys/columns. No top-level `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`,
`RENAME`, data `DELETE`, or data `UPDATE` was found. Additive foreign
keys, indexes and unique constraints still require rehearsal with existing
data. The schema file and metadata snapshots are present for the 15-entry
branch chain; `npm run db:check` passed.

The project's `drizzle-orm/mysql2/migrator` uses
`__drizzle_migrations` in the selected database by default. Its columns are
`id` (serial primary key), `hash` (text), and `created_at` (bigint).
The hash is SHA-256 of the entire SQL file; `created_at` is the journal
`when` value, not the wall-clock time of execution. The installed migrator
reads only the latest applied `created_at` to decide which entries to run;
it does **not** compare historical hashes before applying later entries.
Thus a clean migration-status count alone cannot rule out drift.

## Production read-only inspection

The authenticated Railway CLI and GraphQL API were used only for service and
backup metadata. The MySQL service is deployed successfully and its volume
is Ready (about 199 MB used of 500 MB provisioned). The API deployment
metadata reports `main` commit `445b507` and a
`npm run db:migrate` pre-deploy command. This is not proof of which SQL
completed or what is in the database today.

No authorized read-only SQL channel was established in this task. The
database is private; no public TCP proxy was verified. Railway's exposed
GraphQL queries did not include a general read-only SQL execution endpoint.
An SSH first-use host key was previously unverified against a Railway-published
fingerprint, so no SSH tunnel or shell was used. No credentials or business
records were read.

| Required production fact | Verified value |
| --- | --- |
| MySQL server version, selected database, session timezone | UNKNOWN |
| `__drizzle_migrations` presence, rows, latest ID/hash/timestamp | UNKNOWN |
| Table/column/index/foreign-key inventory | UNKNOWN |
| Applied/pending migration count and exact sequence | UNKNOWN |
| Schema drift / journal drift | UNKNOWN |
| Production baseline migration | UNKNOWN |

**Safe evidence collection checkpoint:** In Railway, open the production
**MySQL** service's **Data** view. If `__drizzle_migrations` exists, inspect
only its `id`, `hash`, and `created_at` columns in ascending order; also
provide the table-name inventory. Do not share credentials or application
rows. If a verified read-only SQL client or query console is available, the
following statements are the minimum metadata-only queries:

```sql
SELECT VERSION(), DATABASE(), @@session.time_zone;
SELECT table_name FROM information_schema.tables
 WHERE table_schema = DATABASE() ORDER BY table_name;
SELECT id, hash, created_at FROM __drizzle_migrations
 ORDER BY created_at, id;
SELECT table_name, column_name, column_type, is_nullable, column_default
 FROM information_schema.columns
 WHERE table_schema = DATABASE() ORDER BY table_name, ordinal_position;
SELECT table_name, index_name, non_unique, column_name, seq_in_index
 FROM information_schema.statistics
 WHERE table_schema = DATABASE() ORDER BY table_name, index_name, seq_in_index;
SELECT table_name, column_name, referenced_table_name, referenced_column_name
 FROM information_schema.key_column_usage
 WHERE table_schema = DATABASE() AND referenced_table_name IS NOT NULL
 ORDER BY table_name, column_name;
```

If the migration table is absent, stop before the third query and report
that absence. Do not run `db:migrate:status` or the application migrator
against production: the former is read-only but the latter can create the
journal and apply DDL. Request independent confirmation of the Railway SSH
host key before using an SSH tunnel.

## Three-way classification and historical conflict

All 0000-0010 migration identities exist on both branches but their file
hashes differ. Main commit `176543a` changed fractional timestamp defaults
from `DEFAULT (now())` to `DEFAULT CURRENT_TIMESTAMP(3)` and aligned
`ON UPDATE` precision for MySQL 9. The branch did not copy that rewrite
over potentially applied history. Production journal hashes and schema are
unknown, so each 0000-0010 entry is **UNKNOWN**, not applied-and-matching or
applied-but-different. Entries 0011-0014 are also **UNKNOWN**, not definitively
pending. No forward-only reconciliation migration was created, and no
production journal repair was attempted.

Until the journal and structure agree, production-equivalent baseline
reconstruction, exact pending migrations, and the exact upgrade sequence
cannot be claimed. Neither journal state nor schema state alone will suffice.

## Disposable regression and restore evidence

This was a **fresh-install regression**, not a production-equivalent upgrade:

- Local engine: MariaDB `10.4.32`, not verified production MySQL.
- New disposable source: `haza_aios_db18_stage19a2_20260922`.
- Migrations 0000-0014 applied successfully; journal has 15 rows.
- Full API suite against that source: 21 files, 81 tests passed.
- Integrity before backup: 198 foreign-key checks and seven tenant checks,
  no failures.
- A local `mysqldump` backup outside the repository completed with exit 0;
  the resulting artifact existed and was 616,323 bytes.
- Restore into a second, empty disposable database succeeded.
- Source/restored aggregate counts matched: 15 migrations, 38 users, 45
  organizations, 45 workspaces, 46 memberships, 18 students, four agents,
  two workflows. All are local synthetic/test data.
- Restored integrity: 198 foreign-key checks and seven tenant checks,
  no failures. The restored database integration smoke passed four tests.
- `npm run db:check` passed. No production data was copied locally.

The first API test invocation could not create Vitest's cache because this
task initially lacked write permission to the D: checkout; no tests ran.
The authorized rerun with one worker passed all 81 tests. No application
source or migration file was changed.

The DB-18 utility reads credentials from the environment, passes the
password via `MYSQL_PWD` rather than command arguments, requires test mode,
loopback host and disposable database names, refuses an existing backup
destination and nonempty restore target, removes a partial output on a
nonzero `mysqldump` exit, and requires explicit disposable-restore opt-in.
This run verified a nonempty artifact and successful restore. The utility
does not itself enforce a timestamped filename or post-process/cryptographic
artifact validation; a real production logical backup procedure must
specify timestamping, encryption, access-controlled offsite storage and a
tested isolated restore.

## Railway backup and recovery point

For the production MySQL volume instance, Railway's read-only API returned
`volumeInstanceBackupList: []` and
`volumeInstanceBackupScheduleList: []`. Its read-only MySQL PITR window
reported `archiveConfigured: false`, no floor/ceiling, and zero full
backups. Thus **no Railway provider recovery point or schedule is verified**.
Railway documents manual and scheduled volume backups for mounted volumes,
but account/plan entitlement was not tested by creating one. Current service
status is **not configured**, and the production recovery point is
**NOT_YET_AVAILABLE/UNVERIFIED**.

Railway documents that restoring a volume backup stages a replacement volume
in the same project/environment and redeploys the service after approval; it
is not an isolated restore drill. No restore was requested. A production-side
manual snapshot/schedule and an encrypted logical backup with an isolated
restore are the proposed pre-19B checkpoint. Creating either requires
separate user approval and an agreed secure destination. A successful local
synthetic restore is not a production backup.

## Stage 19B order and rollback

The **exact** migration/deployment order is UNDETERMINED because the live
baseline and pending list are unknown. The repository's Railway pre-deploy
command can run migrations automatically during an API deploy, so a future
plan must either deliberately use that single migration path or change the
deployment strategy under separate approval; it must not issue migrations
twice. No Stage 19 deployment was initiated here.

Application rollback compatibility is **UNKNOWN**. Although the branch
migrations appear additive, constraints and current production schema/data
have not been tested together. Rolling back application code does not undo
MySQL DDL. Before Stage 19B, establish a verified recovery point, replay the
actual production baseline with synthetic data, run the exact pending chain,
then test both new code and current production code against the resulting
schema. Only then choose backup/migrate/deploy order and rollback criteria.

## Quality and release gates

This task adds audit documentation only. API integration tests (81), restored
database smoke (4), fresh migration, local backup/restore, integrity and
`db:check` passed as above. API/web source was not changed, so API/web
typechecks, builds, web tests and lint were not rerun for this documentation
commit; Stage 19A.1's prior results remain recorded in its report. The
historical web lint debt remains separate. No secret values were printed or
committed. The tracked-file secret scan and staged diff must be checked before
commit.

**Remaining blockers:** read-only production journal and schema evidence,
full-hash/structure reconciliation, exact pending list, production-equivalent
rehearsal and tenant-isolation regression, verified production recovery point,
deployment order and rollback compatibility. Stage 19B is not authorized.
`main`, production data/schema/journal, Railway application configuration,
Cloudflare and DNS remain untouched.

**STAGE 19A.2 RESULT: NO-GO**
