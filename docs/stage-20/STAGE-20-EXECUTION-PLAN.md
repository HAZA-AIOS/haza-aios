# Stage 20 Execution Plan

## Pre-requisites
- All developers must pull `main` baseline (`ae8f0e5`).

## Sprint 20B: Core SIS Integration (P0)
- Resolve `GAP-001`. Connect `StudentDirectoryPage.tsx` and `TeacherDirectoryPage.tsx` to live backend data.
- Enforce tenant isolation (`business_id`) on all SIS queries.
- Un-skip and fix `sis-core.integration.test.ts`.

## Sprint 20C: Timetable & Attendance (P1)
- Connect `ClassTimetablePage.tsx` and `MarkAttendancePage.tsx`.
- Enable and pass `sis-attendance-timetable.integration.test.ts`.

## Sprint 20D: Finance & Communication (P2)
- Connect `InvoicesPage.tsx` and `AnnouncementsPage.tsx`.
- Enable `sis-finance-communication-portal.integration.test.ts`.

## Sprint 20E: Examinations & Analytics (P2) (COMPLETED)
- Verified `ExaminationResultsPage.tsx` and `SisAnalyticsPage.tsx` are fully integrated with backend endpoints.
- Tests unskipped but blocked due to database tunnel connection limits. 

## Sprint 20F: Final Validation & Testing Infrastructure (P1)
- Resolved `GAP-002` (Domain Verification).
- Resolved `GAP-006` (Implemented isolated local MySQL/MariaDB integration test runner with strict safety guard and comprehensive Stage 20F.2 multi-tenant RBAC security suite).
