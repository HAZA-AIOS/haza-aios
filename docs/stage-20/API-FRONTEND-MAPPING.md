# API to Frontend Integration Mapping

## 1. Authentication
- **Page**: `LoginPage.tsx`, `ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx`
- **Backend Route**: `POST /api/v1/auth/login`, `/api/v1/auth/forgot-password`
- **Status**: Integrated. Tenant context correctly mapped, database queries work.

## 2. Workspace Overview
- **Page**: `WorkspaceOverviewPage.tsx`
- **Backend Route**: Missing dedicated `/api/v1/workspace/overview` metrics aggregator.
- **Status**: Currently displaying partial placeholder data.

## 3. Education / SIS Module
- **Page**: `StudentDirectoryPage.tsx`, `TeacherDirectoryPage.tsx`, `StudentAdmissionPage.tsx`, `StudentProfilePage.tsx`
- **Backend Route**: `/api/v1/organizations/:id/sis/students`, `/api/v1/organizations/:id/sis/staff`
- **Status**: Fully Integrated. Frontend service layer (`student.service.ts`, `staff.service.ts`) communicates via authenticated `sisRequest` and persisted via Drizzle repositories in `apps/api`.
- **Validation**: Verified end-to-end via `workflow-regression.integration.test.ts` and `sis-core.integration.test.ts`.

## 4. Admin
- **Page**: `AdminAuditLogPage.tsx`
- **Backend Route**: Integrated with `operational-service.ts` in `apps/web/src/operations`.
- **Status**: Fully Integrated backend layer (`operations.module.ts`).

### Stage 20D: Finance & Communication Integration
- **Finance APIs mapped to frontend features**: Invoice Management, Payments, Fee Categories, Student Ledgers
- **Communication APIs mapped**: Messaging, Announcements, Sent Receipts, In-app Notifications
- **Result**: Successfully integrated to backend services and exposed through tenant-scoped API routes.

### Stage 20E: Examinations & Analytics Integration
- **Examination APIs mapped to frontend features**: Exam Creation, Assessment Management, Mark Entry, Results Publishing, Grading Rules
- **Analytics APIs mapped**: Tenant-scoped overview, data quality, health metrics, and CSV reporting exports
- **Result**: Successfully integrated to backend services and exposed through tenant-scoped API routes. The UI consumes these routes fully.

### Stage 20F.3: End-to-End Workflow Regression
- **Coverage**: Organization/Workspace Lifecycle, Custom Domains, Student/Staff Lifecycles, Attendance/Timetable Scheduling, Invoicing/Payments/Ledger, Communication/Notifications, Examination Results Protection, and Analytics Reporting.
- **Verification**: 27/27 API suites (131 tests) and 34/34 Web suites (184 tests) passing.