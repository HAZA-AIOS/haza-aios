import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "../src/common/errors/api-error.js";
import { createLogger } from "../src/common/logging/logger.js";
import {
  buildPaginationMetadata,
  fetchAllBatches,
  paginatedResponse,
  parsePagination,
} from "../src/common/pagination/pagination.js";
import { loadConfig, type ApiConfig } from "../src/config/env.js";
import { createDatabaseClient, type DatabaseClient } from "../src/database/client.js";
import { migrate } from "../src/database/mysql94-migrator.js";
import { students } from "../src/database/schema.js";
import { AuthService } from "../src/modules/auth/services/auth.service.js";
import { SisFinanceService } from "../src/modules/education/sis-finance.service.js";
import { SisService } from "../src/modules/education/sis.service.js";
import { eq, sql } from "drizzle-orm";

const describeDatabase = process.env.RUN_DB_INTEGRATION_TESTS === "true" ? describe : describe.skip;
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(currentDirectory, "../src/database/migrations");

describe("Epic 10N / Phase 3 Final Correction: Complete Dataset Retrieval & Accurate Pagination Metadata", () => {
  /* ─────────────────────────────────────────────────────────────
   * 1. API PAGINATION METADATA TRUTHFULNESS & STRICT PARSING
   * ───────────────────────────────────────────────────────────── */
  describe("API Pagination Metadata Truthfulness Across Dataset Scales", () => {
    it("reports accurate metadata for 0 records", () => {
      const parsed = parsePagination({ all: "true" });
      const metadata = buildPaginationMetadata(0, parsed);

      expect(metadata.totalItems).toBe(0);
      expect(metadata.totalPages).toBe(1);
      expect(metadata.page).toBe(1);
      expect(metadata.pageSize).toBe(2000);
      expect(metadata.hasNextPage).toBe(false);
      expect(metadata.hasPreviousPage).toBe(false);
    });

    it("reports accurate metadata for 1 record", () => {
      const parsed = parsePagination({ all: "true" });
      const metadata = buildPaginationMetadata(1, parsed);

      expect(metadata.totalItems).toBe(1);
      expect(metadata.totalPages).toBe(1);
      expect(metadata.hasNextPage).toBe(false);
      expect(metadata.hasPreviousPage).toBe(false);
    });

    it("reports accurate metadata for 25 records (standard default page size)", () => {
      const parsed = parsePagination({ all: "true" });
      const metadata = buildPaginationMetadata(25, parsed);

      expect(metadata.totalItems).toBe(25);
      expect(metadata.totalPages).toBe(1);
      expect(metadata.hasNextPage).toBe(false);
      expect(metadata.hasPreviousPage).toBe(false);
    });

    it("reports accurate metadata for 100 records (standard max interactive page size)", () => {
      const parsed = parsePagination({ all: "true" });
      const metadata = buildPaginationMetadata(100, parsed);

      expect(metadata.totalItems).toBe(100);
      expect(metadata.totalPages).toBe(1);
      expect(metadata.hasNextPage).toBe(false);
      expect(metadata.hasPreviousPage).toBe(false);
    });

    it("reports accurate metadata for exactly 2,000 records (bounded batch ceiling)", () => {
      const parsed = parsePagination({ all: "true" });
      const metadata = buildPaginationMetadata(2000, parsed);

      expect(metadata.totalItems).toBe(2000);
      expect(metadata.totalPages).toBe(1);
      expect(metadata.pageSize).toBe(2000);
      expect(metadata.hasNextPage).toBe(false);
      expect(metadata.hasPreviousPage).toBe(false);
    });

    it("reports truthful metadata for 2,001 records without false totalPages: 1 claim", () => {
      // Page 1 of 2
      const page1Parsed = parsePagination({ all: "true", page: "1" });
      const page1Meta = buildPaginationMetadata(2001, page1Parsed);

      expect(page1Meta.totalItems).toBe(2001);
      expect(page1Meta.pageSize).toBe(2000);
      expect(page1Meta.page).toBe(1);
      expect(page1Meta.totalPages).toBe(2);
      expect(page1Meta.hasNextPage).toBe(true);
      expect(page1Meta.hasPreviousPage).toBe(false);

      // Page 2 of 2
      const page2Parsed = parsePagination({ all: "true", page: "2" });
      const page2Meta = buildPaginationMetadata(2001, page2Parsed);

      expect(page2Meta.totalItems).toBe(2001);
      expect(page2Meta.page).toBe(2);
      expect(page2Meta.totalPages).toBe(2);
      expect(page2Meta.hasNextPage).toBe(false);
      expect(page2Meta.hasPreviousPage).toBe(true);
    });

    it("reports truthful metadata for 5,000 records across 3 batches", () => {
      const totalItems = 5000;

      // Page 1
      const p1Meta = buildPaginationMetadata(totalItems, parsePagination({ all: "true", page: 1 }));
      expect(p1Meta.totalPages).toBe(3);
      expect(p1Meta.hasNextPage).toBe(true);
      expect(p1Meta.hasPreviousPage).toBe(false);

      // Page 2
      const p2Meta = buildPaginationMetadata(totalItems, parsePagination({ all: "true", page: 2 }));
      expect(p2Meta.totalPages).toBe(3);
      expect(p2Meta.hasNextPage).toBe(true);
      expect(p2Meta.hasPreviousPage).toBe(true);

      // Page 3
      const p3Meta = buildPaginationMetadata(totalItems, parsePagination({ all: "true", page: 3 }));
      expect(p3Meta.totalPages).toBe(3);
      expect(p3Meta.hasNextPage).toBe(false);
      expect(p3Meta.hasPreviousPage).toBe(true);
    });

    it("supports semantic aliases fetchAllRequested, boundedFullDatasetMode, and compatibilityBatch", () => {
      const p1 = parsePagination({ fetchAllRequested: "true", page: "2" });
      expect(p1.isUnbounded).toBe(true);
      expect(p1.fetchAllRequested).toBe(true);
      expect(p1.boundedFullDatasetMode).toBe(true);
      expect(p1.compatibilityBatch).toBe(true);
      expect(p1.page).toBe(2);
      expect(p1.offset).toBe(2000);
      expect(p1.limit).toBe(2000);

      const p2 = parsePagination({ boundedFullDatasetMode: "true" });
      expect(p2.isUnbounded).toBe(true);
      expect(p2.limit).toBe(2000);

      const p3 = parsePagination({ compatibilityBatch: "true" });
      expect(p3.isUnbounded).toBe(true);
      expect(p3.limit).toBe(2000);
    });

    it("maintains dual-envelope API response convention with truthful metadata", () => {
      const parsed = parsePagination({ all: "true", page: 1 });
      const fakeRecords = [{ id: "1" }, { id: "2" }];
      const response = paginatedResponse(fakeRecords, 2050, parsed, "students");

      expect(response.students).toBe(fakeRecords);
      expect(response.data).toBe(fakeRecords);
      expect(response.pagination.totalItems).toBe(2050);
      expect(response.pagination.totalPages).toBe(2);
      expect(response.pagination.hasNextPage).toBe(true);
      expect(response.pagination.hasPreviousPage).toBe(false);
    });
  });

  /* ─────────────────────────────────────────────────────────────
   * 2. SERVER-SIDE BOUNDED RETRIEVAL HELPER (fetchAllBatches)
   * ───────────────────────────────────────────────────────────── */
  describe("Server-Side Reusable Bounded Retrieval (fetchAllBatches)", () => {
    it("fetches multi-page datasets in controlled 2,000 batches until completion", async () => {
      const totalCount = 4500;
      const allMockData = Array.from({ length: totalCount }, (_, i) => ({
        id: `rec-${i + 1}`,
        val: i + 1,
      }));

      const fetchBatch = async (pagination: { limit: number; offset: number }) => {
        const batch = allMockData.slice(pagination.offset, pagination.offset + pagination.limit);
        return {
          items: batch,
          total: totalCount,
        };
      };

      const result = await fetchAllBatches(fetchBatch, { batchSize: 2000 });

      expect(result.length).toBe(totalCount);
      expect(result[0].id).toBe("rec-1");
      expect(result[totalCount - 1].id).toBe(`rec-${totalCount}`);
    });

    it("prevents infinite loops if batch returns empty or repeated offsets", async () => {
      let callCount = 0;
      const fetchBatch = async () => {
        callCount++;
        return { items: [], total: 1000 };
      };

      const result = await fetchAllBatches(fetchBatch, { maxPages: 5, batchSize: 200 });
      expect(result.length).toBe(0);
      expect(callCount).toBe(1);
    });

    it("aborts cleanly when signal is triggered", async () => {
      const controller = new AbortController();
      let callCount = 0;
      const fetchBatch = async () => {
        callCount++;
        if (callCount === 2) controller.abort();
        return { items: [{ id: "x" }], total: 1000 };
      };

      await expect(
        fetchAllBatches(fetchBatch, { signal: controller.signal, batchSize: 1 })
      ).rejects.toThrow("aborted");
    });
  });

  /* ─────────────────────────────────────────────────────────────
   * 3. REAL DATABASE INTEGRATION: LARGE DATASETS (>2,000 RECORDS)
   * ───────────────────────────────────────────────────────────── */
  describeDatabase("Database Integration: > 2,000 Records Bounded Retrieval & Truthful Metadata", () => {
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

    it("inserts > 2,000 students and retrieves all records accurately without silent truncation", async () => {
      const { tenant } = await createSisTenant(database, "corr-large-scale");
      const client = database.db;
      const sis = new SisService(database);

      const targetCount = 2050;
      const batchInsertSize = 500;
      const insertedStudentIds: string[] = [];

      // Bulk insert 2,050 students in chunks
      for (let offset = 0; offset < targetCount; offset += batchInsertSize) {
        const chunkLength = Math.min(batchInsertSize, targetCount - offset);
        const chunkValues = [];

        for (let i = 0; i < chunkLength; i++) {
          const index = offset + i + 1;
          const id = randomUUID();
          insertedStudentIds.push(id);
          const admissionNumber = `ADM-SCALE-${String(index).padStart(5, "0")}`;
          const studentNumber = `STU-SCALE-${String(index).padStart(5, "0")}`;
          const firstName = `FirstName${String(index).padStart(5, "0")}`;
          const lastName = "BenchmarkScale";
          const status = index % 2 === 0 ? "active" : "inactive";

          chunkValues.push(
            sql`(${id}, ${tenant.workspaceId}, ${admissionNumber}, ${studentNumber}, ${firstName}, ${lastName}, '2010-01-01', 'other', '2026-09-01', ${status})`
          );
        }

        await client.execute(sql`
          INSERT INTO students (id, workspace_id, admission_number, student_number, first_name, last_name, date_of_birth, gender, admission_date, student_status)
          VALUES ${sql.join(chunkValues, sql`, `)}
        `);
      }

      // Verify total count in database
      const [countResult] = (await client.execute(sql`
        SELECT COUNT(*) as total FROM students WHERE workspace_id = ${tenant.workspaceId}
      `)) as unknown as [Array<{ total: number | string }>];
      const actualDbCount = Number(countResult[0].total);
      expect(actualDbCount).toBe(targetCount);

      // 1. Single unbounded request (all=true) receives first bounded batch (2,000)
      const firstBatchPagination = parsePagination({ all: "true" });
      const firstBatch = await sis.listStudents(tenant, {}, firstBatchPagination);
      expect(firstBatch.length).toBe(2000);

      // Verify pagination metadata truthfully indicates second page exists
      const meta = buildPaginationMetadata(actualDbCount, firstBatchPagination);
      expect(meta.totalItems).toBe(2050);
      expect(meta.totalPages).toBe(2);
      expect(meta.hasNextPage).toBe(true);
      expect(meta.hasPreviousPage).toBe(false);

      // 2. Second batch (page=2, all=true) receives remaining 50 records
      const secondBatchPagination = parsePagination({ all: "true", page: 2 });
      const secondBatch = await sis.listStudents(tenant, {}, secondBatchPagination);
      expect(secondBatch.length).toBe(50);

      const secondMeta = buildPaginationMetadata(actualDbCount, secondBatchPagination);
      expect(secondMeta.totalItems).toBe(2050);
      expect(secondMeta.totalPages).toBe(2);
      expect(secondMeta.hasNextPage).toBe(false);
      expect(secondMeta.hasPreviousPage).toBe(true);

      // 3. Multi-batch retrieval via fetchAllBatches retrieves all 2,050 records
      const allRetrieved = await fetchAllBatches(
        async (p) => {
          const items = await sis.listStudents(tenant, {}, p);
          return { items, total: actualDbCount };
        },
        { batchSize: 2000 }
      );

      expect(allRetrieved.length).toBe(2050);

      // Verify stable deterministic ordering: no duplicates, no missing records
      const uniqueRetrievedIds = new Set(allRetrieved.map((s) => s.id));
      expect(uniqueRetrievedIds.size).toBe(2050);

      // 4. Verify tenant isolation: another tenant sees 0 records
      const { tenant: otherTenant } = await createSisTenant(database, "corr-isolated-other");
      const otherBatch = await sis.listStudents(otherTenant, {}, firstBatchPagination);
      expect(otherBatch.length).toBe(0);

      // 5. Verify SQL filtering compatibility on large datasets
      const activeOnly = await fetchAllBatches(
        async (p) => {
          const items = await sis.listStudents(tenant, { status: "active" }, p);
          return { items, total: 1025 };
        },
        { batchSize: 2000 }
      );
      expect(activeOnly.length).toBe(1025);
      expect(activeOnly.every((s) => s.status === "active")).toBe(true);
    });

    it("executes complete operational workflows (roster, finance, report) above standard thresholds", async () => {
      const { tenant } = await createSisTenant(database, "corr-workflows");
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

      // Create 40 students with enrollments and invoices (exceeding default 25 page size)
      const studentCount = 40;
      for (let i = 1; i <= studentCount; i++) {
        const student = await sis.createStudent(tenant, {
          firstName: `OpStudent${String(i).padStart(2, "0")}`,
          lastName: "WorkflowScale",
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

      // Operational Workflow 1: Complete class attendance roster
      const rosterStudents = await sis.listEnrollments(
        tenant,
        { sectionId: fixture.section.id, status: "active" },
        parsePagination({ all: "true" })
      );
      expect(rosterStudents.length).toBe(studentCount);

      // Operational Workflow 2: Complete financial ledger / billing statement
      const invoiceReport = await finance.listInvoices(
        tenant,
        { academicYearId: fixture.year.id },
        parsePagination({ all: "true" })
      );
      expect(invoiceReport.length).toBe(studentCount);

      // Operational Workflow 3: CSV/Report export dataset generation
      const csvExportRows = invoiceReport.map((inv) => ({
        invoiceNumber: inv.invoiceNumber,
        totalCents: inv.totalCents,
        status: inv.status,
      }));
      expect(csvExportRows.length).toBe(studentCount);
      expect(csvExportRows.every((r) => r.totalCents === 15000)).toBe(true);
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
    capacity: 50,
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
