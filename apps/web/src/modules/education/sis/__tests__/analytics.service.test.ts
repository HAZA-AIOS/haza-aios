import { beforeEach, describe, expect, it } from "vitest";
import { AcademicService } from "../academic.service";
import { SisAnalyticsService } from "../analytics.service";
import { AttendanceService } from "../attendance.service";
import { CommunicationService } from "../communication.service";
import { EnrollmentService } from "../enrollment.service";
import { ExaminationService } from "../examination.service";
import { FinanceService } from "../finance.service";
import { StaffService } from "../staff.service";
import { StudentService } from "../student.service";
import { TeachingAssignmentService } from "../teaching-assignment.service";
import { timetableService } from "../timetable.service";

const owner = { userId: "owner-user", role: "Owner" as const };
const teacher = { userId: "teacher-user", role: "Teacher" as const };
const accountant = { userId: "accountant-user", role: "Accountant" as const };
const member = { userId: "member-user", role: "Member" as const };

async function seedAnalyticsContext(organizationId: string) {
  const year = await AcademicService.createAcademicYear(organizationId, {
    name: `2026-2027-${organizationId}`,
    startDate: "2026-08-01",
    endDate: "2027-07-31",
    status: "active",
  });
  const grade = await AcademicService.createGrade(organizationId, {
    name: "Grade 7",
    level: 7,
    order: 7,
    status: "active",
  });
  const section = await AcademicService.createSection(organizationId, {
    gradeId: grade.id,
    name: "A",
    capacity: 32,
    status: "active",
  });
  const subject = await AcademicService.createSubject(organizationId, {
    name: `Science, Lab "${organizationId}"`,
    code: `SCI-${organizationId}`,
    status: "active",
    displayOrder: 1,
  });
  const teacherStaff = await StaffService.createStaff({
    organizationId,
    firstName: "Nadia",
    lastName: "Rahman",
    email: `teacher-${organizationId}@example.com`,
    hireDate: "2026-08-01",
    staffType: "teacher",
    employmentStatus: "full_time",
    status: "active",
    userId: "teacher-user",
  });
  await StaffService.createStaff({
    organizationId,
    firstName: "Unassigned",
    lastName: "Teacher",
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
    dateOfBirth: "2013-04-01",
    gender: "female",
    admissionDate: "2026-08-01",
    status: "active",
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
  const missingEnrollmentStudent = await StudentService.createStudent({
    organizationId,
    firstName: "No",
    lastName: "Enrollment",
    dateOfBirth: "2013-04-01",
    gender: "male",
    admissionDate: "2026-08-01",
    status: "active",
    guardians: [],
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
  await TeachingAssignmentService.assignTeacher({
    organizationId,
    staffId: teacherStaff.id,
    academicYear: year.name,
    gradeId: grade.id,
    sectionId: section.id,
    subjectId: subject.id,
    isActive: true,
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
    teacherId: teacherStaff.id,
    dayOfWeek: 1,
    periodId: period.id,
    roomId: "Lab-1",
  });
  const attendanceSession = await AttendanceService.createSession(organizationId, {
    academicYearId: year.id,
    date: "2026-08-17",
    gradeId: grade.id,
    sectionId: section.id,
    sessionType: "daily",
    status: "draft",
    markedBy: "admin",
  });
  await AttendanceService.saveAttendanceRecords(organizationId, attendanceSession.id, [{ studentId: student.id, status: "present" }], "admin");
  const exam = await ExaminationService.createExamination(organizationId, {
    name: "Final Term",
    academicYearId: year.id,
    type: "final_term",
    startDate: "2026-11-01",
    endDate: "2026-11-05",
    status: "completed",
  }, owner);
  const examSubject = await ExaminationService.addExaminationSubject(organizationId, {
    examinationId: exam.id,
    gradeId: grade.id,
    sectionId: section.id,
    subjectId: subject.id,
    maximumMarks: 100,
    passingMarks: 40,
    status: "completed",
  }, owner);
  await ExaminationService.enterMark(organizationId, {
    sourceType: "examination",
    sourceId: exam.id,
    examinationSubjectId: examSubject.id,
    studentId: student.id,
    obtainedMarks: 85,
    enteredBy: "admin",
  }, owner);
  await ExaminationService.publishResults(organizationId, exam.id, grade.id, section.id, owner);
  const draftExam = await ExaminationService.createExamination(organizationId, {
    name: "Unpublished Check",
    academicYearId: year.id,
    type: "monthly_test",
    startDate: "2026-12-01",
    endDate: "2026-12-02",
    status: "completed",
  }, owner);
  const category = await FinanceService.createFeeCategory(organizationId, {
    name: "Tuition",
    code: `TUITION-${organizationId}`,
    status: "active",
    displayOrder: 1,
  }, owner);
  const structure = await FinanceService.createFeeStructure(organizationId, {
    academicYearId: year.id,
    gradeId: grade.id,
    feeCategoryId: category.id,
    name: "Monthly Tuition",
    amountCents: 100000,
    frequency: "monthly",
    effectiveFrom: "2026-08-01",
    status: "active",
  }, owner);
  await FinanceService.assignFeeStructureToStudent(organizationId, student.id, enrollment.id, structure.id, owner);
  const invoice = await FinanceService.createInvoice(organizationId, {
    studentId: student.id,
    enrollmentId: enrollment.id,
    academicYearId: year.id,
    issueDate: "2026-08-10",
    dueDate: "2026-08-30",
    currency: "USD",
    feeStructureIds: [structure.id],
    status: "issued",
  }, owner);
  await CommunicationService.sendCommunication(organizationId, {
    subject: "Operational Update",
    body: "Report-ready communication.",
    senderId: "admin",
    audience: { type: "selected_students", studentIds: [student.id] },
    channels: ["in_app", "email"],
    priority: "normal",
  }, owner);
  return { year, grade, section, subject, student, missingEnrollmentStudent, teacherStaff, draftExam, invoice };
}

describe("Epic 10J: SIS Analytics, Reporting & Operational Completion", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("builds central SIS analytics from existing source services", async () => {
    const { year, grade, section } = await seedAnalyticsContext("org-analytics");
    const overview = await SisAnalyticsService.getOverview("org-analytics", {
      academicYearId: year.id,
      gradeId: grade.id,
      sectionId: section.id,
    }, owner);

    expect(overview.students.total).toBe(1);
    expect(overview.staff.activeTeachers).toBe(2);
    expect(overview.attendance.attendancePercentage).toBe(100);
    expect(overview.timetable.scheduledClasses).toBe(1);
    expect(overview.results.publishedResults).toBe(1);
    expect(overview.finance.outstandingCents).toBeGreaterThan(0);
    expect(overview.communication.communicationsSent).toBe(1);
    expect(overview.portal.linkedParentAccounts).toBe(1);
  });

  it("generates representative reports with active filters", async () => {
    const { year, grade, section } = await seedAnalyticsContext("org-reports-10j");
    const filters = { academicYearId: year.id, gradeId: grade.id, sectionId: section.id };
    const studentReport = await SisAnalyticsService.getReport("org-reports-10j", "student_directory", filters, owner);
    const attendanceReport = await SisAnalyticsService.getReport("org-reports-10j", "attendance_summary", filters, owner);
    const resultsReport = await SisAnalyticsService.getReport("org-reports-10j", "results_summary", filters, owner);
    const financeReport = await SisAnalyticsService.getReport("org-reports-10j", "finance_collection", filters, owner);

    expect(studentReport.rows).toHaveLength(2);
    expect(attendanceReport.rows).toHaveLength(1);
    expect(resultsReport.rows[0].passRate).toBe(100);
    expect(financeReport.rows[0].balanceCents).toBe(100000);
  });

  it("exports escaped CSV and excludes hidden sensitive guardian fields", async () => {
    await seedAnalyticsContext("org-export-10j");
    const csv = await SisAnalyticsService.exportCsv("org-export-10j", "student_directory", {}, owner);

    expect(csv).toContain("Admission Number,Name,Status,Class,Section,Guardian Count");
    expect(csv).not.toContain("sara@example.com");
    expect(csv).not.toContain("555-1000");
  });

  it("enforces report and export permissions", async () => {
    await seedAnalyticsContext("org-permission-10j");

    await expect(SisAnalyticsService.getReport("org-permission-10j", "finance_collection", {}, teacher)).rejects.toThrow("Unauthorized");
    await expect(SisAnalyticsService.exportCsv("org-permission-10j", "finance_collection", {}, member)).rejects.toThrow("Unauthorized");
    await expect(SisAnalyticsService.getReport("org-permission-10j", "finance_collection", {}, accountant)).resolves.toBeTruthy();
  });

  it("detects data quality and health issues from actual SIS state", async () => {
    const { missingEnrollmentStudent, draftExam } = await seedAnalyticsContext("org-quality-10j");
    const issues = await SisAnalyticsService.getDataQuality("org-quality-10j", {}, owner);
    const health = await SisAnalyticsService.getHealth("org-quality-10j", {}, owner);

    expect(issues.some((issue) => issue.relatedResourceId === missingEnrollmentStudent.id && issue.title.includes("without current enrollment"))).toBe(true);
    expect(issues.some((issue) => issue.relatedResourceId === draftExam.id && issue.title.includes("without published results"))).toBe(true);
    expect(health.status).not.toBe("healthy");
    expect(health.modules.find((item) => item.epic === "10J")).toBeUndefined();
  });

  it("keeps analytics tenant isolated", async () => {
    await seedAnalyticsContext("org-tenant-a");
    await seedAnalyticsContext("org-tenant-b");

    const reportA = await SisAnalyticsService.getReport("org-tenant-a", "finance_collection", {}, owner);
    const reportB = await SisAnalyticsService.getReport("org-tenant-b", "finance_collection", {}, owner);

    expect(reportA.rows[0].invoiceNumber).toBe("INV-2026-00001");
    expect(reportB.rows[0].invoiceNumber).toBe("INV-2026-00001");
    expect(reportA.rows).toHaveLength(1);
    expect(reportB.rows).toHaveLength(1);
  });

  it("supports empty datasets without hard-coded healthy status", async () => {
    const overview = await SisAnalyticsService.getOverview("org-empty-10j", {}, owner);
    const health = await SisAnalyticsService.getHealth("org-empty-10j", {}, owner);
    const report = await SisAnalyticsService.getReport("org-empty-10j", "student_directory", {}, owner);

    expect(overview.students.total).toBe(0);
    expect(report.rows).toHaveLength(0);
    expect(health.status).toBe("critical");
  });
});
