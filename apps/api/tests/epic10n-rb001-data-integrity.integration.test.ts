import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ApiError } from "../src/common/errors/api-error.js";
import { createLogger } from "../src/common/logging/logger.js";
import { loadConfig, type ApiConfig } from "../src/config/env.js";
import { createDatabaseClient, type DatabaseClient } from "../src/database/client.js";
import { migrate } from "../src/database/mysql94-migrator.js";
import { AuthService } from "../src/modules/auth/services/auth.service.js";
import { SisService } from "../src/modules/education/sis.service.js";
import { SisAdmissionsService } from "../src/modules/education/sis-admissions.service.js";
import { SisExaminationService } from "../src/modules/education/sis-examination.service.js";
import { validateCreateStudent } from "../src/modules/education/validation/sis-validation.js";

const describeDatabase = process.env.RUN_DB_INTEGRATION_TESTS === "true" ? describe : describe.skip;
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(currentDirectory, "../src/database/migrations");

async function migrateIfNeeded(database: DatabaseClient): Promise<void> {
  try {
    await migrate(database.db, { migrationsFolder });
  } catch (error) {
    const code = (error as { cause?: { code?: string } }).cause?.code;
    if (code === "ER_TABLE_EXISTS_ERROR") return;
    throw error;
  }
}

