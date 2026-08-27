# DB-7 Examination, Assessment & Results Persistence

## Scope

DB-7 migrates the examination, assessment, marks, grading, and result publication domain from browser-local authority to the existing HAZA API and MySQL persistence architecture.

## Added Persistence

- `examinations`
- `examination_subjects`
- `assessments`
- `grading_rules`
- `mark_records`
- `result_publications`

All records are scoped by `workspace_id`, with tenant resolution still derived from organization context through the existing SIS workspace service.

## API Surface

Routes were added under `/api/v1/organizations/:organizationId/sis` for examinations, subjects, assessments, grading rules, marks, calculated class results, result publications, student result lookup, and subject performance.

## Frontend Migration

`apps/web/src/modules/education/sis/examination.service.ts` now delegates to the SIS API through `sisRequest`. It no longer treats localStorage collections as authoritative runtime state.

## Guardrails

- Existing Epic 10F UI is not redesigned.
- Workspace layout standardization from DB-6 remains unchanged.
- Tenant isolation is enforced by workspace-scoped queries.
- Published examination results block silent mark mutation.
- Result publications persist calculated result-card data as JSON for the current SIS experience.
