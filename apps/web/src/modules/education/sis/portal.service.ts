import { workspaceService } from "@/workspace/workspace-service";
import { AcademicService } from "./academic.service";
import { AttendanceService } from "./attendance.service";
import { CommunicationService } from "./communication.service";
import { EnrollmentService } from "./enrollment.service";
import { ExaminationService } from "./examination.service";
import { FinanceService } from "./finance.service";
import { StaffService } from "./staff.service";
import { StudentService } from "./student.service";
import { timetableService } from "./timetable.service";
import type {
  Announcement,
  Assessment,
  CommunicationAudience,
  CommunicationMessage,
  Examination,
  MarkRecord,
  ParentPortalDashboard,
  PortalActor,
  PortalFinanceSummary,
  PortalPolicy,
  PortalResultItem,
  PortalRole,
  PortalStudentDashboard,
  PortalStudentSummary,
  PortalTimetableItem,
  PortalUpdateRequest,
  PortalUpdateRequestType,
  ResultPublication,
  Student,
  StudentGuardian,
  StudentPortalDashboard,
} from "./sis.types";

const PORTAL_REQUESTS_KEY = "haza-aios.sis.portal.update-requests";
const PORTAL_POLICIES_KEY = "haza-aios.sis.portal.policies";

function readCollection<T>(key: string): T[] {
  const data = localStorage.getItem(key);
  if (!data) return [];
  try {
    return JSON.parse(data) as T[];
  } catch {
    return [];
  }
}

function writeCollection<T>(key: string, values: T[]): void {
  localStorage.setItem(key, JSON.stringify(values));
}

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function studentName(student: Student): string {
  return [student.firstName, student.lastName].filter(Boolean).join(" ");
}

