import { migrate } from "drizzle-orm/mysql2/migrator";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import type { Server } from "node:http";
import { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { createLogger } from "../src/common/logging/logger.js";
import { loadConfig, type ApiConfig } from "../src/config/env.js";
import { createDatabaseClient, type DatabaseClient } from "../src/database/client.js";
import { AuthService } from "../src/modules/auth/services/auth.service.js";
import { SisService } from "../src/modules/education/sis.service.js";

const describeDatabase = process.env.RUN_DB_INTEGRATION_TESTS === "true" ? describe : describe.skip;
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(currentDirectory, "../src/database/migrations");

const logger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

describeDatabase("DB-5 SIS core persistence", () => {
  let config: ApiConfig;
  let database: DatabaseClient;

  beforeAll(async () => {
    config = loadConfig({
      ...process.env,
      NODE_ENV: "test",
      LOG_LEVEL: "error",
    });
    database = createDatabaseClient(config.database, createLogger(config));
    await migrateIfNeeded(database);
  });

  afterAll(async () => {
    await database.close();
  });

  it("persists academic structure, students, guardians, enrollment, staff, and teaching assignments", async () => {
    const { tenant } = await createSisTenant(database, "persist");
    const service = new SisService(database);

    const year = await service.createAcademicYear(tenant, { name: `2026-${randomUUID().slice(0, 6)}`, startDate: "2026-01-01", endDate: "2026-12-31", status: "active" });
    const term = await service.createTerm(tenant, { academicYearId: year.id, name: "Term 1", startDate: "2026-01-05", endDate: "2026-04-30", status: "active" });
    const grade = await service.createGrade(tenant, { name: `Grade ${randomUUID().slice(0, 4)}`, level: 1, order: 1, status: "active" });
    const section = await service.createSection(tenant, { gradeId: grade.id, name: "A", capacity: 30, status: "active" });
    const subject = await service.createSubject(tenant, { name: `Math ${randomUUID().slice(0, 4)}`, code: `M-${randomUUID().slice(0, 6)}`, status: "active", displayOrder: 1 });
    await service.assignSubjectToClass(tenant, grade.id, subject.id);
    const department = await service.createDepartment(tenant, { name: `Academics ${randomUUID().slice(0, 4)}` });
    const staff = await service.createStaff(tenant, { firstName: "Ada", lastName: "Teacher", hireDate: "2026-01-01", staffType: "teacher", employmentStatus: "full_time", status: "active", departmentId: department.id });
    const assignment = await service.createTeachingAssignment(tenant, { staffId: staff.id, academicYear: year.name, gradeId: grade.id, sectionId: section.id, subjectId: subject.id, isActive: true });
    const student = await service.createStudent(tenant, { firstName: "Sam", lastName: "Student", dateOfBirth: "2016-05-01", gender: "male", admissionDate: "2026-01-15", status: "active", guardians: [{ firstName: "Pat", lastName: "Guardian", relationship: "guardian", email: `pat-${randomUUID()}@example.com`, phone: "555-0100", isEmergencyContact: true, isPrimaryContact: true, portalAccessEnabled: true, authorizedForPortal: true }] });
    const enrollment = await service.createEnrollment(tenant, { studentId: student.id, academicYear: year.name, gradeId: grade.id, sectionId: section.id, enrollmentDate: "2026-01-15", status: "active" });

    expect(term.academicYearId).toBe(year.id);
    expect(await service.getClassSubjects(tenant, grade.id)).toContain(subject.id);
    expect(assignment.staffId).toBe(staff.id);
    expect(student.guardians).toHaveLength(1);
    expect(enrollment.studentId).toBe(student.id);

    const secondClient = createDatabaseClient(config.database, createLogger(config));
    try {
      const reloaded = await new SisService(secondClient).getStudent(tenant, student.id);
      expect(reloaded?.guardians[0].authorizedForPortal).toBe(true);
    } finally {
      await secondClient.close();
    }
  });

  it("enforces tenant isolation and duplicate admission protection", async () => {
    const orgA = await createSisTenant(database, "tenant-a");
    const orgB = await createSisTenant(database, "tenant-b");
    const service = new SisService(database);
    const student = await service.createStudent(orgA.tenant, { admissionNumber: `ADM-${randomUUID().slice(0, 8)}`, firstName: "One", lastName: "Tenant", dateOfBirth: "2015-01-01", gender: "female", admissionDate: "2026-01-01", status: "active", guardians: [] });

    await expect(service.createStudent(orgA.tenant, { admissionNumber: student.admissionNumber, firstName: "Duplicate", lastName: "Student", dateOfBirth: "2015-01-01", gender: "female", admissionDate: "2026-01-01", status: "active", guardians: [] })).rejects.toMatchObject({ cause: { statusCode: 409 } });
    await expect(service.getStudent(orgB.tenant, student.id)).resolves.toBeNull();
  });

  it("exposes SIS APIs through authenticated tenant routes", async () => {
    const server = createApp(config, logger, database);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const registered = await registerViaApi(baseUrl, `db5-${randomUUID().slice(0, 8)}`);

    try {
      const createYear = await fetch(`${baseUrl}/api/v1/organizations/${registered.organizationId}/sis/academic-years`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${registered.token}` },
        body: JSON.stringify({ name: `API ${randomUUID().slice(0, 6)}`, startDate: "2026-01-01", endDate: "2026-12-31", status: "planned" }),
      });
      const created = await createYear.json() as { academicYear: { id: string } };
      const listYears = await fetch(`${baseUrl}/api/v1/organizations/${registered.organizationId}/sis/academic-years`, {
        headers: { authorization: `Bearer ${registered.token}` },
      });
      const listed = await listYears.json() as { academicYears: Array<{ id: string }> };

      expect(createYear.status).toBe(201);
      expect(listed.academicYears.some((item) => item.id === created.academicYear.id)).toBe(true);
    } finally {
      await closeServer(server);
    }
  });
});

async function createSisTenant(database: DatabaseClient, label: string) {
  const suffix = randomUUID().slice(0, 8);
  const auth = await new AuthService(database).register({
    firstName: "SIS",
    lastName: "Owner",
    email: `${label}-${suffix}@example.com`,
    password: "password123",
    organizationName: `SIS ${label} ${suffix}`,
    organizationType: "School",
    industry: "Education",
    country: "United States",
  });
  const organizationId = auth.memberships[0].organizationId;
  const tenant = await new SisService(database).getTenant(organizationId);
  return { auth, tenant };
}

async function registerViaApi(baseUrl: string, label: string): Promise<{ token: string; organizationId: string }> {
  const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      firstName: "API",
      lastName: "SIS",
      email: `${label}@example.com`,
      password: "password123",
      organizationName: `Org ${label}`,
      organizationType: "School",
      industry: "Education",
      country: "United States",
    }),
  });
  const body = await response.json() as { session: { accessToken: string }; memberships: Array<{ organizationId: string }> };
  expect(response.status).toBe(201);
  return { token: body.session.accessToken, organizationId: body.memberships[0].organizationId };
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  server.close();
  await once(server, "close");
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
