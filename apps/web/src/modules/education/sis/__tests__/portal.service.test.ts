import { beforeEach, describe, expect, it } from "vitest";
import { AcademicService } from "../academic.service";
import { AttendanceService } from "../attendance.service";
import { CommunicationService } from "../communication.service";
import { EnrollmentService } from "../enrollment.service";
import { ExaminationService } from "../examination.service";
import { FinanceService } from "../finance.service";
import { PortalService } from "../portal.service";
import { StaffService } from "../staff.service";
import { StudentService } from "../student.service";
import { timetableService } from "../timetable.service";

const admin = { userId: "admin-user", role: "Owner" as const };

function seedMemberships(organizationId: string, userIds: string[]) {
  const existing = JSON.parse(localStorage.getItem("haza-aios.memberships") || "[]");
  localStorage.setItem("haza-aios.memberships", JSON.stringify([...existing, ...userIds.map((userId, index) => ({
    id: `membership-${organizationId}-${index}`,
    organizationId,
    userId,
    role: "Member",
    status: "active",
    joinedAt: "2026-08-01T00:00:00.000Z",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  }))]));
  const existingUsers = JSON.parse(localStorage.getItem("haza-aios.workspace-users") || "{}");
  localStorage.setItem("haza-aios.workspace-users", JSON.stringify({ ...existingUsers, ...Object.fromEntries(userIds.map((userId) => [userId, {
    name: userId,
    email: `${userId}@example.com`,
  }])) }));
}

