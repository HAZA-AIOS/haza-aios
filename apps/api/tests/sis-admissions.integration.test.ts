import { migrate } from "../src/database/mysql94-migrator.js";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger } from "../src/common/logging/logger.js";
import { loadConfig, type ApiConfig } from "../src/config/env.js";
import { createDatabaseClient, type DatabaseClient } from "../src/database/client.js";
import { AuthService } from "../src/modules/auth/services/auth.service.js";
import { SisAdmissionsService } from "../src/modules/education/sis-admissions.service.js";
import { SisFinanceService } from "../src/modules/education/sis-finance.service.js";
import { SisService } from "../src/modules/education/sis.service.js";

const describeDatabase = process.env.RUN_DB_INTEGRATION_TESTS === "true" ? describe : describe.skip;
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(currentDirectory, "../src/database/migrations");

describeDatabase("DB-10K Admissions & Enrollment persistence", () => {
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

  it("handles enquiry lifecycle: creation, filtering, update, and conversion to application", async () => {
    const { tenant } = await createSisTenant(database, "adm-enq");
    const admissions = new SisAdmissionsService(database);
    const sis = new SisService(database);
    const fixture = await createClassFixture(sis, tenant);
    const staffActor = { userId: "staff-1", role: "Staff" };

    // 1. Create Enquiry
    const enquiry = await admissions.createEnquiry(
      tenant,
      {
        studentName: "Zaid Ahmed",
        guardianName: "Tariq Ahmed",
        phone: "555-0199",
        email: "tariq@example.com",
        desiredGradeId: fixture.grade.id,
        preferredCampus: "North Campus",
        previousSchool: "Beaconhouse",
        enquiryDate: "2026-10-01",
        followUpDate: "2026-10-10",
        notes: "Interested in robotics curriculum",
      },
      staffActor
    );

    expect(enquiry.id).toBeDefined();
    expect(enquiry.referenceNumber).toMatch(/^ENQ-\d{4}-\d{5}$/);
    expect(enquiry.status).toBe("new");

    // 2. Filter Enquiries
    const list = await admissions.listEnquiries(tenant, { search: "Zaid" });
    expect(list.length).toBe(1);
    expect(list[0].referenceNumber).toBe(enquiry.referenceNumber);

    // 3. Update Enquiry
    const updated = await admissions.updateEnquiry(
      tenant,
      String(enquiry.id),
      { status: "contacted", notes: "Parent contacted, campus tour scheduled" },
      staffActor
    );
    expect(updated.status).toBe("contacted");

    // 4. Convert Enquiry to Application
    const app = await admissions.convertEnquiryToApplication(tenant, String(enquiry.id), staffActor);
    expect(app.id).toBeDefined();
    expect(app.applicationNumber).toMatch(/^APP-\d{4}-\d{5}$/);
    expect((app.student as Record<string, unknown>).firstName).toBe("Zaid");
    expect((app.student as Record<string, unknown>).lastName).toBe("Ahmed");

    const reloadedEnquiry = await admissions.getEnquiry(tenant, String(enquiry.id));
    expect(reloadedEnquiry.status).toBe("converted");
    expect(reloadedEnquiry.convertedApplicationId).toBe(app.id);

    // 5. Duplicate conversion prevention (idempotent)
    const idempotentApp = await admissions.convertEnquiryToApplication(tenant, String(enquiry.id), staffActor);
    expect(idempotentApp.id).toBe(app.id);
  });

  it("handles application workflow, submission validation, assessment recording, and decision", async () => {
    const { tenant } = await createSisTenant(database, "adm-flow");
    const admissions = new SisAdmissionsService(database);
    const sis = new SisService(database);
    const fixture = await createClassFixture(sis, tenant);
    const applicantActor = { userId: "applicant-user", role: "Applicant" };
    const adminActor = { userId: "admin-user", role: "Owner" };

    // 1. Create Draft Application
    const draftApp = await admissions.createApplication(
      tenant,
      {
        desiredGradeId: fixture.grade.id,
        campus: "Main Campus",
        academicYear: fixture.year.name,
        student: {
          firstName: "Fatima",
          lastName: "Noor",
          dateOfBirth: "2017-04-12",
          gender: "female",
          address: "123 Garden Avenue",
          previousSchool: "City Montessori",
        },
        guardians: [
          {
            id: randomUUID(),
            firstName: "Rashid",
            lastName: "Noor",
            relationship: "father",
            email: "rashid@example.com",
            phone: "555-0888",
            isPrimaryContact: true,
            isEmergencyContact: true,
          },
        ],
      },
      applicantActor
    );
    expect(draftApp.status).toBe("draft");

    // 2. Reject decision on draft application
    await expect(
      admissions.recordDecision(tenant, String(draftApp.id), { status: "approved" }, adminActor)
    ).rejects.toMatchObject({ statusCode: 400 });

    // 3. Submit Application
    const submittedApp = await admissions.submitApplication(tenant, String(draftApp.id), applicantActor);
    expect(submittedApp.status).toBe("submitted");
    expect(submittedApp.submissionDate).toBeDefined();

    // 4. Create Assessment
    const assessment = await admissions.createAssessment(
      tenant,
      {
        applicationId: submittedApp.id,
        subject: "Mathematics & English Diagnostic",
        assessmentType: "written_test",
        maximumMarks: 100,
        obtainedMarks: 85,
        passingMarks: 60,
        assessorStaffId: fixture.staff.id,
        assessorName: "Ada Teacher",
        remarks: "Excellent problem solving ability",
      },
      adminActor
    );
    expect(assessment.outcome).toBe("passed");

    // Verify application state transitioned to 'assessment'
    const appUnderAssessment = await admissions.getApplication(tenant, String(draftApp.id));
    expect(appUnderAssessment.status).toBe("assessment");

    // 5. Approve Application with Remarks
    const approvedApp = await admissions.recordDecision(
      tenant,
      String(draftApp.id),
      {
        status: "approved",
        remarks: "Candidate met all diagnostic benchmarks.",
      },
      adminActor
    );
    expect(approvedApp.status).toBe("approved");
    expect((approvedApp.decision as Record<string, unknown>).status).toBe("approved");
    expect((approvedApp.decision as Record<string, unknown>).remarks).toBe("Candidate met all diagnostic benchmarks.");
  });

  it("integrates fee package assignment and transactionally converts approved application to active enrollment", async () => {
    const { tenant } = await createSisTenant(database, "adm-conv");
    const admissions = new SisAdmissionsService(database);
    const sis = new SisService(database);
    const finance = new SisFinanceService(database);
    const fixture = await createClassFixture(sis, tenant);
    const adminActor = { userId: "admin-1", role: "Owner" };

    // 1. Setup Fee Category and Structure
    const feeCat = await finance.createCategory(
      tenant,
      { name: "Admissions & Tuition", code: "ADM-" + randomUUID().slice(0, 4), status: "active", displayOrder: 1 },
      adminActor
    );
    const feeStruct = await finance.createStructure(
      tenant,
      {
        name: "Standard Tuition",
        academicYearId: fixture.year.id,
        gradeId: fixture.grade.id,
        feeCategoryId: feeCat.id,
        amountCents: 150000,
        status: "active",
      },
      adminActor
    );

    // 2. Create and Approve an Application
    const app = await admissions.createApplication(
      tenant,
      {
        desiredGradeId: fixture.grade.id,
        academicYear: fixture.year.name,
        campus: "Main Campus",
        status: "draft",
        student: {
          firstName: "Bilal",
          lastName: "Iqbal",
          dateOfBirth: "2016-08-20",
          gender: "male",
        },
        guardians: [
          {
            id: randomUUID(),
            firstName: "Iqbal",
            lastName: "Masood",
            relationship: "father",
            email: `iqbal-${randomUUID()}@example.com`,
            phone: "555-0999",
            isPrimaryContact: true,
            isEmergencyContact: true,
          },
        ],
      },
      adminActor
    );

    await admissions.submitApplication(tenant, String(app.id), adminActor);
    await admissions.recordDecision(tenant, String(app.id), { status: "approved", remarks: "Approved for enrollment." }, adminActor);

    // 3. Review Fee Preview and Assign Fee Package
    const feePreview = await admissions.getFeePackagePreview(tenant, String(app.id));
    expect(feePreview.applicableStructures.length).toBeGreaterThanOrEqual(1);

    await admissions.assignFeePackage(
      tenant,
      String(app.id),
      {
        feeStructureIds: [feeStruct.id],
        admissionFeeCents: 20000,
      },
      adminActor
    );

    // 4. Convert to Enrollment
    const conversionResult = await admissions.convertApplicationToEnrollment(
      tenant,
      String(app.id),
      {
        academicYear: fixture.year.name,
        gradeId: fixture.grade.id,
        sectionId: fixture.section.id,
        admissionDate: "2026-10-15",
      },
      adminActor
    );

    expect(conversionResult.success).toBe(true);
    expect(conversionResult.isExisting).toBe(false);
    expect(conversionResult.student?.id).toBeDefined();
    expect(conversionResult.student?.status).toBe("active");
    expect(conversionResult.student?.admissionNumber).toMatch(/^(ADM|TMS)-\d{4}-\d{5}$/);
    expect(conversionResult.enrollment.status).toBe("active");

    // Verify application status updated to enrolled
    const enrolledApp = await admissions.getApplication(tenant, String(app.id));
    expect(enrolledApp.status).toBe("enrolled");
    expect(enrolledApp.enrolledStudentId).toBe(conversionResult.student?.id);

    // 5. Idempotent retry: Returns existing student and enrollment records
    const retryResult = await admissions.convertApplicationToEnrollment(
      tenant,
      String(app.id),
      {
        academicYear: fixture.year.name,
        gradeId: fixture.grade.id,
        sectionId: fixture.section.id,
      },
      adminActor
    );
    expect(retryResult.success).toBe(true);
    expect(retryResult.isExisting).toBe(true);
    expect(retryResult.student?.id).toBe(conversionResult.student?.id);

    // 6. Printable Document Data
    const printData = await admissions.getApplicationPrintData(tenant, String(app.id));
    expect(printData.applicationNumber).toBe(app.applicationNumber);
    expect(printData.student.fullName).toBe("Bilal Iqbal");
    expect(printData.guardians.length).toBe(1);

    // 7. Admissions Reports
    const conversionReport = await admissions.getReport(tenant, "conversion_summary");
    expect(conversionReport.title).toBe("Admission Conversion Summary");
    expect(conversionReport.enrolled).toBeGreaterThanOrEqual(1);

    const campusReport = await admissions.getReport(tenant, "campus_summary");
    expect(campusReport.title).toBe("Campus-wise Admissions Report");

    // 8. Admissions Dashboard
    const dashboard = await admissions.getDashboard(tenant);
    expect(dashboard.enrolledStudents).toBeGreaterThanOrEqual(1);
    expect(dashboard.conversionRatePercentage).toBeGreaterThanOrEqual(50);
  });
});

async function createSisTenant(database: DatabaseClient, label: string) {
  const suffix = randomUUID().slice(0, 8);
  const auth = await new AuthService(database).register({
    firstName: "Adm",
    lastName: "Owner",
    email: label + "-" + suffix + "@example.com",
    password: "password123",
    organizationName: "Adm Org " + label + " " + suffix,
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
    name: "2026-" + suffix,
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    status: "active",
  });
  const grade = await service.createGrade(tenant, {
    name: "Grade " + suffix,
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
