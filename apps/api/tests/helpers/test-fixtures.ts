import { randomUUID } from "node:crypto";
import type { DatabaseClient } from "../../src/database/client.js";
import { AuthService } from "../../src/modules/auth/services/auth.service.js";
import { SisService, type SisTenantContext } from "../../src/modules/education/sis.service.js";
import { SisFinanceService } from "../../src/modules/education/sis-finance.service.js";
import { SisCommunicationService } from "../../src/modules/education/sis-communication.service.js";
import { SisExaminationService } from "../../src/modules/education/sis-examination.service.js";
import type { TrackedFixtureContext } from "./test-cleanup.js";

export interface FixtureTenant {
  organizationId: string;
  tenant: SisTenantContext;
  auth: Awaited<ReturnType<AuthService["register"]>>;
}

export interface ClassFixture {
  year: { id: string; name: string };
  grade: { id: string; name: string };
  section: { id: string; name: string };
  subject: { id: string; name: string };
  staff: { id: string; name: string };
  student: { id: string; name: string };
  enrollment: { id: string };
}

/**
 * Creates an isolated SIS tenant (organization, workspace, owner user, default roles)
 * and registers it with the cleanup tracker.
 */
export async function createIsolatedTenant(
  database: DatabaseClient,
  label: string,
  tracker?: TrackedFixtureContext
): Promise<FixtureTenant> {
  const suffix = randomUUID().slice(0, 8);
  const auth = await new AuthService(database).register({
    firstName: "Test",
    lastName: "Admin",
    email: `${label}-${suffix}@example.test`,
    password: "Password123!",
    organizationName: `Test Org ${label} ${suffix}`,
    organizationType: "School",
    industry: "Education",
    country: "United States",
  });

  const organizationId = auth.memberships[0].organizationId;
  const tenant = await new SisService(database).getTenant(organizationId);

  if (tracker) {
    tracker.organizationIds.add(organizationId);
    tracker.userIds.add(auth.user.id);
  }

  return { organizationId, tenant, auth };
}

/**
 * Creates academic structure (year, grade, section, subject, staff, student, enrollment).
 */
export async function createAcademicClassFixture(
  database: DatabaseClient,
  tenant: SisTenantContext
): Promise<ClassFixture> {
  const sis = new SisService(database);
  const suffix = randomUUID().slice(0, 6);

  const year = await sis.createAcademicYear(tenant, {
    name: `Year-${suffix}`,
    startDate: "2026-08-01",
    endDate: "2027-06-30",
    status: "active",
  });

  const grade = await sis.createGrade(tenant, {
    name: `Grade-${suffix}`,
    level: 1,
    order: 1,
    status: "active",
  });

  const section = await sis.createSection(tenant, {
    gradeId: grade.id,
    name: `Sec-${suffix}`,
    capacity: 30,
    status: "active",
  });

  const subject = await sis.createSubject(tenant, {
    name: `Math-${suffix}`,
    code: `M-${suffix}`,
    status: "active",
    displayOrder: 1,
  });

  await sis.assignSubjectToClass(tenant, grade.id, subject.id);

  const staff = await sis.createStaff(tenant, {
    firstName: "Teacher",
    lastName: `Staff-${suffix}`,
    email: `teacher-${suffix}@example.test`,
    staffType: "teacher",
    employmentStatus: "full_time",
    status: "active",
  });

  await sis.createTeachingAssignment(tenant, {
    staffId: staff.id,
    academicYear: year.name,
    gradeId: grade.id,
    sectionId: section.id,
    subjectId: subject.id,
    isActive: true,
  });

  const student = await sis.createStudent(tenant, {
    admissionNumber: `ADM-${suffix}`,
    firstName: "Student",
    lastName: `Pupil-${suffix}`,
    dateOfBirth: "2015-05-15",
    gender: "female",
    admissionDate: "2026-08-01",
    status: "active",
    guardians: [
      {
        firstName: "Parent",
        lastName: `Guardian-${suffix}`,
        relationship: "Mother",
        phone: "+15551234567",
        email: `parent-${suffix}@example.test`,
        isEmergencyContact: true,
        authorizedForPortal: true,
      },
    ],
  });

  const enrollment = await sis.createEnrollment(tenant, {
    studentId: student.id,
    academicYear: year.name,
    gradeId: grade.id,
    sectionId: section.id,
    enrollmentDate: "2026-08-01",
    status: "active",
  });

  return {
    year: { id: year.id, name: year.name },
    grade: { id: grade.id, name: grade.name },
    section: { id: section.id, name: section.name },
    subject: { id: subject.id, name: subject.name },
    staff: { id: staff.id, name: `${staff.firstName} ${staff.lastName}` },
    student: { id: student.id, name: `${student.firstName} ${student.lastName}` },
    enrollment: { id: enrollment.id },
  };
}

