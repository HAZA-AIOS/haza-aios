import { ApiError } from '../../common/errors/api-error.js';
import type { DatabaseClient } from '../../database/client.js';
import { SisCommunicationService } from './sis-communication.service.js';
import { SisExaminationService } from './sis-examination.service.js';
import { SisFinanceService } from './sis-finance.service.js';
import { SisService } from './sis.service.js';

type JsonRecord = Record<string, unknown>;
type Tenant = { organizationId: string; workspaceId: string };
type Actor = { userId?: string; role?: string; permissions?: string[] };
type Filters = {
  academicYearId?: string;
  termId?: string;
  gradeId?: string;
  sectionId?: string;
  subjectId?: string;
  dateFrom?: string;
  dateTo?: string;
};
type ReportKind =
  | 'student_directory'
  | 'staff_directory'
  | 'attendance_summary'
  | 'timetable_summary'
  | 'results_summary'
  | 'finance_collection'
  | 'communication_delivery';
type Context = {
  years: JsonRecord[];
  activeYear: JsonRecord | null;
  grades: JsonRecord[];
  sections: JsonRecord[];
  subjects: JsonRecord[];
  students: JsonRecord[];
  staff: JsonRecord[];
  enrollments: JsonRecord[];
  sessions: JsonRecord[];
  attendanceRecords: Array<{ session: JsonRecord; record: JsonRecord }>;
  periods: JsonRecord[];
  timetable: JsonRecord[];
  assignments: JsonRecord[];
  examinations: JsonRecord[];
  assessments: JsonRecord[];
  marks: JsonRecord[];
  results: JsonRecord[];
  invoices: JsonRecord[];
  finance: JsonRecord;
  communications: JsonRecord[];
  deliveries: JsonRecord[];
};

const reportPermissions: Record<ReportKind, string> = {
  student_directory: 'student_reports.view',
  staff_directory: 'staff_reports.view',
  attendance_summary: 'attendance_reports.view',
  timetable_summary: 'timetable_reports.view',
  results_summary: 'results_reports.view',
  finance_collection: 'finance_reports.view',
  communication_delivery: 'communication_reports.view',
};
const managerRoles = new Set(['Owner', 'Admin']);
const accountantPermissions = new Set(['analytics.view', 'reports.view', 'reports.export', 'finance_reports.view', 'data_quality.view', 'sis_health.view']);
const teacherPermissions = new Set(['analytics.view', 'reports.view', 'attendance_reports.view', 'timetable_reports.view', 'results_reports.view']);

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function num(value: unknown): number {
  const out = Number(value);
  return Number.isFinite(out) ? out : 0;
}

function bool(value: unknown): boolean {
  return value === true;
}

function percent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 100;
}

function dateInRange(value: unknown, filters: Filters): boolean {
  const date = str(value).split('T')[0];
  if (!date) return true;
  if (filters.dateFrom && date < filters.dateFrom) return false;
  if (filters.dateTo && date > filters.dateTo) return false;
  return true;
}

function distribution(values: string[]) {
  const rows = new Map<string, number>();
  for (const value of values) rows.set(value, (rows.get(value) ?? 0) + 1);
  return Array.from(rows.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

function csvEscape(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

function hasPermission(actor: Actor | undefined, permission: string): boolean {
  if (!actor) return true;
  const role = str(actor.role) || 'Owner';
  if (managerRoles.has(role)) return true;
  if (actor.permissions?.includes(permission)) return true;
  if (role === 'Accountant' && accountantPermissions.has(permission)) return true;
  if (role === 'Teacher' && teacherPermissions.has(permission)) return true;
  return false;
}

function assertPermission(actor: Actor | undefined, permission: string): void {
  if (!hasPermission(actor, permission)) throw new ApiError(403, 'FORBIDDEN', `Unauthorized: missing permission ${permission}`);
}

function parseFilters(source: URLSearchParams | JsonRecord): Filters {
  const get = (key: keyof Filters) => source instanceof URLSearchParams ? source.get(key) ?? undefined : source[key] as string | undefined;
  const filters: Filters = {
    academicYearId: get('academicYearId'),
    termId: get('termId'),
    gradeId: get('gradeId'),
    sectionId: get('sectionId'),
    subjectId: get('subjectId'),
    dateFrom: get('dateFrom'),
    dateTo: get('dateTo'),
  };
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
    throw new ApiError(400, 'VALIDATION_FAILED', 'dateFrom must be before or equal to dateTo.');
  }
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value)) as Filters;
}