function metadataString(record: { metadata?: Record<string, unknown> }, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record.metadata?.[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function guardianLinkedToUser(student: Student, guardian: StudentGuardian, userId: string): boolean {
  const explicitUserId = guardian.userId || metadataString(student, [`guardianUserId:${guardian.id}`]);
  const hasPortalAccess = guardian.portalAccessEnabled === true || guardian.authorizedForPortal === true;
  return explicitUserId === userId && hasPortalAccess;
}

function studentLinkedToUser(student: Student, userId: string): boolean {
  const linkedUserId = student.userId || metadataString(student, ["studentUserId", "userId", "portalUserId"]);
  return linkedUserId === userId && student.portalAccessEnabled !== false;
}

function assertActor(actor: PortalActor, role: PortalRole, organizationId: string): void {
  if (actor.organizationId !== organizationId || actor.role !== role || !actor.userId) {
    throw new Error("Unauthorized portal context.");
  }
}

export class PortalServiceClass {
  private getRequestsDb(): PortalUpdateRequest[] {
    return readCollection<PortalUpdateRequest>(PORTAL_REQUESTS_KEY);
  }

  private saveRequestsDb(requests: PortalUpdateRequest[]): void {
    writeCollection(PORTAL_REQUESTS_KEY, requests);
  }

  private getPoliciesDb(): PortalPolicy[] {
    return readCollection<PortalPolicy>(PORTAL_POLICIES_KEY);
  }

  private savePoliciesDb(policies: PortalPolicy[]): void {
    writeCollection(PORTAL_POLICIES_KEY, policies);
  }

  async getPolicy(organizationId: string): Promise<PortalPolicy> {
    return this.getPoliciesDb().find((policy) => policy.organizationId === organizationId) || {
      organizationId,
      studentFinanceVisible: false,
      studentMessagingEnabled: false,
      parentMessagingEnabled: true,
    };
  }

  async savePolicy(organizationId: string, updates: Partial<Omit<PortalPolicy, "organizationId">>): Promise<PortalPolicy> {
    const policies = this.getPoliciesDb();
    const index = policies.findIndex((policy) => policy.organizationId === organizationId);
    const saved = { ...(index >= 0 ? policies[index] : await this.getPolicy(organizationId)), ...updates, organizationId };
    if (index >= 0) policies[index] = saved;
    else policies.push(saved);
    this.savePoliciesDb(policies);
    await this.audit(organizationId, "Portal Policy Updated", "Updated parent and student portal policy.");
    return saved;
  }

  async resolveParentStudents(organizationId: string, userId: string): Promise<Array<{ student: Student; guardian: StudentGuardian }>> {
    await this.assertActiveMembership(organizationId, userId);
    const students = await StudentService.getStudents(organizationId);
    const linked: Array<{ student: Student; guardian: StudentGuardian }> = [];
    for (const student of students.filter((item) => item.status === "active")) {
      const guardian = student.guardians.find((item) => guardianLinkedToUser(student, item, userId));
      if (guardian) linked.push({ student, guardian });
    }
    return linked;
  }

  async resolveStudentAccount(organizationId: string, userId: string): Promise<Student> {
    await this.assertActiveMembership(organizationId, userId);
    const student = (await StudentService.getStudents(organizationId)).find((item) => item.status === "active" && studentLinkedToUser(item, userId));
    if (!student) throw new Error("No authorized student portal record found.");
    return student;
  }

  async getParentDashboard(actor: PortalActor, selectedStudentId?: string): Promise<ParentPortalDashboard> {
    assertActor(actor, "parent", actor.organizationId);
    const linked = await this.resolveParentStudents(actor.organizationId, actor.userId);
    const summaries = await Promise.all(linked.map(({ student }) => this.buildStudentSummary(actor.organizationId, student)));
    const target = selectedStudentId || linked[0]?.student.id;
    const selected = target ? await this.getParentStudentDashboard(actor, target) : undefined;
    return {
      userId: actor.userId,
      linkedStudents: summaries,
      selectedStudent: selected,
      totalUnreadNotifications: selected?.communication.unreadNotifications || 0,
    };
  }

  async getParentStudentDashboard(actor: PortalActor, studentId: string): Promise<PortalStudentDashboard> {
    assertActor(actor, "parent", actor.organizationId);
    const linked = await this.resolveParentStudents(actor.organizationId, actor.userId);
    const relation = linked.find(({ student }) => student.id === studentId);
    if (!relation) throw new Error("Forbidden: student is not linked to this guardian account.");
    await this.audit(actor.organizationId, "Parent Portal Student Viewed", `Parent portal accessed student ${relation.student.admissionNumber}.`);
    return this.buildStudentDashboard(actor.organizationId, relation.student, {
      role: "parent",
      userId: actor.userId,
      guardian: relation.guardian,
    });
  }

  async getStudentDashboard(actor: PortalActor, requestedStudentId?: string): Promise<StudentPortalDashboard> {
    assertActor(actor, "student", actor.organizationId);
    const student = await this.resolveStudentAccount(actor.organizationId, actor.userId);
    if (requestedStudentId && requestedStudentId !== student.id) {
      throw new Error("Forbidden: students can only access their own portal record.");
    }
    await this.audit(actor.organizationId, "Student Portal Viewed", `Student portal accessed ${student.admissionNumber}.`);
    return {
      ...(await this.buildStudentDashboard(actor.organizationId, student, { role: "student", userId: actor.userId })),
      userId: actor.userId,
    };
  }

  async submitUpdateRequest(
    actor: PortalActor,
    input: { studentId?: string; type: PortalUpdateRequestType; subject: string; details: string },
  ): Promise<PortalUpdateRequest> {
    if (!input.subject.trim() || !input.details.trim()) throw new Error("Update request subject and details are required.");
    if (actor.role === "parent" && input.studentId) {
      await this.getParentStudentDashboard(actor, input.studentId);
    }
    if (actor.role === "student") {
      const student = await this.resolveStudentAccount(actor.organizationId, actor.userId);
      if (input.studentId && input.studentId !== student.id) throw new Error("Forbidden: update request student mismatch.");
    }
    const now = new Date().toISOString();
    const request: PortalUpdateRequest = {
      id: createId("portal-request"),
      organizationId: actor.organizationId,
      requesterUserId: actor.userId,
      requesterRole: actor.role,
      studentId: input.studentId,
      type: input.type,
      subject: input.subject.trim(),
      details: input.details.trim(),
      status: "submitted",
      createdAt: now,
      updatedAt: now,
    };
    const requests = this.getRequestsDb();
    requests.push(request);
    this.saveRequestsDb(requests);
    await this.audit(actor.organizationId, "Portal Update Request Submitted", `Submitted ${request.type} request.`);
    return request;
  }

  async getUpdateRequests(actor: PortalActor): Promise<PortalUpdateRequest[]> {
    return this.getRequestsDb().filter(
      (request) =>
        request.organizationId === actor.organizationId &&
        request.requesterUserId === actor.userId &&
        request.requesterRole === actor.role,
    );
  }

  private async assertActiveMembership(organizationId: string, userId: string): Promise<void> {
    const members = await workspaceService.getMembers(organizationId);
    const member = members.find((item) => item.userId === userId && item.status === "active");
    if (!member) throw new Error("Unauthorized: active organization membership is required.");
  }

  private async buildStudentSummary(organizationId: string, student: Student): Promise<PortalStudentSummary> {
    const enrollment = await EnrollmentService.getCurrentEnrollment(student.id, organizationId);
    const [grade, section] = await Promise.all([
      enrollment ? AcademicService.getGrade(enrollment.gradeId, organizationId) : Promise.resolve(null),
      enrollment ? AcademicService.getSection(enrollment.sectionId, organizationId) : Promise.resolve(null),
    ]);
    return {
      id: student.id,
      displayName: studentName(student),
      admissionNumber: student.admissionNumber,
      status: student.status,
      photoUrl: student.photoUrl,
      email: student.email,
      phone: student.phone,
      gradeName: grade?.name,
      sectionName: section?.name,
      academicYear: enrollment?.academicYear,
    };
  }

  private async buildStudentDashboard(
    organizationId: string,
    student: Student,
    viewer: { role: PortalRole; userId: string; guardian?: StudentGuardian },
  ): Promise<PortalStudentDashboard> {
    const policy = await this.getPolicy(organizationId);
    const [studentSummary, attendance, attendanceHistory, timetable, results, assessments, finance, communication] =
      await Promise.all([
        this.buildStudentSummary(organizationId, student),
        AttendanceService.getStudentAttendanceSummary(organizationId, student.id),
        AttendanceService.getStudentAttendanceHistory(organizationId, student.id),
        this.getStudentTimetable(organizationId, student.id),
        this.getPublishedResults(organizationId, student.id),
        this.getPublishedAssessments(organizationId, student.id),
        this.getFinanceSummary(organizationId, student.id, viewer.role === "parent" || policy.studentFinanceVisible),
        this.getCommunicationSummary(organizationId, student, viewer),
      ]);

    return {
      student: studentSummary,
      attendance,
      attendanceHistory,
      timetable,
      results,
      assessments,
      finance,
      communication,
    };
  }

  private async getStudentTimetable(organizationId: string, studentId: string): Promise<PortalTimetableItem[]> {
    const enrollment = await EnrollmentService.getCurrentEnrollment(studentId, organizationId);
    if (!enrollment) return [];
    const year = (await AcademicService.getAcademicYears(organizationId)).find((item) => item.name === enrollment.academicYear);
    if (!year) return [];
    const [entries, periods, subjects, staff] = await Promise.all([
      timetableService.getTimetableEntries(organizationId, {
        academicYearId: year.id,
        gradeId: enrollment.gradeId,
        sectionId: enrollment.sectionId,
      }),
      timetableService.getPeriods(organizationId),
      AcademicService.getSubjects(organizationId),
      StaffService.getStaffList(organizationId),
    ]);
    return entries.map((entry) => {
      const period = periods.find((item) => item.id === entry.periodId);
      const subject = subjects.find((item) => item.id === entry.subjectId);
      const teacher = staff.find((item) => item.id === entry.teacherId);
      return {
        id: entry.id,
        dayOfWeek: entry.dayOfWeek,
        periodName: period?.name || "Period",
        startTime: period?.startTime || "",
        endTime: period?.endTime || "",
        subjectName: subject?.name || "Subject",
        teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}`.trim() : "Teacher",
        roomId: entry.roomId,
      };
    });
  }

  private async getPublishedResults(organizationId: string, studentId: string): Promise<PortalResultItem[]> {
    const [publications, examinations, subjects] = await Promise.all([
      ExaminationService.getResultPublications(organizationId),
      ExaminationService.getExaminations(organizationId),
      AcademicService.getSubjects(organizationId),
    ]);
    return publications
      .filter((publication) => publication.status === "published")
      .flatMap((publication) => this.mapPublishedResult(publication, examinations, subjects, studentId));
  }

  private mapPublishedResult(
    publication: ResultPublication,
    examinations: Examination[],
    subjects: Awaited<ReturnType<typeof AcademicService.getSubjects>>,
    studentId: string,
  ): PortalResultItem[] {
    const result = publication.results.find((item) => item.studentId === studentId);
    if (!result) return [];
    const examination = examinations.find((item) => item.id === publication.examinationId);
    return result.subjects.map((subjectResult) => ({
      id: `${publication.id}:${studentId}:${subjectResult.subjectId}`,
      sourceType: "examination",
      sourceName: examination?.name || "Published Examination",
      subjectName: subjects.find((item) => item.id === subjectResult.subjectId)?.name || "Subject",
      maximumMarks: subjectResult.maximumMarks,
      obtainedMarks: subjectResult.obtainedMarks,
      percentage: subjectResult.percentage,
      grade: subjectResult.grade,
      passed: subjectResult.passed,
      remarks: subjectResult.remarks,
      publishedAt: publication.publishedAt,
    }));
  }

  private async getPublishedAssessments(organizationId: string, studentId: string): Promise<PortalResultItem[]> {
    const [assessments, marks, subjects] = await Promise.all([
      ExaminationService.getAssessments(organizationId),
      ExaminationService.getMarks(organizationId, { sourceType: "assessment", studentId }),
      AcademicService.getSubjects(organizationId),
    ]);
    const publishedAssessments = assessments.filter((assessment) => assessment.status === "published");
    return marks
      .filter((mark) => publishedAssessments.some((assessment) => assessment.id === mark.sourceId))
      .map((mark) => this.mapAssessmentMark(mark, publishedAssessments, subjects));
  }

  private mapAssessmentMark(
    mark: MarkRecord,
    assessments: Assessment[],
    subjects: Awaited<ReturnType<typeof AcademicService.getSubjects>>,
  ): PortalResultItem {
    const assessment = assessments.find((item) => item.id === mark.sourceId);
    return {
      id: mark.id,
      sourceType: "assessment",
      sourceName: assessment?.title || "Published Assessment",
      subjectName: subjects.find((item) => item.id === mark.subjectId)?.name || "Subject",
      maximumMarks: mark.maximumMarks,
      obtainedMarks: mark.obtainedMarks,
      percentage: mark.percentage,
      grade: mark.grade,
      remarks: mark.remarks,
      publishedAt: assessment?.updatedAt,
    };
  }

  private async getFinanceSummary(organizationId: string, studentId: string, visible: boolean): Promise<PortalFinanceSummary> {
    if (!visible) {
      return { visible: false, providerConfigured: false, outstandingCents: 0, overdueCents: 0, invoices: [], payments: [], receipts: [] };
    }
    const [invoices, payments, receipts] = await Promise.all([
      FinanceService.getInvoices(organizationId, { studentId }),
      FinanceService.getPayments(organizationId, studentId),
      FinanceService.getReceipts(organizationId, studentId),
    ]);
    return {
      visible: true,
      providerConfigured: false,
      outstandingCents: invoices.reduce((sum, invoice) => sum + invoice.balanceCents, 0),
      overdueCents: invoices.filter((invoice) => invoice.status === "overdue").reduce((sum, invoice) => sum + invoice.balanceCents, 0),
      invoices: invoices.filter((invoice) => invoice.status !== "draft" && invoice.status !== "voided"),
      payments,
      receipts,
    };
  }

  private async getCommunicationSummary(
    organizationId: string,
    student: Student,
    viewer: { role: PortalRole; userId: string; guardian?: StudentGuardian },
  ) {
    const recipient = viewer.role === "student"
      ? { kind: "student" as const, id: student.id }
      : { kind: "guardian" as const, id: viewer.guardian?.id || "" };
    const [announcements, notifications, messages] = await Promise.all([
      this.getVisibleAnnouncements(organizationId, student, viewer.guardian),
      CommunicationService.getNotifications(organizationId, recipient),
      this.getVisibleMessages(organizationId, student, viewer.guardian),
    ]);
    return {
      announcements,
      notifications,
      unreadNotifications: notifications.filter((item) => !item.isRead).length,
      messages,
    };
  }

  private async getVisibleAnnouncements(organizationId: string, student: Student, guardian?: StudentGuardian): Promise<Announcement[]> {
    const announcements = await CommunicationService.getAnnouncements(organizationId);
    const visible: Announcement[] = [];
    for (const announcement of announcements.filter((item) => item.status === "published")) {
      if (await this.audienceIncludes(organizationId, announcement.audience, student, guardian)) visible.push(announcement);
    }
    return visible;
  }

  private async getVisibleMessages(organizationId: string, student: Student, guardian?: StudentGuardian): Promise<CommunicationMessage[]> {
    const messages = await CommunicationService.getCommunications(organizationId);
    const visible: CommunicationMessage[] = [];
    for (const message of messages.filter((item) => item.status === "sent")) {
      if (await this.audienceIncludes(organizationId, message.audience, student, guardian)) visible.push(message);
    }
    return visible;
  }

  private async audienceIncludes(
    organizationId: string,
    audience: CommunicationAudience,
    student: Student,
    guardian?: StudentGuardian,
  ): Promise<boolean> {
    try {
      const recipients = await CommunicationService.resolveAudience(organizationId, audience);
      return recipients.some((recipient) => recipient.kind === "student" && recipient.id === student.id) ||
        Boolean(guardian && recipients.some((recipient) => recipient.kind === "guardian" && recipient.id === guardian.id));
    } catch {
      return false;
    }
  }

  private async audit(organizationId: string, action: string, details: string): Promise<void> {
    await workspaceService.addActivityLog(organizationId, { action, actor: "Portal User", details });
  }
}

export const PortalService = new PortalServiceClass();