/**
 * Creates attendance session and records.
 */
export async function createAttendanceFixture(
  database: DatabaseClient,
  tenant: SisTenantContext,
  classFixture: ClassFixture
) {
  const sis = new SisService(database);
  const session = await sis.createAttendanceSession(tenant, {
    academicYearId: classFixture.year.id,
    date: "2026-09-01",
    gradeId: classFixture.grade.id,
    sectionId: classFixture.section.id,
    sessionType: "daily",
    markedBy: classFixture.staff.id,
    status: "draft",
  });

  const records = await sis.saveAttendanceRecords(
    tenant,
    session.id,
    [{ studentId: classFixture.student.id, status: "present", note: "On time" }],
    classFixture.staff.id
  );

  return { session, records };
}

/**
 * Creates finance category, structure, invoice, and payment.
 */
export async function createFinanceFixture(
  database: DatabaseClient,
  tenant: SisTenantContext,
  classFixture: ClassFixture,
  actor: { userId: string; role: string }
) {
  const finance = new SisFinanceService(database);
  const suffix = randomUUID().slice(0, 6);

  const category = await finance.createCategory(
    tenant,
    {
      name: `Tuition ${suffix}`,
      code: `CAT-${suffix}`,
      status: "active",
      displayOrder: 1,
    },
    actor
  );

  const structure = await finance.createStructure(
    tenant,
    {
      name: `Annual Tuition ${suffix}`,
      academicYearId: classFixture.year.id,
      gradeId: classFixture.grade.id,
      feeCategoryId: category.id,
      amountCents: 120000,
      frequency: "annual",
      effectiveFrom: "2026-08-01",
      status: "active",
    },
    actor
  );

  await finance.assignFee(
    tenant,
    classFixture.student.id,
    classFixture.enrollment.id,
    structure.id,
    actor
  );

  const invoice = await finance.createInvoice(
    tenant,
    {
      studentId: classFixture.student.id,
      enrollmentId: classFixture.enrollment.id,
      academicYearId: classFixture.year.id,
      issueDate: "2026-08-01",
      dueDate: "2026-08-31",
      currency: "USD",
      feeStructureIds: [structure.id],
      status: "issued",
    },
    actor
  );

  const paymentResult = await finance.recordPayment(
    tenant,
    {
      invoiceId: invoice.id,
      amountCents: 60000,
      paymentDate: "2026-08-15",
      paymentMethod: "bank_transfer",
      referenceNumber: `REF-${suffix}`,
      receivedBy: "Finance Office",
    },
    actor
  );

  return { category, structure, invoice, paymentResult };
}

/**
 * Creates examination, examination subject, mark, and result calculation.
 */
export async function createExaminationFixture(
  database: DatabaseClient,
  tenant: SisTenantContext,
  classFixture: ClassFixture
) {
  const exams = new SisExaminationService(database);
  const suffix = randomUUID().slice(0, 6);

  const exam = await exams.createExamination(tenant, {
    name: `Exam-${suffix}`,
    academicYearId: classFixture.year.id,
    type: "final",
    startDate: "2026-11-01",
    endDate: "2026-11-15",
    status: "scheduled",
  });

  const examSubject = await exams.addExaminationSubject(tenant, {
    examinationId: exam.id,
    gradeId: classFixture.grade.id,
    sectionId: classFixture.section.id,
    subjectId: classFixture.subject.id,
    maximumMarks: 100,
    passingMarks: 50,
    status: "scheduled",
    examDate: "2026-11-05",
  });

  const mark = await exams.enterMark(tenant, {
    sourceType: "examination",
    sourceId: exam.id,
    examinationSubjectId: examSubject.id,
    studentId: classFixture.student.id,
    obtainedMarks: 88,
    enteredBy: classFixture.staff.id,
  });

  const calculated = await exams.calculateClassResults(
    tenant,
    exam.id,
    classFixture.grade.id,
    classFixture.section.id
  );

  return { exam, examSubject, mark, calculated };
}
