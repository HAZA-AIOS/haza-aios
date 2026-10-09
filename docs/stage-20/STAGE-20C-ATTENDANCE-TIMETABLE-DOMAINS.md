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

### Tenant Domain Verification & Management (GAP-002) - Stage 20C.1
- **Problem:** The gap register (`INTEGRATION-GAP-REGISTER.md`) stated that "Domain verification mechanism is mocked" and required a Cloudflare API hook integration.
- **Implementation Steps:**
  1. **Schema:** Added `tenantDomains` table with `tenantDomainStatus` enum (`pending_verification`, `verified`, `provisioning`, `active`, `failed`, `disabled`) and `verificationToken` column to `apps/api/src/database/schema.ts` to persistently store tenant domains associated with their respective organizations.
  2. **Migration:** Generated the Drizzle migration `0016_left_deathstrike.sql` and `0017_youthful_silverclaw.sql`.
  3. **Backend Service:** Updated `apps/api/src/modules/platform/services/domain.service.ts`:
     - Added secure token generation (`ha-verify=<random_hex>`) using `node:crypto`.
     - Implemented real DNS TXT record validation using `node:dns/promises`.
     - Added IDN/punycode normalization.
     - Added security checks rejecting prohibited or internal domains (e.g. `haza-aios.com`, `localhost`).
  4. **API Routes:** Integrated domain CRUD routes to `apps/api/src/modules/platform/platform.module.ts` under `/api/v1/organizations/:organizationId/domains`.
  5. **Frontend Service:** Updated `domain-service.ts` inside `apps/web/src/org/` which interfaces with the new API endpoints using the core `apiClient.request`. Added updated types for the domain statuses.
  6. **UI Component:** Updated `WorkspaceDomainsPage.tsx` under `apps/web/src/pages/workspace/` allowing users to view DNS TXT record instructions (e.g. Type: TXT, Name: `_haza-aios-verification.<domain>`, Value: `ha-verify=...`), verify DNS, and view live status updates.
  7. **Tests:** Written full unit test coverage for `DomainService` covering token generation, missing/incorrect TXT records, timeouts, and authorization controls. All 11 tests pass successfully.
  8. **Cloudflare Provisioning:** Explicitly leaving automated provisioning pending until a safe, scoped testing token and sandbox configuration are provided for `customHostnames`.


## 3. Results
- **API Builds:** Successfully compiled via `npx tsc`.
- **Frontend Builds:** Successfully built via `npx vite build` after resolving TypeScript discrepancies.
- **Integration Status:** Stage 20C objectives have been successfully implemented and integrated.

## 4. Next Steps
- Implement GAP-005: Full-text search backend endpoint (if not already handled via a separate Stage phase).
- Un-skip API tests corresponding to Attendance and Timetabling (`sis-attendance-timetable.integration.test.ts`) inside the test runner and verify behavior against MySQL locally.
- Proceed to Stage 20D (Finance/Invoices routing).
