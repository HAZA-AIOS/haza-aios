# HAZA-AIOS — Isolated Demo Academy Import & Epic 17 RAG Acceptance

## Authorization and scope

Owner approved continuing with a **new dedicated fictional demo organization**, not the real school organization. This document is an implementation specification, **not a claim that records have been inserted or acceptance has passed**.

**Existing baseline:** `v0.17.0-epic17`. Preserve release tag and production migrations. PR #55 merged fictional catalog (`apps/api/src/database/fixtures/epic17-learning-demo.json`) and zero-write preview (`scripts/preview-epic17-learning-fixtures.mjs`).

## Required execution sequence

1. Inspect real organization creation, tenant/workspace provisioning, Education SIS, LMS domain services, Knowledge API, and seed policy. Do not invent unsupported API endpoints or database columns.
2. Check Railway API/worker rollout has fully settled before any API tests. Confirm deployment SHA and schema.
3. Implement a reusable, **idempotent, authenticated demo provisioning/import tool** that uses existing service layer, not raw direct SQL inserts for business records.
4. Prefer isolated staging/test database. If the system only offers production, create a dedicated explicitly marked **HAZA-AIOS Demo Academy (FICTIONAL)** organization and workspace using the normal authorized admin workflow. No production changes to existing tenant records.
5. All writes require: validated target organization ID, workspace ID, verified fictional/demo status, current authenticated administrator, per-section dry-run preview, explicit `--apply` flag, and audit logging. Default is dry-run. Abort if the organization already contains real users/students or is not demonstrably a demo tenant.
6. Import the 31 fixture entries through supported academic/LMS APIs, respecting parent dependencies (year → grade → section → subject → unit → lesson → activity → assignment → assessment). Do not claim all 31 sections are persisted if some modules lack corresponding APIs; report supported/unsupported mappings.
7. Use synthetic identifiers and stable external fixture keys to ensure a second run creates zero duplicates. Avoid real email, phone, guardian or student PII.
8. Import the fictional Cells Reference Note via the authenticated `/api/v1/organizations/:organizationId/knowledge/upload` endpoint or the existing `KnowledgeService.uploadAndIngestDocument` domain path. Preserve source ID, chunk ID, provider mode and provenance.
9. Search via the authenticated knowledge search route; require a real source/chunk reference for the answer `What structures do plant and animal cells share?`. Test authorized teacher, unauthorized user, second tenant, revoked permission, and archived/deleted source.
10. Run the Academic Planning Assistant against the ingested source and validate citations. Distinguish mock fallback from live embedding and inference. Never claim paid-model RAG is tested without a configured live provider and actual successful calls.
11. Execute all API/web tests, new import and RAG acceptance tests, and check deployment/worker logs. Use fictional records only. Record PASS/FAIL, timestamps, tenant IDs (non-secret), source/chunk IDs, counts, evidence, provider mode, cleanup and limitations.
12. Keep the demo tenant only after verified segregation and import success; otherwise roll back synthetic records with audited cleanup. Do not modify existing production tenant records.

## Acceptance gates

- CI green, API/worker/web/MySQL settled and healthy.
- A real dedicated fictional organization/workspace provisioned with normal access controls, **or** an isolated staging environment.
- All 31 fixture sections mapped to real features or explicitly marked unsupported.
- Actual supported records visible in corresponding LMS views, with DEMO/FICTIONAL labels.
- Re-run import is idempotent; no duplicates.
- RAG upload → extraction → chunks → authorized retrieval → validated citation demonstrated.
- Cross-tenant/private access and deleted-source retrieval fail closed.
- Provider mode disclosed (mock versus live).
- No real school records touched.
- PR reviewed/merged only after CI; release tag unchanged unless a separate versioned production code release is explicitly justified.

## Important observations from code inspection

- `apps/api/src/database/seed/seed-policy.ts` sets `productionAutoSeedAllowed: false`; do not relax it.
- `knowledge.module.ts` exposes authenticated upload and search routes.
- `KnowledgeService.uploadAndIngestDocument` currently stores document payloads in durable database storage and may use a deterministic embedding fallback. Test exact production behavior rather than assuming live embeddings.
- Railway API and worker were **deploying** at last inspection after PR #55 merge. Wait for healthy settled deployment before production acceptance.

## Required final evidence

Report GitHub PR and commit, actual import target, supported section mapping, record counts, dry-run and applied results, UI checks, RAG citations, authorization failures, test totals, deployment status, and unresolved blockers. Do not mark success until independently observed.