async function seedPortalContext(organizationId: string) {
  seedMemberships(organizationId, ["parent-user", "student-user", "other-parent", "other-student"]);
  const year = await AcademicService.createAcademicYear(organizationId, {
    name: `2026-2027-${organizationId}`,
    startDate: "2026-08-01",
    endDate: "2027-07-31",
    status: "active",
  });
  const grade = await AcademicService.createGrade(organizationId, {
    name: "Grade 6",
    level: 6,
    order: 6,
    status: "active",
  });
  const section = await AcademicService.createSection(organizationId, {
    gradeId: grade.id,
    name: "A",
    capacity: 30,
    status: "active",
  });
  const subject = await AcademicService.createSubject(organizationId, {
    name: "Mathematics",
    code: `MATH-${organizationId}`,
    status: "active",
    displayOrder: 1,
  });
  const teacher = await StaffService.createStaff({
    organizationId,
    firstName: "Nadia",
    lastName: "Rahman",
    email: `teacher-${organizationId}@example.com`,
    hireDate: "2026-08-01",
    staffType: "teacher",
    employmentStatus: "full_time",
    status: "active",
  });
  const student = await StudentService.createStudent({
    organizationId,
    userId: "student-user",
    portalAccessEnabled: true,
    firstName: "Aisha",
    lastName: "Khan",
    dateOfBirth: "2014-04-01",
    gender: "female",
    admissionDate: "2026-08-01",
    status: "active",
    email: "aisha@example.com",
    guardians: [{
      id: "guardian-parent",
      userId: "parent-user",
      firstName: "Sara",
      lastName: "Khan",
      relationship: "mother",
      email: "sara@example.com",
      phone: "555-1000",
      isEmergencyContact: true,
      isPrimaryContact: true,
      portalAccessEnabled: true,
    }],
  });
  const otherStudent = await StudentService.createStudent({
    organizationId,
    userId: "other-student",
    portalAccessEnabled: true,
    firstName: "Zain",
    lastName: "Ali",
    dateOfBirth: "2014-04-01",
    gender: "male",
    admissionDate: "2026-08-01",
    status: "active",
    guardians: [{
      id: "guardian-other",
      userId: "other-parent",
      firstName: "Omar",
      lastName: "Ali",
      relationship: "father",
      email: "omar@example.com",
      phone: "555-2000",
      isEmergencyContact: true,
      isPrimaryContact: true,
      portalAccessEnabled: true,
    }],
  });
  const enrollment = await EnrollmentService.enrollStudent({
    organizationId,
    studentId: student.id,
    academicYear: year.name,
    gradeId: grade.id,
    sectionId: section.id,
    enrollmentDate: "2026-08-01",
    status: "active",
  });
  await EnrollmentService.enrollStudent({
    organizationId,
    studentId: otherStudent.id,
    academicYear: year.name,
    gradeId: grade.id,
    sectionId: section.id,
    enrollmentDate: "2026-08-01",
    status: "active",
  });
  const period = await timetableService.savePeriod(organizationId, {
    name: "Period 1",
    startTime: "08:00",
    endTime: "08:45",
    type: "teaching",
    displayOrder: 1,
  });
  await timetableService.saveTimetableEntry(organizationId, {
    academicYearId: year.id,
    gradeId: grade.id,
    sectionId: section.id,
    subjectId: subject.id,
    teacherId: teacher.id,
    dayOfWeek: 1,
    periodId: period.id,
    roomId: "R-101",
  });
  const session = await AttendanceService.createSession(organizationId, {
    academicYearId: year.id,
    date: "2026-08-17",
    gradeId: grade.id,
    sectionId: section.id,
    sessionType: "daily",
    status: "draft",
    markedBy: "admin",
  });
  await AttendanceService.saveAttendanceRecords(organizationId, session.id, [{ studentId: student.id, status: "present" }], "admin");
  const exam = await ExaminationService.createExamination(organizationId, {
    name: "Mid Term",
    academicYearId: year.id,
    type: "mid_term",
    startDate: "2026-09-01",
    endDate: "2026-09-05",
    status: "completed",
  }, admin);
  const examSubject = await ExaminationService.addExaminationSubject(organizationId, {
    examinationId: exam.id,
    gradeId: grade.id,
    sectionId: section.id,
    subjectId: subject.id,
    maximumMarks: 100,
    passingMarks: 40,
    status: "completed",
  }, admin);
  await ExaminationService.bulkEnterMarks(organizationId, [
    { sourceType: "examination", sourceId: exam.id, examinationSubjectId: examSubject.id, studentId: student.id, obtainedMarks: 88, enteredBy: "admin" },
    { sourceType: "examination", sourceId: exam.id, examinationSubjectId: examSubject.id, studentId: otherStudent.id, obtainedMarks: 70, enteredBy: "admin" },
  ], admin);
  await ExaminationService.publishResults(organizationId, exam.id, grade.id, section.id, admin);
  const draftExam = await ExaminationService.createExamination(organizationId, {
    name: "Draft Test",
    academicYearId: year.id,
    type: "monthly_test",
    startDate: "2026-10-01",
    endDate: "2026-10-02",
    status: "completed",
  }, admin);
  await ExaminationService.addExaminationSubject(organizationId, {
    examinationId: draftExam.id,
    gradeId: grade.id,
    sectionId: section.id,
    subjectId: subject.id,
    maximumMarks: 50,
    passingMarks: 20,
    status: "completed",
  }, admin);
  const category = await FinanceService.createFeeCategory(organizationId, {
    name: "Tuition",
    code: `TUITION-${organizationId}`,
    status: "active",
    displayOrder: 1,
  }, admin);
  const structure = await FinanceService.createFeeStructure(organizationId, {
    academicYearId: year.id,
    gradeId: grade.id,
    feeCategoryId: category.id,
    name: "Monthly Tuition",
    amountCents: 120000,
    frequency: "monthly",
    effectiveFrom: "2026-08-01",
    status: "active",
  }, admin);
  await FinanceService.assignFeeStructureToStudent(organizationId, student.id, enrollment.id, structure.id, admin);
  const invoice = await FinanceService.createInvoice(organizationId, {
    studentId: student.id,
    enrollmentId: enrollment.id,
    academicYearId: year.id,
    issueDate: "2026-08-10",
    dueDate: "2026-08-30",
    currency: "USD",
    feeStructureIds: [structure.id],
    status: "issued",
  }, admin);
  await CommunicationService.createAnnouncement(organizationId, {
    title: "Welcome Back",
    content: "Classes have started.",
    authorId: "admin",
    audience: { type: "section", academicYear: year.name, gradeId: grade.id, sectionId: section.id },
    priority: "normal",
    status: "published",
  }, admin);
  await CommunicationService.createNotification(organizationId, {
    recipientKind: "guardian",
    recipientId: "guardian-parent",
    recipientUserId: "parent-user",
    type: "invoice.issued",
    title: "Invoice Issued",
    message: "A new invoice is available.",
    priority: "important",
    relatedResourceType: "invoice",
    relatedResourceId: invoice.id,
  });
  return { year, grade, section, subject, student, otherStudent, invoice };
}

