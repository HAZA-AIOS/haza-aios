# DB-16: Audit, Events, Notifications and Operational Persistence

Status: implemented on `feature/db16-operational-persistence`; pending review and merge.
Base: `develop` after DB-15.

## Implemented baseline

- Added immutable, tenant-scoped audit records for actor, action, resource, result,
  request, correlation, safe snapshots, changed fields, and metadata.
- Added tenant-scoped domain events with aggregate identity, schema version,
  correlation/causation identifiers, and optional idempotency keys.
- Added operational events for cross-domain diagnostics with severity, component,
  resource references, workflow/agent run references, and sanitized error details.
- Extended DB-8 notification and delivery persistence instead of introducing a
  duplicate notification subsystem. Notifications now support source-event links,
  read and acknowledgement timestamps, expiry, and durable delivery-attempt metadata.
- Added authenticated organization-scoped read APIs and user-scoped notification
  operations. Audit and event records have no API update or delete path.
- Workflow state changes and task assignment now emit transactional audit/events;
  assigned users receive durable notifications. Failed workflow and agent runs
  create linked operational events.
- Replaced the admin audit page's static data source with the current organization's
  persisted audit API while preserving its established layout.

Migration: `0013_abnormal_johnny_storm.sql`. The migration is additive and
forward-only. It creates three tables, extends two DB-8 tables, adds indexes and
foreign keys, and grants the new permissions idempotently.

## Existing-system audit

- DB-4 `security_events` remains the authentication/security event store; DB-16
  does not repurpose it as a general product audit trail.
- DB-8 `sis_notifications`, `notification_preferences`, and
  `communication_deliveries` remain authoritative for user notifications and
  channel delivery records.
- DB-12 through DB-15 run tables remain authoritative for agent and workflow
  lifecycle state. DB-16 stores diagnostic references, not duplicate run state.
- Request IDs already supplied by the HTTP request context remain the request
  correlation source.

## Security and isolation

- Every query is constrained by organization ownership. Workspace, user, workflow
  run, and agent run references are validated before persistence.
- Notification reads and state changes are constrained to the authenticated user.
- `audit.read`, `event.read`, `notification.read`, and
  `notification.manage` extend the DB-4 permission model.
- Operational payloads recursively redact password, secret, token, authorization,
  cookie, API-key, credential, database URL, and private-key fields. Payload depth,
  collection size, key count, and text length are bounded.
- Audit and event APIs are read-only. Application services append records inside
  the same transaction as supported domain writes.

## Transaction and delivery boundary

Creating a domain event and its user notification is atomic. Workflow terminal
updates, task assignment, audit records, and their related events share the domain
transaction. Failed agent/workflow diagnostics likewise share the relevant run
transaction.

DB-16 persists notification intent and delivery attempts only. It does not add a
message broker, transactional outbox relay, background worker, email/SMS provider,
retry daemon, or exactly-once delivery guarantee. Provider execution and durable
asynchronous dispatch require a later explicitly designed phase.

## Retention and privacy

Audit and event records are append-only at the application API boundary. Automated
retention, legal hold, archival, subject-access exports, and destructive privacy
workflows are intentionally deferred until policy requirements are approved.
Sanitization reduces accidental secret storage but is not a substitute for data
classification at each producer.

## Verification

- Generated migration inspected for destructive statements.
- Full migration chain applied to a disposable empty MySQL database.
- Integration coverage verifies tenant isolation, pagination, redaction,
  idempotency, RBAC, notification ownership, read/acknowledge state, preferences,
  delivery attempts, atomic rollback, workflow assignment, and failure diagnostics.
- API unit tests, typecheck, lint, production build, and migration consistency run.
- Web typecheck, tests, targeted lint, and production build run after the persisted
  audit page integration.

## Explicitly deferred

- Transactional outbox publishing and message-broker integration.
- Background notification workers, provider execution, retry scheduling, and
  delivery webhooks.
- Automated retention, archival, legal hold, and privacy-erasure workflows.
- DB-14 embeddings/vector search and DB-15 durable workflow workers.
- Production deployment, Cloudflare, Railway, DNS, and production MySQL changes.
