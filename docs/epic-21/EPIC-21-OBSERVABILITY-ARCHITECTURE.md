# HAZA-AIOS — EPIC 21: OBSERVABILITY ARCHITECTURE
## Distributed Tracing, Span Trees & Structured Telemetry

---

## 1. W3C TraceContext & Correlation ID Standard

HAZA-AIOS adopts OpenTelemetry and W3C `traceparent` standards for cross-service and distributed agent executions:

```
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
              │  └───────────────┬───────────────┘ └───────┬───────┘ └─┬─┘
           version           trace-id                   parent-id     flags
```

- **Trace ID (`traceId`):** 32-character hexadecimal string uniquely identifying an entire execution request from the initial user prompt, API dispatch, or scheduled autonomous trigger.
- **Span ID (`spanId`):** 16-character hexadecimal string identifying a discrete segment of work.
- **Parent Span ID (`parentSpanId`):** References the immediate parent span, forming an acyclic tree of nested operations.
- **Trace Flags (`traceFlags`):** Sampling decision bitmask (`01` = sampled).

---

## 2. Distributed Execution Span Tree

Every asynchronous multi-agent or autonomous workflow forms a hierarchical tree of spans:

```
[Trace: 4bf92f3577b34da6a3ce929d0e0e4736]
 └── [Span: 00f067aa0ba902b7] workflow.run (Grade 6 Science Planning) [2450ms]
      ├── [Span: a1b2c3d4e5f60718] step.execute (step_plan) [650ms]
      │    ├── [Span: 1122334455667788] agent.reasoning (Curriculum Planner) [450ms]
      │    │    └── [Span: 99aabbccddeeff00] provider.completion (gpt-4o) [420ms]
      │    └── [Span: 2233445566778899] tool.call (academic_standards_search) [180ms]
      ├── [Span: b2c3d4e5f6071819] step.execute (step_draft) [1100ms]
      │    ├── [Span: 33445566778899aa] agent.reasoning (Lesson Specialist) [950ms]
      │    │    └── [Span: aabbccddeeff0011] provider.completion (gpt-4o) [910ms]
      │    └── [Span: 445566778899aabb] tool.call (lms_lesson_draft_save) [120ms]
      └── [Span: c3d4e5f607181920] step.execute (step_review) [700ms]
           └── [Span: 5566778899aabbcc] human_approval.wait [Paused]
```

---

## 3. Span Attributes & Schema Normalization

Every span stored in `agent_trace_spans` conforms to a normalized attribute schema:

| Attribute | Type | Description |
|---|---|---|
| `trace_id` | varchar(64) | 32-hex global trace identifier |
| `span_id` | varchar(64) | 16-hex discrete span identifier |
| `parent_span_id`| varchar(64) | Parent span reference (null for root) |
| `name` | varchar(120) | Span operation name (`workflow.run`, `agent.reasoning`, `tool.execute`, etc.) |
| `kind` | varchar(30) | OpenTelemetry span kind (`internal`, `client`, `server`, `producer`, `consumer`) |
| `status` | varchar(20) | Execution outcome (`ok`, `error`, `unset`) |
| `status_code` | int | Normalized HTTP or domain status code (200, 429, 500) |
| `status_message`| text | Safe, sanitized error message if failed |
| `duration_ms` | int | Wall-clock execution duration in milliseconds |
| `start_time` | timestamp(3)| Start timestamp with millisecond precision |
| `end_time` | timestamp(3)| Completion timestamp with millisecond precision |
| `attributes` | json | Sanitized metadata (model, tokens, temperature, tool parameters) |
| `events` | json | In-span lifecycle logs and exceptions with timestamps |

---

## 4. Deep Secret Redaction Engine

Telemetry ingestion applies recursive regex scrubbing to prevent credential leakage:
- OpenAI API Keys: `sk-[a-zA-Z0-9]{20,}` -> `sk-...REDACTED`
- Generic Bearer Tokens: `Bearer [a-zA-Z0-9._\-]{20,}` -> `Bearer ...REDACTED`
- Database Connection Strings: `mysql://...` -> `mysql://[USER]:[REDACTED]@[HOST]/...`
- Private Prompt Fields: Passwords, social security numbers, private student identifiers scrubbed.

