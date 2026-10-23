import { migrate } from "../src/database/mysql94-migrator.js";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger } from "../src/common/logging/logger.js";
import { ApiError } from "../src/common/errors/api-error.js";
import { parsePagination, buildPaginationMetadata } from "../src/common/pagination/pagination.js";
import {
  validateCreateAcademicYear,
  validateCreateGrade,
  validateCreateSection,
  validateCreateStudent,
  validateUpdateStudent,
  validateCreateEnrollment,
  validateTransferStudent,
  validateCreateAttendanceSession,
  validateRecordAttendance,
  validateCreateStaff,
  validateCreateTeachingAssignment,
  validateCreateEnquiry,
  validateCreateApplication,
  validateCreateInvoice,
  validateRecordPayment,
  validateGenerateRecurringInvoices,
  validateCreateExpense,
  validateCreateIncome,
} from "../src/modules/education/validation/sis-validation.js";
import { loadConfig, type ApiConfig } from "../src/config/env.js";
import { createDatabaseClient, type DatabaseClient } from "../src/database/client.js";
import { AuthService } from "../src/modules/auth/services/auth.service.js";
import { SisAdmissionsService } from "../src/modules/education/sis-admissions.service.js";
import { SisFinanceService } from "../src/modules/education/sis-finance.service.js";
import { SisService } from "../src/modules/education/sis.service.js";
import { students } from "../src/database/schema.js";
import { and, eq } from "drizzle-orm";

const describeDatabase = process.env.RUN_DB_INTEGRATION_TESTS === "true" ? describe : describe.skip;
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(currentDirectory, "../src/database/migrations");