function scopedByEnrollment(studentIds: Set<string>, enrollments: JsonRecord[], filters: Filters): Set<string> {
  if (!filters.gradeId && !filters.sectionId) return studentIds;
  const matching = new Set(enrollments
    .filter((enrollment) => (!filters.gradeId || enrollment.gradeId === filters.gradeId) && (!filters.sectionId || enrollment.sectionId === filters.sectionId))
    .map((enrollment) => str(enrollment.studentId)));
  return new Set(Array.from(studentIds).filter((studentId) => matching.has(studentId)));
}

export class SisAnalyticsService {
  constructor(private readonly database: DatabaseClient) {}

  async getOverview(tenant: Tenant, filtersInput: URLSearchParams | JsonRecord = {}, actor?: Actor) {
    assertPermission(actor, 'analytics.view');
    const filters = parseFilters(filtersInput);
    const context = await this.loadContext(tenant, filters);
    const studentIds = scopedByEnrollment(new Set(context.students.map((student) => str(student.id))), context.enrollments, filters);
    const students = context.students.filter((student) => studentIds.has(str(student.id)));
    const activeStudents = students.filter((student) => student.status === 'active');
    const attendance = this.attendanceSummary(context.attendanceRecords);
    const activeTeachers = context.staff.filter((member) => member.status === 'active' && member.staffType === 'teacher');
    const activeAssignments = context.assignments.filter((assignment) => bool(assignment.isActive));
    const teacherAssignmentIds = new Set(activeAssignments.map((assignment) => str(assignment.staffId)));
    const publishedMarks = context.results
      .filter((publication) => publication.status === 'published')
      .flatMap((publication) => (publication.results as JsonRecord[] | undefined ?? []).flatMap((result) => result.subjects as JsonRecord[] | undefined ?? []));
    const averagePerformance = publishedMarks.length
      ? Math.round((publishedMarks.reduce((sum, item) => sum + num(item.percentage), 0) / publishedMarks.length) * 100) / 100
      : 0;

    return {
      students: {
        total: students.length,
        active: activeStudents.length,
        admissions: students.filter((student) => dateInRange(student.admissionDate, filters)).length,
        withdrawals: students.filter((student) => student.status === 'withdrawn' || student.status === 'transferred').length,
        byStatus: distribution(students.map((student) => str(student.status) || 'unknown')),
        byClass: distribution(context.enrollments
          .filter((enrollment) => studentIds.has(str(enrollment.studentId)))
          .map((enrollment) => str(context.grades.find((grade) => grade.id === enrollment.gradeId)?.name) || 'Unassigned')),
      },
      staff: {
        total: context.staff.length,
        activeTeachers: activeTeachers.length,
        activeStaff: context.staff.filter((member) => member.status === 'active').length,
        teachersWithoutAssignments: activeTeachers.filter((teacher) => !teacherAssignmentIds.has(str(teacher.id))).length,
      },
      attendance,
      academics: {
        academicYears: context.years.length,
        activeAcademicYears: context.years.filter((year) => year.status === 'active').length,
        grades: context.grades.length,
        sections: context.sections.length,
        subjects: context.subjects.length,
      },
      timetable: {
        scheduledClasses: context.timetable.length,
        teacherLoad: distribution(context.timetable.map((entry) => str(context.staff.find((member) => member.id === entry.teacherId)?.firstName) || 'Unassigned Teacher')),
        periodUtilization: distribution(context.timetable.map((entry) => str(context.periods.find((period) => period.id === entry.periodId)?.name) || 'Unknown Period')),
      },
      results: {
        examinations: context.examinations.length,
        publishedResults: context.results.filter((result) => result.status === 'published').length,
        passRate: percent(publishedMarks.filter((mark) => bool(mark.passed)).length, publishedMarks.length),
        averagePerformance,
      },
      finance: context.finance,
      communication: {
        ...(await new SisCommunicationService(this.database).summary(tenant)),
        failedDeliveries: context.deliveries.filter((delivery) => delivery.status === 'failed').length,
      },
      portal: {
        linkedParentAccounts: this.countLinkedParents(context.students),
        linkedStudentAccounts: context.students.filter((student) => Boolean(student.userId || (student.metadata as JsonRecord | undefined)?.studentUserId)).length,
        portalReadyStudents: context.students.filter((student) => student.portalAccessEnabled !== false && (student.userId || (student.guardians as JsonRecord[] | undefined ?? []).some((guardian) => guardian.portalAccessEnabled || guardian.authorizedForPortal))).length,
      },
    };
  }

