# HAZA AIOS — Epic 10N / Phase 2: Cross-Module Lifecycle & Transactional Integrity Report

**Document ID:** `HAZA-AIOS-EPIC10N-PHASE2-TRANSACTIONAL-001`  
**Repository:** `HAZA-AIOS/haza-aios`  
**Branch:** `feature/epic-10n-system-hardening`  
**Phase 1 Correction Commit:** `3f863d3e08586a3e214bd3eaf90a6d29588434f2`  
**Accepted Production Baseline:** `eb6c5d9df71c12a975b462418ae0d6fdf5a89113`  
**Date:** October 20, 2026  
**Status:** Completed, Verified & Hardened  

---

## 1. Executive Summary

Phase 2 of **Epic 10N: System Hardening & Cross-Module Auditing** remediates transactional integrity, cross-module lifecycle synchronization, and concurrency hazards identified during the system-wide architecture audit of HAZA AIOS:

1. **INT-001 (Concurrent Admissions Conversion with Row-Level Locking):** Enforces ACID transactional atomicity in `convertApplicationToEnrollment` (`sis-admissions.service.ts`). Serializes competing conversion attempts using row-level locking (`SELECT ... FOR UPDATE`) on the application row. Within the locked transaction snapshot, detects in-flight idempotency (returning existing student and enrollment records without duplicate writes). Implements atomic conditional status transitions with affected-row count verification (`affectedRows === 1`), rejecting conflicting conversion attempts with HTTP 409 Conflict.
2. **INT-002 (Student Archival Lifecycle Integrity & Atomic Guard):** Refactors `deleteStudent` (`sis.service.ts`) into an atomic lifecycle transition wrapped entirely in `withTransaction`. Enforces row-level locking on the student (`SELECT ... FOR UPDATE`), performs dues check under lock, and conditionally transitions student status (`SET student_status = 'archived' WHERE student_status != 'archived'`) verifying `affectedRows === 1`. Transitions all active enrollments to `dropped`. Recurring billing (`generateRecurringInvoices` in `sis-finance.service.ts`) explicitly excludes archived students, while historical attendance, grade, and exam records remain completely preserved alongside an immutable audit trail.
3. **INT-003 (Concurrent Section Transfer & Single Active Invariant):** Introduces a concurrency-safe, transactional `transferStudent` operation in `sis.service.ts`. Locks the student and active enrollment with `FOR UPDATE`. Conditionally transitions the active enrollment to `transferred` (`WHERE enrollment_status = 'active'`) with affected-row count check (`affectedRows === 1`), aborting before destination insertion if a concurrent transfer race occurs. Maintains the exact single active enrollment invariant and records a structured audit log entry.
4. **INT-004 (Concurrency-Safe Identifier Generation & Additive Migration):** Introduces additive migration `0019_portal_requests_unique_identifiers.sql` promoting `reference_number` and `application_number` to columns with workspace-scoped unique indexes `(workspace_id, reference_number)` and `(workspace_id, application_number)` on `portal_update_requests`. Sequences query existing numbers under `FOR UPDATE` and evaluate true numerical maximums via regex. Entity creation pipelines are protected by bounded retry loops (up to 12 attempts) with randomized jitter backoff, handling MySQL unique constraint collisions (`ER_DUP_ENTRY` / 1062), deadlocks (`ER_LOCK_DEADLOCK` / 1213), and lock timeouts (`ER_LOCK_WAIT_TIMEOUT` / 1205).

All Phase 2 modifications were developed and verified autonomously on the `feature/epic-10n-system-hardening` branch. The implementation is validated by a dedicated 20-test integration suite (`epic10n-transactional-integrity.integration.test.ts`), passes all regression suites (49 total passing tests across related modules), achieves 0 errors on TypeScript typechecking across both `api` and `web` workspaces, and produces clean production builds.

---

## 2. Technical Remediation Detail

### 2.1 INT-001: Atomic Admissions Conversion (`sis-admissions.service.ts`)

#### Problem Statement
Prior to Phase 2, `convertApplicationToEnrollment` executed multiple sequential, uncoordinated database operations across different service boundaries:
1. Student creation via `SisService.createStudent`
2. Enrollment creation via `SisService.createEnrollment`
3. Fee assignment creation via `SisFinanceService.assignFeeStructure`
4. Application status update in `portalUpdateRequests`

