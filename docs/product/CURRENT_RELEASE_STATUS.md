# HAZA-AIOS — Current Release & Roadmap Status

**As of:** 2026-11-01  
**Production tag:** `v0.17.0-epic17`  
**Source repository:** `HAZA-AIOS/haza-aios`  
**Next epic:** **18 — scope pending approval** (not started)

## Production deployment

| Component | Status | Notes |
| --- | --- | --- |
| Web | Online at https://www.haza-aios.com | Railway production |
| API | Online at https://api.haza-aios.com | Railway production |
| Worker | Online | Dedicated continuous queue-processing service |
| MySQL | Online | Railway production; migration `0027_agent_knowledge_context_engine.sql` reported applied |

The Epic 17 release report records successful API/Web health checks, migration verification, and synthetic data cleanup. These are reported point-in-time observations, not a guarantee of continuous uptime.

## Delivered agent roadmap

| Epic | Scope | Delivery status |
| --- | --- | --- |
| 11 | AI Agent Platform Foundation | Production released (`v0.11.0-epic11`) |
| 12 | Agent Registry & Marketplace | Production released (`v0.12.0-epic12`) |
| 13 | Agent Configuration & Builder | Production released (`v0.13.0-epic13`) |
| 14 | Agent Runtime & Execution | Production released (`v0.14.0-epic14`) |
| 15 | First Production AI Agent — Academic Planning Assistant | Production released (`v0.15.0-epic15`) |
| 16 | Agent Tools & Organizational Data Integration | Production released (`v0.16.0-epic16`) |
| 17 | Agent Knowledge & Context Engine | Production released (`v0.17.0-epic17`) |
| **18** | **Next milestone, scope pending approval** | **Not started** |

## Epic 16 evidence and release summary

- GitHub PR was merged into `main`; release tag `v0.16.0-epic16` created.
- Automated tests: **368 API + 292 Web = 660/660 passing**; gateway security benchmarks: **15/15**.
- Production migration: **0026**, creating `ai_agent_tools`, `ai_agent_tool_versions`, `ai_agent_tool_tenant_policies`, and `ai_agent_tool_executions`.
- Production verification covers autonomous agent tool calling loop, zero student PII access guarantee, sovereign tenant tool policies, and mandatory human approval gates for high-risk operations (`education.lesson_plans.publish`).
- **Inference mode:** the OpenAI adapter and tool function calling support exist. Fallback to deterministic mock is maintained with transparent provider mode attribution.

## Epic 17 evidence and limitations

- GitHub PR #53 merged to main at `ad76dcfd4ecdf07f04f6ec92325a28ce8feefae8`. Annotated tag `v0.17.0-epic17` targets commit `ede2e06ce8dcd71bef5d5ba692bf138ddc9904a9`.
- Release report: 386 API tests + 292 Web tests = **678 passing**; **8/8 production smoke steps**, six knowledge tables from migration 0027.
- Delivered knowledge components reported: document extraction/chunking, tenant-scoped knowledge collections, embeddings interface with deterministic fallback, hybrid retrieval, citation validation, trusted `knowledge.search` tool, and knowledge workspace.
- **Verification boundary:** The eight-step smoke transcript establishes service/database and synthetic data checks, but does not independently demonstrate a real embedding-provider search, upload-to-cited-answer lifecycle, or document-deletion invalidation. Mock deterministic vectors must not be described as proven semantic understanding.
- Next epic is **18**, with scope not yet authorized.

## Sources of truth

1. Annotated release tags (`v0.17.0-epic17`, `v0.16.0-epic16`, `v0.15.0-epic15`, `v0.14.0-epic14`, etc.).
2. Applied database migrations in `apps/api/src/database/migrations/`.
3. Verified Railway deployment logs and service health endpoints.
