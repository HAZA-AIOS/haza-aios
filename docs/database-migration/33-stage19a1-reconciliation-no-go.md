# Stage 19A.1: production reconciliation checkpoint (2026-09-22)

**Result: NO-GO for Stage 19B.** This branch is a candidate based on
`origin/develop`; neither `main` nor production data/configuration was
changed. Do not merge or deploy the candidate until the blockers below are
resolved.

## Repository and reconciliation

The starting `develop` checkout was clean and synchronized. `git fsck --full`
found only dangling unreachable objects. The reconciliation branch is
`release/stage19-production-reconciliation`. Non-migration main changes were
applied as individual cherry-picks with source references. This keeps
DB-14 through DB-18 on the develop side and preserves the main production
fixes without merging conflicting migration history.

| Main source | Classification | Candidate disposition |
| --- | --- | --- |
| `055fb97` | API production TypeScript build | Cherry-picked |
| `d1b428b` | Cloudflare frontend assets | Already patch-equivalent in develop (`e77f43a`) |
| `8ed1416` | Railway platform port | Cherry-picked |
| `5a7e261`, `7942359`, `268d9aa`, `8db5e97` | Public landing, pricing and login UI | Cherry-picked |
| `7a585f6`, `bfce357`, `f81e531` | Registration policy, auth error handling and logging | Cherry-picked |
| `bef25a4` | Railway pre-deploy migration command | Cherry-picked; MUST NOT be activated before Stage 19B approval |
| `176543a` | MySQL 9 timestamp rewrite of migrations 0000-0010 | **Not applied** pending production migration forensics |
| `f7d5a26`, `7c60dc1`, `e0d27a7`, `97bb1b4` | Products, multi-org, CORS, post-login routing | Cherry-picked |
| Main merge commits | Merge bookkeeping | Not cherry-picked; source feature commits retained |

The only cherry-pick conflicts were the auth module import list and
`CHANGELOG.md`; both sides' required imports/entries were retained.
No Cloudflare route, DNS record, Railway setting, production variable or
database object was changed. The known `api.haza-aios.com/*` Worker exclusion
must continue to be verified separately before a future deployment.

Develop-only scope includes DB-14 knowledge (0011), DB-15 workflows (0012),
DB-16 operations (0013), DB-17 usage/billing (0014), and DB-18
backup/restore/integrity tooling, plus the Stage 19A audit. DB-14 embeddings
and vector search remain deferred.

## Migration forensics

`main` and `develop` use the same journal identities for 0000-0010 but
different SQL bodies. Main commit `176543a` rewrote fractional timestamp
defaults from `DEFAULT (now())` / `ON UPDATE CURRENT_TIMESTAMP` to
`DEFAULT CURRENT_TIMESTAMP(3)` / `ON UPDATE CURRENT_TIMESTAMP(3)` for
MySQL 9 compatibility. All eleven SQL files 0000-0010 differ. Develop
additionally has 0011-0014 and matching metadata snapshots/journal entries;
main lacks them. The branch deliberately retains develop's SQL and journal
unchanged. No applied migration was rewritten, deleted, renumbered or marked
complete. A forward-only reconciliation cannot be designed responsibly until
production applied hashes and schema are known.

The production migration tracking table, applied identities/hashes, table
inventory, schema version, and exact pending set are **UNKNOWN**. A prior
HTTP readiness result showed database connectivity, not migration state.
Railway CLI exposes private MySQL host variables but no public MySQL URL for
the service. No read-only SQL session was established; an SSH first-use host
key was not trusted without independent verification. Do not infer that
0011-0014 are pending merely because they are absent from main.

To collect the minimum production evidence, use Railway's MySQL Data/query
console or a verified read-only SQL connection and return only these results
(no credentials or business rows):

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = DATABASE()
ORDER BY table_name;

SELECT id, hash, created_at
FROM __drizzle_migrations
ORDER BY created_at;
```

If the migration table has a different name, identify it from
`information_schema.tables` first and inspect only its column names before
querying. Once the applied journal is known, compare
`information_schema.columns`, indexes and foreign keys for the divergent
tables against both branch definitions. Classify each migration as applied,
pending, divergent or unknown before designing any forward-only fix.

## Railway backup evidence

Read-only Railway GraphQL for the production MySQL volume instance
`123b7d37-5af6-4a4f-b2ea-9b212bedf31b` returned
`volumeInstanceBackupList: []` and
`volumeInstanceBackupScheduleList: []`. The volume is mounted and Ready,
but **no provider backup or schedule is configured/verified**. Retention is
therefore not established. Do not treat a healthy volume as a backup.

DB-18's logical backup, isolated restore and integrity tooling passed on
disposable MySQL in Stage 19A. That proves a local procedure, not a current
production recovery point. Before Stage 19B, configure/verify provider
backup or create an authorized encrypted logical production backup, store it
outside Railway in access-controlled storage, restore it to an isolated
database, and record integrity results and recovery point. Do not do this
implicitly during deployment.

## Validation on this candidate

| Gate | Result |
| --- | --- |
| API typecheck, lint, build | PASS |
| Web typecheck and production build | PASS; bundle-size warning |
| Drizzle `db:check` | PASS; develop's 15 ordered migrations |
| API unit suite | PASS: 46 tests; DB integration skipped without test DB |
| Web suite | 32 files / 169 tests passed; two fork startup timeouts caused nonzero exit. Both timed-out files reran successfully with one worker (2 files / 15 tests). |
| Changed web files targeted ESLint | PASS: no findings |
| Full web ESLint | FAIL: 214 errors, 18 warnings, exactly Stage 19A baseline; no count regression |
| Tracked-file common secret-pattern scan | No matching files |
| Fresh install / logical restore rehearsal | Stage 19A PASS; not repeated as a production-equivalent upgrade |
| Production-equivalent migration upgrade | BLOCKED: exact starting migration/schema unknown |

The API/web builds compile together with the selected main fixes. The
candidate retains `apps/api/railway.toml`, including its automatic
`preDeployCommand`; that command makes an accidental production deployment
unsafe until the migration state and backup gates are closed.

## Remaining gates and release decision

1. Obtain read-only production migration journal and schema inventory.
2. Establish which historical 0000-0010 SQL variant was applied and whether
   a forward-only reconciliation migration is needed. Preserve both source
   histories as evidence.
3. Establish a verified production backup/recovery point and an isolated
   restore. Railway currently reports no volume backup/schedule.
4. Rehearse the **actual** production starting state to DB-18 on disposable
   MySQL with representative synthetic data, integrity and tenant isolation.
5. Review production deployment settings and check the Railway pre-deploy
   command cannot run before explicit Stage 19B authorization.
6. Only after these gates, review a PR into `develop` and use a normal merge
   commit. Do not merge `develop` into `main` or migrate production here.

The candidate branch is intentionally not merged into `develop`. Stage 19B
is not authorized. `main`, Railway configuration, Cloudflare configuration,
DNS, and production MySQL remain unchanged.