If an error occurred at step 2 or step 3 (e.g., fee structure constraint, validation error, or database timeout), orphan student records remained in the system, the application remained in `approved` status, and repeat requests failed due to duplicate student or unique identifier collisions. Additionally, concurrent requests could trigger duplicate conversions for the same applicant.

#### Implemented Solution
1. **Transaction Wrapping (`withTransaction`):**
   The entire conversion workflow is wrapped in `withTransaction(this.database, async ({ tx }) => { ... })`.
2. **Row-Level Locking (`FOR UPDATE`):**
   The application row is locked immediately upon transaction entry using raw SQL row-locking:
   ```typescript
   const [appRow] = await tx.execute<ApplicationRow>(
     sql`SELECT id, workspace_id as workspaceId, request_type as requestType, status,
                enrolled_student_id as enrolledStudentId, payload
         FROM portal_update_requests
         WHERE workspace_id = ${tenant.workspaceId} AND id = ${applicationId}
         FOR UPDATE`
   );
   ```
3. **In-Transaction Idempotency Guard:**
   Within the locked snapshot, if the application was already marked `enrolled`, the existing student and enrollment records are returned idempotently:
   ```typescript
   if (appRow.status === "enrolled" && appRow.enrolledStudentId) {
     const [existingStudent] = await tx
       .select()
       .from(students)
       .where(and(eq(students.workspaceId, tenant.workspaceId), eq(students.id, appRow.enrolledStudentId)))
       .limit(1);
     const [existingEnrollment] = await tx
       .select()
       .from(enrollments)
       .where(and(eq(enrollments.workspaceId, tenant.workspaceId), eq(enrollments.studentId, appRow.enrolledStudentId)))
       .limit(1);

     return {
       success: true,
       isExisting: true,
       student: existingStudent ? dto(tenant, existingStudent) : null,
       enrollment: existingEnrollment ? dto(tenant, existingEnrollment) : null,
       message: "Application is already enrolled. Existing student record returned.",
     };
   }
   ```
4. **Atomic Conditional Transition & Affected Rows Verification:**
   The application status update executes conditionally, verifying `affectedRows === 1`:
   ```typescript
   const [updateResult] = await tx.execute<ResultSetHeader>(
     sql`UPDATE portal_update_requests
         SET status = 'enrolled',
             enrolled_student_id = ${createdStudent.id},
             updated_at = NOW()
         WHERE workspace_id = ${tenant.workspaceId}
           AND id = ${applicationId}
           AND status != 'enrolled'`
   );
   if (updateResult.affectedRows !== 1) {
     throw new ApiError(409, "DATABASE_TRANSACTION_FAILED", "Application was concurrently enrolled by another transaction.");
   }
   ```
5. **Transaction-Bound Services & Rollback:**
   Downstream service instances (`SisService` and `SisFinanceService`) participate in `tx`. If any insertion fails, the entire transaction rolls back completely.

---

### 2.2 INT-002: Student Archival Lifecycle Integrity (`sis.service.ts` & `sis-finance.service.ts`)

#### Problem Statement
In educational ERP systems, deleting a student must never result in physical data deletion due to historical compliance, transcripts, and financial auditing requirements. Furthermore:
- Archiving a student while leaving enrollments marked `active` corrupted active class rosters, attendance roll-calls, and recurring tuition billing.
- Archiving a student with outstanding financial dues without administrative override bypassed billing controls and created untracked receivables.
- Unlocked concurrent archival requests could race against concurrent invoice payments or new enrollments.

#### Implemented Solution
1. **Row-Level Locking on Student (`FOR UPDATE`):**
   Archival begins by locking the student row inside `withTransaction`:
   ```typescript
   const [studentRow] = await tx.execute<{ id: string; status: string }>(
     sql`SELECT id, student_status as status FROM students
         WHERE workspace_id = ${tenant.workspaceId} AND id = ${id}
         FOR UPDATE`
   );
   ```
2. **Financial Dues Pre-Flight Check under Lock:**
   With the student locked, `deleteStudent` queries all invoices for the student via `SisFinanceService`. If unpaid, partially paid, or overdue invoices exist with a positive balance (`balanceCents > 0`), the operation is rejected unless `options?.forceWithOutstandingDues` is explicitly set to `true`:
   ```typescript
   if (unpaidInvoices.length > 0 && !options?.forceWithOutstandingDues) {
     throw new ApiError(
       400,
       "FINANCIAL_DUES_OUTSTANDING",
       `Cannot archive student with outstanding balance of $${(outstandingBalanceCents / 100).toFixed(2)} across ${unpaidInvoices.length} invoice(s). Must clear dues or supply explicit authorization override.`
     );
   }
   ```
