# HAZA-AIOS — EPIC 20 SCHEDULER ARCHITECTURE
## Distributed Task Scheduling, Trigger Evaluation & Idempotency

---

## 1. Overview

The HAZA-AIOS Autonomous Task Scheduler delivers durable, distributed scheduling across multi-node deployments without requiring external Redis or RabbitMQ dependencies. It leverages MySQL relational state, atomic updates, and deterministic lease mechanics.

```
+--------------------------------------------------------------------------------+
|                           SCHEDULER SUBSYSTEM                                  |
|                                                                                |
|  [ Recurring Cron Trigger ]       [ One-Time Schedule ]     [ App Domain Event ] |
|            |                                |                         |        |
|            +--------------------------------+-------------------------+        |
|                                             |                                  |
|                                             v                                  |
|                               [ Trigger Evaluation Engine ]                    |
|                               (Validates Cron, TZ, State, Bounds)              |
|                                             |                                  |
|                                             v                                  |
|                               [ Deduplication & Idempotency ]                 |
|                               (Hash: TaskId + Timestamp / EventId)             |
|                                             |                                  |
|                                             v                                  |
|                         [ Enqueue to `autonomous_task_runs` ]                  |
|                                (Status: `queued`)                              |
+--------------------------------------------------------------------------------+
```

---

## 2. Trigger Types & Specifications

### 1. One-Time Schedules (`schedule_type: once`)
- Requires `scheduled_at` timestamp in UTC.
- Evaluated by the scheduler polling loop: triggers when `scheduled_at <= NOW()` and `last_run_at IS NULL`.
- Once executed, the trigger automatically disables itself or marks next run as null.

### 2. Recurring Cron Schedules (`schedule_type: recurring`)
- Requires a standard 5-field cron expression (`cron_expression`) and a timezone (`timezone`, defaults to `UTC`).
- Computes `next_run_at` using timezone-aware cron parsing.
- Upon dispatch, calculates the subsequent `next_run_at` and stores `last_run_at = NOW()`.

### 3. Application Event Triggers (`trigger_type: event`)
- Subscribes to internal platform events using dot-separated wildcard patterns (e.g., `lms.section.created`, `academic.plan.*`).
- When an event occurs, matching enabled triggers generate a queued run.

---

## 3. Deduplication & Idempotency Guarantees

To ensure container restarts, worker crashes, or concurrent scheduler ticks never trigger duplicate execution:
1. Every task run has a unique `idempotency_key`:
   - For scheduled runs: `idempotency_key = "sched:{taskId}:{timestampMillis}"`
   - For event triggers: `idempotency_key = "event:{taskId}:{eventId}"`
2. Unique constraint `auto_runs_idempotency_unique` on `(workspace_id, task_definition_id, idempotency_key)` guarantees duplicate requests are rejected at the database engine level with zero race conditions.

---

## 4. Missed Schedule Policies

When an instance is stopped for maintenance or deployment, scheduled triggers that fell within the downtime window are resolved according to `missed_schedule_policy`:
- **`run_once` (Default):** Coalesces all missed executions into a single execution and schedules the next normal window.
- **`skip`:** Ignores the missed windows entirely and waits for the next future window.
- **`run_all`:** Enqueues backfilled runs for each missed window up to a configurable ceiling (`max_missed_backfill = 5`).