  async getReport(tenant: Tenant, kind: ReportKind, filtersInput: URLSearchParams | JsonRecord = {}, actor?: Actor) {
    assertPermission(actor, 'reports.view');
    assertPermission(actor, reportPermissions[kind]);
    const filters = parseFilters(filtersInput);
    const context = await this.loadContext(tenant, filters);
    const generatedAt = new Date().toISOString();
    if (kind === 'student_directory') return this.studentReport(context, generatedAt);
    if (kind === 'staff_directory') return this.staffReport(context, generatedAt);
    if (kind === 'attendance_summary') return this.attendanceReport(context, generatedAt);
    if (kind === 'timetable_summary') return this.timetableReport(context, generatedAt);
    if (kind === 'results_summary') return this.resultsReport(context, generatedAt);
    if (kind === 'finance_collection') return this.financeReport(context, generatedAt);
    return this.communicationReport(context, generatedAt);
  }

  async exportCsv(tenant: Tenant, kind: ReportKind, filtersInput: URLSearchParams | JsonRecord = {}, actor?: Actor): Promise<string> {
    assertPermission(actor, 'reports.export');
    const report = await this.getReport(tenant, kind, filtersInput, actor);
    return [report.columns.map((column: JsonRecord) => csvEscape(column.label)).join(',')]
      .concat(report.rows.map((row: JsonRecord) => report.columns.map((column: JsonRecord) => csvEscape(row[str(column.key)])).join(',')))
      .join('\r\n');
  }

  async getDataQuality(tenant: Tenant, filtersInput: URLSearchParams | JsonRecord = {}, actor?: Actor) {
    assertPermission(actor, 'data_quality.view');
    return this.dataQuality(await this.loadContext(tenant, parseFilters(filtersInput)));
  }

  async getHealth(tenant: Tenant, filtersInput: URLSearchParams | JsonRecord = {}, actor?: Actor) {
    assertPermission(actor, 'sis_health.view');
    const context = await this.loadContext(tenant, parseFilters(filtersInput));
    const dataQuality = this.dataQuality(context);
    const readiness = this.readiness(context, dataQuality);
    const status = readiness.some((item) => item.status === 'critical') || dataQuality.some((item) => item.severity === 'critical')
      ? 'critical'
      : readiness.some((item) => item.status === 'warning') || dataQuality.some((item) => item.severity === 'warning')
        ? 'warning'
        : 'healthy';
    return { status, readiness, dataQuality, modules: this.moduleCompletion(context) };
  }