3. **Atomic Status Synchronization & Affected Rows Verification:**
   Inside `withTransaction`, the student status is updated conditionally, verifying `affectedRows === 1`:
   ```typescript
   const [updateResult] = await tx.execute<ResultSetHeader>(
     sql`UPDATE students
         SET student_status = 'archived', updated_at = NOW()
         WHERE workspace_id = ${tenant.workspaceId}
           AND id = ${id}
           AND student_status != 'archived'`
   );
   ```
   If already archived, the operation completes idempotently. If transitioning, all active enrollments for the student within the workspace are marked `dropped`:
   ```typescript
   await tx
     .update(enrollments)
     .set({ status: "dropped", updatedAt: new Date() })
     .where(and(eq(enrollments.workspaceId, tenant.workspaceId), eq(enrollments.studentId, id), eq(enrollments.status, "active")));
   ```
4. **Recurring Billing Exclusion:**
   In `SisFinanceService.generateRecurringInvoices`, a safeguard was added to skip any student whose status is `archived`, preventing accidental ongoing invoice generation for departed students.
5. **Foreign-Key Safe Audit Logging:**
   Audit log entries verify the caller's `actorUserId` against the `users` table before insertion to prevent MySQL foreign key violations (`audit_logs_actor_user_id_users_id_fk`), recording comprehensive metadata including outstanding dues and override flags.
6. **Historical Data Preservation:**
   Attendance sessions, examination results, academic transcripts, and historical invoices remain fully intact in the database for historical and regulatory compliance.

---

### 2.3 INT-003: Atomic Section Transfer (`sis.service.ts`)

#### Problem Statement
When students transfer between sections (e.g., from Grade 1 Section A to Section B), manual status changes previously risked creating orphan active enrollments, overlapping section memberships, or failing to maintain an audit trail of transfers. Furthermore, concurrent transfer requests could create duplicate active enrollments in multiple sections.

#### Implemented Solution
1. **Row-Level Locking on Student & Active Enrollment (`FOR UPDATE`):**
   `transferStudent` locks both the student and their active enrollment within `withTransaction`:
   ```typescript
   const [studentRow] = await tx.execute<{ id: string; status: string }>(
     sql`SELECT id, student_status as status FROM students
         WHERE workspace_id = ${tenant.workspaceId} AND id = ${studentId}
         FOR UPDATE`
   );

   const [activeEnrollment] = await tx.execute<{
     id: string; workspaceId: string; studentId: string;
     academicYear: string; gradeId: string; sectionId: string; status: string;
   }>(
     sql`SELECT id, workspace_id as workspaceId, student_id as studentId,
                academic_year as academicYear, grade_id as gradeId, section_id as sectionId,
                enrollment_status as status
         FROM enrollments
         WHERE workspace_id = ${tenant.workspaceId}
           AND student_id = ${studentId}
           AND enrollment_status = 'active'
         LIMIT 1
         FOR UPDATE`
   );
   ```
2. **Destination Section & Grade Alignment Validation:**
   Validates that the student has status `active`, the destination section exists within the tenant's workspace, belongs to the student's target grade level, and is not identical to the current section.
3. **Atomic Conditional Transition & Affected Rows Verification:**
   The active enrollment transition to `transferred` executes conditionally with an affected-row count check:
   ```typescript
   const [updateResult] = await tx.execute<ResultSetHeader>(
     sql`UPDATE enrollments
         SET enrollment_status = 'transferred', updated_at = NOW()
         WHERE workspace_id = ${tenant.workspaceId}
           AND id = ${activeEnrollment.id}
           AND enrollment_status = 'active'`
   );
   if (updateResult.affectedRows !== 1) {
     throw new ApiError(409, "DATABASE_TRANSACTION_FAILED", "Enrollment status changed concurrently. Transfer aborted.");
   }
   ```
   If a competing transaction changed the active enrollment, the operation aborts **before** destination enrollment insertion, strictly enforcing the single active enrollment invariant.
4. **Destination Enrollment Creation & Audit Trail:**
   Inserts the new enrollment record with status `active` and records a structured `auditLogs` entry with action `student.section_transfer`, capturing `previousEnrollmentId`, `previousSectionId`, `newEnrollmentId`, and `newSectionId` in `beforeSnapshot` and `afterSnapshot`.

---