async function createSisTenant(db: DatabaseClient, label: string) {
  const suffix = randomUUID().slice(0, 8);
  const auth = await new AuthService(db).register({
    firstName: "RB001",
    lastName: "Owner",
    email: `${label}-${suffix}@example.com`,
    password: "password123",
    organizationName: `RB001 Org ${label} ${suffix}`,
    organizationType: "School",
    industry: "Education",
    country: "United States",
  });
  const tenant = await new SisService(db).getTenant(auth.memberships[0].organizationId);
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

describeDatabase("RB-001: Data Integrity & Prevention of Fabricated Business Defaults", () => {
  let config: ApiConfig;
  let database: DatabaseClient;

  beforeAll(async () => {
    config = loadConfig({ ...process.env, NODE_ENV: "test", LOG_LEVEL: "error" });
    database = createDatabaseClient(config.database, createLogger(config));
    await migrateIfNeeded(database);
  });

  afterAll(async () => {
    await database?.close();
  });

  /* ─────────────────────────────────────────────────────────────
   * 1. Missing required student data is rejected or represented
   *    according to documented business rules
   * ───────────────────────────────────────────────────────────── */
  it("rejects missing student dateOfBirth, firstName, lastName, or admissionDate with 400 validation error", async () => {
    const { tenant } = await createSisTenant(database, "rb001-student-req");
    const sis = new SisService(database);

    // Missing dateOfBirth
    await expect(
      sis.createStudent(tenant, {
        firstName: "Alice",
        lastName: "Test",
        admissionDate: "2026-09-01",
        status: "active",
      })
    ).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof ApiError &&
        err.statusCode === 400 &&
        err.code === "VALIDATION_FAILED" &&
        err.message.includes("Student date of birth is required")
      );
    });

    // Missing admissionDate
    await expect(
      sis.createStudent(tenant, {
        firstName: "Alice",
        lastName: "Test",
        dateOfBirth: "2015-05-15",
        status: "active",
      })
    ).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof ApiError &&
        err.statusCode === 400 &&
        err.code === "VALIDATION_FAILED" &&
        err.message.includes("Student admission date is required")
      );
    });

    // Missing firstName
    await expect(
      sis.createStudent(tenant, {
        lastName: "Test",
        dateOfBirth: "2015-05-15",
        admissionDate: "2026-09-01",
        status: "active",
      })
    ).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof ApiError &&
        err.statusCode === 400 &&
        err.code === "VALIDATION_FAILED" &&
        err.message.includes("Student first name is required")
      );
    });

    // HTTP validation layer check
    try {
      validateCreateStudent({
        firstName: "Alice",
        lastName: "Test",
        admissionDate: "2026-09-01",
        // dateOfBirth omitted
      });
      expect.fail("Expected validateCreateStudent to throw ApiError");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).details?.some((d) => d.field === "dateOfBirth")).toBe(true);
    }
  });

  /* ─────────────────────────────────────────────────────────────
   * 2. Invalid date values are not replaced with fabricated dates
   * ───────────────────────────────────────────────────────────── */
  it("rejects invalid date strings for student DOB, admissionDate, and staff hireDate", async () => {
    const { tenant } = await createSisTenant(database, "rb001-invalid-dates");
    const sis = new SisService(database);

    // Malformed student dateOfBirth
    await expect(
      sis.createStudent(tenant, {
        firstName: "Bob",
        lastName: "InvalidDate",
        dateOfBirth: "invalid-date-string",
        admissionDate: "2026-09-01",
        status: "active",
      })
    ).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof ApiError &&
        err.statusCode === 400 &&
        err.code === "VALIDATION_FAILED"
      );
    });

    // Malformed student admissionDate
    await expect(
      sis.createStudent(tenant, {
        firstName: "Bob",
        lastName: "InvalidDate",
        dateOfBirth: "2015-05-15",
        admissionDate: "99-99-9999",
        status: "active",
      })
    ).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof ApiError &&
        err.statusCode === 400 &&
        err.code === "VALIDATION_FAILED"
      );
    });

    // Malformed staff hireDate
    await expect(
      sis.createStaff(tenant, {
        firstName: "Carol",
        lastName: "Teacher",
        hireDate: "not-a-valid-date",
        staffType: "teacher",
      })
    ).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof ApiError &&
        err.statusCode === 400 &&
        err.code === "VALIDATION_FAILED"
      );
    });
  });

  /* ─────────────────────────────────────────────────────────────
   * 3. Missing guardian contacts are not replaced with invented contact information
   * ───────────────────────────────────────────────────────────── */
  it("rejects guardians with missing phone or email and preserves genuine relationships", async () => {
    const { tenant } = await createSisTenant(database, "rb001-guardian-req");
    const sis = new SisService(database);

    // Missing guardian email
    await expect(
      sis.createStudent(tenant, {
        firstName: "David",
        lastName: "NoEmailGuardian",
        dateOfBirth: "2015-06-01",
        admissionDate: "2026-09-01",
        status: "active",
        guardians: [
          {
            firstName: "Parent",
            lastName: "One",
            phone: "+15551234567",
            // email omitted
          },
        ],
      })
    ).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof ApiError &&
        err.statusCode === 400 &&
        err.message.includes("Guardian email is required")
      );
    });

    // Missing guardian phone
    await expect(
      sis.createStudent(tenant, {
        firstName: "David",
        lastName: "NoPhoneGuardian",
        dateOfBirth: "2015-06-01",
        admissionDate: "2026-09-01",
        status: "active",
        guardians: [
          {
            firstName: "Parent",
            lastName: "One",
            email: "parent@example.test",
            // phone omitted
          },
        ],
      })
    ).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof ApiError &&
        err.statusCode === 400 &&
        err.message.includes("Guardian phone is required")
      );
    });

    // Unsupported relationship
    await expect(
      sis.createStudent(tenant, {
        firstName: "David",
        lastName: "InvalidRel",
        dateOfBirth: "2015-06-01",
        admissionDate: "2026-09-01",
        status: "active",
        guardians: [
          {
            firstName: "Parent",
            lastName: "One",
            phone: "+15551234567",
            email: "parent@example.test",
            relationship: "neighbor_unauthorized",
          },
        ],
      })
    ).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof ApiError &&
        err.statusCode === 400 &&
        err.message.includes("Invalid guardian relationship")
      );
    });
  });

  /* ─────────────────────────────────────────────────────────────
   * 4. Missing or invalid attendance status never becomes present
   * ───────────────────────────────────────────────────────────── */
  it("rejects attendance records with missing or invalid status and never marks student present silently", async () => {
    const { tenant } = await createSisTenant(database, "rb001-attendance-status");
    const sis = new SisService(database);
    const fixture = await createClassFixture(sis, tenant);

    const student = await sis.createStudent(tenant, {
      firstName: "Attendance",
      lastName: "Target",
      dateOfBirth: "2015-07-01",
      admissionDate: "2026-09-01",
      status: "active",
    });

    await sis.createEnrollment(tenant, {
      studentId: student.id,
      academicYear: fixture.year.name,
      gradeId: fixture.grade.id,
      sectionId: fixture.section.id,
      enrollmentDate: "2026-09-01",
      status: "active",
    });

    const session = await sis.createAttendanceSession(tenant, {
      academicYearId: fixture.year.id,
      gradeId: fixture.grade.id,
      sectionId: fixture.section.id,
      attendanceDate: "2026-10-15",
      sessionType: "daily",
    });

    // Invalid status string like "unknown" or "present_maybe"
    await expect(
      sis.saveAttendanceRecords(
        tenant,
        session.id,
        [{ studentId: student.id, status: "bogus_status" }],
        "test-marker"
      )
    ).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof ApiError &&
        err.statusCode === 400 &&
        err.message.includes("Attendance status is invalid or missing")
      );
    });

    // Empty status string
    await expect(
      sis.saveAttendanceRecords(
        tenant,
        session.id,
        [{ studentId: student.id, status: "" }],
        "test-marker"
      )
    ).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof ApiError &&
        err.statusCode === 400 &&
        err.message.includes("Attendance status is invalid or missing")
      );
    });

    // Verify student was NOT marked present
    const records = await sis.listAttendanceRecords(tenant, session.id);
    expect(records.length).toBe(0);
  });

  /* ─────────────────────────────────────────────────────────────
   * 5. Valid legacy examination enum values are normalized correctly
   * ───────────────────────────────────────────────────────────── */
  it("normalizes legacy examination and assessment type aliases correctly", async () => {
    const { tenant } = await createSisTenant(database, "rb001-exam-aliases");
    const examService = new SisExaminationService(database);
    const sis = new SisService(database);
    const fixture = await createClassFixture(sis, tenant);

    // Legacy "midterm" -> "mid_term"
    const exam1 = await examService.createExamination(tenant, {
      name: "Midterm Exam 2026",
      academicYearId: fixture.year.id,
      type: "midterm",
      startDate: "2026-10-01",
      endDate: "2026-10-15",
      status: "scheduled",
    });
    expect(exam1.type).toBe("mid_term");
    expect(exam1.status).toBe("scheduled");

    // Legacy "final" -> "final_term"
    const exam2 = await examService.createExamination(tenant, {
      name: "Final Term 2026",
      academicYearId: fixture.year.id,
      type: "final",
      startDate: "2026-11-01",
      endDate: "2026-11-15",
    });
    expect(exam2.type).toBe("final_term");
    expect(exam2.status).toBe("draft"); // Documented default when omitted

    // Legacy assessment "test" -> "class_test"
    const subject = await sis.createSubject(tenant, {
      name: "Science",
      code: `SCI-${randomUUID().slice(0, 4)}`,
      status: "active",
      displayOrder: 1,
    });
    await sis.assignSubjectToClass(tenant, fixture.grade.id, subject.id);
    const teacher = await sis.createStaff(tenant, {
      firstName: "Exam",
      lastName: "Teacher",
      hireDate: "2026-08-01",
      staffType: "teacher",
    });

    const assessment = await examService.createAssessment(tenant, {
      title: "Unit 1 Quiz",
      academicYearId: fixture.year.id,
      gradeId: fixture.grade.id,
      sectionId: fixture.section.id,
      subjectId: subject.id,
      teacherId: teacher.id,
      type: "test",
      maximumMarks: 50,
      passingMarks: 20,
      assessmentDate: "2026-10-20",
    });
    expect(assessment.type).toBe("class_test");
  });

  /* ─────────────────────────────────────────────────────────────
   * 6. Unsupported enum values are rejected where required
   * ───────────────────────────────────────────────────────────── */
  it("rejects unsupported examination and assessment enum values with 400 validation error", async () => {
    const { tenant } = await createSisTenant(database, "rb001-unsupported-enums");
    const examService = new SisExaminationService(database);
    const sis = new SisService(database);
    const fixture = await createClassFixture(sis, tenant);

    // Unsupported examination type
    await expect(
      examService.createExamination(tenant, {
        name: "Invalid Exam Type",
        academicYearId: fixture.year.id,
        type: "surprise_pop_quiz",
        startDate: "2026-10-01",
        endDate: "2026-10-05",
      })
    ).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof ApiError &&
        err.statusCode === 400 &&
        err.message.includes("Invalid examination type")
      );
    });

    // Unsupported examination status
    await expect(
      examService.createExamination(tenant, {
        name: "Invalid Exam Status",
        academicYearId: fixture.year.id,
        type: "mid_term",
        startDate: "2026-10-01",
        endDate: "2026-10-05",
        status: "pending_review",
      })
    ).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof ApiError &&
        err.statusCode === 400 &&
        err.message.includes("Invalid examination status")
      );
    });
  });

  /* ─────────────────────────────────────────────────────────────
   * 7. Valid existing admissions workflows continue functioning
   * ───────────────────────────────────────────────────────────── */
  it("processes valid admissions enquiries, applications, and conversions with legitimate contacts", async () => {
    const { tenant } = await createSisTenant(database, "rb001-admissions-flow");
    const admissions = new SisAdmissionsService(database);
    const sis = new SisService(database);
    const fixture = await createClassFixture(sis, tenant);

    const enquiry = await admissions.createEnquiry(tenant, {
      studentName: "Admissions Pupil",
      guardianName: "Admissions Parent",
      phone: "+15559876543",
      desiredGradeId: fixture.grade.id,
      email: "admissions-parent@example.test",
    });
    expect(enquiry.id).toBeDefined();

    const application = await admissions.createApplication(tenant, {
      enquiryId: enquiry.id,
      academicYearId: fixture.year.id,
      desiredGradeId: fixture.grade.id,
      student: {
        firstName: "Admissions",
        lastName: "Pupil",
        dateOfBirth: "2016-04-10",
        gender: "female",
      },
      guardians: [
        {
          firstName: "Admissions",
          lastName: "Parent",
          relationship: "mother",
          phone: "+15559876543",
          email: "admissions-parent@example.test",
          isPrimaryContact: true,
        },
      ],
    });
    expect(application.id).toBeDefined();

    // Submit and approve application
    await admissions.submitApplication(tenant, application.id);
    await admissions.recordDecision(tenant, application.id, {
      status: "approved",
      remarks: "Approved for enrollment",
    });

    // Convert to student & enrollment
    const conversion = await admissions.convertApplicationToEnrollment(tenant, application.id, {
      academicYear: fixture.year.name,
      gradeId: fixture.grade.id,
      sectionId: fixture.section.id,
      admissionDate: "2026-09-01",
    });
    expect(conversion.success).toBe(true);
    expect(conversion.student.firstName).toBe("Admissions");
    expect(conversion.student.dateOfBirth).toBe("2016-04-10");
    expect(conversion.student.admissionDate).toBe("2026-09-01");
  });

  /* ─────────────────────────────────────────────────────────────
   * 8. Valid staff creation continues functioning
   * ───────────────────────────────────────────────────────────── */
  it("successfully creates staff with explicit hireDate and rejects missing hireDate", async () => {
    const { tenant } = await createSisTenant(database, "rb001-staff-creation");
    const sis = new SisService(database);

    // Missing hireDate rejected
    await expect(
      sis.createStaff(tenant, {
        firstName: "Jane",
        lastName: "Teacher",
        staffType: "teacher",
      })
    ).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof ApiError &&
        err.statusCode === 400 &&
        err.message.includes("Staff hire date is required")
      );
    });

    // Valid staff created
    const staff = await sis.createStaff(tenant, {
      firstName: "Jane",
      lastName: "Teacher",
      hireDate: "2026-08-15",
      staffType: "teacher",
      employmentStatus: "full_time",
      status: "active",
    });
    expect(staff.id).toBeDefined();
    expect(staff.hireDate).toBe("2026-08-15");
    expect(staff.employeeNumber).toMatch(/^EMP-\d{3}$/);
  });

  /* ─────────────────────────────────────────────────────────────
   * 9. Existing tenant isolation remains intact
   * ───────────────────────────────────────────────────────────── */
  it("enforces strict tenant isolation for students and staff with legitimate required data", async () => {
    const { tenant: tenantA } = await createSisTenant(database, "rb001-iso-a");
    const { tenant: tenantB } = await createSisTenant(database, "rb001-iso-b");
    const sis = new SisService(database);

    const studentA = await sis.createStudent(tenantA, {
      firstName: "StudentA",
      lastName: "Isolation",
      dateOfBirth: "2015-01-01",
      admissionDate: "2026-09-01",
      status: "active",
    });

    // Tenant B cannot see Tenant A's student
    const fetchedByB = await sis.getStudent(tenantB, studentA.id);
    expect(fetchedByB).toBeNull();
  });

  /* ─────────────────────────────────────────────────────────────
   * 10. Transactional operations remain atomic
   * ───────────────────────────────────────────────────────────── */
  it("rolls back student and guardian creation atomically if an error occurs within the transaction", async () => {
    const { tenant } = await createSisTenant(database, "rb001-atomic-rollback");
    const sis = new SisService(database);

    const initialStudents = await sis.listStudents(tenant);

    // Attempt student creation with second guardian having an invalid relationship
    await expect(
      sis.createStudent(tenant, {
        firstName: "Rollback",
        lastName: "Candidate",
        dateOfBirth: "2015-08-08",
        admissionDate: "2026-09-01",
        guardians: [
          {
            firstName: "Valid",
            lastName: "Parent",
            phone: "+15551112233",
            email: "valid@example.test",
            relationship: "mother",
          },
          {
            firstName: "Invalid",
            lastName: "Parent",
            phone: "+15551112244",
            email: "invalid@example.test",
            relationship: "not_a_legal_relationship",
          },
        ],
      })
    ).rejects.toThrow(/Invalid guardian relationship/);

    // Verify atomic rollback: no orphan student record was created
    const postStudents = await sis.listStudents(tenant);
    expect(postStudents.length).toBe(initialStudents.length);
  });
});