describe("Epic 10I: Parent & Student Portal", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("resolves linked parent children and aggregates authorized portal data", async () => {
    const { student } = await seedPortalContext("org-portal-parent");
    const dashboard = await PortalService.getParentDashboard({
      organizationId: "org-portal-parent",
      userId: "parent-user",
      role: "parent",
    });

    expect(dashboard.linkedStudents).toHaveLength(1);
    expect(dashboard.linkedStudents[0].id).toBe(student.id);
    expect(dashboard.selectedStudent?.attendance.attendancePercentage).toBe(100);
    expect(dashboard.selectedStudent?.timetable).toHaveLength(1);
    expect(dashboard.selectedStudent?.finance.visible).toBe(true);
    expect(dashboard.selectedStudent?.communication.notifications.some((item) => item.type === "invoice.issued")).toBe(true);
  });

  it("denies an unlinked guardian attempting to access another child", async () => {
    const { student } = await seedPortalContext("org-portal-idor-parent");
    await expect(PortalService.getParentStudentDashboard({
      organizationId: "org-portal-idor-parent",
      userId: "other-parent",
      role: "parent",
    }, student.id)).rejects.toThrow("Forbidden");
  });

  it("resolves a student account and denies another student id", async () => {
    const { student, otherStudent } = await seedPortalContext("org-portal-student");
    const dashboard = await PortalService.getStudentDashboard({
      organizationId: "org-portal-student",
      userId: "student-user",
      role: "student",
    }, student.id);

    expect(dashboard.student.id).toBe(student.id);
    await expect(PortalService.getStudentDashboard({
      organizationId: "org-portal-student",
      userId: "student-user",
      role: "student",
    }, otherStudent.id)).rejects.toThrow("Forbidden");
  });

  it("shows only published results and assessments to portals", async () => {
    await seedPortalContext("org-portal-results");
    const dashboard = await PortalService.getStudentDashboard({
      organizationId: "org-portal-results",
      userId: "student-user",
      role: "student",
    });

    expect(dashboard.results).toHaveLength(1);
    expect(dashboard.results[0].sourceName).toBe("Mid Term");
    expect(dashboard.results.some((item) => item.sourceName === "Draft Test")).toBe(false);
  });

  it("hides student finance unless organization policy allows it", async () => {
    await seedPortalContext("org-portal-finance");
    const actor = { organizationId: "org-portal-finance", userId: "student-user", role: "student" as const };
    expect((await PortalService.getStudentDashboard(actor)).finance.visible).toBe(false);

    await PortalService.savePolicy("org-portal-finance", { studentFinanceVisible: true });
    const visibleDashboard = await PortalService.getStudentDashboard(actor);
    expect(visibleDashboard.finance.visible).toBe(true);
    expect(visibleDashboard.finance.invoices).toHaveLength(1);
    expect(visibleDashboard.finance.providerConfigured).toBe(false);
  });

  it("keeps portal access tenant isolated", async () => {
    await seedPortalContext("org-portal-a");
    await seedPortalContext("org-portal-b");

    const dashboardA = await PortalService.getParentDashboard({ organizationId: "org-portal-a", userId: "parent-user", role: "parent" });
    const dashboardB = await PortalService.getParentDashboard({ organizationId: "org-portal-b", userId: "parent-user", role: "parent" });

    expect(dashboardA.selectedStudent?.student.id).not.toBe(dashboardB.selectedStudent?.student.id);
    await expect(PortalService.getParentStudentDashboard({
      organizationId: "org-portal-a",
      userId: "parent-user",
      role: "parent",
    }, dashboardB.selectedStudent?.student.id || "")).rejects.toThrow("Forbidden");
  });

  it("requires explicit guardian portal authorization", async () => {
    seedMemberships("org-portal-no-access", ["parent-user"]);
    await StudentService.createStudent({
      organizationId: "org-portal-no-access",
      firstName: "Noor",
      lastName: "Ahmed",
      dateOfBirth: "2015-01-01",
      gender: "female",
      admissionDate: "2026-08-01",
      status: "active",
      guardians: [{
        id: "guardian-no-access",
        userId: "parent-user",
        firstName: "Parent",
        lastName: "User",
        relationship: "guardian",
        email: "parent@example.com",
        phone: "555-9000",
        isEmergencyContact: true,
        isPrimaryContact: true,
        portalAccessEnabled: false,
      }],
    });

    const dashboard = await PortalService.getParentDashboard({ organizationId: "org-portal-no-access", userId: "parent-user", role: "parent" });
    expect(dashboard.linkedStudents).toHaveLength(0);
  });

  it("creates limited self-service update requests without changing SIS source records", async () => {
    const { student } = await seedPortalContext("org-portal-request");
    const actor = { organizationId: "org-portal-request", userId: "parent-user", role: "parent" as const };
    const before = await StudentService.getStudent(student.id, "org-portal-request");
    const request = await PortalService.submitUpdateRequest(actor, {
      studentId: student.id,
      type: "contact_update",
      subject: "Phone update",
      details: "Please update my phone number after review.",
    });
    const after = await StudentService.getStudent(student.id, "org-portal-request");

    expect(request.status).toBe("submitted");
    expect(after?.guardians[0].phone).toBe(before?.guardians[0].phone);
    expect(await PortalService.getUpdateRequests(actor)).toHaveLength(1);
  });
});
