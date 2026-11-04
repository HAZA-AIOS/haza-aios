# HAZA-AIOS — EPIC 21: SECURITY MATRIX
## Telemetry Privacy, Secret Redaction & Multi-Tenant Access

---

## 1. Multi-Tenant Telemetry Isolation

All observability entities, spans, evaluation suites, SLOs, and incident records are strictly bounded by `organization_id`:

| Entity | Isolation Enforcement | Key Constraints |
|---|---|---|
| `agent_trace_spans` | `organization_id` foreign key & indexed | Spans cannot be searched or viewed cross-tenant |
| `agent_evaluation_datasets` | `organization_id` foreign key | Benchmark sets private to school organization |
| `agent_evaluation_cases` | `dataset_id` cascading delete & `organization_id` | Test cases isolated |
| `agent_evaluation_runs` | `organization_id` foreign key | Benchmark results cannot leak cross-tenant |
| `agent_slo_definitions` | `organization_id` foreign key | Custom tenant SLO thresholds |
| `agent_reliability_metrics` | `organization_id` foreign key & window indexed | Telemetry isolated |
| `agent_alert_rules` | `organization_id` foreign key | Alert definitions scoped to tenant |
| `agent_incidents` | `organization_id` foreign key & status indexed | Incident management strictly private |

---

## 2. Telemetry Masking & Zero Secret Leakage

1. **Credential Scrubbing:** API keys (`sk-...`), bearer tokens, basic auth credentials, and passwords in span attributes, event payloads, and logs are automatically replaced with `[REDACTED]`.
2. **Export Sanitization:** Exported operational reports (CSV/JSON) exclude raw prompt texts and private environment variables.
3. **No Direct SQL Execution:** Spans are recorded exclusively through typed ORM repository methods with parameterized statements.
4. **Least-Privilege RBAC:** Only authorized roles (`admin`, `owner`, `supervisor`) can manage alert rules, acknowledge incidents, or run benchmarks.

