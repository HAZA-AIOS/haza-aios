import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { createLogger } from "../src/common/logging/logger.js";
import { loadConfig, type ApiConfig } from "../src/config/env.js";
import { createDatabaseClient, type DatabaseClient } from "../src/database/client.js";
import { AuthService } from "../src/modules/auth/services/auth.service.js";
import { SisService } from "../src/modules/education/sis.service.js";
import { SisFinanceService } from "../src/modules/education/sis-finance.service.js";
import { SisCommunicationService } from "../src/modules/education/sis-communication.service.js";
import { SisExaminationService } from "../src/modules/education/sis-examination.service.js";
import { DomainService } from "../src/modules/platform/services/domain.service.js";
import {
  createFixtureTracker,
  cleanupTrackedFixtures,
} from "./helpers/test-cleanup.js";
import {
  createIsolatedTenant,
  createAcademicClassFixture,
  type FixtureTenant,
  type ClassFixture,
} from "./helpers/test-fixtures.js";

const describeDatabase = process.env.RUN_DB_INTEGRATION_TESTS === "true" ? describe : describe.skip;

const logger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

describeDatabase("Stage 20F.2: Multi-Tenant Isolation & RBAC Security Matrix", () => {
  let config: ApiConfig;
  let database: DatabaseClient;
  const tracker = createFixtureTracker();

  // Multi-Tenant Matrix entities
  let orgA: FixtureTenant;
  let orgB: FixtureTenant;
  let classA: ClassFixture;
  let classB: ClassFixture;

  beforeAll(async () => {
    config = loadConfig({
      ...process.env,
      NODE_ENV: "test",
      LOG_LEVEL: "error",
    });
    database = createDatabaseClient(config.database, createLogger(config));

    // Provision Tenant A
    orgA = await createIsolatedTenant(database, "tenant-a", tracker);
    classA = await createAcademicClassFixture(database, orgA.tenant);

    // Provision Tenant B
    orgB = await createIsolatedTenant(database, "tenant-b", tracker);
    classB = await createAcademicClassFixture(database, orgB.tenant);
  });

  afterAll(async () => {
    try {
      await cleanupTrackedFixtures(database, tracker);
    } finally {
      await database.close();
    }
  });

  // --------------------------------------------------------------------------
  // SECTION 1: AUTHENTICATION SECURITY & TOKEN VALIDATION
  // --------------------------------------------------------------------------
  describe("Authentication Security", () => {
    it("rejects requests with missing authentication credentials", async () => {
      const authService = new AuthService(database);
      const req = { headers: {} } as any;

      await expect(authService.authenticateRequest(req)).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it("rejects forged or malformed session tokens", async () => {
      const authService = new AuthService(database);
      const req = { headers: { authorization: "Bearer forged-token-secret-123" } } as any;

      await expect(authService.authenticateRequest(req)).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it("revokes sessions on logout and refuses further requests with that token", async () => {
      const authService = new AuthService(database);
      const suffix = randomUUID().slice(0, 8);
      const sessionUser = await authService.register({
        firstName: "Temp",
        lastName: "User",
        email: `revoked-${suffix}@example.test`,
        password: "Password123!",
        organizationName: `Revoked Org ${suffix}`,
        organizationType: "School",
        industry: "Education",
        country: "United States",
      });
      tracker.organizationIds.add(sessionUser.memberships[0].organizationId);
      tracker.userIds.add(sessionUser.user.id);

      const token = sessionUser.session.accessToken;
      const req = { headers: { authorization: `Bearer ${token}` } } as any;

      // Verify active
      const authenticated = await authService.authenticateRequest(req);
      expect(authenticated.user.id).toBe(sessionUser.user.id);

      // Logout
      await authService.logout(token);

      // Verify immediate rejection
      await expect(authService.authenticateRequest(req)).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it("rejects unauthorized workspace switching / access to foreign organization", async () => {
      const authService = new AuthService(database);
      const userARequest = { headers: { authorization: `Bearer ${orgA.auth.session.accessToken}` } } as any;

      // User A attempts to access Organization B
      await expect(
        authService.requireOrganizationPermission(userARequest, orgB.organizationId, "workspace.read")
      ).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 2: ACADEMIC & SIS CORE TENANT ISOLATION
  // --------------------------------------------------------------------------
  describe("Academic Structure & Student/Staff Isolation", () => {
    it("prevents cross-tenant retrieval of students", async () => {
      const sis = new SisService(database);

      // Tenant A queries Tenant B's student using Tenant A's context
      const student = await sis.getStudent(orgA.tenant, classB.student.id);
      expect(student).toBeNull();
    });

    it("prevents cross-tenant update of students", async () => {
      const sis = new SisService(database);

      // Tenant A attempts to rename Tenant B's student
      await expect(
        sis.updateStudent(orgA.tenant, classB.student.id, { firstName: "HackedName" })
      ).rejects.toMatchObject({
        statusCode: 404,
      });

      // Confirm Tenant B's student was NOT modified
      const studentB = await sis.getStudent(orgB.tenant, classB.student.id);
      expect(studentB?.firstName).not.toBe("HackedName");
    });

    it("prevents cross-tenant deletion or archiving of students", async () => {
      const sis = new SisService(database);

      // Tenant A attempts to delete Tenant B's student
      await expect(
        sis.deleteStudent(orgA.tenant, classB.student.id)
      ).rejects.toMatchObject({
        statusCode: 404,
      });

      // Confirm student B is still active
      const studentB = await sis.getStudent(orgB.tenant, classB.student.id);
      expect(studentB?.status).toBe("active");
    });

    it("prevents cross-tenant staff retrieval and update", async () => {
      const sis = new SisService(database);

      const staff = await sis.getStaff(orgA.tenant, classB.staff.id);
      expect(staff).toBeNull();

      await expect(
        sis.updateStaff(orgA.tenant, classB.staff.id, { firstName: "MaliciousUpdate" })
      ).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("rejects cross-tenant foreign key assignment in enrollments", async () => {
      const sis = new SisService(database);

      // Tenant A attempts to enroll Tenant B's student into Tenant A's class
      await expect(
        sis.createEnrollment(orgA.tenant, {
          studentId: classB.student.id, // Foreign student!
          academicYear: classA.year.name,
          gradeId: classA.grade.id,
          sectionId: classA.section.id,
          enrollmentDate: "2026-09-01",
          status: "active",
        })
      ).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("rejects cross-tenant foreign key assignment in teaching assignments", async () => {
      const sis = new SisService(database);

      // Tenant A attempts to assign Tenant B's teacher to Tenant A's section
      await expect(
        sis.createTeachingAssignment(orgA.tenant, {
          staffId: classB.staff.id, // Foreign teacher!
          academicYear: classA.year.name,
          gradeId: classA.grade.id,
          sectionId: classA.section.id,
          subjectId: classA.subject.id,
          isActive: true,
        })
      ).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 3: ATTENDANCE & TIMETABLE ISOLATION
  // --------------------------------------------------------------------------
  describe("Attendance & Timetable Isolation", () => {
    it("rejects marking attendance for a student belonging to another tenant", async () => {
      const sis = new SisService(database);
      const sessionA = await sis.createAttendanceSession(orgA.tenant, {
        academicYearId: classA.year.id,
        date: "2026-09-10",
        gradeId: classA.grade.id,
        sectionId: classA.section.id,
        sessionType: "daily",
        status: "draft",
      });

      // Attempt to submit attendance record for Student B in Session A
      await expect(
        sis.saveAttendanceRecords(
          orgA.tenant,
          sessionA.id,
          [{ studentId: classB.student.id, status: "present" }],
          classA.staff.id
        )
      ).rejects.toMatchObject({
        cause: { statusCode: 400 },
      });
    });

    it("prevents cross-tenant retrieval of student attendance history", async () => {
      const sis = new SisService(database);

      // Tenant A attempts to inspect attendance history of Tenant B's student -> rejected with 404 (not found for Tenant A)
      await expect(
        sis.getStudentAttendanceHistory(orgA.tenant, classB.student.id)
      ).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 4: FINANCE DATA ISOLATION & RBAC
  // --------------------------------------------------------------------------
  describe("Finance Isolation & RBAC", () => {
    const ownerActor = { userId: "owner", role: "Owner" };
    const teacherActor = { userId: "teacher", role: "Teacher" };
    let invoiceAId: string;

    beforeAll(async () => {
      const finance = new SisFinanceService(database);
      const suffix = randomUUID().slice(0, 6);
      const catA = await finance.createCategory(
        orgA.tenant,
        { name: `Tuition ${suffix}`, code: `CAT-${suffix}`, status: "active", displayOrder: 1 },
        ownerActor
      );
      const structA = await finance.createStructure(
        orgA.tenant,
        {
          name: `Tuition Fee ${suffix}`,
          academicYearId: classA.year.id,
          gradeId: classA.grade.id,
          feeCategoryId: catA.id,
          amountCents: 50000,
          status: "active",
        },
        ownerActor
      );
      await finance.assignFee(orgA.tenant, classA.student.id, classA.enrollment.id, structA.id, ownerActor);
      const invA = await finance.createInvoice(
        orgA.tenant,
        {
          studentId: classA.student.id,
          enrollmentId: classA.enrollment.id,
          academicYearId: classA.year.id,
          issueDate: "2026-09-01",
          dueDate: "2026-09-30",
          feeStructureIds: [structA.id],
          status: "issued",
        },
        ownerActor
      );
      invoiceAId = invA.id;
    });

    it("denies Teacher role from creating fee structures or issuing invoices (RBAC)", async () => {
      const finance = new SisFinanceService(database);

      await expect(
        finance.createStructure(
          orgA.tenant,
          {
            name: "Unauthorized Fee",
            academicYearId: classA.year.id,
            gradeId: classA.grade.id,
            feeCategoryId: "some-cat",
            amountCents: 10000,
          },
          teacherActor
        )
      ).rejects.toMatchObject({
        statusCode: 403,
      });

      await expect(
        finance.createInvoice(
          orgA.tenant,
          {
            studentId: classA.student.id,
            enrollmentId: classA.enrollment.id,
            academicYearId: classA.year.id,
            issueDate: "2026-09-01",
            dueDate: "2026-09-30",
          },
          teacherActor
        )
      ).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("prevents cross-tenant listing and inspection of invoices", async () => {
      const finance = new SisFinanceService(database);

      // Tenant B queries invoices with studentId = Student A
      const invoicesForB = await finance.listInvoices(orgB.tenant, { studentId: classA.student.id });
      expect(invoicesForB).toHaveLength(0);
    });

    it("prevents recording payments against an invoice belonging to another tenant", async () => {
      const finance = new SisFinanceService(database);

      // Tenant B attempts to record payment against Tenant A's invoice
      await expect(
        finance.recordPayment(
          orgB.tenant,
          {
            invoiceId: invoiceAId, // Belongs to Tenant A!
            amountCents: 10000,
            paymentDate: "2026-09-15",
            paymentMethod: "cash",
          },
          ownerActor
        )
      ).rejects.toMatchObject({
        cause: { statusCode: 404 },
      });
    });

    it("prevents cross-tenant ledger extraction", async () => {
      const finance = new SisFinanceService(database);

      // Tenant B requests student ledger for Student A
      const ledger = await finance.ledger(orgB.tenant, classA.student.id);
      expect(ledger).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 5: COMMUNICATION & NOTIFICATIONS ISOLATION
  // --------------------------------------------------------------------------
  describe("Communication & Audience Resolution Isolation", () => {
    it("ensures audience resolution only resolves students and staff within the tenant", async () => {
      const comm = new SisCommunicationService(database);

      const recipientsA = await comm.resolveAudience(orgA.tenant, { type: "all_students" });
      const recipientIdsA = recipientsA.map((r) => r.studentId);

      expect(recipientIdsA).toContain(classA.student.id);
      expect(recipientIdsA).not.toContain(classB.student.id);
    });

    it("prevents cross-tenant template retrieval and modification", async () => {
      const comm = new SisCommunicationService(database);
      const ownerActor = { userId: "owner", role: "Owner" };

      const templateA = await comm.createTemplate(
        orgA.tenant,
        {
          name: "Confidential Letter",
          category: "general",
          subject: "Notice",
          content: "Hello {{ student_name }}",
          supportedVariables: ["student_name"],
        },
        ownerActor
      );

      // Tenant B lists templates
      const templatesB = await comm.listTemplates(orgB.tenant);
      expect(templatesB.some((t: any) => t.id === templateA.id)).toBe(false);

      // Tenant B attempts to update Tenant A's template
      await expect(
        comm.updateTemplate(
          orgB.tenant,
          templateA.id as string,
          { name: "Hijacked Template" },
          ownerActor
        )
      ).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("prevents marking notifications belonging to another recipient or tenant", async () => {
      const comm = new SisCommunicationService(database);

      const notifA = await comm.createNotification(orgA.tenant, {
        recipientKind: "student",
        recipientId: classA.student.id,
        type: "general",
        title: "Secret Alert",
        message: "Private Data",
      });

      // Tenant B tries to mark it as read
      await expect(
        comm.markRead(orgB.tenant, notifA.id as string)
      ).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 6: EXAMINATIONS & MARKS INTEGRITY
  // --------------------------------------------------------------------------
  describe("Examinations & Results Isolation", () => {
    it("prevents entering marks for a student belonging to another tenant", async () => {
      const exams = new SisExaminationService(database);
      const suffix = randomUUID().slice(0, 6);

      const examA = await exams.createExamination(orgA.tenant, {
        name: `Midterm-${suffix}`,
        academicYearId: classA.year.id,
        startDate: "2026-10-01",
        endDate: "2026-10-10",
      });

      const examSubA = await exams.addExaminationSubject(orgA.tenant, {
        examinationId: examA.id,
        gradeId: classA.grade.id,
        sectionId: classA.section.id,
        subjectId: classA.subject.id,
        maximumMarks: 100,
        passingMarks: 50,
      });

      // Attempt to enter marks for Student B in Tenant A's exam -> 404 student not found for Tenant A
      await expect(
        exams.enterMark(orgA.tenant, {
          sourceType: "examination",
          sourceId: examA.id,
          examinationSubjectId: examSubA.id,
          studentId: classB.student.id, // Foreign student!
          obtainedMarks: 95,
          enteredBy: classA.staff.id,
        })
      ).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("prevents cross-tenant publication or inspection of examination results", async () => {
      const exams = new SisExaminationService(database);

      // Tenant B queries student result for Student A
      const result = await exams.getStudentResult(orgB.tenant, "non-existent-exam", classA.student.id);
      expect(result).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 7: DOMAIN MANAGEMENT & PLATFORM ISOLATION
  // --------------------------------------------------------------------------
  describe("Domain & Platform Isolation", () => {
    it("prevents cross-tenant verification or deletion of custom domains", async () => {
      const domainService = new DomainService(database);
      const domainA = `school-${randomUUID().slice(0, 8)}.edu`;

      const created = await domainService.createTenantDomain(orgA.organizationId, domainA);
      expect(created.verificationToken).toMatch(/^ha-verify=[a-f0-9]{64}$/);

      // Tenant B attempts to verify Tenant A's domain
      await expect(
        domainService.verifyTenantDomain(orgB.organizationId, created.id)
      ).rejects.toMatchObject({
        statusCode: 404,
      });

      // Tenant B attempts to delete Tenant A's domain
      await expect(
        domainService.deleteTenantDomain(orgB.organizationId, created.id)
      ).rejects.toMatchObject({
        statusCode: 404,
      });

      // Ensure domain still belongs to Tenant A
      const domainListA = await domainService.listTenantDomains(orgA.organizationId);
      expect(domainListA.some((d) => d.id === created.id)).toBe(true);
    });
  });
});
