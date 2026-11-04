# HAZA-AIOS — EPIC 20 RECOVERY & CONTINUOUS OPERATIONS
## Worker Leasing, Checkpoint Persistence & Crash Recovery

---

## 1. Continuous Worker Architecture

Continuous operations run through the dedicated Railway background `Worker` service (`apps/api/src/worker.ts`), preserving compute isolation between user-facing HTTP requests and long-running autonomous tasks.

```
+--------------------------------------------------------------------------------+
|                         RAILWAY WORKER SERVICE                                 |
|                                                                                |
|     +-------------------------+            +----------------------------+      |
|     | Lease Acquisition Loop  |<-----------| MySQL `autonomous_task_runs|      |
|     | (Atomic lease + lock)   |----------->| (Status: `leased`)         |      |
|     +-------------------------+            +----------------------------+      |
|                  |                                                             |
|                  v                                                             |
|     +-------------------------+            +----------------------------+      |
|     | Heartbeat Dispatcher    |----------->| (heartbeat_at = NOW(),     |      |
|     | (Every 15s)             |            |  lease_expires_at = +60s)  |      |
|     +-------------------------+            +----------------------------+      |
|                  |                                                             |
|                  v                                                             |
|     +-------------------------+            +----------------------------+      |
|     | Checkpoint Persister    |----------->| `autonomous_task_          |      |
|     | (On step completion)    |            |  checkpoints` (snapshot)   |      |
|     +-------------------------+            +----------------------------+      |
|                  |                                                             |
|                  v                                                             |
|     +-------------------------+                                                |
|     | Graceful Shutdown (SIG) |                                                |
|     | (Release unrun leases)  |                                                |
|     +-------------------------+                                                |
+--------------------------------------------------------------------------------+
```

---

## 2. Leasing Protocol & Distributed Locking

1. **Lease Acquisition:**
   Workers poll for `queued` runs where `organization` is not emergency stopped.
   Acquisition uses an atomic SQL UPDATE:
   ```sql
   UPDATE autonomous_task_runs
   SET status = 'leased',
       worker_id = :workerId,
       leased_at = NOW(),
       lease_expires_at = DATE_ADD(NOW(), INTERVAL 60 SECOND),
       heartbeat_at = NOW()
   WHERE id = :runId AND status = 'queued';
   ```
2. **Heartbeats:**
   While executing, the active worker sends heartbeats every 15 seconds, advancing `lease_expires_at` by 60 seconds.
3. **Stale Lease Detection & Zombie Recovery:**
   If a worker pod crashes or is killed by Railway, its heartbeat ceases.
   The scheduler scanner periodically queries:
   ```sql
   SELECT id FROM autonomous_task_runs
   WHERE status IN ('leased', 'running')
     AND lease_expires_at < NOW();
   ```
   Such runs are reclaimed: if `retry_count < max_retries`, their status resets to `queued` with incremented `retry_count`; otherwise they transition to `timed_out` / `failed`.

---

## 3. Checkpointing & Resume Mechanics

At every step boundary in a multi-step autonomous task:
1. Current step outputs and intermediate context are persisted to `autonomous_task_checkpoints`.
2. Upon recovery from a crash, the worker queries the latest checkpoint for the task run and resumes from the uncompleted step rather than starting from the beginning.
3. Idempotent action execution ensures that already-executed actions with external side effects are not re-executed during recovery.
