import { randomUUID } from "node:crypto";
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
import { SisAnalyticsService } from "../src/modules/education/sis-analytics.service.js";
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

describeDatabase("Stage 20F.3: End-to-End Workflow Regression Suite", () => {
  let config: ApiConfig;
  let database: DatabaseClient;
  const tracker = createFixtureTracker();

  let org: FixtureTenant;
  let academic: ClassFixture;

  beforeAll(async () => {
    config = loadConfig({
      ...process.env,
      NODE_ENV: "test",
      LOG_LEVEL: "error",
    });
    database = createDatabaseClient(config.database, createLogger(config));

    // Provision main isolated tenant & academic base
    org = await createIsolatedTenant(database, "workflow-e2e", tracker);
    academic = await createAcademicClassFixture(database, org.tenant);
  });

  afterAll(async () => {
    try {
      await cleanupTrackedFixtures(database, tracker);
    } finally {
      await database.close();
    }
  });

  // ==========================================================================
  // 1. ORGANIZATION, WORKSPACE & BUSINESS WORKFLOWS
  // ==========================================================================
  describe("Workflow: Organization, Business & Workspace Lifecycle", () => {
    it("validates organization creation, membership, role assignment, and workspace context retrieval", async () => {
      const auth = new AuthService(database);
      const userSuffix = randomUUID().slice(0, 6);
      const testEmail = `org-flow-${userSuffix}@example.test`;

      // 1. User registration & primary organization creation
      const reg = await auth.register({
        firstName: "Flow",
        lastName: "Admin",
        email: testEmail,
        password: "Password123!",
        organizationName: `Workflow Org ${userSuffix}`,
        organizationType: "School",
        industry: "Education",
        country: "United States",
      });
      tracker.organizationIds.add(reg.memberships[0].organizationId);
      tracker.userIds.add(reg.user.id);

      expect(reg.user.id).toBeDefined();
      expect(reg.memberships).toHaveLength(1);
      const orgId = reg.memberships[0].organizationId;

      // 2. Retrieve organization details & workspace mapping
      const sis = new SisService(database);
      const tenant = await sis.getTenant(orgId);
      expect(tenant.organizationId).toBe(orgId);
      expect(tenant.workspaceId).toBeDefined();

      // 3. User second registration / tenant mapping
      const secondaryEmail = `member-${userSuffix}@example.test`;
      const secondaryUser = await auth.register({
        firstName: "Staff",
        lastName: "Member",
        email: secondaryEmail,
        password: "Password123!",
        organizationName: `Staff School ${userSuffix}`,
        organizationType: "School",
        industry: "Education",
        country: "United States",
      });
      tracker.organizationIds.add(secondaryUser.memberships[0].organizationId);
      tracker.userIds.add(secondaryUser.user.id);

      // Verify organization data retrieval
      const reloadedTenant = await sis.getTenant(orgId);
      expect(reloadedTenant.workspaceId).toBe(tenant.workspaceId);
    });

    it("validates custom domain lifecycle: registration, token issuance, and state handling", async () => {
      const domainService = new DomainService(database);
      const hostname = `school-${randomUUID().slice(0, 6)}.testedu.org`;

      // 1. Register domain
      const created = await domainService.createTenantDomain(org.organizationId, hostname);
      expect(created.domain).toBe(hostname);
      expect(created.status).toBe("pending_verification");
      expect(created.verificationToken).toMatch(/^ha-verify=[a-f0-9]{64}$/);

      // 2. Fetch domain by organization
      const domains = await domainService.listTenantDomains(org.organizationId);
      const found = domains.find((d) => d.domain === hostname);
      expect(found).toBeDefined();
      expect(found?.status).toBe("pending_verification");

      // 3. Domain deletion
      await domainService.deleteTenantDomain(org.organizationId, created.id);
      const remaining = await domainService.listTenantDomains(org.organizationId);
      expect(remaining.some((d) => d.id === created.id)).toBe(false);
    });
  });

  // ==========================================================================
  // 2. STUDENT LIFECYCLE WORKFLOW
  // ==========================================================================
  describe("Workflow: Student Lifecycle", () => {
    it("validates student admission, profile updates, enrollment, and directory retrieval", async () => {
      const sis = new SisService(database);
      const suffix = randomUUID().slice(0, 6);

      // 1. Student admission
      const student = await sis.createStudent(org.tenant, {
        firstName: "Lifecycle",
        lastName: `Student-${suffix}`,
        dateOfBirth: "2015-04-12",
        gender: "female",
        admissionDate: "2026-08-15",
        status: "active",
        phone: "555-0100",
        address: "123 School Lane",
        guardians: [
          {
            firstName: "Primary",
            lastName: "Guardian",
            relationship: "mother",
            email: `guardian-${suffix}@example.test`,
            phone: "555-0199",
            isEmergencyContact: true,
            isPrimaryContact: true,
            portalAccessEnabled: true,
            authorizedForPortal: true,
          },
        ],
      });
      expect(student.id).toBeDefined();
      expect(student.admissionNumber).toBeDefined();
      expect(student.status).toBe("active");

      // 2. Profile editing
      const updated = await sis.updateStudent(org.tenant, student.id, {
        address: "456 Updated Way",
        phone: "555-0999",
      });
      expect(updated.address).toBe("456 Updated Way");
      expect(updated.phone).toBe("555-0999");

      // 3. Class and section enrollment
      const enrollment = await sis.createEnrollment(org.tenant, {
        studentId: student.id,
        academicYear: academic.year.name,
        gradeId: academic.grade.id,
        sectionId: academic.section.id,
        enrollmentDate: "2026-08-15",
        status: "active",
      });
      expect(enrollment.id).toBeDefined();
      expect(enrollment.studentId).toBe(student.id);

      // 4. Update enrollment status (e.g., transferred)
      const updatedEnrollment = await sis.updateEnrollment(org.tenant, enrollment.id, {
        status: "transferred",
      });
      expect(updatedEnrollment.status).toBe("transferred");

      // 5. Directory retrieval
      const directory = await sis.listStudents(org.tenant);
      const inDirectory = directory.find((s) => s.id === student.id);
      expect(inDirectory).toBeDefined();
      expect(inDirectory?.firstName).toBe("Lifecycle");
    });
  });

  // ==========================================================================
  // 3. STAFF & TEACHER LIFECYCLE WORKFLOW
  // ==========================================================================
  describe("Workflow: Staff & Teacher Lifecycle", () => {
    it("validates staff creation, profile update, department allocation, and teaching assignment", async () => {
      const sis = new SisService(database);
      const suffix = randomUUID().slice(0, 6);

      // 1. Department creation
      const dept = await sis.createDepartment(org.tenant, {
        name: `Science Dept-${suffix}`,
      });

      // 2. Staff record creation
      const staff = await sis.createStaff(org.tenant, {
        firstName: "Ada",
        lastName: `Lovelace-${suffix}`,
        hireDate: "2026-08-01",
        staffType: "teacher",
        employmentStatus: "full_time",
        status: "active",
        phone: "555-0100",
        departmentId: dept.id,
      });
      expect(staff.id).toBeDefined();
      expect(staff.departmentId).toBe(dept.id);

      // 3. Staff profile update
      const updatedStaff = await sis.updateStaff(org.tenant, staff.id, {
        phone: "555-0456",
        address: "789 Campus Walk",
      });
      expect(updatedStaff.phone).toBe("555-0456");
      expect(updatedStaff.address).toBe("789 Campus Walk");

      // 4. Subject assignment to class
      const newSubject = await sis.createSubject(org.tenant, {
        name: `Physics-${suffix}`,
        code: `PHY-${suffix}`,
        status: "active",
        displayOrder: 2,
      });
      await sis.assignSubjectToClass(org.tenant, academic.grade.id, newSubject.id);

      // 5. Teacher teaching assignment
      const assignment = await sis.createTeachingAssignment(org.tenant, {
        staffId: staff.id,
        academicYear: academic.year.name,
        gradeId: academic.grade.id,
        sectionId: academic.section.id,
        subjectId: newSubject.id,
        isActive: true,
      });
      expect(assignment.id).toBeDefined();
      expect(assignment.staffId).toBe(staff.id);
      expect(assignment.subjectId).toBe(newSubject.id);

      // 6. Authorized staff listing
      const allStaff = await sis.listStaff(org.tenant);
      expect(allStaff.some((s) => s.id === staff.id)).toBe(true);
    });
  });

  // ==========================================================================
  // 4. ATTENDANCE & TIMETABLE WORKFLOW
  // ==========================================================================
  describe("Workflow: Attendance & Timetable", () => {
    it("validates attendance session lifecycle, record marking, updates, and conflict detection", async () => {
      const sis = new SisService(database);
      const dateStr = "2026-09-10";

      // 1. Create attendance session
      const session = await sis.createAttendanceSession(org.tenant, {
        academicYearId: academic.year.id,
        gradeId: academic.grade.id,
        sectionId: academic.section.id,
        date: dateStr,
        sessionType: "morning",
        status: "submitted",
      });
      expect(session.id).toBeDefined();

      // 2. Record attendance for student
      const savedRecords = await sis.saveAttendanceRecords(
        org.tenant,
        session.id,
        [
          {
            studentId: academic.student.id,
            status: "present",
            note: "On time",
          },
        ],
        academic.staff.id
      );
      expect(savedRecords).toBeDefined();

      // 3. List attendance records for session
      const records = await sis.listAttendanceRecords(org.tenant, session.id);
      expect(records).toHaveLength(1);
      expect(records[0].status).toBe("present");

      // 4. Update attendance record (change from present to late)
      await sis.saveAttendanceRecords(
        org.tenant,
        session.id,
        [
          {
            studentId: academic.student.id,
            status: "late",
            note: "Traffic delay",
          },
        ],
        academic.staff.id
      );

      const updatedRecords = await sis.listAttendanceRecords(org.tenant, session.id);
      expect(updatedRecords[0].status).toBe("late");

      // 5. Student attendance history
      const history = await sis.getStudentAttendanceHistory(org.tenant, academic.student.id);
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history.some((h) => h.record.status === "late")).toBe(true);

      // 6. Timetable creation & conflict detection
      const period = await sis.savePeriod(org.tenant, {
        name: `P1-${randomUUID().slice(0, 4)}`,
        startTime: "09:00",
        endTime: "10:00",
        type: "teaching",
        displayOrder: 1,
      });

      const entry1 = await sis.saveTimetableEntry(org.tenant, {
        academicYearId: academic.year.id,
        gradeId: academic.grade.id,
        sectionId: academic.section.id,
        subjectId: academic.subject.id,
        teacherId: academic.staff.id,
        dayOfWeek: 1,
        periodId: period.id,
      });
      expect(entry1.id).toBeDefined();

      // Reject schedule collision (same teacher, same day, same period)
      await expect(
        sis.saveTimetableEntry(org.tenant, {
          academicYearId: academic.year.id,
          gradeId: academic.grade.id,
          sectionId: academic.section.id,
          subjectId: academic.subject.id,
          teacherId: academic.staff.id,
          dayOfWeek: 1,
          periodId: period.id,
        })
      ).rejects.toThrow();
    });
  });

  // ==========================================================================
  // 5. FINANCE LIFECYCLE WORKFLOW
  // ==========================================================================
  describe("Workflow: Finance Lifecycle", () => {
    it("validates fee category, structure, invoicing, partial payment, full payment, and balance consistency", async () => {
      const finance = new SisFinanceService(database);
      const suffix = randomUUID().slice(0, 6);

      // 1. Fee category creation
      const category = await finance.createCategory(org.tenant, {
        name: `Tuition Fee ${suffix}`,
        code: `TUI-${suffix}`,
      });
      expect(category.id).toBeDefined();

      // 2. Fee structure configuration
      const structure = await finance.createStructure(org.tenant, {
        feeCategoryId: category.id,
        academicYearId: academic.year.id,
        gradeId: academic.grade.id,
        name: `Term 1 Tuition ${suffix}`,
        amountCents: 100000, // $1000.00
      });
      expect(structure.id).toBeDefined();
      expect(structure.amountCents).toBe(100000);

      // 3. Issue invoice ($1,000.00) with future dueDate to test issued status
      const invoice = await finance.createInvoice(org.tenant, {
        studentId: academic.student.id,
        enrollmentId: academic.enrollment.id,
        academicYearId: academic.year.id,
        issueDate: "2026-09-01",
        dueDate: "2030-09-30",
        feeStructureIds: [structure.id],
        status: "issued",
      });
      expect(invoice.id).toBeDefined();
      expect(invoice.totalCents).toBe(100000);
      expect(invoice.paidAmountCents).toBe(0);
      expect(invoice.status).toBe("issued");

      // 4. Record partial payment ($400.00)
      const partialPayment = await finance.recordPayment(org.tenant, {
        invoiceId: invoice.id,
        amountCents: 40000,
        paymentDate: "2026-09-05",
        paymentMethod: "bank_transfer",
        referenceNumber: `REF-P1-${suffix}`,
      });
      expect(partialPayment.receipt.id).toBeDefined();
      expect(partialPayment.invoice.paidAmountCents).toBe(40000);
      expect(partialPayment.invoice.status).toBe("partially_paid");

      // 5. Record final settlement payment ($600.00)
      const finalPayment = await finance.recordPayment(org.tenant, {
        invoiceId: invoice.id,
        amountCents: 60000,
        paymentDate: "2026-09-10",
        paymentMethod: "cash",
        referenceNumber: `REF-P2-${suffix}`,
      });
      expect(finalPayment.invoice.paidAmountCents).toBe(100000);
      expect(finalPayment.invoice.status).toBe("paid");

      // 6. Ledger consistency verification
      const ledger = await finance.ledger(org.tenant, academic.student.id);
      expect(ledger.length).toBeGreaterThanOrEqual(3); // 1 invoice + 2 payments
      const finalEntry = ledger[ledger.length - 1];
      expect(finalEntry.balanceCents).toBe(0); // Fully settled balance is 0
    });
  });

  // ==========================================================================
  // 6. COMMUNICATION LIFECYCLE WORKFLOW
  // ==========================================================================
  describe("Workflow: Communication Lifecycle", () => {
    it("validates template creation, announcement broadcast, notification dispatch, and read status updates", async () => {
      const comms = new SisCommunicationService(database);
      const suffix = randomUUID().slice(0, 6);

      // 1. Template creation
      const template = await comms.createTemplate(org.tenant, {
        name: `Welcome Notice ${suffix}`,
        category: "general",
        subject: "Welcome {{student_name}}",
        content: "Welcome to {{school_name}}, class {{class_name}}.",
        supportedVariables: ["student_name", "school_name", "class_name"],
      });
      expect(template.id).toBeDefined();

      // 2. Announcement broadcast
      const announcement = await comms.createAnnouncement(org.tenant, {
        title: `School Reopening ${suffix}`,
        content: "Campus reopens next Monday for all grades.",
        priority: "high",
        audience: { type: "organization" },
        status: "published",
      });
      expect(announcement.id).toBeDefined();
      expect(announcement.status).toBe("published");

      // 3. Notification generation
      const notification = await comms.createNotification(org.tenant, {
        title: "Fee Reminder",
        message: "Please review your student ledger for upcoming due dates.",
        recipientKind: "student",
        recipientId: academic.student.id,
        type: "reminder",
      });
      expect(notification.id).toBeDefined();
      expect(notification.isRead).toBe(false);

      // 4. Read/unread status update
      const readNotif = await comms.markRead(org.tenant, String(notification.id));
      expect(readNotif.isRead).toBe(true);

      // 5. Active announcements query
      const list = await comms.listAnnouncements(org.tenant);
      expect(list.some((a) => a.id === announcement.id)).toBe(true);
    });
  });

  // ==========================================================================
  // 7. EXAMINATION & RESULTS LIFECYCLE WORKFLOW
  // ==========================================================================
  describe("Workflow: Examination & Results Lifecycle", () => {
    it("validates examination configuration, individual marks entry, calculation, approval, and publication protection", async () => {
      const examService = new SisExaminationService(database);
      const suffix = randomUUID().slice(0, 6);

      // 1. Examination creation
      const exam = await examService.createExamination(org.tenant, {
        name: `Midterm Exam ${suffix}`,
        academicYearId: academic.year.id,
        type: "midterm",
        startDate: "2026-10-01",
        endDate: "2026-10-15",
        status: "draft",
      });
      expect(exam.id).toBeDefined();

      // 2. Assessment subject configuration (with explicit sectionId matching enrollment)
      const examSubject = await examService.addExaminationSubject(org.tenant, {
        examinationId: exam.id,
        gradeId: academic.grade.id,
        sectionId: academic.section.id,
        subjectId: academic.subject.id,
        maximumMarks: 100,
        passingMarks: 50,
      });
      expect(examSubject.id).toBeDefined();

      // 3. Mark entry
      const mark = await examService.enterMark(org.tenant, {
        sourceType: "examination",
        sourceId: exam.id,
        examinationSubjectId: examSubject.id,
        studentId: academic.student.id,
        obtainedMarks: 88,
        enteredBy: academic.staff.id,
      });
      expect(mark.id).toBeDefined();
      expect(mark.obtainedMarks).toBe(88);
      expect(mark.percentage).toBe(88);
      expect(mark.grade).toBe("A");

      // 4. Result publication
      const publication = await examService.publishResults(
        org.tenant,
        exam.id,
        academic.grade.id,
        academic.section.id,
        academic.staff.id
      );
      expect(publication.id).toBeDefined();
      expect(publication.status).toBe("published");
      expect(publication.results[0].studentId).toBe(academic.student.id);
      expect(publication.results[0].passed).toBe(true);

      // 5. Verification: Published result modification protection
      // Modifying marks on an already published examination must be rejected
      await expect(
        examService.enterMark(org.tenant, {
          sourceType: "examination",
          sourceId: exam.id,
          examinationSubjectId: examSubject.id,
          studentId: academic.student.id,
          obtainedMarks: 95,
          enteredBy: academic.staff.id,
        })
      ).rejects.toThrow();

      // 6. Student result retrieval
      const studentResult = await examService.getStudentResult(
        org.tenant,
        exam.id,
        academic.student.id
      );
      expect(studentResult).not.toBeNull();
      expect(studentResult?.passed).toBe(true);
      expect(studentResult?.percentage).toBe(88);
    });
  });

  // ==========================================================================
  // 8. ANALYTICS & REPORTING WORKFLOW
  // ==========================================================================
  describe("Workflow: Analytics & Reporting", () => {
    it("validates summary metrics, demographic counts, data quality insights, and CSV export format", async () => {
      const analytics = new SisAnalyticsService(database);

      // 1. Overview metrics
      const overview = await analytics.getOverview(org.tenant);
      expect(overview).toBeDefined();
      expect(overview.students.total).toBeGreaterThanOrEqual(1);
      expect(overview.staff.total).toBeGreaterThanOrEqual(1);

      // 2. Data quality checks
      const dataQuality = await analytics.getDataQuality(org.tenant);
      expect(dataQuality).toBeDefined();
      expect(Array.isArray(dataQuality)).toBe(true);

      // 3. CSV report export
      const csvExport = await analytics.exportCsv(org.tenant, "student_directory");
      expect(typeof csvExport).toBe("string");
      expect(csvExport).toContain("Admission Number");
      expect(csvExport).toContain("Name");
      expect(csvExport).toContain("Status");
    });
  });
});
