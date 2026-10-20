import { migrate } from "../src/database/mysql94-migrator.js";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger } from "../src/common/logging/logger.js";
import { loadConfig, type ApiConfig } from "../src/config/env.js";
import { createDatabaseClient, type DatabaseClient } from "../src/database/client.js";
import { auditLogs, enrollments, students } from "../src/database/schema.js";
import { AuthService } from "../src/modules/auth/services/auth.service.js";
import { SisAdmissionsService } from "../src/modules/education/sis-admissions.service.js";
import { SisFinanceService } from "../src/modules/education/sis-finance.service.js";
import { SisService } from "../src/modules/education/sis.service.js";
import { and, eq } from "drizzle-orm";

const describeDatabase = process.env.RUN_DB_INTEGRATION_TESTS === "true" ? describe : describe.skip;
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(currentDirectory, "../src/database/migrations");

describeDatabase("Epic 10N Phase 2: Cross-Module Lifecycle & Transactional Integrity", () => {
  let config: ApiConfig;
  let database: DatabaseClient;

  beforeAll(async () => {
    config = loadConfig({ ...process.env, NODE_ENV: "test", LOG_LEVEL: "error" });
    database = createDatabaseClient(config.database, createLogger(config));
    await migrateIfNeeded(database);
  });

  afterAll(async () => {
    await database.close();
  });

  /* ─────────────────────────────────────────────────────────────
   * INT-001: ATOMIC ADMISSIONS CONVERSION
   * ───────────────────────────────────────────────────────────── */
  describe("INT-001: Atomic Admissions Conversion", () => {
    it("converts approved application to active enrollment transactionally", async () => {
      const { tenant, auth } = await createSisTenant(database, "int001-success");
      const admissions = new SisAdmissionsService(database);
      const sis = new SisService(database);
      const finance = new SisFinanceService(database);
      const fixture = await createClassFixture(sis, tenant);
      const adminActor = { userId: auth.user.id, role: "Owner" };

      // Create fee structure
      const feeCategory = await finance.createCategory(tenant, { name: "Tuition", code: "TUIT" }, adminActor);
      const feeStructure = await finance.createStructure(
        tenant,
        {
          name: "Term 1 Tuition",
          feeCategoryId: feeCategory.id,
          academicYearId: fixture.year.id,
          gradeId: fixture.grade.id,
          amountCents: 15000,
          paymentFrequency: "one_time",
          dueDate: "2026-10-31",
          status: "active",
        },
        adminActor
      );

      // Create application
      const app = await admissions.createApplication(
        tenant,
        {
          desiredGradeId: fixture.grade.id,
          campus: "Main Campus",
          student: {
            firstName: "Hamza",
            lastName: "Siddiqui",
            dateOfBirth: "2015-05-15",
            gender: "male",
            email: "hamza@example.com",
          },
          guardians: [
            {
              firstName: "Kamran",
              lastName: "Siddiqui",
              relationship: "father",
              email: "kamran@example.com",
              phone: "555-1111",
              isPrimaryContact: true,
            },
          ],
        },
        adminActor
      );

      // Submit and approve application
      await admissions.submitApplication(tenant, String(app.id));
      await admissions.recordDecision(
        tenant,
        String(app.id),
        {
          status: "approved",
          remarks: "Approved for admission",
        },
        adminActor
      );

      // Assign fee package
      await admissions.assignFeePackage(
        tenant,
        String(app.id),
        {
          feeStructureIds: [feeStructure.id],
          admissionFeeCents: 5000,
        },
        adminActor
      );

      // Execute conversion
      const result = await admissions.convertApplicationToEnrollment(
        tenant,
        String(app.id),
        {
          academicYear: fixture.year.name,
          gradeId: fixture.grade.id,
          sectionId: fixture.section.id,
          admissionDate: "2026-10-20",
        },
        adminActor
      );

      expect(result.success).toBe(true);
      expect(result.isExisting).toBe(false);
      expect(result.student?.status).toBe("active");
      expect(result.student?.firstName).toBe("Hamza");
      expect(result.enrollment.status).toBe("active");
      expect(result.enrollment.sectionId).toBe(fixture.section.id);

      // Verify application state
      const reloadedApp = await admissions.getApplication(tenant, String(app.id));
      expect(reloadedApp.status).toBe("enrolled");
      expect(reloadedApp.enrolledStudentId).toBe(result.student?.id);
      expect(reloadedApp.enrolledEnrollmentId).toBe(result.enrollment.id);

      // Verify fee assignment was created
      const assignments = await finance.listAssignments(tenant, result.student?.id);
      expect(assignments.length).toBeGreaterThanOrEqual(1);
    });

    it("handles idempotent repeated conversion attempts without duplicate writes", async () => {
      const { tenant, auth } = await createSisTenant(database, "int001-idempotent");
      const admissions = new SisAdmissionsService(database);
      const sis = new SisService(database);
      const fixture = await createClassFixture(sis, tenant);
      const adminActor = { userId: auth.user.id, role: "Owner" };

      const app = await admissions.createApplication(
        tenant,
        {
          desiredGradeId: fixture.grade.id,
          student: {
            firstName: "Sana",
            lastName: "Mirza",
            dateOfBirth: "2016-03-20",
          },
          guardians: [
            {
              firstName: "Kamran",
              lastName: "Mirza",
              relationship: "father",
              email: "kamran@example.com",
              isPrimaryContact: true,
            },
          ],
        },
        adminActor
      );
      await admissions.submitApplication(tenant, String(app.id));
      await admissions.recordDecision(tenant, String(app.id), { status: "approved" }, adminActor);

      const firstResult = await admissions.convertApplicationToEnrollment(
        tenant,
        String(app.id),
        {
          academicYear: fixture.year.name,
          gradeId: fixture.grade.id,
          sectionId: fixture.section.id,
        },
        adminActor
      );
      expect(firstResult.isExisting).toBe(false);

      // Second conversion attempt
      const secondResult = await admissions.convertApplicationToEnrollment(
        tenant,
        String(app.id),
        {
          academicYear: fixture.year.name,
          gradeId: fixture.grade.id,
          sectionId: fixture.section.id,
        },
        adminActor
      );
      expect(secondResult.success).toBe(true);
      expect(secondResult.isExisting).toBe(true);
      expect(secondResult.student?.id).toBe(firstResult.student?.id);
      expect(secondResult.enrollment.id).toBe(firstResult.enrollment.id);
    });

    it("rejects conversion of non-approved applications", async () => {
      const { tenant } = await createSisTenant(database, "int001-nonapproved");
      const admissions = new SisAdmissionsService(database);
      const sis = new SisService(database);
      const fixture = await createClassFixture(sis, tenant);

      const app = await admissions.createApplication(tenant, {
        desiredGradeId: fixture.grade.id,
        student: { firstName: "Ali", lastName: "Khan", dateOfBirth: "2015-01-01" },
      });

      // Draft application should fail conversion
      await expect(
        admissions.convertApplicationToEnrollment(tenant, String(app.id), {
          academicYear: fixture.year.name,
          gradeId: fixture.grade.id,
          sectionId: fixture.section.id,
        })
      ).rejects.toThrow(/Only approved applications can be converted/);
    });

    it("rolls back all writes if enrollment creation fails during conversion", async () => {
      const { tenant, auth } = await createSisTenant(database, "int001-rollback");
      const admissions = new SisAdmissionsService(database);
      const sis = new SisService(database);
      const fixture = await createClassFixture(sis, tenant);
      const adminActor = { userId: auth.user.id, role: "Owner" };

      const app = await admissions.createApplication(
        tenant,
        {
          desiredGradeId: fixture.grade.id,
          student: {
            firstName: "Rollback",
            lastName: "Test",
            dateOfBirth: "2015-08-08",
          },
          guardians: [
            {
              firstName: "Parent",
              lastName: "Test",
              relationship: "father",
              email: "parent@example.com",
              isPrimaryContact: true,
            },
          ],
        },
        adminActor
      );
      await admissions.submitApplication(tenant, String(app.id));
      await admissions.recordDecision(tenant, String(app.id), { status: "approved" }, adminActor);

      // Attempt conversion with non-existent section ID -> should fail during enrollment creation
      const invalidSectionId = randomUUID();
      await expect(
        admissions.convertApplicationToEnrollment(
          tenant,
          String(app.id),
          {
            academicYear: fixture.year.name,
            gradeId: fixture.grade.id,
            sectionId: invalidSectionId,
          },
          adminActor
        )
      ).rejects.toThrow();

      // Verify student was NOT created (rolled back cleanly)
      const allStudents = await sis.listStudents(tenant);
      const orphaned = allStudents.find((s) => s.firstName === "Rollback" && s.lastName === "Test");
      expect(orphaned).toBeUndefined();

      // Verify application status remains approved, not enrolled
      const currentApp = await admissions.getApplication(tenant, String(app.id));
      expect(currentApp.status).toBe("approved");
    });

    it("safely handles two competing simultaneous conversion requests without duplicate students or enrollments", async () => {
      const { tenant, auth } = await createSisTenant(database, "int001-concurrent");
      const admissions = new SisAdmissionsService(database);
      const sis = new SisService(database);
      const finance = new SisFinanceService(database);
      const fixture = await createClassFixture(sis, tenant);
      const adminActor = { userId: auth.user.id, role: "Owner" };

      const feeCategory = await finance.createCategory(tenant, { name: "Tuition", code: "TUIT" }, adminActor);
      const feeStructure = await finance.createStructure(
        tenant,
        {
          name: "Term Tuition",
          feeCategoryId: feeCategory.id,
          academicYearId: fixture.year.id,
          gradeId: fixture.grade.id,
          amountCents: 12000,
          paymentFrequency: "one_time",
          dueDate: "2026-10-31",
          status: "active",
        },
        adminActor
      );

      const app = await admissions.createApplication(
        tenant,
        {
          desiredGradeId: fixture.grade.id,
          campus: "Main Campus",
          student: {
            firstName: "Concurrent",
            lastName: "Applicant",
            dateOfBirth: "2015-06-16",
            gender: "female",
            email: "concurrent@example.com",
          },
          guardians: [
            {
              firstName: "Parent",
              lastName: "Applicant",
              relationship: "mother",
              email: "mother@example.com",
              phone: "555-8888",
              isPrimaryContact: true,
            },
          ],
        },
        adminActor
      );

      await admissions.submitApplication(tenant, String(app.id));
      await admissions.recordDecision(tenant, String(app.id), { status: "approved" }, adminActor);
      await admissions.assignFeePackage(
        tenant,
        String(app.id),
        {
          feeStructureIds: [feeStructure.id],
          admissionFeeCents: 3000,
        },
        adminActor
      );

      // Launch two simultaneous competing conversion requests
      const conversionOptions = {
        academicYear: fixture.year.name,
        gradeId: fixture.grade.id,
        sectionId: fixture.section.id,
        admissionDate: "2026-10-20",
      };

      const [res1, res2] = await Promise.all([
        admissions.convertApplicationToEnrollment(tenant, String(app.id), conversionOptions, adminActor),
        admissions.convertApplicationToEnrollment(tenant, String(app.id), conversionOptions, adminActor),
      ]);

      // Both must succeed
      expect(res1.success).toBe(true);
      expect(res2.success).toBe(true);

      // One must be the original conversion (isExisting: false), the other the idempotent result (isExisting: true)
      const existingFlags = [res1.isExisting, res2.isExisting].sort();
      expect(existingFlags).toEqual([false, true]);

      // Both results must point to the identical student and enrollment ID
      expect(res1.student?.id).toBe(res2.student?.id);
      expect(res1.enrollment.id).toBe(res2.enrollment.id);

      // Directly verify database state: exactly 1 student, exactly 1 enrollment, exactly 1 fee assignment
      const allMatchingStudents = (await sis.listStudents(tenant)).filter(
        (s) => s.firstName === "Concurrent" && s.lastName === "Applicant"
      );
      expect(allMatchingStudents.length).toBe(1);

      const enrollmentsInDb = await database.db
        .select()
        .from(enrollments)
        .where(
          and(
            eq(enrollments.workspaceId, tenant.workspaceId),
            eq(enrollments.studentId, allMatchingStudents[0].id)
          )
        );
      expect(enrollmentsInDb.length).toBe(1);

      const feeAssignments = await finance.listAssignments(tenant, allMatchingStudents[0].id);
      expect(feeAssignments.length).toBe(1);
    });
  });

  /* ─────────────────────────────────────────────────────────────
   * INT-002: STUDENT ARCHIVAL LIFECYCLE INTEGRITY
   * ───────────────────────────────────────────────────────────── */
  describe("INT-002: Student Archival Lifecycle Integrity", () => {
    it("archives student and transitions active enrollments to dropped in one atomic transaction", async () => {
      const { tenant, auth } = await createSisTenant(database, "int002-archival");
      const sis = new SisService(database);
      const fixture = await createClassFixture(sis, tenant);
      const actor = { userId: auth.user.id, role: "Owner" };

      const student = await sis.createStudent(tenant, {
        firstName: "Archival",
        lastName: "Target",
        dateOfBirth: "2015-02-02",
        gender: "male",
        status: "active",
      });

      const enrollment = await sis.createEnrollment(tenant, {
        studentId: student.id,
        academicYear: fixture.year.name,
        gradeId: fixture.grade.id,
        sectionId: fixture.section.id,
        enrollmentDate: "2026-10-01",
        status: "active",
      });

      expect(enrollment.status).toBe("active");

      // Execute archival
      const result = await sis.deleteStudent(tenant, student.id, {}, actor);
      expect(result.success).toBe(true);

      // Student status must be archived
      const reloadedStudent = await sis.getStudent(tenant, student.id);
      expect(reloadedStudent?.status).toBe("archived");

      // Enrollment status must be dropped
      const studentEnrollments = await sis.listEnrollments(tenant, { studentId: student.id });
      expect(studentEnrollments[0].status).toBe("dropped");

      // Student must NOT appear in active enrollment queries
      const activeEnrollments = await sis.listEnrollments(tenant, { status: "active" });
      const foundInActive = activeEnrollments.some((e) => e.studentId === student.id);
      expect(foundInActive).toBe(false);

      // Verify audit log entry was created
      const auditRows = await database.db
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.workspaceId, tenant.workspaceId),
            eq(auditLogs.resourceId, student.id),
            eq(auditLogs.action, "student.archive")
          )
        );
      expect(auditRows.length).toBe(1);
      expect(auditRows[0].result).toBe("success");
    });

    it("prevents archival when student has unpaid invoices without explicit override", async () => {
      const { tenant, auth } = await createSisTenant(database, "int002-dues");
      const sis = new SisService(database);
      const finance = new SisFinanceService(database);
      const fixture = await createClassFixture(sis, tenant);
      const adminActor = { userId: auth.user.id, role: "Owner" };

      const student = await sis.createStudent(tenant, {
        firstName: "Dues",
        lastName: "Student",
        dateOfBirth: "2015-04-04",
        status: "active",
      });

      const enrollment = await sis.createEnrollment(tenant, {
        studentId: student.id,
        academicYear: fixture.year.name,
        gradeId: fixture.grade.id,
        sectionId: fixture.section.id,
        enrollmentDate: "2026-10-01",
        status: "active",
      });

      // Create fee category, structure, and issued invoice with balance
      const cat = await finance.createCategory(tenant, { name: "Tuition", code: "TUIT" }, adminActor);
      const struct = await finance.createStructure(
        tenant,
        {
          name: "Annual Fee",
          feeCategoryId: cat.id,
          academicYearId: fixture.year.id,
          gradeId: fixture.grade.id,
          amountCents: 25000,
          paymentFrequency: "one_time",
          dueDate: "2026-11-30",
          status: "active",
        },
        adminActor
      );

      const invoice = await finance.createInvoice(
        tenant,
        {
          studentId: student.id,
          enrollmentId: enrollment.id,
          academicYearId: fixture.year.id,
          billingPeriod: "2026-10",
          feeStructureIds: [struct.id],
          issueDate: "2026-10-01",
          dueDate: "2026-10-31",
          status: "issued",
        },
        adminActor
      );

      expect(invoice.balanceCents).toBe(25000);

      // Attempt archival without override -> MUST REJECT
      await expect(sis.deleteStudent(tenant, student.id)).rejects.toThrow(
        /Cannot archive student with outstanding balance/
      );

      // Student and enrollment must still be active
      const studentAfter = await sis.getStudent(tenant, student.id);
      expect(studentAfter?.status).toBe("active");
      const enrollmentsAfter = await sis.listEnrollments(tenant, { studentId: student.id, status: "active" });
      expect(enrollmentsAfter.length).toBe(1);

      // Now authorize archival with forceWithOutstandingDues: true
      const authorizedResult = await sis.deleteStudent(
        tenant,
        student.id,
        { forceWithOutstandingDues: true },
        adminActor
      );
      expect(authorizedResult.success).toBe(true);

      // Verify student is now archived, invoice is preserved, not deleted
      const finalStudent = await sis.getStudent(tenant, student.id);
      expect(finalStudent?.status).toBe("archived");

      const invoicesAfter = await finance.listInvoices(tenant, { studentId: student.id });
      expect(invoicesAfter.length).toBe(1);
      expect(invoicesAfter[0].id).toBe(invoice.id);
      expect(invoicesAfter[0].balanceCents).toBe(25000); // Intact financial history
    });

    it("preserves historical attendance and exam records upon archival", async () => {
      const { tenant } = await createSisTenant(database, "int002-history");
      const sis = new SisService(database);
      const fixture = await createClassFixture(sis, tenant);

      const student = await sis.createStudent(tenant, {
        firstName: "Historical",
        lastName: "Records",
        dateOfBirth: "2015-06-06",
        status: "active",
      });

      const enrollment = await sis.createEnrollment(tenant, {
        studentId: student.id,
        academicYear: fixture.year.name,
        gradeId: fixture.grade.id,
        sectionId: fixture.section.id,
        enrollmentDate: "2026-10-01",
        status: "active",
      });

      // Create attendance session and record
      const session = await sis.createAttendanceSession(tenant, {
        academicYearId: fixture.year.id,
        date: "2026-10-05",
        gradeId: fixture.grade.id,
        sectionId: fixture.section.id,
        sessionType: "daily",
      });

      await sis.saveAttendanceRecords(
        tenant,
        session.id,
        [{ studentId: student.id, status: "present", note: "On time" }],
        "Teacher 1"
      );

      // Archive student
      await sis.deleteStudent(tenant, student.id);

      // Verify attendance records remain intact
      const attendance = await sis.listAttendanceRecords(tenant, session.id);
      expect(attendance.length).toBe(1);
      expect(attendance[0].studentId).toBe(student.id);
      expect(attendance[0].status).toBe("present");
    });

    it("operates idempotently on repeated student archival", async () => {
      const { tenant } = await createSisTenant(database, "int002-idempotent");
      const sis = new SisService(database);
      const student = await sis.createStudent(tenant, {
        firstName: "Repeat",
        lastName: "Archive",
        dateOfBirth: "2015-07-07",
        status: "active",
      });

      const first = await sis.deleteStudent(tenant, student.id);
      expect(first.success).toBe(true);

      const second = await sis.deleteStudent(tenant, student.id);
      expect(second.success).toBe(true);
      expect(second.isExisting).toBe(true);
    });

    it("safely handles concurrent archival requests without race conditions", async () => {
      const { tenant, auth } = await createSisTenant(database, "int002-concurrent-archive");
      const sis = new SisService(database);
      const fixture = await createClassFixture(sis, tenant);
      const actor = { userId: auth.user.id, role: "Owner" };

      const student = await sis.createStudent(tenant, {
        firstName: "Concurrent",
        lastName: "Archival",
        dateOfBirth: "2015-08-18",
        status: "active",
      });

      await sis.createEnrollment(tenant, {
        studentId: student.id,
        academicYear: fixture.year.name,
        gradeId: fixture.grade.id,
        sectionId: fixture.section.id,
        enrollmentDate: "2026-10-01",
        status: "active",
      });

      // Fire two simultaneous archival requests
      const [res1, res2] = await Promise.all([
        sis.deleteStudent(tenant, student.id, {}, actor),
        sis.deleteStudent(tenant, student.id, {}, actor),
      ]);

      expect(res1.success).toBe(true);
      expect(res2.success).toBe(true);

      const existingFlags = [res1.isExisting, res2.isExisting];
      expect(existingFlags).toContain(true);

      // Student is archived in database
      const reloaded = await sis.getStudent(tenant, student.id);
      expect(reloaded?.status).toBe("archived");

      // Zero active enrollments exist
      const activeEnrollments = await sis.listEnrollments(tenant, { studentId: student.id, status: "active" });
      expect(activeEnrollments.length).toBe(0);
    });
  });

  /* ─────────────────────────────────────────────────────────────
   * INT-003: ATOMIC SECTION TRANSFER
   * ───────────────────────────────────────────────────────────── */
  describe("INT-003: Atomic Section Transfer", () => {
    it("transfers student between sections atomically and writes audit trail", async () => {
      const { tenant, auth } = await createSisTenant(database, "int003-transfer");
      const sis = new SisService(database);
      const fixture = await createClassFixture(sis, tenant);
      const actor = { userId: auth.user.id, role: "Owner" };

      // Create Section B in the same grade
      const sectionB = await sis.createSection(tenant, {
        gradeId: fixture.grade.id,
        name: "B",
        capacity: 25,
        status: "active",
      });

      const student = await sis.createStudent(tenant, {
        firstName: "Tariq",
        lastName: "Jamil",
        dateOfBirth: "2015-09-09",
        status: "active",
      });

      const enrollmentA = await sis.createEnrollment(tenant, {
        studentId: student.id,
        academicYear: fixture.year.name,
        gradeId: fixture.grade.id,
        sectionId: fixture.section.id,
        enrollmentDate: "2026-10-01",
        status: "active",
      });

      // Transfer student from Section A to Section B
      const newEnrollment = await sis.transferStudent(
        tenant,
        student.id,
        sectionB.id,
        {},
        actor
      );

      expect(newEnrollment.id).toBeDefined();
      expect(newEnrollment.sectionId).toBe(sectionB.id);
      expect(newEnrollment.status).toBe("active");

      // Verify previous enrollment is marked 'transferred'
      const allEnrollments = await sis.listEnrollments(tenant, { studentId: student.id });
      expect(allEnrollments.length).toBe(2);

      const oldEnr = allEnrollments.find((e) => e.id === enrollmentA.id);
      expect(oldEnr?.status).toBe("transferred");

      const activeEnr = allEnrollments.find((e) => e.status === "active");
      expect(activeEnr?.id).toBe(newEnrollment.id);
      expect(activeEnr?.sectionId).toBe(sectionB.id);

      // Verify exactly ONE active enrollment exists
      const currentActive = await sis.listEnrollments(tenant, { studentId: student.id, status: "active" });
      expect(currentActive.length).toBe(1);

      // Verify audit log entry
      const auditRows = await database.db
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.workspaceId, tenant.workspaceId),
            eq(auditLogs.resourceId, student.id),
            eq(auditLogs.action, "student.section_transfer")
          )
        );
      expect(auditRows.length).toBe(1);
      expect(auditRows[0].operation).toBe("transfer");
    });

    it("rejects transfer to non-existent section or section belonging to another grade", async () => {
      const { tenant } = await createSisTenant(database, "int003-invalid-dest");
      const sis = new SisService(database);
      const fixture = await createClassFixture(sis, tenant);

      const student = await sis.createStudent(tenant, {
        firstName: "Transfer",
        lastName: "Validation",
        dateOfBirth: "2015-10-10",
        status: "active",
      });

      await sis.createEnrollment(tenant, {
        studentId: student.id,
        academicYear: fixture.year.name,
        gradeId: fixture.grade.id,
        sectionId: fixture.section.id,
        enrollmentDate: "2026-10-01",
        status: "active",
      });

      // 1. Non-existent section
      await expect(
        sis.transferStudent(tenant, student.id, randomUUID())
      ).rejects.toThrow(/Destination section not found/);

      // 2. Same section
      await expect(
        sis.transferStudent(tenant, student.id, fixture.section.id)
      ).rejects.toThrow(/Student is already in this section/);

      // 3. Section belonging to a different grade
      const grade2 = await sis.createGrade(tenant, {
        name: "Grade 2",
        level: 2,
        order: 2,
        status: "active",
      });
      const sectionGrade2 = await sis.createSection(tenant, {
        gradeId: grade2.id,
        name: "G2-A",
        status: "active",
      });

      await expect(
        sis.transferStudent(tenant, student.id, sectionGrade2.id, { gradeId: fixture.grade.id })
      ).rejects.toThrow(/does not belong to the target grade level/);
    });

    it("rejects transfer of archived or inactive student", async () => {
      const { tenant } = await createSisTenant(database, "int003-archived");
      const sis = new SisService(database);
      const fixture = await createClassFixture(sis, tenant);

      const student = await sis.createStudent(tenant, {
        firstName: "Inactive",
        lastName: "Student",
        dateOfBirth: "2015-11-11",
        status: "active",
      });

      await sis.createEnrollment(tenant, {
        studentId: student.id,
        academicYear: fixture.year.name,
        gradeId: fixture.grade.id,
        sectionId: fixture.section.id,
        enrollmentDate: "2026-10-01",
        status: "active",
      });

      // Archive student
      await sis.deleteStudent(tenant, student.id);

      const sectionB = await sis.createSection(tenant, {
        gradeId: fixture.grade.id,
        name: "B",
        status: "active",
      });

      await expect(
        sis.transferStudent(tenant, student.id, sectionB.id)
      ).rejects.toThrow(/Cannot transfer student with status 'archived'/);
    });

    it("safely handles two competing simultaneous section transfers preventing duplicate active enrollments", async () => {
      const { tenant, auth } = await createSisTenant(database, "int003-concurrent-transfer");
      const sis = new SisService(database);
      const fixture = await createClassFixture(sis, tenant);
      const actor = { userId: auth.user.id, role: "Owner" };

      // Create Section B and Section C in the same grade
      const sectionB = await sis.createSection(tenant, {
        gradeId: fixture.grade.id,
        name: "B",
        capacity: 25,
        status: "active",
      });
      const sectionC = await sis.createSection(tenant, {
        gradeId: fixture.grade.id,
        name: "C",
        capacity: 25,
        status: "active",
      });

      const student = await sis.createStudent(tenant, {
        firstName: "Concurrent",
        lastName: "Transfer",
        dateOfBirth: "2015-09-19",
        status: "active",
      });

      await sis.createEnrollment(tenant, {
        studentId: student.id,
        academicYear: fixture.year.name,
        gradeId: fixture.grade.id,
        sectionId: fixture.section.id,
        enrollmentDate: "2026-10-01",
        status: "active",
      });

      // Fire two competing section transfers simultaneously
      const [transfer1, transfer2] = await Promise.allSettled([
        sis.transferStudent(tenant, student.id, sectionB.id, {}, actor),
        sis.transferStudent(tenant, student.id, sectionB.id, {}, actor),
      ]);

      // Exactly one must succeed and one must be rejected (cannot transfer student already in this section / concurrent conflict)
      const statuses = [transfer1.status, transfer2.status].sort();
      expect(statuses).toEqual(["fulfilled", "rejected"]);

      // Verify that in the database, exactly ONE active enrollment exists
      const activeEnrollments = await database.db
        .select()
        .from(enrollments)
        .where(
          and(
            eq(enrollments.workspaceId, tenant.workspaceId),
            eq(enrollments.studentId, student.id),
            eq(enrollments.status, "active")
          )
        );
      expect(activeEnrollments.length).toBe(1);

      // Verify previous source enrollment was transitioned to transferred
      const transferredEnrollments = await database.db
        .select()
        .from(enrollments)
        .where(
          and(
            eq(enrollments.workspaceId, tenant.workspaceId),
            eq(enrollments.studentId, student.id),
            eq(enrollments.status, "transferred")
          )
        );
      expect(transferredEnrollments.length).toBe(1);
    });
  });

  /* ─────────────────────────────────────────────────────────────
   * INT-004: CONCURRENCY-SAFE IDENTIFIER GENERATION
   * ───────────────────────────────────────────────────────────── */
  describe("INT-004: Concurrency-Safe Identifier Generation", () => {
    it("allocates unique non-colliding admission numbers under parallel creation", async () => {
      const { tenant } = await createSisTenant(database, "int004-parallel-students");
      const sis = new SisService(database);

      const studentCount = 10;
      const creationPromises = Array.from({ length: studentCount }, (_, i) =>
        sis.createStudent(tenant, {
          firstName: `Parallel${i}`,
          lastName: "Student",
          dateOfBirth: `2015-01-${String(i + 1).padStart(2, "0")}`,
          status: "applicant",
        })
      );

      const created = await Promise.all(creationPromises);
      expect(created.length).toBe(studentCount);

      // Verify every admission number is unique
      const admissionNumbers = created.map((s) => s.admissionNumber);
      const uniqueNumbers = new Set(admissionNumbers);
      expect(uniqueNumbers.size).toBe(studentCount);

      // Verify format
      for (const num of admissionNumbers) {
        expect(num).toMatch(/^TMS-\d{4}-\d{5}$/);
      }
    });

    it("allocates unique non-colliding employee numbers under parallel staff creation", async () => {
      const { tenant } = await createSisTenant(database, "int004-parallel-staff");
      const sis = new SisService(database);

      const staffCount = 8;
      const creationPromises = Array.from({ length: staffCount }, (_, i) =>
        sis.createStaff(tenant, {
          firstName: `Staff${i}`,
          lastName: "Member",
          hireDate: "2026-01-01",
          staffType: "teacher",
          status: "active",
        })
      );

      const created = await Promise.all(creationPromises);
      expect(created.length).toBe(staffCount);

      const employeeNumbers = created.map((s) => s.employeeNumber);
      const uniqueNumbers = new Set(employeeNumbers);
      expect(uniqueNumbers.size).toBe(staffCount);

      for (const num of employeeNumbers) {
        expect(num).toMatch(/^EMP-\d{3}$/);
      }
    });

    it("correctly calculates next identifier sequence across gaps from non-sequential records", async () => {
      const { tenant } = await createSisTenant(database, "int004-gap-handling");
      const sis = new SisService(database);
      const year = new Date().getFullYear();

      // Create student with explicit manual high admission number
      await sis.createStudent(tenant, {
        firstName: "High",
        lastName: "Sequence",
        dateOfBirth: "2015-12-12",
        admissionNumber: `TMS-${year}-00050`,
      });

      // Next auto-generated student should be 00051 (not 00002)
      const nextStudent = await sis.createStudent(tenant, {
        firstName: "Auto",
        lastName: "Sequence",
        dateOfBirth: "2015-12-13",
      });

      expect(nextStudent.admissionNumber).toBe(`TMS-${year}-00051`);
    });

    it("scopes identifier allocation per tenant without cross-tenant collisions", async () => {
      const { tenant: tenantA } = await createSisTenant(database, "int004-tenant-a");
      const { tenant: tenantB } = await createSisTenant(database, "int004-tenant-b");
      const sis = new SisService(database);

      const studentA = await sis.createStudent(tenantA, {
        firstName: "TenantA",
        lastName: "Student",
        dateOfBirth: "2015-01-01",
      });

      const studentB = await sis.createStudent(tenantB, {
        firstName: "TenantB",
        lastName: "Student",
        dateOfBirth: "2015-01-01",
      });

      // Both tenants can start their numbering sequence independently
      expect(studentA.admissionNumber).toMatch(/^TMS-\d{4}-00001$/);
      expect(studentB.admissionNumber).toMatch(/^TMS-\d{4}-00001$/);
    });

    it("allocates unique non-colliding enquiry reference numbers under parallel creation", async () => {
      const { tenant } = await createSisTenant(database, "int004-parallel-enquiries");
      const admissions = new SisAdmissionsService(database);
      const sis = new SisService(database);
      const fixture = await createClassFixture(sis, tenant);

      const enquiryCount = 10;
      const creationPromises = Array.from({ length: enquiryCount }, (_, i) =>
        admissions.createEnquiry(tenant, {
          studentName: `Enquiry Child ${i}`,
          guardianName: `Parent ${i}`,
          phone: `555-010${i}`,
          desiredGradeId: fixture.grade.id,
        })
      );

      const created = await Promise.all(creationPromises);
      expect(created.length).toBe(enquiryCount);

      const refNumbers = created.map((e) => String(e.referenceNumber));
      const uniqueRefs = new Set(refNumbers);
      expect(uniqueRefs.size).toBe(enquiryCount);

      for (const ref of refNumbers) {
        expect(ref).toMatch(/^ENQ-\d{4}-\d{5}$/);
      }
    });

    it("allocates unique non-colliding application numbers under parallel creation", async () => {
      const { tenant } = await createSisTenant(database, "int004-parallel-applications");
      const admissions = new SisAdmissionsService(database);
      const sis = new SisService(database);
      const fixture = await createClassFixture(sis, tenant);

      const appCount = 10;
      const creationPromises = Array.from({ length: appCount }, (_, i) =>
        admissions.createApplication(tenant, {
          desiredGradeId: fixture.grade.id,
          student: {
            firstName: `AppStudent${i}`,
            lastName: "Parallel",
            dateOfBirth: "2016-01-01",
          },
        })
      );

      const created = await Promise.all(creationPromises);
      expect(created.length).toBe(appCount);

      const appNumbers = created.map((a) => String(a.applicationNumber));
      const uniqueApps = new Set(appNumbers);
      expect(uniqueApps.size).toBe(appCount);

      for (const num of appNumbers) {
        expect(num).toMatch(/^APP-\d{4}-\d{5}$/);
      }
    });
  });
});

