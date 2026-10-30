# HAZA-AIOS — Current Release & Roadmap Status

**As of:** 2026-10-30  
**Production tag:** `v0.15.0-epic15`  
**Source repository:** `HAZA-AIOS/haza-aios`  
**Next epic:** **16 — Agent Tools & Organizational Data Integration** (planned, not implemented)

## Production deployment

| Component | Status | Notes |
| --- | --- | --- |
| Web | Online at https://www.haza-aios.com | Railway production |
| API | Online at https://api.haza-aios.com | Railway production |
| Worker | Online | Dedicated continuous queue-processing service |
| MySQL | Online | Railway production; migration `0025_academic_lesson_plans.sql` reported applied |

All four services were independently checked online on 2026-10-30, with no critical or warning issues and no pending deployments. This status is a point-in-time observation, not a permanent uptime guarantee.

## Delivered agent roadmap

| Epic | Scope | Delivery status |
| --- | --- | --- |
| 11 | AI Agent Platform Foundation | Production released (`v0.11.0-epic11`) |
| 12 | Agent Registry & Marketplace | Production released (`v0.12.0-epic12`) |
| 13 | Agent Configuration & Builder | Production released (`v0.13.0-epic13`) |
| 14 | Agent Runtime & Execution | Production released (`v0.14.0-epic14`) |
| 15 | First Production AI Agent — Academic Planning Assistant | Production released (`v0.15.0-epic15`) |
| **16** | **Agent Tools & Organizational Data Integration** | **Next — not started** |
| 17 | Agent Knowledge & Context Engine | Planned |

## Epic 15 evidence and limitations

- GitHub PR **#50** was reported merged; release tag `v0.15.0-epic15` was independently compared against `v0.14.0-epic14`: **4 commits ahead, 32 changed files**.
- Reported automated tests: **351 API + 289 Web = 640/640 passing**; reported pedagogical benchmarks: **14/14**.
- Reported production migration: **0025**, creating the `academic_lesson_plans` table.
- Reported production smoke checks cover unattended worker generation, validated 17-field lesson-plan output, draft edits, teacher approval, explicit LMS publishing, export, and cross-tenant rejection. The test outcomes are from the Epic 15 execution report and were not independently rerun for this documentation update.
- **Inference mode:** the OpenAI adapter exists, but the Epic 15 report states that `OPENAI_API_KEY` is not provisioned in the API/worker production services. Generation falls back to a deterministic mock, with provider mode attribution. Live paid inference remains an activation and verification dependency; never present it as tested or enabled.
- Human-supervised educational drafting is delivered; no unrestricted access to student records or autonomous grading is claimed.

## Epic 16 scope boundary (planning only)

The next epic should design and implement permission-gated tools and organizational-data access, including tenant-scoped connectors, allowlisted operations, tool input/output schemas, policy checks, audit trails, approval gates, and secure failure handling. It must not assume blanket access to SIS data or silently introduce cross-tenant queries. This is a planning direction, **not a claim of delivered Epic 16 features**.

## Versioning and workflow

The authoritative production release identifier is the annotated Git tag `v0.15.0-epic15`. The root `package.json` currently declares workspace package version `0.1.0`; this documentation-only change intentionally does not modify package manifests, lockfiles, deployment artifacts, database schema, or the production release tag.

Historical DB retrofit phases (DB-0–DB-18) are separate from the agent Epic 11–17 roadmap. Some older README sections describe the former `develop` workflow or prototype state; the current production release follows PRs to `main` and release tags.

## Sources of truth

- [Epic 15 release tag](https://github.com/HAZA-AIOS/haza-aios/releases/tag/v0.15.0-epic15)
- [Epic 15 pull request](https://github.com/HAZA-AIOS/haza-aios/pull/50)
- [CHANGELOG](../../CHANGELOG.md)
- [Repository README](../../README.md)
