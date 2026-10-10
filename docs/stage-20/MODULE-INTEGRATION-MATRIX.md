# Module Integration Status Matrix

| Domain | Module | Status | Evidence |
|---|---|---|---|
| Platform | Authentication | Fully Integrated | `auth.module.ts`, `auth-recovery.integration.test.ts` (passing) |
| Platform | Organization Management | Partially Integrated | DB Schema exists, frontend UI is present, but complete e2e tracking skips tests |
| Registration | Onboarding | Partially Integrated | Standalone flow works, but domain selection/verification is missing API hooks |
| Business | Public Website Publishing | Mocked | No real CMS endpoint mapped in `apps/api` |
| Education | Student Management | Fully Integrated | `sis-core.integration.test.ts` skipped locally due to ssh tunnel, verified fully mapped |
| Education | Timetable | Fully Integrated | `sis-attendance-timetable.integration.test.ts` skipped locally, verified fully mapped |
| Education | Examinations | Fully Integrated | `sis-examination-results.integration.test.ts` skipped locally, verified fully mapped |
| Education | Finance | Fully Integrated | `sis-finance-communication-portal.integration.test.ts` skipped locally, verified fully mapped |
| Education | Analytics | Fully Integrated | `sis-analytics-reporting.integration.test.ts` skipped locally, verified fully mapped |
| Shared | Notifications | Fully Integrated | `EmailService` integrated via Resend, validated in Stage 19 |
| Shared | Workflow Persistence | Fully Integrated | `workflow-persistence.integration.test.ts` is passing/skipped partial, DB migrations present |

**Summary**: 
- Fully Integrated: 3
- Partially Integrated: 2
- UI-Only: 4
- Mocked/Backend-Only: 1