  private async loadContext(tenant: Tenant, filters: Filters): Promise<Context> {
    const sis = new SisService(this.database);
    const exams = new SisExaminationService(this.database);
    const financeService = new SisFinanceService(this.database);
    const communication = new SisCommunicationService(this.database);
    const years = await sis.listAcademicYears(tenant) as JsonRecord[];
    const activeYear = filters.academicYearId
      ? years.find((year) => year.id === filters.academicYearId) ?? null
      : years.find((year) => year.status === 'active') ?? years[0] ?? null;
    const [grades, sections, subjects, students, staff, allEnrollments, periods, timetableAll, assignments, examinations, assessments, marks, results, invoices, communications, deliveries] = await Promise.all([
      sis.listGrades(tenant),
      sis.listSections(tenant),
      sis.listSubjects(tenant),
      sis.listStudents(tenant),
      sis.listStaff(tenant),
      sis.listEnrollments(tenant, {}),
      sis.listPeriods(tenant),
      sis.listTimetableEntries(tenant, {}),
      sis.listTeachingAssignments(tenant, {}),
      exams.listExaminations(tenant),
      exams.listAssessments(tenant),
      exams.listMarks(tenant, {}),
      exams.listResultPublications(tenant),
      financeService.listInvoices(tenant),
      communication.listMessages(tenant),
      communication.deliveryHistory(tenant),
    ]) as JsonRecord[][];
    const finance = await financeService.collectionSummary(tenant) as JsonRecord;
    this.assertScopedFilters(filters, { years, grades, sections, subjects, examinations });
    const enrollments = allEnrollments.filter((enrollment) => {
      if (activeYear && enrollment.academicYear !== activeYear.name) return false;
      if (filters.gradeId && enrollment.gradeId !== filters.gradeId) return false;
      if (filters.sectionId && enrollment.sectionId !== filters.sectionId) return false;
      return true;
    });
    const sessions = (await sis.listAttendanceSessions(tenant, {
      academicYearId: str(activeYear?.id),
      gradeId: filters.gradeId,
      sectionId: filters.sectionId,
    }) as JsonRecord[]).filter((session) => dateInRange(session.date, filters));
    const attendanceRecords = (await Promise.all(students.map((student) =>
      sis.getStudentAttendanceHistory(tenant, str(student.id), str(activeYear?.id)),
    ))).flat().filter(({ session }) => dateInRange((session as JsonRecord).date, filters)) as Array<{ session: JsonRecord; record: JsonRecord }>;
    const timetable = timetableAll.filter((entry) => {
      if (activeYear && entry.academicYearId !== activeYear.id) return false;
      if (filters.termId && entry.termId !== filters.termId) return false;
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

  private assertScopedFilters(filters: Filters, context: Pick<Context, 'years' | 'grades' | 'sections' | 'subjects' | 'examinations'>): void {
    const mustExist = [
      ['Academic year', filters.academicYearId, context.years],
      ['Grade', filters.gradeId, context.grades],
      ['Section', filters.sectionId, context.sections],
      ['Subject', filters.subjectId, context.subjects],
    ] as const;
    for (const [label, id, rows] of mustExist) {
      if (id && !rows.some((row) => row.id === id)) throw new ApiError(404, 'NOT_FOUND', `${label} not found for this organization.`);
    }
    if (filters.sectionId && filters.gradeId) {
      const section = context.sections.find((row) => row.id === filters.sectionId);
      if (section && section.gradeId !== filters.gradeId) throw new ApiError(400, 'VALIDATION_FAILED', 'Section does not belong to the selected grade.');
    }
  }

  private attendanceSummary(records: Array<{ session: JsonRecord; record: JsonRecord }>) {
    const summary = { totalSessions: records.length, present: 0, absent: 0, late: 0, excused: 0, attendancePercentage: 0, completedSessions: 0, draftSessions: 0 };
    for (const { session, record } of records) {
      if (record.status === 'present') summary.present += 1;
      if (record.status === 'absent') summary.absent += 1;
      if (record.status === 'late') summary.late += 1;
      if (record.status === 'excused') summary.excused += 1;
      if (session.status === 'completed') summary.completedSessions += 1;
      if (session.status === 'draft') summary.draftSessions += 1;
    }
    const counted = summary.present + summary.absent + summary.late;
    summary.attendancePercentage = percent(summary.present + summary.late, counted);
    return summary;
  }

  private countLinkedParents(students: JsonRecord[]): number {
    const parents = new Set<string>();
    for (const student of students) {
      for (const guardian of (student.guardians as JsonRecord[] | undefined) ?? []) {
        if (guardian.userId && (guardian.portalAccessEnabled || guardian.authorizedForPortal)) parents.add(str(guardian.userId));
      }
    }
    return parents.size;
  }

  private studentReport(context: Context, generatedAt: string) {
    return {
      kind: 'student_directory',
      title: 'Student Directory Report',
      generatedAt,
      columns: [
        { key: 'admissionNumber', label: 'Admission Number' },
        { key: 'name', label: 'Name' },
        { key: 'status', label: 'Status' },
        { key: 'class', label: 'Class' },
        { key: 'section', label: 'Section' },
        { key: 'guardianCount', label: 'Guardian Count' },
      ],
      rows: context.students.map((student) => {
        const enrollment = context.enrollments.find((item) => item.studentId === student.id);
        return {
          admissionNumber: str(student.admissionNumber),
          name: `${str(student.firstName)} ${str(student.lastName)}`.trim(),
          status: str(student.status),
          class: str(context.grades.find((grade) => grade.id === enrollment?.gradeId)?.name),
          section: str(context.sections.find((section) => section.id === enrollment?.sectionId)?.name),
          guardianCount: ((student.guardians as unknown[] | undefined) ?? []).length,
        };
      }),
    };
  }

  private staffReport(context: Context, generatedAt: string) {
    return {
      kind: 'staff_directory',
      title: 'Staff Directory Report',
      generatedAt,
      columns: [
        { key: 'employeeNumber', label: 'Employee Number' },
        { key: 'name', label: 'Name' },
        { key: 'staffType', label: 'Staff Type' },
        { key: 'status', label: 'Status' },
        { key: 'assignmentCount', label: 'Active Assignments' },
      ],
      rows: context.staff.map((member) => ({
        employeeNumber: str(member.employeeNumber),
        name: `${str(member.firstName)} ${str(member.lastName)}`.trim(),
        staffType: str(member.staffType),
        status: str(member.status),
        assignmentCount: context.assignments.filter((assignment) => assignment.staffId === member.id && assignment.isActive).length,
      })),
    };
  }

  private attendanceReport(context: Context, generatedAt: string) {
    return {
      kind: 'attendance_summary',
      title: 'Attendance Summary Report',
      generatedAt,
      columns: [
        { key: 'date', label: 'Date' },
        { key: 'class', label: 'Class' },
        { key: 'section', label: 'Section' },
        { key: 'status', label: 'Session Status' },
        { key: 'present', label: 'Present' },
        { key: 'absent', label: 'Absent' },
        { key: 'late', label: 'Late' },
        { key: 'excused', label: 'Excused' },
      ],
      rows: context.sessions.map((session) => {
        const records = context.attendanceRecords.filter(({ session: item }) => item.id === session.id).map(({ record }) => record);
        return {
          date: str(session.date),
          class: str(context.grades.find((grade) => grade.id === session.gradeId)?.name),
          section: str(context.sections.find((section) => section.id === session.sectionId)?.name),
          status: str(session.status),
          present: records.filter((record) => record.status === 'present').length,
          absent: records.filter((record) => record.status === 'absent').length,
          late: records.filter((record) => record.status === 'late').length,
          excused: records.filter((record) => record.status === 'excused').length,
        };
      }),
    };
  }

  private timetableReport(context: Context, generatedAt: string) {
    return {
      kind: 'timetable_summary',
      title: 'Timetable Summary Report',
      generatedAt,
      columns: [
        { key: 'day', label: 'Day' },
        { key: 'period', label: 'Period' },
        { key: 'class', label: 'Class' },
        { key: 'section', label: 'Section' },
        { key: 'subject', label: 'Subject' },
        { key: 'teacher', label: 'Teacher' },
        { key: 'room', label: 'Room' },
      ],
      rows: context.timetable.map((entry) => ({
        day: num(entry.dayOfWeek),
        period: str(context.periods.find((period) => period.id === entry.periodId)?.name),
        class: str(context.grades.find((grade) => grade.id === entry.gradeId)?.name),
        section: str(context.sections.find((section) => section.id === entry.sectionId)?.name),
        subject: str(context.subjects.find((subject) => subject.id === entry.subjectId)?.name),
        teacher: str(context.staff.find((member) => member.id === entry.teacherId)?.firstName),
        room: str(entry.roomId),
      })),
    };
  }

  private resultsReport(context: Context, generatedAt: string) {
    return {
      kind: 'results_summary',
      title: 'Published Results Report',
      generatedAt,
      columns: [
        { key: 'examination', label: 'Examination' },
        { key: 'class', label: 'Class' },
        { key: 'section', label: 'Section' },
        { key: 'studentCount', label: 'Students' },
        { key: 'passRate', label: 'Pass Rate' },
        { key: 'average', label: 'Average' },
      ],
      rows: context.results.filter((result) => result.status === 'published').map((result) => {
        const subjectRows = (result.results as JsonRecord[] | undefined ?? []).flatMap((student) => student.subjects as JsonRecord[] | undefined ?? []);
        return {
          examination: str(context.examinations.find((exam) => exam.id === result.examinationId)?.name),
          class: str(context.grades.find((grade) => grade.id === result.gradeId)?.name),
          section: str(context.sections.find((section) => section.id === result.sectionId)?.name),
          studentCount: ((result.results as unknown[] | undefined) ?? []).length,
          passRate: percent(subjectRows.filter((subject) => bool(subject.passed)).length, subjectRows.length),
          average: subjectRows.length ? Math.round((subjectRows.reduce((sum, subject) => sum + num(subject.percentage), 0) / subjectRows.length) * 100) / 100 : 0,
        };
      }),
    };
  }

  private financeReport(context: Context, generatedAt: string) {
    return {
      kind: 'finance_collection',
      title: 'Finance Collection Report',
      generatedAt,
      columns: [
        { key: 'invoiceNumber', label: 'Invoice Number' },
        { key: 'student', label: 'Student' },
        { key: 'status', label: 'Status' },
        { key: 'totalCents', label: 'Total Cents' },
        { key: 'paidCents', label: 'Paid Cents' },
        { key: 'balanceCents', label: 'Balance Cents' },
      ],
      rows: context.invoices.filter((invoice) => invoice.status !== 'draft' && invoice.status !== 'voided').map((invoice) => {
        const student = context.students.find((item) => item.id === invoice.studentId);
        return {
          invoiceNumber: str(invoice.invoiceNumber),
          student: student ? `${str(student.firstName)} ${str(student.lastName)}`.trim() : '',
          status: str(invoice.status),
          totalCents: num(invoice.totalCents),
          paidCents: num(invoice.paidAmountCents),
          balanceCents: num(invoice.balanceCents),
        };
      }),
    };
  }

  private communicationReport(context: Context, generatedAt: string) {
    return {
      kind: 'communication_delivery',
      title: 'Communication Delivery Report',
      generatedAt,
      columns: [
        { key: 'channel', label: 'Channel' },
        { key: 'recipientKind', label: 'Recipient Kind' },
        { key: 'status', label: 'Status' },
        { key: 'queuedAt', label: 'Queued At' },
        { key: 'retryCount', label: 'Retry Count' },
      ],
      rows: context.deliveries.map((delivery) => ({
        channel: str(delivery.channel),
        recipientKind: str(delivery.recipientKind),
        status: str(delivery.status),
        queuedAt: str(delivery.queuedAt),
        retryCount: num(delivery.retryCount),
      })),
    };
  }

  private dataQuality(context: Context) {
    const issues: JsonRecord[] = [];
    const enrollmentStudentIds = new Set(context.enrollments.filter((item) => item.status === 'active').map((item) => str(item.studentId)));
    const admissionNumbers = new Map<string, JsonRecord[]>();
    for (const student of context.students) {
      const admissionNumber = str(student.admissionNumber);
      admissionNumbers.set(admissionNumber, [...(admissionNumbers.get(admissionNumber) ?? []), student]);
      if (student.status === 'active' && !enrollmentStudentIds.has(str(student.id))) issues.push({ id: `student-no-enrollment-${student.id}`, category: 'Students', severity: 'critical', title: 'Active student without current enrollment', details: `${admissionNumber} is active but not enrolled.`, relatedResourceType: 'student', relatedResourceId: student.id });
      if (((student.guardians as unknown[] | undefined) ?? []).length === 0) issues.push({ id: `student-no-guardian-${student.id}`, category: 'Students', severity: 'warning', title: 'Student missing guardian', details: `${admissionNumber} has no guardian contacts.`, relatedResourceType: 'student', relatedResourceId: student.id });
    }
    for (const [admissionNumber, students] of admissionNumbers.entries()) {
      if (students.length > 1) issues.push({ id: `duplicate-admission-${admissionNumber}`, category: 'Students', severity: 'critical', title: 'Duplicate admission number', details: `${admissionNumber} appears ${students.length} times.` });
    }
    const activeAssignments = context.assignments.filter((assignment) => assignment.isActive);
    for (const teacher of context.staff.filter((member) => member.staffType === 'teacher' && member.status === 'active')) {
      if (!activeAssignments.some((assignment) => assignment.staffId === teacher.id)) issues.push({ id: `teacher-no-assignment-${teacher.id}`, category: 'Staff', severity: 'warning', title: 'Active teacher without assignment', details: `${str(teacher.firstName)} ${str(teacher.lastName)} has no active teaching assignments.`, relatedResourceType: 'staff', relatedResourceId: teacher.id });
    }
    for (const grade of context.grades) {
      if (!context.sections.some((section) => section.gradeId === grade.id)) issues.push({ id: `grade-no-section-${grade.id}`, category: 'Academic', severity: 'warning', title: 'Class without section', details: `${str(grade.name)} has no sections configured.`, relatedResourceType: 'grade', relatedResourceId: grade.id });
    }
    for (const session of context.sessions.filter((item) => item.status === 'draft')) issues.push({ id: `attendance-draft-${session.id}`, category: 'Attendance', severity: 'info', title: 'Draft attendance session', details: `${str(session.date)} attendance is not completed.`, relatedResourceType: 'attendance_session', relatedResourceId: session.id });
    for (const exam of context.examinations.filter((item) => item.status === 'completed')) {
      if (!context.results.some((result) => result.examinationId === exam.id && result.status === 'published')) issues.push({ id: `exam-unpublished-${exam.id}`, category: 'Results', severity: 'warning', title: 'Completed exam without published results', details: `${str(exam.name)} is completed but no published result was found.`, relatedResourceType: 'examination', relatedResourceId: exam.id });
    }
    for (const invoice of context.invoices.filter((item) => num(item.balanceCents) > 0 && !['draft', 'cancelled', 'voided'].includes(str(item.status)))) issues.push({ id: `invoice-outstanding-${invoice.id}`, category: 'Finance', severity: invoice.status === 'overdue' ? 'critical' : 'info', title: 'Outstanding invoice', details: `${str(invoice.invoiceNumber)} has an outstanding balance.`, relatedResourceType: 'invoice', relatedResourceId: invoice.id });
    for (const delivery of context.deliveries.filter((item) => item.status === 'failed')) issues.push({ id: `delivery-failed-${delivery.id}`, category: 'Communication', severity: 'warning', title: 'Failed communication delivery', details: `${str(delivery.channel)} delivery failed for ${str(delivery.recipientKind)}.`, relatedResourceType: 'delivery', relatedResourceId: delivery.id });
    return issues;
  }

  private readiness(context: Context, issues: JsonRecord[]) {
    const statusFor = (condition: boolean, warning: boolean) => condition ? 'healthy' : warning ? 'warning' : 'critical';
    return [
      { key: 'active-year', label: 'Active Academic Year', status: statusFor(Boolean(context.activeYear), false), details: context.activeYear ? str(context.activeYear.name) : 'No active academic year configured.' },
      { key: 'academic-structure', label: 'Academic Structure', status: statusFor(context.grades.length > 0 && context.sections.length > 0 && context.subjects.length > 0, false), details: `${context.grades.length} classes, ${context.sections.length} sections, ${context.subjects.length} subjects.` },
      { key: 'students', label: 'Student Management', status: statusFor(context.students.length > 0, false), details: `${context.students.length} students available.` },
      { key: 'staff', label: 'Staff & Teachers', status: statusFor(context.staff.some((member) => member.staffType === 'teacher'), false), details: `${context.staff.length} staff records.` },
      { key: 'timetable', label: 'Timetable', status: statusFor(context.timetable.length > 0, true), details: `${context.timetable.length} scheduled classes.` },
      { key: 'finance', label: 'Fees & Finance', status: statusFor(context.invoices.length > 0 || num(context.finance.totalBilledCents) > 0, true), details: `${num(context.finance.outstandingCents)} cents outstanding.` },
      { key: 'communication', label: 'Communication', status: statusFor(context.communications.length > 0 || context.deliveries.length > 0, true), details: `${context.deliveries.length} delivery records.` },
      { key: 'data-quality', label: 'Data Quality', status: issues.some((issue) => issue.severity === 'critical') ? 'critical' : issues.length > 0 ? 'warning' : 'healthy', details: `${issues.length} operational issue(s) detected.` },
    ];
  }

  private moduleCompletion(context: Context) {
    return [
      { epic: '10A', module: 'Students', status: context.students.length > 0 ? 'complete' : 'partial', details: `${context.students.length} student records.` },
      { epic: '10B', module: 'Staff & Teachers', status: context.staff.length > 0 ? 'complete' : 'partial', details: `${context.staff.length} staff records.` },
      { epic: '10C', module: 'Academic Structure', status: context.grades.length > 0 && context.sections.length > 0 && context.subjects.length > 0 ? 'complete' : 'partial', details: `${context.grades.length}/${context.sections.length}/${context.subjects.length} class-section-subject records.` },
      { epic: '10D', module: 'Attendance', status: context.sessions.length > 0 ? 'complete' : 'partial', details: `${context.sessions.length} attendance sessions.` },
      { epic: '10E', module: 'Timetable', status: context.timetable.length > 0 ? 'complete' : 'partial', details: `${context.timetable.length} timetable entries.` },
      { epic: '10F', module: 'Examination & Results', status: context.results.some((result) => result.status === 'published') ? 'complete' : 'partial', details: `${context.results.length} result publications.` },
      { epic: '10G', module: 'Fees & Finance', status: context.invoices.length > 0 ? 'complete' : 'partial', details: `${context.invoices.length} invoices.` },
      { epic: '10H', module: 'Communication', status: context.communications.length > 0 || context.deliveries.length > 0 ? 'complete' : 'partial', details: `${context.deliveries.length} delivery attempts.` },
      { epic: '10I', module: 'Parent/Student Portal', status: this.countLinkedParents(context.students) > 0 || context.students.some((student) => student.userId) ? 'complete' : 'partial', details: `${this.countLinkedParents(context.students)} linked parent accounts.` },
    ];
  }
}
