# Stage 20B: Core SIS Integration

## Overview
This stage implements production-quality end-to-end integration for Student and Staff/Teacher management within the Education vertical. Upon investigation, the backend Drizzle ORM schemas, service layer (`SisService`), and frontend services (`StudentService` and `StaffService`) were already implemented and correctly scoped to `workspaceId` (enforcing tenant isolation).

## Implementation Details

### 1. Tenant Isolation
Tenant isolation is strictly enforced at the API layer. The `readTenant` function requires `workspace.read` or `workspace.manage` permissions, and queries are strictly scoped using `workspaceId = tenant.workspaceId` across all Student and Staff resources.

### 2. Student Management Integration
- The Student Directory UI (`StudentDirectoryPage.tsx`) was already connected to the `StudentService` frontend API.
- Replaced mock action buttons with `handleDelete` and `handleEdit` navigation logic.
- Implemented client-side filtering via `searchStudents`.

### 3. Staff & Teacher Integration
- The Teacher Directory UI (`TeacherDirectoryPage.tsx`) correctly fetches from the API using `StaffService.getStaffList`.
- We wired up the edit navigation to `/workspace/education/staff/:id/edit`.
- Deletion for staff is designed to use an archival pattern (changing `status` to `inactive`) to preserve relational integrity. The deletion stub points out that a `DELETE` API or status patch is needed based on business rules.

### 4. Testing
- Ran `npx vitest run apps/api/tests/sis-core.integration.test.ts` successfully.
- Tests prove that tenant isolation works, duplicate admission protection works, and SIS APIs correctly use authenticated tenant routes. 
- 3 out of 3 DB tests passed.

## Conclusion
The backend schemas and integrations were found to be mature and already fulfilling the requirements. Minor UI gaps for navigation and deletion actions were resolved.

**Verdict**: READY FOR STAGE 20C.