describeDatabase("Epic 10N Phase 3: Database Query Optimization, API Pre-Validation & Billing Atomicity", () => {
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
   * DB-001: SQL QUERY OPTIMIZATION & IN-DATABASE FILTERING
   * ───────────────────────────────────────────────────────────── */
  describe("DB-001: SQL Query Optimization & Tenant Isolation", () => {
    it("filters students directly in SQL by admissionNumber and status", async () => {
      const { tenant } = await createSisTenant(database, "db001-students");
      const sis = new SisService(database);
      const fixture = await createClassFixture(sis, tenant);

      const s1 = await sis.createStudent(tenant, {
        firstName: "Alice",
        lastName: "Wonderland",
        admissionDate: "2026-09-01",
        status: "active",
      });
      const s2 = await sis.createStudent(tenant, {
        firstName: "Bob",
        lastName: "Builder",
        admissionDate: "2026-09-01",
        status: "inactive",
      });

      const activeStudents = await sis.listStudents(tenant, { status: "active" });
      expect(activeStudents.some((s) => s.id === s1.id)).toBe(true);
      expect(activeStudents.some((s) => s.id === s2.id)).toBe(false);

      const byAdm = await sis.listStudents(tenant, { admissionNumber: s1.admissionNumber.toLowerCase() });
      expect(byAdm.length).toBe(1);
      expect(byAdm[0].id).toBe(s1.id);
    });

    it("filters enrollments directly in SQL by status, academicYear, and sectionId", async () => {
      const { tenant } = await createSisTenant(database, "db001-enrollments");
      const sis = new SisService(database);
      const fixture = await createClassFixture(sis, tenant);

      const student1 = await sis.createStudent(tenant, {
        firstName: "Student",
        lastName: "One",
        admissionDate: "2026-09-01",
        status: "active",
      });
      const student2 = await sis.createStudent(tenant, {
        firstName: "Student",
        lastName: "Two",
        admissionDate: "2026-09-01",
        status: "active",
      });

      const e1 = await sis.createEnrollment(tenant, {
        studentId: student1.id,
        academicYearId: fixture.year.id,
        academicYear: fixture.year.name,
        gradeId: fixture.grade.id,
        sectionId: fixture.section.id,
        startDate: "2026-09-01",
        status: "active",
      });
      const e2 = await sis.createEnrollment(tenant, {
        studentId: student2.id,
        academicYearId: fixture.year.id,
        academicYear: fixture.year.name,
        gradeId: fixture.grade.id,
        sectionId: fixture.section.id,
        startDate: "2026-09-01",
        status: "withdrawn",
      });

      const activeList = await sis.listEnrollments(tenant, { status: "active", sectionId: fixture.section.id });
      expect(activeList.some((e) => e.id === e1.id)).toBe(true);
      expect(activeList.some((e) => e.id === e2.id)).toBe(false);
    });

    it("filters attendance sessions directly in SQL by date and academicYearId", async () => {
      const { tenant } = await createSisTenant(database, "db001-attendance");
      const sis = new SisService(database);
      const fixture = await createClassFixture(sis, tenant);

      const session1 = await sis.createAttendanceSession(tenant, {
        academicYearId: fixture.year.id,
        gradeId: fixture.grade.id,
        sectionId: fixture.section.id,
        date: "2026-10-01",
        sessionType: "homeroom",
        status: "scheduled",
      });
      const session2 = await sis.createAttendanceSession(tenant, {
        academicYearId: fixture.year.id,
        gradeId: fixture.grade.id,
        sectionId: fixture.section.id,
        date: "2026-10-02",
        sessionType: "homeroom",
        status: "completed",
      });

      const sessionsOct1 = await sis.listAttendanceSessions(tenant, { date: "2026-10-01" });
      expect(sessionsOct1.some((s) => s.id === session1.id)).toBe(true);
      expect(sessionsOct1.some((s) => s.id === session2.id)).toBe(false);

      const totalOct1 = await sis.countAttendanceSessions(tenant, { date: "2026-10-01" });
      expect(totalOct1).toBe(1);
    });

    it("filters finance invoices, expenses and incomes with gte/lte dates in SQL", async () => {
      const { tenant, auth } = await createSisTenant(database, "db001-finance-sql");
      const sis = new SisService(database);
      const finance = new SisFinanceService(database);
      const fixture = await createClassFixture(sis, tenant);
      const actor = { userId: auth.user.id, role: "Owner" };

      const student = await sis.createStudent(tenant, {
        firstName: "Finance",
        lastName: "Pupil",
        admissionDate: "2026-09-01",
        status: "active",
      });

      const enrollment = await sis.createEnrollment(tenant, {
        studentId: student.id,
        academicYearId: fixture.year.id,
        academicYear: fixture.year.name,
        gradeId: fixture.grade.id,
        sectionId: fixture.section.id,
        startDate: "2026-09-01",
        status: "active",
      });

      const feeCategory = await finance.createCategory(tenant, { name: "Tuition", code: "TUIT" }, actor);
      const feeStructure = await finance.createStructure(
        tenant,
        {
          name: "Term Tuition",
          feeCategoryId: feeCategory.id,
          academicYearId: fixture.year.id,
          gradeId: fixture.grade.id,
          amountCents: 5000,
          paymentFrequency: "one_time",
          dueDate: "2026-10-15",
          status: "active",
        },
        actor
      );
      await finance.assignFee(tenant, student.id, enrollment.id, feeStructure.id, actor);

      const inv1 = await finance.createInvoice(
        tenant,
        {
          studentId: student.id,
          enrollmentId: enrollment.id,
          academicYearId: fixture.year.id,
          feeStructureIds: [feeStructure.id],
          title: "October Tuition",
          amountCents: 5000,
          issueDate: "2026-10-01",
          dueDate: "2026-10-15",
        },
        actor
      );

      const inv2 = await finance.createInvoice(
        tenant,
        {
          studentId: student.id,
          enrollmentId: enrollment.id,
          academicYearId: fixture.year.id,
          feeStructureIds: [feeStructure.id],
          title: "November Tuition",
          amountCents: 5000,
          issueDate: "2026-11-01",
          dueDate: "2026-11-15",
        },
        actor
      );

      const octInvoices = await finance.listInvoices(tenant, {
        dateFrom: "2026-10-01",
        dateTo: "2026-10-31",
      });
      expect(octInvoices.some((i) => i.id === inv1.id)).toBe(true);
      expect(octInvoices.some((i) => i.id === inv2.id)).toBe(false);

      // Verify expenses
      const expenseCategory = await finance.createExpenseCategory(tenant, { name: "Supplies", code: "SUPP" }, actor);
      const exp1 = await finance.createExpense(
        tenant,
        {
          title: "Books",
          amountCents: 2000,
          categoryId: expenseCategory.id,
          payee: "Book Store",
          expenseDate: "2026-10-05",
        },
        actor
      );
      const exp2 = await finance.createExpense(
        tenant,
        {
          title: "Software",
          amountCents: 8000,
          categoryId: expenseCategory.id,
          payee: "Tech Vendor",
          expenseDate: "2026-11-05",
        },
        actor
      );

      const octExpenses = await finance.listExpenses(tenant, {
        dateFrom: "2026-10-01",
        dateTo: "2026-10-31",
      });
      expect(octExpenses.some((e) => e.id === exp1.id)).toBe(true);
      expect(octExpenses.some((e) => e.id === exp2.id)).toBe(false);
    });

    it("strictly isolates cross-tenant records in optimized SQL queries", async () => {
      const { tenant: tenantA } = await createSisTenant(database, "db001-tenant-a");
      const { tenant: tenantB } = await createSisTenant(database, "db001-tenant-b");
      const sis = new SisService(database);

      const studentA = await sis.createStudent(tenantA, {
        firstName: "SecretA",
        lastName: "Child",
        admissionDate: "2026-09-01",
        status: "active",
      });

      const listB = await sis.listStudents(tenantB);
      expect(listB.some((s) => s.id === studentA.id)).toBe(false);

      const countB = await sis.countStudents(tenantB);
      expect(countB).toBe(0);
    });
  });

  /* ─────────────────────────────────────────────────────────────
   * DB-002: CENTRALIZED API REQUEST PRE-VALIDATION
   * ───────────────────────────────────────────────────────────── */
  describe("DB-002: Centralized API Request Validation", () => {
    it("validates valid input payloads successfully", () => {
      const validStudent = validateCreateStudent({
        firstName: "John",
        lastName: "Doe",
        admissionDate: "2026-09-01",
        status: "active",
      });
      expect(validStudent.firstName).toBe("John");
      expect(validStudent.lastName).toBe("Doe");

      const validYear = validateCreateAcademicYear({
        name: "2026-2027",
        startDate: "2026-09-01",
        endDate: "2027-06-30",
        status: "active",
      });
      expect(validYear.name).toBe("2026-2027");

      const validGrade = validateCreateGrade({
        name: "Grade 1",
        level: 1,
      });
      expect(validGrade.level).toBe(1);

      const validSection = validateCreateSection({
        gradeId: "12345",
        name: "Section A",
        capacity: 25,
      });
      expect(validSection.capacity).toBe(25);
    });

    it("rejects missing required fields with HTTP 400 and VALIDATION_FAILED code", () => {
      try {
        validateCreateStudent({ firstName: "" });
        expect.fail("Should have thrown ApiError");
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiError = err as ApiError;
        expect(apiError.statusCode).toBe(400);
        expect(apiError.code).toBe("VALIDATION_FAILED");
        expect(apiError.message).toBe("Request validation failed.");
        expect(apiError.details).toBeDefined();
        expect(apiError.details?.some((d) => d.field === "firstName")).toBe(true);
      }
    });

    it("rejects invalid enum values with clear validation details", () => {
      try {
        validateCreateStudent({
          firstName: "John",
          lastName: "Doe",
          admissionDate: "2026-09-01",
          gender: "invalid_gender_value",
        });
        expect.fail("Should have thrown ApiError");
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiError = err as ApiError;
        expect(apiError.statusCode).toBe(400);
        expect(apiError.code).toBe("VALIDATION_FAILED");
        expect(apiError.details?.some((d) => d.field === "gender")).toBe(true);
      }
    });

    it("rejects invalid date formats", () => {
      try {
        validateCreateAcademicYear({
          name: "2026-2027",
          startDate: "not-a-valid-date",
          endDate: "2027-06-30",
        });
        expect.fail("Should have thrown ApiError");
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiError = err as ApiError;
        expect(apiError.statusCode).toBe(400);
        expect(apiError.code).toBe("VALIDATION_FAILED");
        expect(apiError.details?.some((d) => d.field === "startDate")).toBe(true);
      }
    });

    it("rejects non-positive cents for financial operations", () => {
      try {
        validateCreateInvoice({
          studentId: "123",
          academicYearId: "456",
          title: "Fee",
          amountCents: -500,
          dueDate: "2026-10-31",
        });
        expect.fail("Should have thrown ApiError");
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiError = err as ApiError;
        expect(apiError.statusCode).toBe(400);
        expect(apiError.code).toBe("VALIDATION_FAILED");
        expect(apiError.details?.some((d) => d.field === "amountCents")).toBe(true);
      }
    });

    it("defends against prototype pollution by rejecting dangerous keys", () => {
      const maliciousPayload = JSON.parse('{"firstName": "Hacker", "lastName": "Man", "admissionDate": "2026-09-01", "__proto__": {"admin": true}}');
      try {
        validateCreateStudent(maliciousPayload);
        expect.fail("Should have thrown ApiError for prototype pollution");
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiError = err as ApiError;
        expect(apiError.statusCode).toBe(400);
        expect(apiError.code).toBe("VALIDATION_FAILED");
        expect(apiError.details?.some((d) => d.field === "__proto__")).toBe(true);
      }
    });
  });

  /* ─────────────────────────────────────────────────────────────
   * DB-003: BOUNDED PAGINATION & METADATA
   * ───────────────────────────────────────────────────────────── */
  describe("DB-003: Bounded Pagination & Dual-Envelope Responses", () => {
    it("parses default pagination correctly", () => {
      const pagination = parsePagination();
      expect(pagination.page).toBe(1);
      expect(pagination.pageSize).toBe(25);
      expect(pagination.limit).toBe(25);
      expect(pagination.offset).toBe(0);
    });

    it("parses page and pageSize query parameters accurately", () => {
      const params = new URLSearchParams("page=3&pageSize=15");
      const pagination = parsePagination(params);
      expect(pagination.page).toBe(3);
      expect(pagination.pageSize).toBe(15);
      expect(pagination.limit).toBe(15);
      expect(pagination.offset).toBe(30);
    });

    it("parses limit and offset parameters and derives page", () => {
      const params = new URLSearchParams("limit=20&offset=40");
      const pagination = parsePagination(params);
      expect(pagination.limit).toBe(20);
      expect(pagination.offset).toBe(40);
      expect(pagination.page).toBe(3);
      expect(pagination.pageSize).toBe(20);
    });

    it("clamps requested page size to max limit of 100", () => {
      const params = new URLSearchParams("pageSize=500");
      const pagination = parsePagination(params);
      expect(pagination.pageSize).toBe(100);
      expect(pagination.limit).toBe(100);
    });

    it("generates complete and accurate pagination metadata", () => {
      const pagination = parsePagination(new URLSearchParams("page=2&pageSize=10"));
      const metadata = buildPaginationMetadata(35, pagination);
      expect(metadata.page).toBe(2);
      expect(metadata.pageSize).toBe(10);
      expect(metadata.totalItems).toBe(35);
      expect(metadata.totalPages).toBe(4);
      expect(metadata.hasPreviousPage).toBe(true);
      expect(metadata.hasNextPage).toBe(true);
    });

    it("paginates student lists deterministically with bounded limit and offset", async () => {
      const { tenant } = await createSisTenant(database, "db003-student-paging");
      const sis = new SisService(database);

      // Create 15 students
      for (let i = 1; i <= 15; i++) {
        await sis.createStudent(tenant, {
          firstName: `Student${String(i).padStart(2, "0")}`,
          lastName: "PaginationTest",
          admissionDate: "2026-09-01",
          status: "active",
        });
      }

      const page1Params = parsePagination(new URLSearchParams("page=1&pageSize=5"));
      const page2Params = parsePagination(new URLSearchParams("page=2&pageSize=5"));

      const [page1Students, total] = await Promise.all([
        sis.listStudents(tenant, {}, page1Params),
        sis.countStudents(tenant),
      ]);
      const page2Students = await sis.listStudents(tenant, {}, page2Params);

      expect(total).toBe(15);
      expect(page1Students.length).toBe(5);
      expect(page2Students.length).toBe(5);

      const p1Ids = new Set(page1Students.map((s) => s.id));
      for (const s of page2Students) {
        expect(p1Ids.has(s.id)).toBe(false);
      }
    });
  });

  /* ─────────────────────────────────────────────────────────────
   * DB-004: RECURRING BILLING BATCH ATOMICITY & LOCKING
   * ───────────────────────────────────────────────────────────── */
  describe("DB-004: Recurring Billing Batch Atomicity", () => {
    it("generates recurring invoices under per-student transaction boundaries", async () => {
      const { tenant, auth } = await createSisTenant(database, "db004-billing-batch");
      const sis = new SisService(database);
      const finance = new SisFinanceService(database);
      const fixture = await createClassFixture(sis, tenant);
      const actor = { userId: auth.user.id, role: "Owner" };

      // Create tuition fee structure
      const feeCategory = await finance.createCategory(tenant, { name: "Tuition", code: "TUIT" }, actor);
      const feeStructure = await finance.createStructure(
        tenant,
        {
          name: "Monthly Tuition",
          feeCategoryId: feeCategory.id,
          academicYearId: fixture.year.id,
          gradeId: fixture.grade.id,
          amountCents: 10000,
          paymentFrequency: "monthly",
          dueDate: "2026-11-05",
          status: "active",
        },
        actor
      );

      // Create 3 active students and enroll them
      const s1 = await sis.createStudent(tenant, { firstName: "Child1", lastName: "Active", admissionDate: "2026-09-01", status: "active" });
      const s2 = await sis.createStudent(tenant, { firstName: "Child2", lastName: "Active", admissionDate: "2026-09-01", status: "active" });
      const s3 = await sis.createStudent(tenant, { firstName: "Child3", lastName: "Active", admissionDate: "2026-09-01", status: "active" });

      const e1 = await sis.createEnrollment(tenant, {
        studentId: s1.id,
        academicYearId: fixture.year.id,
        academicYear: fixture.year.name,
        gradeId: fixture.grade.id,
        sectionId: fixture.section.id,
        startDate: "2026-09-01",
        status: "active",
      });
      const e2 = await sis.createEnrollment(tenant, {
        studentId: s2.id,
        academicYearId: fixture.year.id,
        academicYear: fixture.year.name,
        gradeId: fixture.grade.id,
        sectionId: fixture.section.id,
        startDate: "2026-09-01",
        status: "active",
      });
      const e3 = await sis.createEnrollment(tenant, {
        studentId: s3.id,
        academicYearId: fixture.year.id,
        academicYear: fixture.year.name,
        gradeId: fixture.grade.id,
        sectionId: fixture.section.id,
        startDate: "2026-09-01",
        status: "active",
      });

      await finance.assignFee(tenant, s1.id, e1.id, feeStructure.id, actor);
      await finance.assignFee(tenant, s2.id, e2.id, feeStructure.id, actor);
      await finance.assignFee(tenant, s3.id, e3.id, feeStructure.id, actor);

      // Execute recurring billing batch
      const batchResult = await finance.generateRecurringInvoices(
        tenant,
        {
          academicYearId: fixture.year.id,
          billingPeriod: "2026-11",
          dueDate: "2026-11-15",
          feeStructureId: feeStructure.id,
        },
        actor
      );

      expect(batchResult.eligibleStudentsCount).toBe(3);
      expect(batchResult.createdInvoicesCount).toBe(3);
      expect(batchResult.skippedDuplicatesCount).toBe(0);
      expect(batchResult.failedItems.length).toBe(0);
      expect(batchResult.batchStatus).toBe("completed");

      // Verify re-running the same period idempotently skips duplicates
      const secondRun = await finance.generateRecurringInvoices(
        tenant,
        {
          academicYearId: fixture.year.id,
          billingPeriod: "2026-11",
          dueDate: "2026-11-15",
          feeStructureId: feeStructure.id,
        },
        actor
      );

      expect(secondRun.eligibleStudentsCount).toBe(3);
      expect(secondRun.createdInvoicesCount).toBe(0);
      expect(secondRun.skippedDuplicatesCount).toBe(3);
      expect(secondRun.batchStatus).toBe("skipped");
    });

    it("prevents double-billing under concurrent billing execution", async () => {
      const { tenant, auth } = await createSisTenant(database, "db004-concurrent-billing");
      const sis = new SisService(database);
      const finance = new SisFinanceService(database);
      const fixture = await createClassFixture(sis, tenant);
      const actor = { userId: auth.user.id, role: "Owner" };

      const feeCategory = await finance.createCategory(tenant, { name: "Tuition", code: "TUIT" }, actor);
      const feeStructure = await finance.createStructure(
        tenant,
        {
          name: "Concurrent Tuition",
          feeCategoryId: feeCategory.id,
          academicYearId: fixture.year.id,
          gradeId: fixture.grade.id,
          amountCents: 12000,
          paymentFrequency: "monthly",
          dueDate: "2026-12-05",
          status: "active",
        },
        actor
      );

      const student = await sis.createStudent(tenant, {
        firstName: "Concurrent",
        lastName: "Candidate",
        admissionDate: "2026-09-01",
        status: "active",
      });

      const enrollment = await sis.createEnrollment(tenant, {
        studentId: student.id,
        academicYearId: fixture.year.id,
        academicYear: fixture.year.name,
        gradeId: fixture.grade.id,
        sectionId: fixture.section.id,
        startDate: "2026-09-01",
        status: "active",
      });

      await finance.assignFee(tenant, student.id, enrollment.id, feeStructure.id, actor);

      // Run two parallel batch requests simultaneously
      const [runA, runB] = await Promise.all([
        finance.generateRecurringInvoices(
          tenant,
          {
            academicYearId: fixture.year.id,
            billingPeriod: "2026-12",
            dueDate: "2026-12-15",
            feeStructureId: feeStructure.id,
          },
          actor
        ),
        finance.generateRecurringInvoices(
          tenant,
          {
            academicYearId: fixture.year.id,
            billingPeriod: "2026-12",
            dueDate: "2026-12-15",
            feeStructureId: feeStructure.id,
          },
          actor
        ),
      ]);

      const totalCreated = runA.createdInvoicesCount + runB.createdInvoicesCount;
      const totalSkipped = runA.skippedDuplicatesCount + runB.skippedDuplicatesCount;

      expect(totalCreated).toBe(1);
      expect(totalSkipped).toBe(1);

      // Verify database has exactly 1 invoice for this student and billing period
      const invoices = await finance.listInvoices(tenant, { studentId: student.id });
      expect(invoices.length).toBe(1);
    });

    it("excludes archived/withdrawn students from recurring billing", async () => {
      const { tenant, auth } = await createSisTenant(database, "db004-archived-exclusion");
      const sis = new SisService(database);
      const finance = new SisFinanceService(database);
      const fixture = await createClassFixture(sis, tenant);
      const actor = { userId: auth.user.id, role: "Owner" };

      const feeCategory = await finance.createCategory(tenant, { name: "Tuition", code: "TUIT" }, actor);
      const feeStructure = await finance.createStructure(
        tenant,
        {
          name: "Exclusion Tuition",
          feeCategoryId: feeCategory.id,
          academicYearId: fixture.year.id,
          gradeId: fixture.grade.id,
          amountCents: 9000,
          paymentFrequency: "monthly",
          dueDate: "2026-10-05",
          status: "active",
        },
        actor
      );

      const activeStudent = await sis.createStudent(tenant, { firstName: "Stay", lastName: "Active", admissionDate: "2026-09-01", status: "active" });
      const archivedStudent = await sis.createStudent(tenant, { firstName: "Left", lastName: "Archived", admissionDate: "2026-09-01", status: "archived" });

      const eActive = await sis.createEnrollment(tenant, {
        studentId: activeStudent.id,
        academicYearId: fixture.year.id,
        academicYear: fixture.year.name,
        gradeId: fixture.grade.id,
        sectionId: fixture.section.id,
        startDate: "2026-09-01",
        status: "active",
      });
      const eArchived = await sis.createEnrollment(tenant, {
        studentId: archivedStudent.id,
        academicYearId: fixture.year.id,
        academicYear: fixture.year.name,
        gradeId: fixture.grade.id,
        sectionId: fixture.section.id,
        startDate: "2026-09-01",
        status: "active",
      });

      await finance.assignFee(tenant, activeStudent.id, eActive.id, feeStructure.id, actor);
      await finance.assignFee(tenant, archivedStudent.id, eArchived.id, feeStructure.id, actor);

      const batchResult = await finance.generateRecurringInvoices(
        tenant,
        {
          academicYearId: fixture.year.id,
          billingPeriod: "2026-10",
          issueDate: "2026-10-01",
          dueDate: "2026-10-15",
          feeStructureId: feeStructure.id,
        },
        actor
      );

      expect(batchResult.eligibleStudentsCount).toBe(2);
      expect(batchResult.createdInvoicesCount).toBe(1);
      expect(batchResult.archivedExcludedCount).toBe(1);

      const archivedInvoices = await finance.listInvoices(tenant, { studentId: archivedStudent.id });
      expect(archivedInvoices.length).toBe(0);
    });
  });
});

async function createSisTenant(database: DatabaseClient, label: string) {
  const suffix = randomUUID().slice(0, 8);
  const auth = await new AuthService(database).register({
    firstName: "Epic10N",
    lastName: "Phase3",
    email: `${label}-${suffix}@example.com`,
    password: "password123",
    organizationName: `Org ${label} ${suffix}`,
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
    firstName: "John",
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
