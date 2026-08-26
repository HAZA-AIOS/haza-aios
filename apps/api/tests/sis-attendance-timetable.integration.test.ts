import { migrate } from "drizzle-orm/mysql2/migrator";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger } from "../src/common/logging/logger.js";
import { loadConfig, type ApiConfig } from "../src/config/env.js";
import { createDatabaseClient, type DatabaseClient } from "../src/database/client.js";
import { AuthService } from "../src/modules/auth/services/auth.service.js";
import { SisService } from "../src/modules/education/sis.service.js";

const describeDatabase = process.env.RUN_DB_INTEGRATION_TESTS === "true" ? describe : describe.skip;
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(currentDirectory, "../src/database/migrations");

describeDatabase("DB-6 attendance and timetable persistence", () => {
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

  it("persists attendance sessions and records through active enrollment", async () => {
    const { tenant } = await createSisTenant(database, "attendance");
    const service = new SisService(database);
    const fixture = await createClassFixture(service, tenant);

    const session = await service.createAttendanceSession(tenant, {
      academicYearId: fixture.year.id,
      date: "2026-02-10",
      gradeId: fixture.grade.id,
      sectionId: fixture.section.id,
      sessionType: "daily",
      status: "draft",
      markedBy: fixture.staff.id,
    });
    const records = await service.saveAttendanceRecords(tenant, session.id, [{ studentId: fixture.student.id, status: "present" }], fixture.staff.id);

    expect(records[0]).toMatchObject({ studentId: fixture.student.id, status: "present" });
    expect(await service.getStudentAttendanceSummary(tenant, fixture.student.id, fixture.year.id)).toMatchObject({ totalSessions: 1, present: 1, attendancePercentage: 100 });

    const secondClient = createDatabaseClient(config.database, createLogger(config));
    try {
      const reloaded = await new SisService(secondClient).listAttendanceRecords(tenant, session.id);
      expect(reloaded).toHaveLength(1);
      expect(reloaded[0].studentId).toBe(fixture.student.id);
    } finally {
      await secondClient.close();
    }
  });

  it("rejects attendance for a student outside the session class tenant context", async () => {
    const orgA = await createSisTenant(database, "attendance-a");
    const orgB = await createSisTenant(database, "attendance-b");
    const service = new SisService(database);
    const fixtureA = await createClassFixture(service, orgA.tenant);
    const fixtureB = await createClassFixture(service, orgB.tenant);
    const session = await service.createAttendanceSession(orgA.tenant, {
      academicYearId: fixtureA.year.id,
      date: "2026-02-11",
      gradeId: fixtureA.grade.id,
      sectionId: fixtureA.section.id,
      sessionType: "daily",
      status: "draft",
    });

    await expect(service.saveAttendanceRecords(orgA.tenant, session.id, [{ studentId: fixtureB.student.id, status: "present" }], fixtureA.staff.id)).rejects.toMatchObject({ cause: { statusCode: 400 } });
  });

  it("persists timetable data and rejects teacher/class/room conflicts", async () => {
    const { tenant } = await createSisTenant(database, "timetable");
    const service = new SisService(database);
    const fixture = await createClassFixture(service, tenant);
    const otherGrade = await service.createGrade(tenant, { name: `Other Grade ${randomUUID().slice(0, 4)}`, level: 2, order: 2, status: "active" });
    const otherSection = await service.createSection(tenant, { gradeId: otherGrade.id, name: "B", capacity: 30, status: "active" });
    await service.createTeachingAssignment(tenant, { staffId: fixture.staff.id, academicYear: fixture.year.name, gradeId: otherGrade.id, sectionId: otherSection.id, subjectId: fixture.subject.id, isActive: true });

    await service.saveSchoolSchedule(tenant, { academicYearId: fixture.year.id, workingDays: [1, 2, 3, 4, 5], scheduleStartTime: "08:00", scheduleEndTime: "15:00" });
    const period = await service.savePeriod(tenant, { name: `Period ${randomUUID().slice(0, 4)}`, startTime: "08:00", endTime: "08:45", type: "teaching", displayOrder: 1 });
    const entry = await service.saveTimetableEntry(tenant, {
      academicYearId: fixture.year.id,
      gradeId: fixture.grade.id,
      sectionId: fixture.section.id,
      subjectId: fixture.subject.id,
      teacherId: fixture.staff.id,
      roomId: "101",
      dayOfWeek: 1,
      periodId: period.id,
    });

    expect((await service.listTimetableEntries(tenant, { gradeId: fixture.grade.id }))[0].id).toBe(entry.id);
    await expect(service.saveTimetableEntry(tenant, { academicYearId: fixture.year.id, gradeId: otherGrade.id, sectionId: otherSection.id, subjectId: fixture.subject.id, teacherId: fixture.staff.id, roomId: "102", dayOfWeek: 1, periodId: period.id })).rejects.toMatchObject({ statusCode: 409 });
    await expect(service.saveTimetableEntry(tenant, { academicYearId: fixture.year.id, gradeId: fixture.grade.id, sectionId: fixture.section.id, subjectId: fixture.subject.id, teacherId: fixture.staff.id, roomId: "101", dayOfWeek: 1, periodId: period.id })).rejects.toMatchObject({ statusCode: 409 });
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

async function createClassFixture(service: SisService, tenant: Awaited<ReturnType<SisService["getTenant"]>>) {
  const suffix = randomUUID().slice(0, 6);
  const year = await service.createAcademicYear(tenant, { name: `2026-${suffix}`, startDate: "2026-01-01", endDate: "2026-12-31", status: "active" });
  const grade = await service.createGrade(tenant, { name: `Grade ${suffix}`, level: 1, order: 1, status: "active" });
  const section = await service.createSection(tenant, { gradeId: grade.id, name: "A", capacity: 30, status: "active" });
  const subject = await service.createSubject(tenant, { name: `Math ${suffix}`, code: `M-${suffix}`, status: "active", displayOrder: 1 });
  const staff = await service.createStaff(tenant, { firstName: "Ada", lastName: "Teacher", hireDate: "2026-01-01", staffType: "teacher", employmentStatus: "full_time", status: "active" });
  await service.createTeachingAssignment(tenant, { staffId: staff.id, academicYear: year.name, gradeId: grade.id, sectionId: section.id, subjectId: subject.id, isActive: true });
  const student = await service.createStudent(tenant, { firstName: "Sam", lastName: "Student", dateOfBirth: "2016-05-01", gender: "male", admissionDate: "2026-01-15", status: "active", guardians: [] });
  const enrollment = await service.createEnrollment(tenant, { studentId: student.id, academicYear: year.name, gradeId: grade.id, sectionId: section.id, enrollmentDate: "2026-01-15", status: "active" });
  return { year, grade, section, subject, staff, student, enrollment };
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