async function createSisTenant(database: DatabaseClient, label: string) {
  const suffix = randomUUID().slice(0, 8);
  const auth = await new AuthService(database).register({
    firstName: "Epic10N",
    lastName: "Owner",
    email: `${label}-${suffix}@example.com`,
    password: "password123",
    organizationName: `Epic10N Org ${label} ${suffix}`,
    organizationType: "School",
    industry: "Education",
    country: "United States",
  });
  const tenant = await new SisService(database).getTenant(auth.memberships[0].organizationId);
  return { auth, tenant };
}

async function createClassFixture(service: SisService, tenant: Awaited<ReturnType<SisService["getTenant"]>>) {
  const suffix = randomUUID().slice(0, 6);
  const year = await service.createAcademicYear(tenant, {
    name: `2026-${suffix}`,
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    status: "active",
  });
  const grade = await service.createGrade(tenant, {
    name: `Grade ${suffix}`,
    level: 1,
    order: 1,
    status: "active",
  });
  const section = await service.createSection(tenant, {
    gradeId: grade.id,
    name: "A",
    capacity: 30,
    status: "active",
  });
  const staff = await service.createStaff(tenant, {
    firstName: "Ada",
    lastName: "Teacher",
    hireDate: "2026-01-01",
    staffType: "teacher",
    employmentStatus: "full_time",
    status: "active",
  });
  return { year, grade, section, staff };
}

async function migrateIfNeeded(database: DatabaseClient): Promise<void> {
  try {
    await migrate(database.db, { migrationsFolder });
  } catch (error) {
    const code = (error as { cause?: { code?: string } }).cause?.code;
    if (code === "ER_TABLE_EXISTS_ERROR") return;
    throw error;
  }
}
