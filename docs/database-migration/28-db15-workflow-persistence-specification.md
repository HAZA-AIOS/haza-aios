# DB-15: Workflow Persistence Specification

Status: proposed implementation scope; implementation has not started.
Base: develop after PR #25, merge commit 94b915d.
Branch: feature/db15-workflow-persistence.

## Objective

Replace browser-local workflow storage with tenant-scoped MySQL persistence,
while preserving the current workflow builder, workspace layout, logo, and
DB-0 through DB-14 data. Do not change production hosting or promote a deployment.

## Verified starting point

- WorkflowService stores workflows, ordered steps, and tasks in localStorage.
- WorkflowExecutionManager executes steps in the browser and tracks active tasks
  in an in-memory map. Persistence alone will not make execution durable.
- Builder and run pages call those services directly. The run page currently
  passes a placeholder user identity, which must not become a trusted API identity.
- The existing cancellation path can overwrite cancelled status with failed.
- Save and notification step types are currently skipped, not implemented actions.

## Required scope

1. Add additive Drizzle migrations for workflow definitions, ordered steps,
   workflow runs, and step-attempt records. Use organization ownership, indexes,
   foreign keys, timestamps, and authenticated creator identity.
2. Save a definition and its step list atomically, including removed steps.
   Use revision checks to reject stale edits. Snapshot the definition and steps
   when creating a run so later edits cannot rewrite historical runs.
3. Add authenticated organization-scoped APIs to list, read, create, update, and
   archive definitions; create and inspect runs; record validated progress; and
   request cancellation. Map explicit read/manage/run authorization into the
   existing permission system. Deny cross-tenant access and foreign references.
4. Validate step types, configuration bounds, ordering, retry limits, and timeout
   values. Resolve agent/tool/knowledge references with server-side permissions.
   Never trust client-supplied ownership, user identity, or executable code.
5. Enforce run and attempt state transitions on the server. Make duplicate start
   requests idempotent, preserve terminal cancellation, and reject stale writes.
   Distinguish reported execution outcomes from server-verified side effects.
6. Replace frontend localStorage persistence with API calls. Preserve the current
   visual layout and add loading, error, conflict, empty, and read-only states.
   Reloading must restore definitions, steps, runs, and recorded results.
7. Keep legacy browser records untouched. Do not silently import untrusted local
   ownership data. Any later import must be explicit and tenant-validated.

## Execution boundary

Choose and document the execution authority before implementing run-write APIs.
The existing browser runner must not be presented as a durable background engine.
If retained for this persistence phase, clearly identify client-reported results,
prevent them from authorizing privileged actions, and define how interrupted runs
are surfaced. Server-side execution requires bounded retries/timeouts, an explicit
recovery policy, and idempotency for external effects. Unsupported steps must not
be represented as successfully executed actions.

## Acceptance criteria

- A workflow and reordered/removed steps survive browser reload and API restart.
- Runs retain the exact definition revision used and their step-attempt history.
- Another tenant cannot read, change, execute, cancel, or reference these records.
- Read-only users cannot manage definitions or forge run progress.
- Duplicate start requests do not create duplicate runs; stale edits conflict.
- Cancellation remains cancelled under concurrent progress/completion writes.
- Archive preserves history and prevents new starts.
- Backend validation rejects malformed definitions and unsupported execution.
- Unit and database integration tests cover these contracts; browser tests cover
  create/edit/save/reload/history and permission/error states.
- Existing frontend/API tests and production builds run. Existing lint debt is
  reported separately; no new findings are introduced in changed files.
- Back up the normal local database before applying migrations. Verify both the
  migration journal and preservation of existing records.

## Explicitly deferred

- DB-14 embeddings, vector search, binary document parsing, and advanced ingestion.
- Distributed queues, scheduling, exactly-once external effects, and durable
  background execution unless separately scoped and verified.
- New notification/save integrations, production deployment, and unrelated UI work.

## Git delivery

Use scoped commits on this branch and a review PR into develop. Preserve main,
the merged DB-14 history, and existing data. No force push, destructive cleanup,
automatic production promotion, or further merge without approval.
