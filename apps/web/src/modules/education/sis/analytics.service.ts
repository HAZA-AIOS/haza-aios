import { workspaceService } from "@/workspace/workspace-service";
import { AcademicService } from "./academic.service";
import { AttendanceService } from "./attendance.service";
import { CommunicationService } from "./communication.service";
import { EnrollmentService } from "./enrollment.service";
import { ExaminationService } from "./examination.service";
import { FinanceService } from "./finance.service";
import { StaffService } from "./staff.service";
import { StudentService } from "./student.service";
import { TeachingAssignmentService } from "./teaching-assignment.service";
import { timetableService } from "./timetable.service";
import type {
  AcademicYear,
  Assessment,
  AttendanceRecord,
  AttendanceSession,
  CommunicationMessage,
  DeliveryAttempt,
  Enrollment,
  Examination,
  FeeCollectionSummary,
  Grade,
  MarkRecord,
  Section,
  SisAnalyticsActor,
  SisAnalyticsFilters,
  SisAnalyticsOverview,
  SisAnalyticsPermission,
  SisDataQualityIssue,
  SisDistributionItem,
  SisHealthOverview,
  SisHealthStatus,
  SisModuleCompletion,
  SisReportKind,
  SisReportResult,
  Staff,
  Student,
  StudentInvoice,
  Subject,
  TeachingAssignment,
  TimePeriod,
  TimetableEntry,
} from "./sis.types";

type AnalyticsContext = {
  years: AcademicYear[];
  activeYear: AcademicYear | null;
  grades: Grade[];
  sections: Section[];
  subjects: Subject[];
  students: Student[];
  staff: Staff[];
  enrollments: Enrollment[];
  sessions: AttendanceSession[];
  attendanceRecords: Array<{ session: AttendanceSession; record: AttendanceRecord }>;
  periods: TimePeriod[];
  timetable: TimetableEntry[];
  assignments: TeachingAssignment[];
  examinations: Examination[];
  assessments: Assessment[];
  marks: MarkRecord[];
  results: Awaited<ReturnType<typeof ExaminationService.getResultPublications>>;
  invoices: StudentInvoice[];
  finance: FeeCollectionSummary;
  communications: CommunicationMessage[];
  deliveries: DeliveryAttempt[];
};

const reportPermissions: Record<SisReportKind, SisAnalyticsPermission> = {
  student_directory: "student_reports.view",
  staff_directory: "staff_reports.view",
  attendance_summary: "attendance_reports.view",
  timetable_summary: "timetable_reports.view",
  results_summary: "results_reports.view",
  finance_collection: "finance_reports.view",
  communication_delivery: "communication_reports.view",
};

const managerRoles = new Set<SisAnalyticsActor["role"]>(["Owner", "Admin"]);
const accountantPermissions = new Set<SisAnalyticsPermission>([
  "analytics.view",
  "reports.view",
  "reports.export",
  "finance_reports.view",
  "data_quality.view",
  "sis_health.view",
]);
const teacherPermissions = new Set<SisAnalyticsPermission>([
  "analytics.view",
  "reports.view",
  "attendance_reports.view",
  "timetable_reports.view",
  "results_reports.view",
]);

function hasPermission(actor: SisAnalyticsActor | undefined, permission: SisAnalyticsPermission): boolean {
  if (!actor) return true;
  if (managerRoles.has(actor.role)) return true;
  if (actor.permissions?.includes(permission)) return true;
  if (actor.role === "Accountant" && accountantPermissions.has(permission)) return true;
  if (actor.role === "Teacher" && teacherPermissions.has(permission)) return true;
  return false;
}

function assertPermission(actor: SisAnalyticsActor | undefined, permission: SisAnalyticsPermission): void {
  if (!hasPermission(actor, permission)) throw new Error(`Unauthorized: missing permission ${permission}`);
}

function percent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 100;
}

function dateInRange(value: string | undefined, filters?: SisAnalyticsFilters): boolean {
  if (!value) return true;
  const date = value.split("T")[0];
  if (filters?.dateFrom && date < filters.dateFrom) return false;
  if (filters?.dateTo && date > filters.dateTo) return false;
  return true;
}

