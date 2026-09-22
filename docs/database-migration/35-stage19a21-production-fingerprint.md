# Stage 19A.2.1: production database fingerprint (2026-09-22)

**Result: additional read-only structural metadata required.** Stage 19B is
not authorized. No production write, migration, backup creation, deployment
or infrastructure change occurred.

## Source and repository gate

The operator supplied results of three SELECT-only queries run in the Railway
`haza-aios / production / MySQL` Console. Codex did not reconnect to
production SQL. Root `D:/HAZA-APPS/HAZA-AIOS`, branch
`release/stage19-production-reconciliation`, starting HEAD
`0e67691aaa4b2b022b1f8765093d431c82418f94`, clean working tree.
The local comparison used `origin/main`, the current branch's migrations,
and `apps/api/src/database/schema.ts`. No historical SQL was edited.

## Production identity and journal

MySQL version: **9.4.0**. Selected database: **`railway`**.
`__drizzle_migrations` exists and contains **11** rows, IDs 1-11 without a
visible gap. Latest entry: ID 11, `created_at=1788799001273`,
corresponding to `0010_many_sandman` on main.

The exact supplied metadata:

| id | hash | created_at |
| ---: | --- | ---: |
| 1 | 8de6dabd4c0790d31b575203e22a019814179d92c4d8a64672665e773c5a90dc | 1787037977818 |
| 2 | 27a811445b2c9d6143bb6229620f74196a8a0e467bda8f2c77f3cd178127b96a | 1787042238699 |
| 3 | 54832bd9d29aedd641bd8d9b0258286b078f7cd267f15ca84a8ca19477de0cf8 | 1787046176071 |
| 4 | 228b313c7dd27d260b0a3e9a65200d562ddb1ab5f23af4dafe8ee9c53a73c045 | 1787556716023 |
| 5 | 0e941c1e97fe15cdd51ac17cda41ba80f548268a2468466ec7b6d9d653e3229b | 1787679324819 |
| 6 | 7ef320e0dd17d312ae1f5a680fdeeeab0902ad60597137a1c5a36830fbffe78d | 1787800000000 |
| 7 | 3e512ea4a3ad5eab2d996270125799015ca17ab1b8e8f182b22a19c52f5b78de | 1787801000000 |
| 8 | c9a5893523ed6b9e4ccdecd69e4e67f415d7f6770f9961b106a8a869fa4f90ff | 1787888655462 |
| 9 | 76ca6400f27861f379b4d574d024afeca80f0a76c75fd0639e8f3a1539546538 | 1787934170278 |
| 10 | be592b09cd644dd7213e01957eb058e14e5e5b306391e49e4f9effcda5cb01e7 | 1788198180185 |
| 11 | 82aa82ef04339e7d7a50b1121030a39c8f75b1d064f11eb87ac99566c3957d58 | 1788799001273 |

For every row, the full SHA-256 hash and journal timestamp match
`origin/main` migration 0000-0010 exactly. None of the 11 SQL hashes
matches the same-numbered file on this branch. The 0000-0010 production
hash family is **MAIN**, not mixed. The historical difference is main's
MySQL 9 fractional-timestamp rewrite. The branch's historical migration
files remain unchanged.

## Production base tables

The operator reported **62** base tables:

```text
__drizzle_migrations, academic_terms, academic_years,
ai_agent_conversations, ai_agent_definitions, ai_agent_memories,
ai_agent_messages, ai_agent_runs, ai_agent_templates,
ai_agent_tool_assignments, announcements, assessments,
attendance_records, attendance_sessions, auth_sessions, class_subjects,
communication_deliveries, communication_messages, communication_templates,
enrollments, examination_subjects, examinations, finance_discounts,
finance_fee_categories, finance_fee_structures, finance_invoices,
finance_payments, finance_receipts, finance_student_fee_assignments,
grade_levels, grading_rules, guardians, internal_database_checks,
mark_records, membership_roles, notification_preferences,
organization_memberships, organization_modules, organization_settings,
organizations, permissions, platform_modules, portal_policies,
portal_update_requests, result_publications, role_permissions, roles,
school_schedules, sections, security_events, sis_notifications,
staff_departments, staff_members, student_guardians, students, subjects,
teaching_assignments, time_periods, timetable_entries, users,
workspace_memberships, workspaces
```

This set exactly matches the 62 tables expected after `origin/main`
migrations 0000-0010 (61 application tables plus journal): none missing or
unexpected. The current branch expects 76 application tables plus journal.
Its 15 table names absent from production are:

```text
knowledge_chunks, knowledge_sources, workflow_definitions, workflow_runs,
workflow_step_runs, workflow_steps, workflow_tasks, audit_logs,
domain_events, operational_events, billing_accounts, billing_statements,
organization_subscriptions, saas_plans, usage_meter_events
```

Table names alone do not prove column types/defaults, indexes, unique
constraints or foreign keys match main, nor rule out partially applied DDL.
The installed Drizzle MySQL migrator selects pending entries using the
latest journal `created_at`; it does not compare prior hashes or schema.

## Baseline and pending journal sequence

- `PRODUCTION_JOURNAL_BASELINE`: **KNOWN**, through main-family
  `0010_many_sandman`.
- `PRODUCTION_TABLE_NAME_BASELINE`: **KNOWN**, exactly main 0000-0010.
- `PRODUCTION_FULL_SCHEMA_BASELINE`: **PARTIALLY KNOWN**.
- `JOURNAL_PENDING_ON_THIS_BRANCH`, in order:
  `0011_dazzling_zaran` (DB-14 knowledge),
  `0012_certain_argent` (DB-15 workflows),
  `0013_abnormal_johnny_storm` (DB-16 operations),
  `0014_third_rawhide_kid` (DB-17 usage/billing).
- `SAFE_TO_APPLY_PENDING_SEQUENCE`: **NOT ESTABLISHED** until structural
  metadata and a production-equivalent rehearsal are complete.
- Table-name drift: **none found**. Column/index/FK drift: **unknown**.

The next non-production rehearsal, after structural metadata review, must
recreate the verified main 0010 schema on disposable **MySQL 9.4**, seed
representative synthetic cross-tenant records, apply exactly 0011-0014,
compare final schema, and run integrity, isolation and application checks.
The previous MariaDB fresh-install/restore drill is not that rehearsal.

## Additional read-only metadata for separate review

No further production query was run. To establish the full schema baseline,
the next approved metadata-only queries should return:

- `information_schema.columns`: table/column name, type, nullable,
  default and extra.
- `information_schema.statistics`: table/index name, uniqueness, column
  name and sequence.
- `information_schema.key_column_usage`: table/column/constraint and
  referenced table/column.
- `information_schema.referential_constraints`: table/constraint and
  update/delete rules.

Each query must be filtered to `table_schema = DATABASE()`. No application
rows are needed. Do not expand production inspection automatically.

## Backup and stop gate

Stage 19A.2 found no verified production recovery point or Railway volume
backup schedule, and PITR was not configured. That finding is retained; no
backup was created in this task. Backup remains a separate approval
checkpoint. No PR or merge was performed. Production data/schema/journal,
Railway application configuration, Cloudflare, DNS, `main` and `develop`
were untouched. Stage 19B remains blocked.

**STAGE 19A.2.1 RESULT: ADDITIONAL READ-ONLY METADATA REQUIRED**
