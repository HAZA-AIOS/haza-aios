# API to Frontend Integration Mapping

## 1. Authentication
- **Page**: `LoginPage.tsx` / `ForgotPasswordPage.tsx` / `ResetPasswordPage.tsx`
- **Backend Route**: `POST /api/v1/auth/login`, `/api/v1/auth/forgot-password`
- **Status**: Integrated. Tenant context correctly mapped, database queries work.

## 2. Workspace Overview
- **Page**: `WorkspaceOverviewPage.tsx`
- **Backend Route**: Missing dedicated `/api/v1/workspace/overview` metrics aggregator.
- **Status**: Currently displaying partial placeholder data.

## 3. Education / SIS Module
- **Page**: `StudentDirectoryPage.tsx`, `TeacherDirectoryPage.tsx`
- **Backend Route**: `/api/v1/education/students` (not fully implemented in controller layer)
- **Status**: Broken/Missing links. The frontend component relies on hardcoded placeholder data. Database access layer exists in Drizzle schemas but lacks integration with the `education` module routes.

## 4. Admin
- **Page**: `AdminAuditLogPage.tsx`
- **Backend Route**: Integrated with `operational-service.ts` in the `apps/web/src/operations`.
- **Status**: Fully Integrated backend layer (`operations.module.ts`).
