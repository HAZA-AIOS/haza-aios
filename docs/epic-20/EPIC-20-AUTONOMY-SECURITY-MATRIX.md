# HAZA-AIOS — EPIC 20 AUTONOMY & SECURITY MATRIX
## Autonomy Levels, Permission Boundaries & Fail-Closed Protocols

---

## 1. Autonomy Level Framework (L0 – L3)

HAZA-AIOS establishes an explicit, auditable 4-tier autonomy governance model:

| Level | Classification | Execution Capabilities | Approval Policy | Safe Defaults |
|---|---|---|---|---|
| **L0** | Fully Manual | Agents prepare step plans and drafts only. No automated execution. | **100% Human Approval Required** for every step before execution. | Recommended for initial agent introduction and regulated workflows. |
| **L1** | Semi-Autonomous | Can execute read-only queries and context lookups automatically. | **Approval Required for all write/mutation actions.** | Default level for new tasks. Read tools run without pause. |
| **L2** | Supervised Autonomous | Can execute standard pre-approved read and write operations within bounded parameters. | **Approval Required for consequential actions** (grades, publish, delete, send email, or costs > $1.00). | Production standard for automated academic scheduling. |
| **L3** | High Autonomy | Runs continuously across complex DAGs and autonomous event loops. | **Automatic execution within strict budget & rate limits.** Approvals required only upon privilege escalation or anomalous drift. | Requires organization Owner authorization and emergency stop readiness. |

---

## 2. Security Boundaries & Invariants

### 1. Zero Privilege Escalation
- Autonomous agents can NEVER gain permissions beyond the user or organization creating the task.
- When an agent adapts a workflow plan, it cannot introduce new tools, new agents, or new database domains not explicitly whitelisted in the task definition.
- If a step fails and requires a capability not in the approved policy, execution halts immediately with status `failed` or `waiting_approval`.

### 2. Prompt Injection Defense
- Task definitions enforce strict schema validation on trigger inputs.
- External trigger payloads are treated as untrusted text and quarantined within isolated execution scopes.
- Execution boundaries are passed to the Agent Runtime as delimited context blocks (`<untrusted_input>`), preventing instructions from overriding system autonomy policies.

### 3. Consequential Action Gates
- Tools marked with `consequential: true` (such as publishing grades, deleting records, notifying parents, executing external API mutations) automatically trigger a pause gate (`waiting_approval`) regardless of autonomy level unless explicitly bypassed in an L3 Owner-approved policy.

### 4. Emergency Freeze & Kill Switch
- Both Organization-level (`emergency_stop_all: true`) and Task-level (`emergency_stopped_at: timestamp`) kill switches exist.
- An emergency stop cancels all currently leased runs, interrupts executing worker loops, and blocks any new triggers from launching.

### 5. Multi-Tenant Isolation
- Every query, trigger, lease, run, checkpoint, and event is filtered by `organization_id` and `workspace_id`.
- Foreign keys strictly enforce referential integrity across tenant boundaries with cascading cleanup or restrict semantics.
