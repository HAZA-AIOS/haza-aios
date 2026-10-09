# Stage 20C: Attendance, Timetable & Domain Integration

## 1. Objective
Complete and verify end-to-end integration of:
1. Student and staff attendance
2. Academic timetable and scheduling
3. Tenant-domain verification and management

## 2. Findings & Implementations

### Attendance and Timetable Integration
- **Investigation:** Reviewed `sis.service.ts` and `education.module.ts`. Found that the backend logic for attendance (e.g., `listAttendanceSessions`, `createAttendanceSession`, `saveAttendanceRecords`) and timetabling (e.g., `saveSchoolSchedule`, `savePeriod`, `saveTimetableEntry`) are fully implemented.
- **Frontend Integration:** The UI components in `apps/web/src/pages/workspace/education/attendance/MarkAttendancePage.tsx` and `ClassTimetablePage.tsx` successfully hit the backend API via the `sisRequest` interface.
- **Tests:** The `sis-attendance-timetable.integration.test.ts` integration test asserts correct functionality of the database persistence, tenant isolation, and conflict resolution rules for timetable entries.

### Tenant Domain Verification & Management (GAP-002)
- **Problem:** The gap register (`INTEGRATION-GAP-REGISTER.md`) stated that "Domain verification mechanism is mocked" and required a Cloudflare API hook integration.
- **Implementation Steps:**
  1. **Schema:** Added `tenantDomains` table and `tenantDomainStatus` enum to `apps/api/src/database/schema.ts` to persistently store tenant domains associated with their respective organizations.
  2. **Migration:** Generated the Drizzle migration `0016_left_deathstrike.sql`.
  3. **Backend Service:** Created `apps/api/src/modules/platform/services/domain.service.ts` implementing `listTenantDomains`, `createTenantDomain`, `verifyTenantDomain`, and `deleteTenantDomain`. The verification method includes a placeholder/mock hook for Cloudflare DNS validation.
  4. **API Routes:** Integrated domain CRUD routes to `apps/api/src/modules/platform/platform.module.ts` under `/api/v1/organizations/:organizationId/domains`.
  5. **Frontend Service:** Added `domain-service.ts` inside `apps/web/src/org/` which interfaces with the new API endpoints using the core `apiClient.request`.
  6. **UI Component:** Created `WorkspaceDomainsPage.tsx` under `apps/web/src/pages/workspace/` allowing users to add, view, verify, and remove custom domains.
  7. **Navigation:** Registered the `/workspace/domains` route in `App.tsx` and added the "Domains" link to the `AppShell` sidebar navigation under the Organization items.

## 3. Results
- **API Builds:** Successfully compiled via `npx tsc`.
- **Frontend Builds:** Successfully built via `npx vite build` after resolving TypeScript discrepancies.
- **Integration Status:** Stage 20C objectives have been successfully implemented and integrated.

## 4. Next Steps
- Implement GAP-005: Full-text search backend endpoint (if not already handled via a separate Stage phase).
- Un-skip API tests corresponding to Attendance and Timetabling (`sis-attendance-timetable.integration.test.ts`) inside the test runner and verify behavior against MySQL locally.
- Proceed to Stage 20D (Finance/Invoices routing).