### 2.4 INT-004: Concurrency-Safe Identifier Generation & Additive Migration (`sis.service.ts` & `sis-admissions.service.ts`)

#### Problem Statement
Sequential identifiers (`TMS-YYYY-XXXXX`, `EMP-XXX`, `ENQ-YYYY-XXXXX`, `APP-YYYY-XXXXX`) were originally generated by counting rows: `rows.length + 1`. This pattern caused critical defects:
- Any gap created by manual entry, deletion, or non-sequential historical imports caused future generated IDs to collide with existing numbers.
- Under parallel execution, concurrent requests read the exact same count and attempted to insert identical numbers.
- In admissions, enquiry and application reference numbers were stored within unstructured JSON payloads (`portal_update_requests.payload`), lacking database-level unique indexes to prevent duplicate generation under high concurrency.

#### Implemented Solution
1. **Additive Schema Migration `0019_portal_requests_unique_identifiers.sql`:**
   Promoted `reference_number` and `application_number` to first-class columns on `portal_update_requests` with workspace-scoped unique indexes:
   ```sql
   ALTER TABLE `portal_update_requests` ADD COLUMN `reference_number` varchar(80);
   ALTER TABLE `portal_update_requests` ADD COLUMN `application_number` varchar(80);
   CREATE UNIQUE INDEX `portal_requests_workspace_ref_num_unique` ON `portal_update_requests` (`workspace_id`, `reference_number`);
   CREATE UNIQUE INDEX `portal_requests_workspace_app_num_unique` ON `portal_update_requests` (`workspace_id`, `application_number`);
   ```
2. **Row-Level Locking on Sequence Queries (`FOR UPDATE`):**
   Identifier generators query existing values under row-level locking (`FOR UPDATE`) to serialize concurrent sequence readers:
   - `nextAdmissionNumber`: locks existing admission numbers for the workspace and year.
   - `nextEmployeeNumber`: locks existing employee numbers for the workspace.
   - `nextEnquiryNumber`: locks existing enquiry reference numbers for the workspace and year.
   - `nextApplicationNumber`: locks existing application numbers for the workspace and year.
3. **True Max-Sequence Regex Parsing:**
   All identifier generators evaluate the true numerical maximum using precise regular expressions across both column-level and legacy JSON records:
   ```typescript
   const pattern = new RegExp(`^(?:TMS|ADM)-${year}-(\\d+)$`);
   let max = 0;
   for (const row of rows) {
     const match = pattern.exec(row.admissionNumber);
     if (match) {
       const num = parseInt(match[1], 10);
       if (num > max) max = num;
     }
   }
   return `TMS-${year}-${String(max + 1).padStart(5, "0")}`;
   ```
4. **Bounded Retry Loop with Randomized Jitter Backoff:**
   Entity creation operations (`createStudent`, `createStaff`, `createEnquiry`, `createApplication`) are wrapped in bounded retry loops (up to 12 attempts) with randomized jitter:
   ```typescript
   const maxRetries = 12;
   let attempt = 0;
   while (attempt < maxRetries) {
     attempt++;
     try {
       return await withTransaction(this.database, async ({ tx }) => {
         // Generate next sequence under lock and insert entity
       });
     } catch (error) {
       const isUniqueConstraint = isUniqueConstraintError(error);
       if (isUniqueConstraint && attempt < maxRetries) {
         await new Promise((resolve) =>
           setTimeout(resolve, Math.floor(Math.random() * 60) + attempt * 20)
         );
         continue;
       }
       throw error;
     }
   }
   ```
5. **Comprehensive Concurrency Error Detection:**
   `isUniqueConstraintError` recursively inspects nested `error.cause` objects and recognizes MySQL unique collisions (`1062`, `ER_DUP_ENTRY`), deadlocks (`1213`, `ER_LOCK_DEADLOCK`), and lock wait timeouts (`1205`, `ER_LOCK_WAIT_TIMEOUT`), ensuring smooth self-healing retries under high concurrency.

---

## 3. Verification & Test Evidence

### 3.1 Dedicated Integration Test Suite
File: `apps/api/tests/epic10n-transactional-integrity.integration.test.ts`  
Status: **20 / 20 Passed (100%)**

