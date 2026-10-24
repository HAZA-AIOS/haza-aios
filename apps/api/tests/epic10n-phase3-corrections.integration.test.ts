import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "../src/common/errors/api-error.js";
import { createLogger } from "../src/common/logging/logger.js";
import {
  buildPaginationMetadata,
  parsePagination,
} from "../src/common/pagination/pagination.js";
import { loadConfig, type ApiConfig } from "../src/config/env.js";
import { createDatabaseClient, type DatabaseClient } from "../src/database/client.js";
import { migrate } from "../src/database/mysql94-migrator.js";
import { backfillPortalRequestIdentifiers } from "../src/database/backfills/backfill-portal-identifiers.js";
import { portalUpdateRequests } from "../src/database/schema.js";
import { AuthService } from "../src/modules/auth/services/auth.service.js";
import { SisAdmissionsService } from "../src/modules/education/sis-admissions.service.js";
import { SisFinanceService } from "../src/modules/education/sis-finance.service.js";
import { SisService } from "../src/modules/education/sis.service.js";
import { and, eq, sql } from "drizzle-orm";

const describeDatabase = process.env.RUN_DB_INTEGRATION_TESTS === "true" ? describe : describe.skip;
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(currentDirectory, "../src/database/migrations");

describeDatabase("Epic 10N Phase 3 Corrections: Migration Integrity, Strict Parsing & Bounded Compatibility", () => {
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
   * CORRECTION A: HISTORICAL IDENTIFIER BACKFILL & DATA INTEGRITY
   * ───────────────────────────────────────────────────────────── */
  describe("Correction A: Historical Identifier Backfill & Data Integrity", () => {
    it("safely backfills legacy JSON-only enquiry and application identifiers", async () => {
      const { tenant } = await createSisTenant(database, "corr-a-legacy-backfill");
      const client = database.db;

      const legacyEnquiryId = randomUUID();
      const legacyAppId = randomUUID();
      const legacyEnqRef = `ENQ-2025-${randomUUID().slice(0, 5)}`;
      const legacyAppNum = `APP-2025-${randomUUID().slice(0, 5)}`;

      // Insert legacy rows with NULL reference_number and application_number columns, identifiers only in JSON payload
      await client.execute(sql`
        INSERT INTO portal_update_requests (id, workspace_id, requester_user_id, requester_role, request_type, status, reference_number, application_number, payload)
        VALUES (
          ${legacyEnquiryId},
          ${tenant.workspaceId},
          'legacy-user',
          'parent',
          'admission_enquiry',
          'new',
          NULL,
          NULL,
          ${JSON.stringify({ referenceNumber: legacyEnqRef, studentName: "Legacy Enquiry Student" })}
        )
      `);

      await client.execute(sql`
        INSERT INTO portal_update_requests (id, workspace_id, requester_user_id, requester_role, request_type, status, reference_number, application_number, payload)
        VALUES (
          ${legacyAppId},
          ${tenant.workspaceId},
          'legacy-user',
          'parent',
          'admission_application',
          'draft',
          NULL,
          NULL,
          ${JSON.stringify({ applicationNumber: legacyAppNum, student: { firstName: "Legacy", lastName: "App" } })}
        )
      `);

      // Run backfill procedure
      const result = await backfillPortalRequestIdentifiers(database, { workspaceId: tenant.workspaceId });
      expect(result.enquiriesBackfilled).toBeGreaterThanOrEqual(1);
      expect(result.applicationsBackfilled).toBeGreaterThanOrEqual(1);

      // Verify that the dedicated columns are now populated
      const [enqRow] = (await client.execute(sql`
        SELECT reference_number as referenceNumber FROM portal_update_requests WHERE id = ${legacyEnquiryId}
      `)) as unknown as [Array<{ referenceNumber: string }>];
      expect(enqRow[0].referenceNumber).toBe(legacyEnqRef);

      const [appRow] = (await client.execute(sql`
        SELECT application_number as applicationNumber FROM portal_update_requests WHERE id = ${legacyAppId}
      `)) as unknown as [Array<{ applicationNumber: string }>];
      expect(appRow[0].applicationNumber).toBe(legacyAppNum);

      // Verify idempotency: running backfill again performs zero writes on already populated rows
      const secondRun = await backfillPortalRequestIdentifiers(database, { workspaceId: tenant.workspaceId });
      expect(secondRun.enquiriesBackfilled).toBe(0);
      expect(secondRun.applicationsBackfilled).toBe(0);
    });

    it("preserves identical identifiers across different workspaces without collision (tenant isolation)", async () => {
      const { tenant: tenantA } = await createSisTenant(database, "corr-a-tenant-a");
      const { tenant: tenantB } = await createSisTenant(database, "corr-a-tenant-b");
      const client = database.db;

      const sharedRef = `ENQ-SHARED-${randomUUID().slice(0, 4)}`;
      const idA = randomUUID();
      const idB = randomUUID();

      // Insert identical reference numbers in JSON payloads in two distinct workspaces
      await client.execute(sql`
        INSERT INTO portal_update_requests (id, workspace_id, requester_user_id, requester_role, request_type, status, reference_number, payload)
        VALUES (${idA}, ${tenantA.workspaceId}, 'user-a', 'parent', 'admission_enquiry', 'new', NULL, ${JSON.stringify({ referenceNumber: sharedRef })})
      `);

      await client.execute(sql`
        INSERT INTO portal_update_requests (id, workspace_id, requester_user_id, requester_role, request_type, status, reference_number, payload)
        VALUES (${idB}, ${tenantB.workspaceId}, 'user-b', 'parent', 'admission_enquiry', 'new', NULL, ${JSON.stringify({ referenceNumber: sharedRef })})
      `);

      // Backfill both
      await backfillPortalRequestIdentifiers(database);

      const [rowA] = (await client.execute(sql`SELECT reference_number as ref FROM portal_update_requests WHERE id = ${idA}`)) as unknown as [Array<{ ref: string }>];
      const [rowB] = (await client.execute(sql`SELECT reference_number as ref FROM portal_update_requests WHERE id = ${idB}`)) as unknown as [Array<{ ref: string }>];

      expect(rowA[0].ref).toBe(sharedRef);
      expect(rowB[0].ref).toBe(sharedRef);
    });

    it("safely detects intra-workspace duplicate conflicts and leaves them unwritten without crashing", async () => {
      const { tenant } = await createSisTenant(database, "corr-a-conflict-test");
      const client = database.db;

      const duplicateRef = `ENQ-DUP-${randomUUID().slice(0, 4)}`;
      const row1Id = randomUUID();
      const row2Id = randomUUID();

      // Insert two rows with the same reference number in the SAME workspace
      await client.execute(sql`
        INSERT INTO portal_update_requests (id, workspace_id, requester_user_id, requester_role, request_type, status, reference_number, payload)
        VALUES (${row1Id}, ${tenant.workspaceId}, 'u1', 'parent', 'admission_enquiry', 'new', NULL, ${JSON.stringify({ referenceNumber: duplicateRef })})
      `);
      await client.execute(sql`
        INSERT INTO portal_update_requests (id, workspace_id, requester_user_id, requester_role, request_type, status, reference_number, payload)
        VALUES (${row2Id}, ${tenant.workspaceId}, 'u2', 'parent', 'admission_enquiry', 'new', NULL, ${JSON.stringify({ referenceNumber: duplicateRef })})
      `);

      const result = await backfillPortalRequestIdentifiers(database, { workspaceId: tenant.workspaceId });
      expect(result.enquiriesSkippedDuplicate).toBe(2);
      expect(result.conflicts.length).toBeGreaterThanOrEqual(2);

      // Verify that neither row caused a duplicate key crash and both remain intact
      const [rows] = (await client.execute(sql`
        SELECT reference_number as ref FROM portal_update_requests WHERE id IN (${row1Id}, ${row2Id})
      `)) as unknown as [Array<{ ref: string | null }>];
      expect(rows[0].ref).toBeNull();
      expect(rows[1].ref).toBeNull();
    });

    it("generates next sequential numbers accurately without colliding with legacy records", async () => {
      const { tenant } = await createSisTenant(database, "corr-a-sequence-test");
      const admissions = new SisAdmissionsService(database);
      const currentYear = new Date().getFullYear();

      // Create an initial enquiry
      const enq1 = await admissions.createEnquiry(tenant, {
        studentName: "Seq Student 1",
        guardianName: "Guardian 1",
        phone: "+15551234567",
        desiredGradeId: "grade-1",
      });

      // Verify format
      expect(enq1.referenceNumber).toMatch(new RegExp(`^ENQ-${currentYear}-\\d{5}$`));

      // Create second enquiry
      const enq2 = await admissions.createEnquiry(tenant, {
        studentName: "Seq Student 2",
        guardianName: "Guardian 2",
        phone: "+15551234568",
        desiredGradeId: "grade-1",
      });

      const num1 = parseInt(enq1.referenceNumber.split("-")[2], 10);
      const num2 = parseInt(enq2.referenceNumber.split("-")[2], 10);
      expect(num2).toBe(num1 + 1);
    });
  });

  /* ─────────────────────────────────────────────────────────────
   * CORRECTION C: STRICT PAGINATION INPUT PARSING
   * ───────────────────────────────────────────────────────────── */
  describe("Correction C: Strict Pagination Input Parsing", () => {
    it("accepts valid positive integers for page and pageSize", () => {
      const parsed = parsePagination({ page: "3", pageSize: "50" });
      expect(parsed.page).toBe(3);
      expect(parsed.pageSize).toBe(50);
      expect(parsed.limit).toBe(50);
      expect(parsed.offset).toBe(100);
      expect(parsed.isUnbounded).toBe(false);
    });

    it("rejects zero page number with HTTP 400 VALIDATION_FAILED", () => {
      expect(() => parsePagination({ page: "0" })).toThrowError(ApiError);
      try {
        parsePagination({ page: "0" });
      } catch (e) {
        const err = e as ApiError;
        expect(err.statusCode).toBe(400);
        expect(err.code).toBe("VALIDATION_FAILED");
        expect(err.details?.some((d) => d.field === "page")).toBe(true);
      }
    });

    it("rejects negative page values with HTTP 400 VALIDATION_FAILED", () => {
      expect(() => parsePagination({ page: "-5" })).toThrowError(ApiError);
    });

    it("rejects negative offset values with HTTP 400 VALIDATION_FAILED", () => {
      expect(() => parsePagination({ offset: "-10" })).toThrowError(ApiError);
    });

    it("rejects fractional decimal numbers (1.5, '2.7') with HTTP 400 VALIDATION_FAILED", () => {
      expect(() => parsePagination({ page: "1.5" })).toThrowError(ApiError);
      expect(() => parsePagination({ pageSize: "2.7" })).toThrowError(ApiError);
      expect(() => parsePagination({ limit: 10.5 })).toThrowError(ApiError);
    });

    it("rejects partially numeric strings ('25abc', 'page1', '0x10') with HTTP 400 VALIDATION_FAILED", () => {
      expect(() => parsePagination({ page: "25abc" })).toThrowError(ApiError);
      expect(() => parsePagination({ pageSize: "100items" })).toThrowError(ApiError);
      expect(() => parsePagination({ limit: "0x20" })).toThrowError(ApiError);
      expect(() => parsePagination({ offset: "abc10" })).toThrowError(ApiError);
    });

    it("rejects NaN and Infinity with HTTP 400 VALIDATION_FAILED", () => {
      expect(() => parsePagination({ page: NaN })).toThrowError(ApiError);
      expect(() => parsePagination({ pageSize: Infinity })).toThrowError(ApiError);
      expect(() => parsePagination({ offset: -Infinity })).toThrowError(ApiError);
    });

    it("rejects values exceeding Number.MAX_SAFE_INTEGER", () => {
      expect(() => parsePagination({ page: "99999999999999999999" })).toThrowError(ApiError);
      expect(() => parsePagination({ offset: "99999999999999999999" })).toThrowError(ApiError);
    });

    it("enforces deterministic precedence: pageSize takes precedence over limit", () => {
      const parsed = parsePagination({ pageSize: "30", limit: "50" });
      expect(parsed.pageSize).toBe(30);
      expect(parsed.limit).toBe(30);
    });

    it("enforces deterministic precedence: page takes precedence over offset", () => {
      const parsed = parsePagination({ page: "2", offset: "100", pageSize: "20" });
      expect(parsed.page).toBe(2);
      expect(parsed.offset).toBe(20); // (2 - 1) * 20 = 20, not 100
    });

    it("derives page accurately when only offset is supplied", () => {
      const parsed = parsePagination({ offset: "75", pageSize: "25" });
      expect(parsed.page).toBe(4);
      expect(parsed.offset).toBe(75);
    });

    it("clamps requested pageSize to max limit of 100", () => {
      const parsed = parsePagination({ pageSize: "500" });
      expect(parsed.pageSize).toBe(100);
      expect(parsed.limit).toBe(100);
    });

    it("handles all=true or unbounded=true safely with bounded upper ceiling", () => {
      const parsed = parsePagination({ all: "true" });
      expect(parsed.isUnbounded).toBe(true);
      expect(parsed.limit).toBe(2000);
      expect(parsed.offset).toBe(0);

      const metadata = buildPaginationMetadata(150, parsed);
      expect(metadata.totalPages).toBe(1);
      expect(metadata.totalItems).toBe(150);
      expect(metadata.hasNextPage).toBe(false);
      expect(metadata.hasPreviousPage).toBe(false);
    });
  });

  /* ─────────────────────────────────────────────────────────────
   * CORRECTION B: PAGINATION BACKWARD COMPATIBILITY & LARGE DATASETS
   * ───────────────────────────────────────────────────────────── */
  describe("Correction B: Pagination Backward Compatibility & Complete Dataset Workflows", () => {
    it("supports dataset sizes greater than 25 and 100 without record loss across pages", async () => {
      const { tenant } = await createSisTenant(database, "corr-b-large-dataset");
      const sis = new SisService(database);

      // Create 110 students to cross both the 25 default threshold and 100 max page size
      const totalCreated = 110;
      for (let i = 1; i <= totalCreated; i++) {
        await sis.createStudent(tenant, {
          firstName: `Student${String(i).padStart(3, "0")}`,
          lastName: "ScaleTest",
          dateOfBirth: "2015-05-01",
          admissionDate: "2026-09-01",
          status: "active",
        });
      }

      // 1. Verify interactive paginated traversal across all pages (pageSize: 30)
      const pageSize = 30;
      let fetchedStudents: Array<{ id: string }> = [];
      const totalPages = Math.ceil(totalCreated / pageSize);

      for (let p = 1; p <= totalPages; p++) {
        const pagination = parsePagination({ page: p, pageSize });
        const pageItems = await sis.listStudents(tenant, {}, pagination);
        fetchedStudents = fetchedStudents.concat(pageItems);
      }

      expect(fetchedStudents.length).toBe(totalCreated);

      // Verify no duplicates across pages
      const uniqueIds = new Set(fetchedStudents.map((s) => s.id));
      expect(uniqueIds.size).toBe(totalCreated);

      // 2. Verify complete operational dataset retrieval (all=true)
      const unboundedPagination = parsePagination({ all: "true" });
      const allStudents = await sis.listStudents(tenant, {}, unboundedPagination);
      expect(allStudents.length).toBe(totalCreated);

      // Verify metadata for all=true
      const meta = buildPaginationMetadata(allStudents.length, unboundedPagination);
      expect(meta.totalItems).toBe(totalCreated);
      expect(meta.totalPages).toBe(1);
      expect(meta.hasNextPage).toBe(false);
      expect(meta.hasPreviousPage).toBe(false);
    });

    it("preserves complete attendance rosters without truncating class members", async () => {
      const { tenant } = await createSisTenant(database, "corr-b-attendance-roster");
      const sis = new SisService(database);
      const fixture = await createClassFixture(sis, tenant);

      // Enroll 35 students in Section A (exceeding 25 default page size)
      const enrolledStudentIds: string[] = [];
      for (let i = 1; i <= 35; i++) {
        const student = await sis.createStudent(tenant, {
          firstName: `RosterStudent${String(i).padStart(2, "0")}`,
          lastName: "ClassRoster",
          dateOfBirth: "2015-05-01",
          admissionDate: "2026-09-01",
          status: "active",
        });
        await sis.createEnrollment(tenant, {
          studentId: student.id,
          academicYear: fixture.year.name,
          gradeId: fixture.grade.id,
          sectionId: fixture.section.id,
          startDate: "2026-09-01",
          status: "active",
        });
        enrolledStudentIds.push(student.id);
      }

      // Operational dataset query with all=true (as used by MarkAttendancePage)
      const sectionEnrollments = await sis.listEnrollments(
        tenant,
        { sectionId: fixture.section.id, status: "active" },
        parsePagination({ all: "true" })
      );

      expect(sectionEnrollments.length).toBe(35);
      const retrievedIds = new Set(sectionEnrollments.map((e) => e.studentId));
      for (const id of enrolledStudentIds) {
        expect(retrievedIds.has(id)).toBe(true);
      }
    });

    it("preserves complete financial ledgers and transaction reports without truncation", async () => {
      const { tenant } = await createSisTenant(database, "corr-b-finance-report");
      const sis = new SisService(database);
      const finance = new SisFinanceService(database);
      const fixture = await createClassFixture(sis, tenant);

      const feeCategory = await finance.createCategory(tenant, {
        code: `TUIT-${randomUUID().slice(0, 4)}`,
        name: "Tuition Fee",
      });
      const feeStructure = await finance.createStructure(tenant, {
        academicYearId: fixture.year.id,
        gradeId: fixture.grade.id,
        name: "Standard Tuition",
        feeCategoryId: feeCategory.id,
        amountCents: 15000,
        paymentFrequency: "one_time",
        dueDate: "2026-10-31",
        status: "active",
      });

      // Create 32 students and generate invoices for each
      for (let i = 1; i <= 32; i++) {
        const student = await sis.createStudent(tenant, {
          firstName: `FinStudent${String(i).padStart(2, "0")}`,
          lastName: "FinScale",
          dateOfBirth: "2015-05-01",
          admissionDate: "2026-09-01",
          status: "active",
        });
        const enrollment = await sis.createEnrollment(tenant, {
          studentId: student.id,
          academicYear: fixture.year.name,
          gradeId: fixture.grade.id,
          sectionId: fixture.section.id,
          startDate: "2026-09-01",
          status: "active",
        });
        await finance.createInvoice(tenant, {
          studentId: student.id,
          enrollmentId: enrollment.id,
          academicYearId: fixture.year.id,
          issueDate: "2026-10-01",
          dueDate: "2026-10-31",
          currency: "USD",
          feeStructureIds: [feeStructure.id],
        });
      }

      // Query complete invoices for reporting (all=true)
      const completeInvoices = await finance.listInvoices(
        tenant,
        { academicYearId: fixture.year.id },
        parsePagination({ all: "true" })
      );

      expect(completeInvoices.length).toBe(32);
    });
  });
});

async function createSisTenant(database: DatabaseClient, label: string) {
  const suffix = randomUUID().slice(0, 8);
  const auth = await new AuthService(database).register({
    firstName: "Epic10N",
    lastName: "Phase3Corr",
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
    capacity: 40,
    status: "active",
  });
  const staff = await service.createStaff(tenant, {
    firstName: "Teacher",
    lastName: `Test ${suffix}`,
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
