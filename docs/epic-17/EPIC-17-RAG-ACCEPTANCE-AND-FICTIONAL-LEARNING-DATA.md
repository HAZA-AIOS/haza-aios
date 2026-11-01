# Epic 17 — Fictional Learning Data & RAG Acceptance Package

**Status:** Fixture content prepared in GitHub; not inserted into a live database.  
**Source:** `apps/api/src/database/fixtures/epic17-learning-demo.json`  
**Coverage:** 31 learning, academic, and knowledge sections.

## Safety and environment

- All school, student, teacher, classes, grades, scores, attendance and certificates are **fictional**.
- The existing `apps/api/src/database/seed/seed-policy.ts` explicitly sets `productionAutoSeedAllowed: false`. Respect it.
- The JSON is a **domain-neutral fixture catalog**, not an executable migration or direct SQL seed. Never bypass existing domain services, tenant policies, or authorization to import it.
- The identifiers `DEMO-ORG-ONLY` and `DEMO-WORKSPACE-ONLY` are placeholders, **not valid production IDs**. Resolve a dedicated demo tenant through the existing authenticated admin provisioning workflow.
- Do not inject this data into a real school's workspace or a production tenant without a separate preview, validation, and explicit confirmation of the exact target tenant.
- Never create actual user accounts or issue certificates using these fixture strings without authorized test-only provisioning.

## Required acceptance run (Antigravity / existing app)

1. Confirm PR #54 is merged and current baseline tag remains `v0.17.0-epic17`.
2. Use a separate isolated test database or explicitly designated demo tenant. Confirm real customer records are absent.
3. Map fixture sections to actual learning module routes and entities; record unsupported sections. **Do not invent database columns or endpoints.**
4. Build an idempotent import adapter using existing Education SIS/LMS and Knowledge services. Validate all records; enforce tenant and resource permissions.
5. Preview record counts, per-section destinations, and proposed changes before import. Default dry-run; no automatic production writes.
6. Import only supported records into isolated test/demo environment. Mark all visible entities `FICTIONAL / DEMO`; use stable import keys to avoid duplication.
7. Upload or ingest the original `knowledge-sources` content via the application's authorized knowledge ingestion route (not by directly inserting chunks).
8. Query: **What structures do plant and animal cells share?** Check that the answer cites the *actual ingested source ID/chunk*, not the expected-result text or fabricated citation.
9. Query with a different tenant and an unauthorized user: ensure neither can access the source. Test revoked permission and deleted/archived source.
10. Test both deterministic fallback and, **only if configured**, live embedding/inference modes; report which was exercised.
11. Validate ingestion, search, citations, UI rendering, counts, test results, cleanup and zero effect on real school data.
12. Keep fixture data in the demo tenant only if the owner explicitly approves the target and retention policy; otherwise clean up synthetic records.

## Acceptance criteria

- 31 fictional sections available as source fixtures; every actual supported learning section has a documented mapping.
- Zero writes to a real school's records.
- No duplicates after a second import.
- Authorized RAG retrieval returns real source references; cross-tenant and unauthorized retrieval return no content.
- Unsupported learning sections are reported rather than silently claimed as seeded.
- All production release tags, services, and migrations remain unchanged.

## Proposed follow-up implementation

Create a dedicated importer and tests in a separate code PR after mapping existing domain contracts. Do not turn fixture catalog into a production auto-seed.
