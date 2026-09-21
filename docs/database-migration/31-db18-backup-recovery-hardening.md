# DB-18: Backup, Recovery and Integrity Foundation

DB-18 adds no schema migration. It provides a guarded disposable-database
backup/restore rehearsal utility and a read-only integrity checker. Production
activation remains a separate Stage 19 decision.

## Local rehearsal

Install MySQL client tools (`mysqldump` and `mysql`). Set `NODE_ENV=test`,
`DATABASE_HOST=127.0.0.1`, and a unique `TEST_DATABASE_NAME` beginning
`haza_aios_db18_`. On Windows, set `MYSQLDUMP_BIN` and `MYSQL_BIN` to
the executable paths if they are not on `PATH`.

1. Create the source with `npm run db:create -w api`, then run
   `npm run db:migrate -w api`.
2. Add only synthetic representative records. Run `npm run db:integrity -w api`.
3. Back up to a new path outside the repository with
   `npm run db:recovery:disposable -w api -- backup <absolute-path.sql>`.
   The utility refuses to overwrite an existing output.
4. Select a different, new `haza_aios_db18_*` name and run
   `npm run db:create -w api`. Verify it is empty.
5. Set `ALLOW_DISPOSABLE_RESTORE=yes`, then run
   `npm run db:recovery:disposable -w api -- restore <absolute-path.sql>`.
   The utility refuses a nonempty target.
6. Run `npm run db:migrate:status -w api` and
   `npm run db:integrity -w api`. Compare representative source and target
   record counts and run application integration tests on the restored copy.

The recovery utility refuses production mode, remote database hosts, and names
outside the disposable test namespace. Passwords are passed to local MySQL
client processes through `MYSQL_PWD`, not command arguments. Backups can still
contain sensitive data: never place a production dump in the repository or an
unapproved local destination.

## Integrity scope

`db:integrity` uses a read-only transaction. It checks all declared foreign
keys in the current schema, then checks cross-tenant relationships for agent
runs, workflow runs, usage source/workspace, subscriptions, and statements.
It reports aggregate failure counts only. A PASS is necessary but does not
prove application semantics or substitute for a restore test.

## Production prerequisites and recovery

Before any Stage 19B migration, independently verify Railway provider backup
capability and retention, take a timestamped provider snapshot if available,
and verify an authorized encrypted logical backup plus a successful isolated
restore. Record migration status and a read-only integrity baseline. Never
assume a backup exists because the deployment is Online.

If migration fails before deployment, stop deployment and inspect the migration
journal and partial DDL; MySQL DDL may commit despite a failed migration. Do
not blindly rerun or roll back. If deployment fails after an additive migration,
assess old-app compatibility before rolling code back. If integrity fails or
data is damaged, freeze writes and choose a verified point-in-time/provider or
logical restore under incident approval, then revalidate migration state,
tenant integrity, application readiness, and representative workflows.

For a database outage, first distinguish provider availability from schema
failure. Do not restore over the live database merely to recover connectivity.
Escalate to the provider, preserve logs, and restore only to a separately
approved target after confirming recovery point and data-loss window.

## Rehearsal evidence

On September 21, 2026, a fresh disposable local MySQL source migrated through
15 journal entries. A synthetic user, organization, workspace, and membership
were backed up and restored into a second empty disposable database. Counts
matched (one each); 198 foreign-key and seven tenant checks passed on both
databases. This does not verify Railway provider backups or production state.