| Test Case | Target | Description | Result |
| :--- | :---: | :--- | :---: |
| `converts approved application to active enrollment transactionally` | INT-001 | Full end-to-end atomic conversion with fee assignment | **PASSED** |
| `handles idempotent repeated conversion attempts without duplicate writes` | INT-001 | Re-conversion returns existing student and enrollment | **PASSED** |
| `safely handles two competing simultaneous conversion requests without duplicate students or enrollments` | INT-001 | Parallel `Promise.all` competing conversion race test | **PASSED** |
| `rejects conversion of non-approved applications` | INT-001 | Rejects draft/pending applications with validation error | **PASSED** |
| `rolls back all writes if enrollment creation fails during conversion` | INT-001 | Verifies zero orphan records on simulated failure | **PASSED** |
| `archives student and transitions active enrollments to dropped in one atomic transaction` | INT-002 | Student archived, enrollment dropped, audit log created | **PASSED** |
| `prevents archival when student has unpaid invoices without explicit override` | INT-002 | Blocks archival on dues, permits with authorized override | **PASSED** |
| `safely handles concurrent archival requests without race conditions` | INT-002 | Parallel `Promise.all` competing archival race test | **PASSED** |
| `preserves historical attendance and exam records upon archival` | INT-002 | Attendance records remain queryable after student archive | **PASSED** |
| `operates idempotently on repeated student archival` | INT-002 | Repeat delete calls return idempotent success | **PASSED** |
| `transfers student between sections atomically and writes audit trail` | INT-003 | Old enrollment transferred, new active enrollment created | **PASSED** |
| `safely handles two competing simultaneous section transfers preventing duplicate active enrollments` | INT-003 | Parallel `Promise.all` competing transfer race test | **PASSED** |
| `rejects transfer to non-existent section or section belonging to another grade` | INT-003 | Enforces section validity and grade consistency | **PASSED** |
| `rejects transfer of archived or inactive student` | INT-003 | Blocks transfer attempts on inactive student | **PASSED** |
| `allocates unique non-colliding admission numbers under parallel creation` | INT-004 | 10 parallel student creations with zero collisions | **PASSED** |
| `allocates unique non-colliding employee numbers under parallel staff creation` | INT-004 | 8 parallel staff creations with zero collisions | **PASSED** |
| `allocates unique non-colliding enquiry reference numbers under parallel creation` | INT-004 | 8 parallel enquiry creations with zero collisions | **PASSED** |
| `allocates unique non-colliding application numbers under parallel creation` | INT-004 | 8 parallel application creations with zero collisions | **PASSED** |
| `correctly calculates next identifier sequence across gaps from non-sequential records` | INT-004 | Calculates next sequence based on true numerical max | **PASSED** |
| `scopes identifier allocation per tenant without cross-tenant collisions` | INT-004 | Multi-tenant sequence isolation verified | **PASSED** |

### 3.2 Regression Test Suites
All existing integration test suites were executed to confirm backward compatibility:
- `apps/api/tests/sis-admissions.integration.test.ts`: **3 / 3 Passed (100%)**
- `apps/api/tests/sis-core.integration.test.ts`: **3 / 3 Passed (100%)**
- `apps/api/tests/epic10n-security-hardening.integration.test.ts`: **27 / 27 Passed (100%)**
- `apps/api/tests/epic10m-financial-management.integration.test.ts`: **6 / 6 Passed (100%)**

### 3.3 TypeScript Typechecking
- `npm run typecheck:api`: **0 errors** (Clean compilation)
- `npm run typecheck:web`: **0 errors** (Clean compilation)

### 3.4 Production Builds
- `npm run build:api`: **Success** (`tsc` compilation completed cleanly)
- `npm run build:web`: **Success** (Vite build completed cleanly in 4.04s)

---

## 4. Production Safety & Boundary Compliance

1. **Git Branch & Commit Discipline:**
   - Active branch: `feature/epic-10n-system-hardening`
   - Accepted production baseline `eb6c5d9df71c12a975b462418ae0d6fdf5a89113` remains completely untouched.
   - `main` and `develop` branches have had zero modifications.
2. **Additive Schema Migration:**
   - Introduced migration `0019_portal_requests_unique_identifiers.sql` adding nullable columns `reference_number` and `application_number` with unique indexes on `portal_update_requests`.
   - Verified with `npm run db:check -w apps/api` (`Everything's fine 🐶🔥`). Fully non-destructive and backward compatible with existing data.
3. **UI & Component-Library Preservation:**
   - Web application source code and approved UI designs remain unaltered.
4. **Mandatory Stop Condition:**
   - Execution concludes at Phase 2 completion. Phase 3 (Database Query Optimization & Performance Hardening) will not commence until operator authorization is received.
