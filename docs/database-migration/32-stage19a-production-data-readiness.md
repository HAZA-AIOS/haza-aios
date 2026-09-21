# Stage 19A: Production Data Readiness Audit (2026-09-21)

**Result: NO-GO.** This is a read-only/non-destructive production assessment.
No production migration, backup, restore, deployment, DNS/configuration change,
or `develop` to `main` merge was performed.

## Repository and phase evidence

Authoritative checkout: `Final_Working`. `git fsck --full` completed with only
dangling unreachable objects; the working tree was clean at audit start.
`origin/develop` = `1675178` (DB-18 PR #43); `origin/main` = `706b82c`
(PR #39). The merge base is `b612500`. GitHub PR #42 delivered DB-17 and
PR #43 delivered DB-18 to `develop`, both with successful checks.

| Phase | Status/evidence         | Migration           | Key scope                         |
| ----- | ----------------------- | ------------------- | --------------------------------- |
| DB-0  | PR #5                   | none                | architecture baseline             |
| DB-1  | PR #6                   | none                | API foundation                    |
| DB-2  | docs and schema/tooling | 0000                | MySQL/Drizzle foundation          |
| DB-3  | PR #7                   | 0001                | tenant, workspace, membership     |
| DB-4  | PR #8                   | 0002                | users, auth, RBAC                 |
| DB-5  | PR #9                   | 0003                | SIS academic/student/staff        |
| DB-6  | PR #10                  | 0004                | attendance/timetable              |
| DB-7  | PR #11                  | 0005                | exams/results                     |
| DB-8  | PR #12                  | 0006                | SIS fees/communication/portal     |
| DB-9  | PR #13                  | existing SIS tables | reporting persistence             |
| DB-10 | PR #18                  | 0007                | platform modules                  |
| DB-11 | docs/schema history     | 0008                | agent registry/configuration      |
| DB-12 | PR #19                  | 0009                | runs/conversations/messages       |
| DB-13 | PR #20                  | 0010                | memory                            |
| DB-14 | PR #25                  | 0011                | text knowledge/retrieval baseline |
| DB-15 | PR #40                  | 0012                | workflow definitions/runs/tasks   |
| DB-16 | PR #41                  | 0013                | audit/events/notifications        |
| DB-17 | PR #42                  | 0014                | usage/SaaS billing foundation     |
| DB-18 | PR #43                  | no DDL              | backup/restore/integrity tooling  |

DB-14 embeddings, binary ingestion, and vector search remain deferred.
DB-17 does not activate payments, pricing policy, or charging.

## Develop versus production

`develop` has DB-14 through DB-18 commits absent from `main`. Conversely,
`main` has production fixes absent from `develop`: Railway pre-deploy
migrations, MySQL 9 timestamp compatibility changes to migrations 0000-0010,
API port/configuration/CORS/registration fixes, public pricing/login/products,
multi-organization workflow, and post-login routing. About 55 files differ on
the `main`-only side and 69 on the `develop`-only side. This is not a
fast-forward promotion. In particular, migration SQL with the same journal
tags differs between branches. Reconcile history and verify the resulting SQL
and app behavior before any production promotion. Do not overwrite either
side's fixes.

The `develop` journal has 15 ordered SQL migrations, 0000 through 0014.
`drizzle-kit check` passed. Inventory: 0000 foundation; 0001-0006 tenant,
auth and SIS; 0007-0010 platform/agent; 0011 knowledge; 0012 workflows; 0013
operations; 0014 metering/billing. The added DB-14 through DB-17 migrations
create tables, indexes, foreign keys and additive columns. No `DROP TABLE`,
`DROP COLUMN`, `TRUNCATE`, `RENAME`, unscoped `DELETE`, or data `UPDATE`
was found in migration SQL. MySQL DDL is not assumed transactionally reversible.

Production migration journal/version and structural data counts were **not
inspected**: no authorized Railway CLI/database read-only connection was
available. Public `/api/v1/health` and `/api/v1/readiness` returned HTTP 200;
readiness reported `database: up`. This proves connectivity, not migration
version, data profile, or backup health. Pending migrations cannot be stated
definitively; 0011-0014 are present on `develop` but absent from `main`.

## Rehearsal and quality gates

DB-18's guarded recovery script, integrity checker, and runbook are in
`31-db18-backup-recovery-hardening.md`. A new local disposable MySQL database
was migrated from 0000 to 0014. A synthetic user, organization, workspace and
membership were inserted. Backup to a local temp file and restore to a
different empty disposable database succeeded. Source and restored counts
matched (one each), migration status reported 15 applied entries, and 198 FK
plus seven tenant consistency checks passed both before and after restore.
The complete API suite on the restored copy passed: 20 files, 64 tests.
The synthetic organization/workspace persisted after the suite. No real
production record was used.

A _production-equivalent upgrade_ was **not** rehearsed: the exact production
migration starting point is unknown and `main` and `develop` contain
different SQL bodies for migrations 0000-0010. A successful fresh install and
restore do not clear that risk.

| Gate                                 | Result                                            |
| ------------------------------------ | ------------------------------------------------- |
| API typecheck, lint, build           | PASS                                              |
| API unit + disposable DB integration | PASS, 64 tests                                    |
| Web typecheck, build                 | PASS; build warns about a large JS chunk          |
| Web tests                            | PASS with two workers, 171 tests                  |
| Web full lint                        | FAIL: 214 errors and 18 warnings in existing code |
| Drizzle schema/journal check         | PASS, 15 ordered migrations                       |
| Tracked-file secret pattern scan     | No matches for common key/private-key patterns    |
| Local integrity/restore              | PASS; production equivalent not established       |

The first unconstrained web test run had three worker startup timeouts despite
154 passing tests; limiting to two workers completed all 171 tests. A DB-14
knowledge integration test hardcoded `haza_aios_test` and tried to migrate a
previously partial local database. Stage 19A tooling now honors
`TEST_DATABASE_NAME`; the full serial API suite then passed on the restored
disposable database. No unrelated lint refactor was made.

## Production configuration and backup checkpoints

The `main` repository contains `apps/api/railway.toml` with
`preDeployCommand = ["npm run db:migrate"]`, start command, and readiness
healthcheck. `develop` lacks this file. A normal future merge would have to
retain and verify this configuration; the actual Railway service settings
were not accessible. Thus migration _may_ run automatically before the new
API deployment, but live behavior is not independently verified. Cloudflare
`wrangler.jsonc` exists in both branches; the actual production branch,
route exclusions, and build settings were not inspected. Do not change the
known `api.haza-aios.com/*` Worker exclusion.

Required API variable names include `DATABASE_HOST`, `DATABASE_PORT`,
`DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD`, `API_HOST`,
`API_PORT`, and `WEB_ORIGIN`; `DATABASE_POOL_LIMIT` is optional.
`main` also documents `WEB_ORIGINS` and `REGISTRATION_ALLOWED_EMAILS`;
these are absent from `develop`'s example because production fixes were
not back-merged. Values/presence in Railway were not verified. The frontend
API-base configuration must be reviewed in the eventual combined tree.
DB-17/DB-18 add no production secret variables. No secret values were read.

Railway provider-level snapshot/backup capability and retention are
**UNAVAILABLE TO INSPECT**. The DB-18 local logical backup is not a production
backup. Before 19B, verify provider capability and an authorized encrypted
logical backup, including an isolated restore and a measured recovery point.

## Controlled activation proposal (not authorized in 19A)

1. Reconcile `main`-only production fixes into a candidate based on
   `develop`, preserving migration SQL, Railway configuration, login, CORS,
   multi-organization routing, pricing and registration policy. Review the
   combined diff and rerun all gates.
2. Obtain authorized read-only production migration/version and aggregate
   data-profile evidence. Rehearse that exact schema starting point with
   representative synthetic records in a disposable database.
3. Verify provider backup settings and an encrypted logical backup by
   restoring into an isolated database. Record baseline integrity and
   migration status.
4. Only after explicit Stage 19B approval, take a fresh verified backup,
   then apply a controlled additive migration before exposing code that
   requires the new tables. Confirm whether Railway's pre-deploy migration
   command will run automatically; do not issue it twice. Deploy API, validate
   readiness and auth, then deploy frontend and complete smoke tests.

Recovery decisions: if a migration fails before deploy, stop the deploy,
preserve the journal/error and assess partial DDL; do not blindly rerun. If
API or frontend deployment fails, stop promotion and roll back application
only after confirming old-code/new-schema compatibility. If readiness or
integrity fails, freeze writes, compare to baseline, and choose provider or
logical restore only under incident approval with a known recovery point.
For severe data loss, restore to a separate target first and verify migration
state, tenant integrity and business records before cutover. For a database
outage, investigate provider availability before considering restore.

Post-activation smoke plan (read-only where possible): public landing page;
API health/readiness; sign-in and session; organization/workspace/switching,
users and RBAC; SIS academics/students/staff, attendance/timetable,
exams/results, fees/communications/portal/reporting; agent registry,
configuration, runs/conversations, memory and knowledge retrieval; workflow
definitions/runs/tasks; audit/events/notifications; usage summary and SaaS
billing read model. Check tenant isolation and error handling. Avoid creating
production test records without a separately approved test plan.

## NO-GO blockers

1. `main`-only production fixes and changed 0000-0010 migration SQL are
   not reconciled with `develop`; promotion behavior is untested.
2. Production migration state and exact pending migration set are unknown.
   Production-equivalent upgrade rehearsal has not passed.
3. Railway provider backup capability, retention, production logical backup
   and isolated restore have not been verified.
4. Live Railway/Cloudflare deployment settings and required variable
   presence have not been inspected. The repository's Railway pre-deploy
   command could execute migrations automatically during promotion.
5. Full web lint has historical errors; establish an agreed baseline or
   resolve release-relevant findings before treating it as a clean gate.

**STAGE 19A RESULT: NO-GO.** Stop before any production-changing operation.