function distribution(values: string[]): SisDistributionItem[] {
  const rows = new Map<string, number>();
  for (const value of values) rows.set(value, (rows.get(value) || 0) + 1);
  return Array.from(rows.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

function csvEscape(value: string | number | boolean | null | undefined): string {
  const raw = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

function scopedByEnrollment(studentIds: Set<string>, enrollments: Enrollment[], filters?: SisAnalyticsFilters): Set<string> {
  if (!filters?.gradeId && !filters?.sectionId) return studentIds;
  const matching = new Set(enrollments
    .filter((enrollment) => (!filters.gradeId || enrollment.gradeId === filters.gradeId) && (!filters.sectionId || enrollment.sectionId === filters.sectionId))
    .map((enrollment) => enrollment.studentId));
  return new Set(Array.from(studentIds).filter((studentId) => matching.has(studentId)));
}

export class SisAnalyticsServiceClass {
  async getOverview(
    organizationId: string,
    filters: SisAnalyticsFilters = {},
    actor?: SisAnalyticsActor,
  ): Promise<SisAnalyticsOverview> {
    assertPermission(actor, "analytics.view");
    const context = await this.loadContext(organizationId, filters);
    const studentIds = scopedByEnrollment(new Set(context.students.map((student) => student.id)), context.enrollments, filters);
    const students = context.students.filter((student) => studentIds.has(student.id));
    const activeStudents = students.filter((student) => student.status === "active");
    const attendance = this.calculateAttendanceSummary(context.attendanceRecords);
    const activeTeachers = context.staff.filter((member) => member.status === "active" && member.staffType === "teacher");
    const activeAssignments = context.assignments.filter((assignment) => assignment.isActive);
    const teacherAssignmentIds = new Set(activeAssignments.map((assignment) => assignment.staffId));
    const marksFromPublishedResults = context.results
      .filter((result) => result.status === "published")
      .flatMap((publication) => publication.results.flatMap((result) => result.subjects));
    const resultAverage = marksFromPublishedResults.length === 0
      ? 0
      : Math.round((marksFromPublishedResults.reduce((sum, item) => sum + item.percentage, 0) / marksFromPublishedResults.length) * 100) / 100;

    return {
      students: {
        total: students.length,
        active: activeStudents.length,
        admissions: students.filter((student) => dateInRange(student.admissionDate, filters)).length,
        withdrawals: students.filter((student) => student.status === "withdrawn" || student.status === "transferred").length,
        byStatus: distribution(students.map((student) => student.status)),
        byClass: distribution(context.enrollments
          .filter((enrollment) => studentIds.has(enrollment.studentId))
          .map((enrollment) => context.grades.find((grade) => grade.id === enrollment.gradeId)?.name || "Unassigned")),
      },
      staff: {
        total: context.staff.length,
        activeTeachers: activeTeachers.length,
        activeStaff: context.staff.filter((member) => member.status === "active").length,
        teachersWithoutAssignments: activeTeachers.filter((teacher) => !teacherAssignmentIds.has(teacher.id)).length,
      },
      attendance,
      academics: {
        academicYears: context.years.length,
        activeAcademicYears: context.years.filter((year) => year.status === "active").length,
        grades: context.grades.length,
        sections: context.sections.length,
        subjects: context.subjects.length,
      },
      timetable: {
        scheduledClasses: context.timetable.length,
        teacherLoad: distribution(context.timetable.map((entry) => context.staff.find((member) => member.id === entry.teacherId)?.firstName || "Unassigned Teacher")),
        periodUtilization: distribution(context.timetable.map((entry) => context.periods.find((period) => period.id === entry.periodId)?.name || "Unknown Period")),
      },
      results: {
        examinations: context.examinations.length,
        publishedResults: context.results.filter((result) => result.status === "published").length,
        passRate: percent(marksFromPublishedResults.filter((result) => result.passed).length, marksFromPublishedResults.length),
        averagePerformance: resultAverage,
      },
      finance: context.finance,
      communication: {
        ...(await CommunicationService.getSummary(organizationId)),
        failedDeliveries: context.deliveries.filter((delivery) => delivery.status === "failed").length,
      },
      portal: {
        linkedParentAccounts: this.countLinkedParents(context.students),
        linkedStudentAccounts: context.students.filter((student) => Boolean(student.userId || student.metadata?.studentUserId)).length,
        portalReadyStudents: context.students.filter((student) => student.portalAccessEnabled !== false && (student.userId || student.guardians.some((guardian) => guardian.portalAccessEnabled || guardian.authorizedForPortal))).length,
      },
    };
  }

  async getReport(
    organizationId: string,
    kind: SisReportKind,
    filters: SisAnalyticsFilters = {},
    actor?: SisAnalyticsActor,
  ): Promise<SisReportResult> {
    assertPermission(actor, "reports.view");
    assertPermission(actor, reportPermissions[kind]);
    const context = await this.loadContext(organizationId, filters);
    const generatedAt = new Date().toISOString();

    if (kind === "student_directory") return this.studentReport(context, generatedAt);
    if (kind === "staff_directory") return this.staffReport(context, generatedAt);
    if (kind === "attendance_summary") return this.attendanceReport(context, generatedAt);
    if (kind === "timetable_summary") return this.timetableReport(context, generatedAt);
    if (kind === "results_summary") return this.resultsReport(context, generatedAt);
    if (kind === "finance_collection") return this.financeReport(context, generatedAt);
    return this.communicationReport(context, generatedAt);
  }

  async exportCsv(
    organizationId: string,
    kind: SisReportKind,
    filters: SisAnalyticsFilters = {},
    actor?: SisAnalyticsActor,
  ): Promise<string> {
    assertPermission(actor, "reports.export");
    const report = await this.getReport(organizationId, kind, filters, actor);
    await workspaceService.addActivityLog(organizationId, {
      action: "SIS Report Exported",
      actor: actor?.userId || "System Operator",
      details: `Exported ${report.title} as CSV.`,
    });
    const headers = report.columns.map((column) => column.label);
    const lines = [headers.map(csvEscape).join(",")];
    for (const row of report.rows) {
      lines.push(report.columns.map((column) => csvEscape(row[column.key])).join(","));
    }
    return lines.join("\r\n");
  }

  async getDataQuality(
    organizationId: string,
    filters: SisAnalyticsFilters = {},
    actor?: SisAnalyticsActor,
  ): Promise<SisDataQualityIssue[]> {
    assertPermission(actor, "data_quality.view");
    const context = await this.loadContext(organizationId, filters);
    return this.calculateDataQuality(context);
  }

  async getHealth(
    organizationId: string,
    filters: SisAnalyticsFilters = {},
    actor?: SisAnalyticsActor,
  ): Promise<SisHealthOverview> {
    assertPermission(actor, "sis_health.view");
    const context = await this.loadContext(organizationId, filters);
    const dataQuality = this.calculateDataQuality(context);
    const readiness = this.calculateReadiness(context, dataQuality);
    const status = readiness.some((item) => item.status === "critical") || dataQuality.some((item) => item.severity === "critical")
      ? "critical"
      : readiness.some((item) => item.status === "warning") || dataQuality.some((item) => item.severity === "warning")
        ? "warning"
        : "healthy";
    return {
      status,
      readiness,
      dataQuality,
      modules: this.calculateModuleCompletion(context),
    };
  }

  private async loadContext(organizationId: string, filters: SisAnalyticsFilters): Promise<AnalyticsContext> {
    const years = await AcademicService.getAcademicYears(organizationId);
    const activeYear = filters.academicYearId
      ? years.find((year) => year.id === filters.academicYearId) || null
      : years.find((year) => year.status === "active") || years[0] || null;
    const [grades, sections, subjects, students, staff, allEnrollments, periods, timetableAll, assignments, examinations, assessments, marks, results, invoices, finance, communications, deliveries] =
      await Promise.all([
        AcademicService.getGrades(organizationId),
        AcademicService.getSections(organizationId),
        AcademicService.getSubjects(organizationId),
        StudentService.getStudents(organizationId),
        StaffService.getStaffList(organizationId),
        EnrollmentService.getEnrollments(organizationId),
        timetableService.getPeriods(organizationId),
        timetableService.getTimetableEntries(organizationId),
        TeachingAssignmentService.getAssignments(organizationId),
        ExaminationService.getExaminations(organizationId),
        ExaminationService.getAssessments(organizationId),
        ExaminationService.getMarks(organizationId),
        ExaminationService.getResultPublications(organizationId),
        FinanceService.getInvoices(organizationId),
        FinanceService.getCollectionSummary(organizationId),
        CommunicationService.getCommunications(organizationId),
        CommunicationService.getDeliveryHistory(organizationId),
      ]);
    const enrollments = allEnrollments.filter((enrollment) => {
      if (activeYear && enrollment.academicYear !== activeYear.name) return false;
      if (filters.gradeId && enrollment.gradeId !== filters.gradeId) return false;
      if (filters.sectionId && enrollment.sectionId !== filters.sectionId) return false;
      return true;
    });
    const sessions = (await AttendanceService.getSessions(organizationId, {
      academicYearId: activeYear?.id,
      gradeId: filters.gradeId,
      sectionId: filters.sectionId,
    })).filter((session) => dateInRange(session.date, filters));
    const attendanceRecords = (await Promise.all(students.map((student) =>
      AttendanceService.getStudentAttendanceHistory(organizationId, student.id, activeYear?.id),
    ))).flat().filter(({ session }) => dateInRange(session.date, filters));
    const timetable = timetableAll.filter((entry) => {
      if (activeYear && entry.academicYearId !== activeYear.id) return false;
      if (filters.gradeId && entry.gradeId !== filters.gradeId) return false;
      if (filters.sectionId && entry.sectionId !== filters.sectionId) return false;
      if (filters.subjectId && entry.subjectId !== filters.subjectId) return false;
      return true;
    });
    return {
      years,
      activeYear,
      grades,
      sections,
      subjects,
      students,
      staff,
      enrollments,
      sessions,
      attendanceRecords,
      periods,
      timetable,
      assignments: assignments.filter((assignment) => !activeYear || assignment.academicYear === activeYear.name),
      examinations: examinations.filter((exam) => !activeYear || exam.academicYearId === activeYear.id),
      assessments: assessments.filter((assessment) => !activeYear || assessment.academicYearId === activeYear.id),
      marks: marks.filter((mark) => !activeYear || mark.academicYearId === activeYear.id),
      results: results.filter((result) => !activeYear || result.academicYearId === activeYear.id),
      invoices: invoices.filter((invoice) => !activeYear || invoice.academicYearId === activeYear.id),
      finance,
      communications,
      deliveries,
    };
  }

  private calculateAttendanceSummary(records: Array<{ session: AttendanceSession; record: AttendanceRecord }>) {
    const summary = { totalSessions: records.length, present: 0, absent: 0, late: 0, excused: 0, attendancePercentage: 0, completedSessions: 0, draftSessions: 0 };
    for (const { session, record } of records) {
      if (record.status === "present") summary.present += 1;
      if (record.status === "absent") summary.absent += 1;
      if (record.status === "late") summary.late += 1;
      if (record.status === "excused") summary.excused += 1;
      if (session.status === "completed") summary.completedSessions += 1;
      if (session.status === "draft") summary.draftSessions += 1;
    }
    const counted = summary.present + summary.absent + summary.late;
    summary.attendancePercentage = counted === 0 ? 0 : percent(summary.present + summary.late, counted);
    return summary;
  }

  private countLinkedParents(students: Student[]): number {
    const parents = new Set<string>();
    for (const student of students) {
      for (const guardian of student.guardians) {
        if (guardian.userId && (guardian.portalAccessEnabled || guardian.authorizedForPortal)) parents.add(guardian.userId);
      }
    }
    return parents.size;
  }

  private studentReport(context: AnalyticsContext, generatedAt: string): SisReportResult {
    return {
      kind: "student_directory",
      title: "Student Directory Report",
      generatedAt,
      columns: [
        { key: "admissionNumber", label: "Admission Number" },
        { key: "name", label: "Name" },
        { key: "status", label: "Status" },
        { key: "class", label: "Class" },
        { key: "section", label: "Section" },
        { key: "guardianCount", label: "Guardian Count" },
      ],
      rows: context.students.map((student) => {
        const enrollment = context.enrollments.find((item) => item.studentId === student.id);
        return {
          admissionNumber: student.admissionNumber,
          name: `${student.firstName} ${student.lastName}`.trim(),
          status: student.status,
          class: context.grades.find((grade) => grade.id === enrollment?.gradeId)?.name || "",
          section: context.sections.find((section) => section.id === enrollment?.sectionId)?.name || "",
          guardianCount: student.guardians.length,
        };
      }),
    };
  }

  private staffReport(context: AnalyticsContext, generatedAt: string): SisReportResult {
    return {
      kind: "staff_directory",
      title: "Staff Directory Report",
      generatedAt,
      columns: [
        { key: "employeeNumber", label: "Employee Number" },
        { key: "name", label: "Name" },
        { key: "staffType", label: "Staff Type" },
        { key: "status", label: "Status" },
        { key: "assignmentCount", label: "Active Assignments" },
      ],
      rows: context.staff.map((member) => ({
        employeeNumber: member.employeeNumber,
        name: `${member.firstName} ${member.lastName}`.trim(),
        staffType: member.staffType,
        status: member.status,
        assignmentCount: context.assignments.filter((assignment) => assignment.staffId === member.id && assignment.isActive).length,
      })),
    };
  }

  private attendanceReport(context: AnalyticsContext, generatedAt: string): SisReportResult {
    return {
      kind: "attendance_summary",
      title: "Attendance Summary Report",
      generatedAt,
      columns: [
        { key: "date", label: "Date" },
        { key: "class", label: "Class" },
        { key: "section", label: "Section" },
        { key: "status", label: "Session Status" },
        { key: "present", label: "Present" },
        { key: "absent", label: "Absent" },
        { key: "late", label: "Late" },
        { key: "excused", label: "Excused" },
      ],
      rows: context.sessions.map((session) => {
        const records = context.attendanceRecords.filter(({ session: item }) => item.id === session.id).map(({ record }) => record);
        return {
          date: session.date,
          class: context.grades.find((grade) => grade.id === session.gradeId)?.name || "",
          section: context.sections.find((section) => section.id === session.sectionId)?.name || "",
          status: session.status,
          present: records.filter((record) => record.status === "present").length,
          absent: records.filter((record) => record.status === "absent").length,
          late: records.filter((record) => record.status === "late").length,
          excused: records.filter((record) => record.status === "excused").length,
        };
      }),
    };
  }

  private timetableReport(context: AnalyticsContext, generatedAt: string): SisReportResult {
    return {
      kind: "timetable_summary",
      title: "Timetable Summary Report",
      generatedAt,
      columns: [
        { key: "day", label: "Day" },
        { key: "period", label: "Period" },
        { key: "class", label: "Class" },
        { key: "section", label: "Section" },
        { key: "subject", label: "Subject" },
        { key: "teacher", label: "Teacher" },
        { key: "room", label: "Room" },
      ],
      rows: context.timetable.map((entry) => ({
        day: entry.dayOfWeek,
        period: context.periods.find((period) => period.id === entry.periodId)?.name || "",
        class: context.grades.find((grade) => grade.id === entry.gradeId)?.name || "",
        section: context.sections.find((section) => section.id === entry.sectionId)?.name || "",
        subject: context.subjects.find((subject) => subject.id === entry.subjectId)?.name || "",
        teacher: context.staff.find((member) => member.id === entry.teacherId)?.firstName || "",
        room: entry.roomId || "",
      })),
    };
  }

  private resultsReport(context: AnalyticsContext, generatedAt: string): SisReportResult {
    return {
      kind: "results_summary",
      title: "Published Results Report",
      generatedAt,
      columns: [
        { key: "examination", label: "Examination" },
        { key: "class", label: "Class" },
        { key: "section", label: "Section" },
        { key: "studentCount", label: "Students" },
        { key: "passRate", label: "Pass Rate" },
        { key: "average", label: "Average" },
      ],
      rows: context.results.filter((result) => result.status === "published").map((result) => {
        const subjectRows = result.results.flatMap((student) => student.subjects);
        return {
          examination: context.examinations.find((exam) => exam.id === result.examinationId)?.name || "",
          class: context.grades.find((grade) => grade.id === result.gradeId)?.name || "",
          section: context.sections.find((section) => section.id === result.sectionId)?.name || "",
          studentCount: result.results.length,
          passRate: percent(subjectRows.filter((subject) => subject.passed).length, subjectRows.length),
          average: subjectRows.length === 0 ? 0 : Math.round((subjectRows.reduce((sum, subject) => sum + subject.percentage, 0) / subjectRows.length) * 100) / 100,
        };
      }),
    };
  }

  private financeReport(context: AnalyticsContext, generatedAt: string): SisReportResult {
    return {
      kind: "finance_collection",
      title: "Finance Collection Report",
      generatedAt,
      columns: [
        { key: "invoiceNumber", label: "Invoice Number" },
        { key: "student", label: "Student" },
        { key: "status", label: "Status" },
        { key: "totalCents", label: "Total Cents" },
        { key: "paidCents", label: "Paid Cents" },
        { key: "balanceCents", label: "Balance Cents" },
      ],
      rows: context.invoices.filter((invoice) => invoice.status !== "draft" && invoice.status !== "voided").map((invoice) => {
        const student = context.students.find((item) => item.id === invoice.studentId);
        return {
          invoiceNumber: invoice.invoiceNumber,
          student: student ? `${student.firstName} ${student.lastName}`.trim() : "",
          status: invoice.status,
          totalCents: invoice.totalCents,
          paidCents: invoice.paidAmountCents,
          balanceCents: invoice.balanceCents,
        };
      }),
    };
  }

  private communicationReport(context: AnalyticsContext, generatedAt: string): SisReportResult {
    return {
      kind: "communication_delivery",
      title: "Communication Delivery Report",
      generatedAt,
      columns: [
        { key: "channel", label: "Channel" },
        { key: "recipientKind", label: "Recipient Kind" },
        { key: "status", label: "Status" },
        { key: "queuedAt", label: "Queued At" },
        { key: "retryCount", label: "Retry Count" },
      ],
      rows: context.deliveries.map((delivery) => ({
        channel: delivery.channel,
        recipientKind: delivery.recipientKind,
        status: delivery.status,
        queuedAt: delivery.queuedAt,
        retryCount: delivery.retryCount,
      })),
    };
  }

  private calculateDataQuality(context: AnalyticsContext): SisDataQualityIssue[] {
    const issues: SisDataQualityIssue[] = [];
    const enrollmentStudentIds = new Set(context.enrollments.filter((item) => item.status === "active").map((item) => item.studentId));
    const admissionNumbers = new Map<string, Student[]>();
    for (const student of context.students) {
      admissionNumbers.set(student.admissionNumber, [...(admissionNumbers.get(student.admissionNumber) || []), student]);
      if (student.status === "active" && !enrollmentStudentIds.has(student.id)) {
        issues.push({ id: `student-no-enrollment-${student.id}`, category: "Students", severity: "critical", title: "Active student without current enrollment", details: `${student.admissionNumber} is active but not enrolled.`, relatedResourceType: "student", relatedResourceId: student.id });
      }
      if (student.guardians.length === 0) {
        issues.push({ id: `student-no-guardian-${student.id}`, category: "Students", severity: "warning", title: "Student missing guardian", details: `${student.admissionNumber} has no guardian contacts.`, relatedResourceType: "student", relatedResourceId: student.id });
      }
    }
    for (const [admissionNumber, students] of admissionNumbers.entries()) {
      if (students.length > 1) issues.push({ id: `duplicate-admission-${admissionNumber}`, category: "Students", severity: "critical", title: "Duplicate admission number", details: `${admissionNumber} appears ${students.length} times.` });
    }
    const activeAssignments = context.assignments.filter((assignment) => assignment.isActive);
    for (const teacher of context.staff.filter((member) => member.staffType === "teacher" && member.status === "active")) {
      if (!activeAssignments.some((assignment) => assignment.staffId === teacher.id)) {
        issues.push({ id: `teacher-no-assignment-${teacher.id}`, category: "Staff", severity: "warning", title: "Active teacher without assignment", details: `${teacher.firstName} ${teacher.lastName} has no active teaching assignments.`, relatedResourceType: "staff", relatedResourceId: teacher.id });
      }
    }
    for (const grade of context.grades) {
      if (!context.sections.some((section) => section.gradeId === grade.id)) {
        issues.push({ id: `grade-no-section-${grade.id}`, category: "Academic", severity: "warning", title: "Class without section", details: `${grade.name} has no sections configured.`, relatedResourceType: "grade", relatedResourceId: grade.id });
      }
    }
    for (const session of context.sessions.filter((item) => item.status === "draft")) {
      issues.push({ id: `attendance-draft-${session.id}`, category: "Attendance", severity: "info", title: "Draft attendance session", details: `${session.date} attendance is not completed.`, relatedResourceType: "attendance_session", relatedResourceId: session.id });
    }
    for (const exam of context.examinations.filter((item) => item.status === "completed")) {
      if (!context.results.some((result) => result.examinationId === exam.id && result.status === "published")) {
        issues.push({ id: `exam-unpublished-${exam.id}`, category: "Results", severity: "warning", title: "Completed exam without published results", details: `${exam.name} is completed but no published result was found.`, relatedResourceType: "examination", relatedResourceId: exam.id });
      }
    }
    for (const invoice of context.invoices.filter((item) => item.balanceCents > 0 && !["draft", "cancelled", "voided"].includes(item.status))) {
      issues.push({ id: `invoice-outstanding-${invoice.id}`, category: "Finance", severity: invoice.status === "overdue" ? "critical" : "info", title: "Outstanding invoice", details: `${invoice.invoiceNumber} has an outstanding balance.`, relatedResourceType: "invoice", relatedResourceId: invoice.id });
    }
    for (const delivery of context.deliveries.filter((item) => item.status === "failed")) {
      issues.push({ id: `delivery-failed-${delivery.id}`, category: "Communication", severity: "warning", title: "Failed communication delivery", details: `${delivery.channel} delivery failed for ${delivery.recipientKind}.`, relatedResourceType: "delivery", relatedResourceId: delivery.id });
    }
    return issues;
  }

  private calculateReadiness(context: AnalyticsContext, issues: SisDataQualityIssue[]) {
    const statusFor = (condition: boolean, warning: boolean): SisHealthStatus => condition ? "healthy" : warning ? "warning" : "critical";
    return [
      { key: "active-year", label: "Active Academic Year", status: statusFor(Boolean(context.activeYear), false), details: context.activeYear ? context.activeYear.name : "No active academic year configured." },
      { key: "academic-structure", label: "Academic Structure", status: statusFor(context.grades.length > 0 && context.sections.length > 0 && context.subjects.length > 0, false), details: `${context.grades.length} classes, ${context.sections.length} sections, ${context.subjects.length} subjects.` },
      { key: "students", label: "Student Management", status: statusFor(context.students.length > 0, false), details: `${context.students.length} students available.` },
      { key: "staff", label: "Staff & Teachers", status: statusFor(context.staff.some((member) => member.staffType === "teacher"), false), details: `${context.staff.length} staff records.` },
      { key: "timetable", label: "Timetable", status: statusFor(context.timetable.length > 0, true), details: `${context.timetable.length} scheduled classes.` },
      { key: "finance", label: "Fees & Finance", status: statusFor(context.invoices.length > 0 || context.finance.totalBilledCents > 0, true), details: `${context.finance.outstandingCents} cents outstanding.` },
      { key: "communication", label: "Communication", status: statusFor(context.communications.length > 0 || context.deliveries.length > 0, true), details: `${context.deliveries.length} delivery records.` },
      { key: "data-quality", label: "Data Quality", status: issues.some((issue) => issue.severity === "critical") ? "critical" as const : issues.length > 0 ? "warning" as const : "healthy" as const, details: `${issues.length} operational issue(s) detected.` },
    ];
  }

  private calculateModuleCompletion(context: AnalyticsContext): SisModuleCompletion[] {
    return [
      { epic: "10A", module: "Students", status: context.students.length > 0 ? "complete" : "partial", details: `${context.students.length} student records.` },
      { epic: "10B", module: "Staff & Teachers", status: context.staff.length > 0 ? "complete" : "partial", details: `${context.staff.length} staff records.` },
      { epic: "10C", module: "Academic Structure", status: context.grades.length > 0 && context.sections.length > 0 && context.subjects.length > 0 ? "complete" : "partial", details: `${context.grades.length}/${context.sections.length}/${context.subjects.length} class-section-subject records.` },
      { epic: "10D", module: "Attendance", status: context.sessions.length > 0 ? "complete" : "partial", details: `${context.sessions.length} attendance sessions.` },
      { epic: "10E", module: "Timetable", status: context.timetable.length > 0 ? "complete" : "partial", details: `${context.timetable.length} timetable entries.` },
      { epic: "10F", module: "Examination & Results", status: context.results.some((result) => result.status === "published") ? "complete" : "partial", details: `${context.results.length} result publications.` },
      { epic: "10G", module: "Fees & Finance", status: context.invoices.length > 0 ? "complete" : "partial", details: `${context.invoices.length} invoices.` },
      { epic: "10H", module: "Communication", status: context.communications.length > 0 || context.deliveries.length > 0 ? "complete" : "partial", details: `${context.deliveries.length} delivery attempts.` },
      { epic: "10I", module: "Parent/Student Portal", status: this.countLinkedParents(context.students) > 0 || context.students.some((student) => student.userId) ? "complete" : "partial", details: `${this.countLinkedParents(context.students)} linked parent accounts.` },
    ];
  }
}

export const SisAnalyticsService = new SisAnalyticsServiceClass();
