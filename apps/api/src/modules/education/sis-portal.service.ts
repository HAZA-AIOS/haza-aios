import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { ApiError } from '../../common/errors/api-error.js';
import type { DatabaseClient } from '../../database/client.js';
import { guardians, portalPolicies, portalUpdateRequests, studentGuardians, students } from '../../database/schema.js';
import { SisCommunicationService } from './sis-communication.service.js';
import { SisExaminationService } from './sis-examination.service.js';
import { SisFinanceService } from './sis-finance.service.js';
import { SisService } from './sis.service.js';

type JsonRecord = Record<string, unknown>;
type Tenant = { organizationId: string; workspaceId: string };
function payloadOf(value: unknown): JsonRecord { if (typeof value === 'string') { try { return JSON.parse(value) as JsonRecord; } catch { return {}; } } return value && typeof value === 'object' ? value as JsonRecord : {}; }
function uuid() { return randomUUID(); }
function now() { return new Date().toISOString(); }
function dto<T extends JsonRecord>(tenant: Tenant, row: { payload: JsonRecord }): T { return { ...payloadOf(row.payload), organizationId: tenant.organizationId } as unknown as T; }

export class SisPortalService {
  constructor(private readonly database: DatabaseClient) {}

  async getPolicy(tenant: Tenant) {
    const row = (await this.database.db.select().from(portalPolicies).where(eq(portalPolicies.workspaceId, tenant.workspaceId)).limit(1))[0];
    return row ? dto(tenant, row) : { organizationId: tenant.organizationId, studentFinanceVisible: false, studentMessagingEnabled: false, parentMessagingEnabled: true };
  }

  async savePolicy(tenant: Tenant, data: JsonRecord) {
    const existing = (await this.database.db.select().from(portalPolicies).where(eq(portalPolicies.workspaceId, tenant.workspaceId)).limit(1))[0];
    const record = { ...(existing ? payloadOf(existing.payload) : await this.getPolicy(tenant)), ...data, organizationId: tenant.organizationId, updatedAt: now(), createdAt: existing ? (existing.payload as JsonRecord).createdAt : now() };
    if (existing) await this.database.db.update(portalPolicies).set({ payload: record, updatedAt: new Date() }).where(eq(portalPolicies.id, existing.id));
    else await this.database.db.insert(portalPolicies).values({ id: uuid(), workspaceId: tenant.workspaceId, payload: record });
    return record;
  }

  async submitRequest(tenant: Tenant, actor: JsonRecord, input: JsonRecord) {
    if (!String(input.subject ?? '').trim() || !String(input.details ?? '').trim()) throw new ApiError(400, 'VALIDATION_FAILED', 'Update request subject and details are required.');
    const record = { id: uuid(), organizationId: tenant.organizationId, requesterUserId: String(actor.userId ?? ''), requesterRole: String(actor.role ?? ''), studentId: input.studentId as string | undefined, type: String(input.type), subject: String(input.subject).trim(), details: String(input.details).trim(), status: 'submitted', createdAt: now(), updatedAt: now() };
    await this.database.db.insert(portalUpdateRequests).values({ id: record.id, workspaceId: tenant.workspaceId, requesterUserId: record.requesterUserId, requesterRole: record.requesterRole, studentId: record.studentId, requestType: record.type, status: record.status, payload: record });
    return record;
  }

  async listRequests(tenant: Tenant, actor: JsonRecord) {
    const rows = await this.database.db.select().from(portalUpdateRequests).where(and(eq(portalUpdateRequests.workspaceId, tenant.workspaceId), eq(portalUpdateRequests.requesterUserId, String(actor.userId ?? '')), eq(portalUpdateRequests.requesterRole, String(actor.role ?? ''))));
    return rows.map((r) => dto(tenant, r));
  }

  async linkStudentUser(tenant: Tenant, studentId: string, input: { userId?: string | null; portalAccessEnabled?: boolean }) {
    const sisService = new SisService(this.database);
    const student = await sisService.getStudent(tenant, studentId);
    if (!student) throw new ApiError(404, 'NOT_FOUND', 'Student not found.');
    await this.database.db.update(students).set({
      userId: input.userId ?? null,
      portalAccessEnabled: input.portalAccessEnabled !== undefined ? Boolean(input.portalAccessEnabled) : true,
      updatedAt: new Date(),
    }).where(and(eq(students.id, studentId), eq(students.workspaceId, tenant.workspaceId)));
    return (await sisService.getStudent(tenant, studentId))!;
  }

  async linkGuardianUser(tenant: Tenant, studentId: string, guardianId: string, input: { userId?: string | null; portalAccessEnabled?: boolean; authorizedForPortal?: boolean }) {
    const sisService = new SisService(this.database);
    const student = await sisService.getStudent(tenant, studentId);
    if (!student) throw new ApiError(404, 'NOT_FOUND', 'Student not found.');
    const guardian = student.guardians.find((g: { id: string }) => g.id === guardianId);
    if (!guardian) throw new ApiError(404, 'NOT_FOUND', 'Guardian not found for this student.');

    if (input.userId !== undefined) {
      await this.database.db.update(guardians).set({
        userId: input.userId ?? null,
        updatedAt: new Date(),
      }).where(and(eq(guardians.id, guardianId), eq(guardians.workspaceId, tenant.workspaceId)));
    }
    await this.database.db.update(studentGuardians).set({
      portalAccessEnabled: input.portalAccessEnabled !== undefined ? Boolean(input.portalAccessEnabled) : true,
      authorizedForPortal: input.authorizedForPortal !== undefined ? Boolean(input.authorizedForPortal) : true,
      updatedAt: new Date(),
    }).where(and(eq(studentGuardians.studentId, studentId), eq(studentGuardians.guardianId, guardianId)));

    return (await sisService.getStudent(tenant, studentId))!;
  }

  async getParentDashboard(tenant: Tenant, userId: string, selectedStudentId?: string) {
    const sisService = new SisService(this.database);
    const allStudents = await sisService.listStudents(tenant);

    // Verify parent-child relationship: guardian.userId must match authenticated userId and have portalAccessEnabled or authorizedForPortal
    const linkedList: Array<{ student: typeof allStudents[number]; guardian: Record<string, unknown> }> = [];
    for (const student of allStudents.filter((s) => s.status === 'active')) {
      const matchingGuardian = (student.guardians as Array<Record<string, unknown>> ?? []).find(
        (g) => String(g.userId ?? '') === userId && (g.portalAccessEnabled === true || g.authorizedForPortal === true)
      );
      if (matchingGuardian) {
        linkedList.push({ student, guardian: matchingGuardian });
      }
    }

    const linkedSummaries = await Promise.all(
      linkedList.map(({ student }) => this.buildStudentSummary(tenant, student))
    );

    if (linkedList.length === 0) {
      return {
        userId,
        linkedStudents: [],
        selectedStudent: null,
        totalUnreadNotifications: 0,
      };
    }

    // Protection against unauthorized record access: Parent can only select their own verified children
    const targetStudentId = selectedStudentId || linkedList[0]?.student.id;
    const verifiedTarget = linkedList.find(({ student }) => student.id === targetStudentId);
    if (!verifiedTarget) {
      throw new ApiError(403, 'FORBIDDEN', 'Forbidden: student is not linked to this guardian account.');
    }

    const selectedDashboard = await this.buildStudentDashboard(tenant, verifiedTarget.student, {
      role: 'parent',
      userId,
      guardianId: String(verifiedTarget.guardian.id ?? ''),
    });

    return {
      userId,
      linkedStudents: linkedSummaries,
      selectedStudent: selectedDashboard,
      totalUnreadNotifications: selectedDashboard.communication.unreadNotifications,
    };
  }

  async getStudentDashboard(tenant: Tenant, userId: string, requestedStudentId?: string) {
    const sisService = new SisService(this.database);
    const allStudents = await sisService.listStudents(tenant);

    // Student self-access only: student.userId must match authenticated userId
    const student = allStudents.find(
      (s) => s.status === 'active' && String(s.userId ?? '') === userId && s.portalAccessEnabled !== false
    );

    if (!student) {
      throw new ApiError(403, 'FORBIDDEN', 'Forbidden: no authorized student portal record found for this account.');
    }

    // IDOR protection: Student can never access any other student's records
    if (requestedStudentId && requestedStudentId !== student.id) {
      throw new ApiError(403, 'FORBIDDEN', 'Forbidden: students can only access their own portal record.');
    }

    const dashboard = await this.buildStudentDashboard(tenant, student, {
      role: 'student',
      userId,
    });

    return {
      userId,
      ...dashboard,
    };
  }

  private async buildStudentSummary(tenant: Tenant, student: Record<string, unknown>) {
    const sisService = new SisService(this.database);
    const enrollments = await sisService.listEnrollments(tenant, { studentId: String(student.id), status: 'active' });
    const currentEnrollment = enrollments[0];

    const [grades, sections] = await Promise.all([
      sisService.listGrades(tenant),
      sisService.listSections(tenant),
    ]);

    const grade = currentEnrollment ? grades.find((g) => g.id === currentEnrollment.gradeId) : null;
    const section = currentEnrollment ? sections.find((s) => s.id === currentEnrollment.sectionId) : null;

    return {
      id: String(student.id),
      displayName: `${String(student.firstName ?? '')} ${String(student.lastName ?? '')}`.trim(),
      admissionNumber: String(student.admissionNumber ?? ''),
      status: String(student.status ?? 'active'),
      photoUrl: student.photoUrl as string | undefined,
      email: student.email as string | undefined,
      phone: student.phone as string | undefined,
      gradeName: grade?.name,
      sectionName: section?.name,
      academicYear: currentEnrollment?.academicYear,
    };
  }

  private async buildStudentDashboard(
    tenant: Tenant,
    student: Record<string, unknown>,
    viewer: { role: 'parent' | 'student'; userId: string; guardianId?: string }
  ) {
    const sisService = new SisService(this.database);
    const sisExam = new SisExaminationService(this.database);
    const sisFinance = new SisFinanceService(this.database);
    const sisComm = new SisCommunicationService(this.database);
    const policy = await this.getPolicy(tenant);

    const studentId = String(student.id);

    // 1. Student Summary
    const summary = await this.buildStudentSummary(tenant, student);

    // 2. Attendance Summary & History (Read-only)
    const [attendance, attendanceHistory] = await Promise.all([
      sisService.getStudentAttendanceSummary(tenant, studentId),
      sisService.getStudentAttendanceHistory(tenant, studentId),
    ]);

    // 3. Timetable
    const enrollments = await sisService.listEnrollments(tenant, { studentId, status: 'active' });
    const enrollment = enrollments[0];
    let timetable: Array<Record<string, unknown>> = [];
    if (enrollment) {
      const [entries, periods, subjects, staff] = await Promise.all([
        sisService.listTimetableEntries(tenant, { gradeId: enrollment.gradeId, sectionId: enrollment.sectionId }),
        sisService.listPeriods(tenant),
        sisService.listSubjects(tenant),
        sisService.listStaff(tenant),
      ]);
      timetable = entries.map((entry) => {
        const period = periods.find((p) => p.id === entry.periodId);
        const subject = subjects.find((s) => s.id === entry.subjectId);
        const teacher = staff.find((t) => t.id === entry.teacherId);
        return {
          id: entry.id,
          dayOfWeek: entry.dayOfWeek,
          periodName: period?.name || 'Period',
          startTime: period?.startTime || '',
          endTime: period?.endTime || '',
          subjectName: subject?.name || 'Subject',
          teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}`.trim() : 'Teacher',
          roomId: entry.roomId,
        };
      });
    }

    // 4. Published Results Only (Filter out drafts or unpublished results)
    const [publications, examinations, subjects] = await Promise.all([
      sisExam.listResultPublications(tenant),
      sisExam.listExaminations(tenant),
      sisService.listSubjects(tenant),
    ]);

    const results: Array<Record<string, unknown>> = [];
    for (const pub of publications.filter((p) => p.status === 'published')) {
      const studentResult = (pub.results as Array<Record<string, unknown>> ?? []).find(
        (r) => r.studentId === studentId
      );
      if (studentResult) {
        const exam = examinations.find((e) => e.id === pub.examinationId);
        for (const sub of (studentResult.subjects as Array<Record<string, unknown>> ?? [])) {
          const subject = subjects.find((s) => s.id === sub.subjectId);
          results.push({
            id: `${pub.id}:${studentId}:${sub.subjectId}`,
            sourceType: 'examination',
            sourceName: exam?.name || 'Published Examination',
            subjectName: subject?.name || 'Subject',
            maximumMarks: sub.maximumMarks,
            obtainedMarks: sub.obtainedMarks,
            percentage: sub.percentage,
            grade: sub.grade,
            passed: sub.passed,
            remarks: sub.remarks,
            publishedAt: pub.publishedAt,
          });
        }
      }
    }

    // Published Assessments
    const assessments = await sisExam.listAssessments(tenant);
    const publishedAssessments = assessments.filter((a) => a.status === 'published');
    const marks = await sisExam.listMarks(tenant, { sourceType: 'assessment', studentId });
    const assessmentResults: Array<Record<string, unknown>> = [];
    for (const mark of marks) {
      const assessment = publishedAssessments.find((a) => a.id === mark.sourceId);
      if (assessment) {
        const subject = subjects.find((s) => s.id === mark.subjectId);
        assessmentResults.push({
          id: mark.id,
          sourceType: 'assessment',
          sourceName: assessment.title,
          subjectName: subject?.name || 'Subject',
          maximumMarks: mark.maximumMarks,
          obtainedMarks: mark.obtainedMarks,
          percentage: mark.percentage,
          grade: mark.grade,
          remarks: mark.remarks,
          publishedAt: assessment.updatedAt,
        });
      }
    }

    // 5. Finance (Permitted fee records, hidden if student and studentFinanceVisible is false)
    const isFinancePermitted = viewer.role === 'parent' || Boolean(policy.studentFinanceVisible);
    let finance: Record<string, unknown>;
    if (!isFinancePermitted) {
      finance = {
        visible: false,
        providerConfigured: false,
        outstandingCents: 0,
        overdueCents: 0,
        invoices: [],
        payments: [],
        receipts: [],
      };
    } else {
      const [invoices, payments, receipts] = await Promise.all([
        sisFinance.listInvoices(tenant, { studentId }),
        sisFinance.listPayments(tenant, studentId),
        sisFinance.listReceipts(tenant, studentId),
      ]);
      const validInvoices = invoices.filter((i) => i.status !== 'draft' && i.status !== 'voided');
      finance = {
        visible: true,
        providerConfigured: false,
        outstandingCents: validInvoices.reduce((sum, inv) => sum + (Number(inv.balanceCents) || 0), 0),
        overdueCents: validInvoices.filter((inv) => inv.status === 'overdue').reduce((sum, inv) => sum + (Number(inv.balanceCents) || 0), 0),
        invoices: validInvoices,
        payments,
        receipts,
      };
    }

    // 6. Communication & Notifications (Scoped to recipient)
    const recipient = viewer.role === 'student'
      ? { kind: 'student' as const, id: studentId }
      : { kind: 'guardian' as const, id: viewer.guardianId || viewer.userId };

    const [allAnnouncements, notifications, messages] = await Promise.all([
      sisComm.listAnnouncements(tenant),
      sisComm.listNotifications(tenant, recipient),
      sisComm.listMessages(tenant),
    ]);

    return {
      student: summary,
      attendance,
      attendanceHistory,
      timetable,
      results,
      assessments: assessmentResults,
      finance,
      communication: {
        announcements: allAnnouncements.filter((a) => a.status === 'published'),
        notifications,
        unreadNotifications: notifications.filter((n) => !n.isRead).length,
        messages: messages.filter((m) => m.status === 'sent'),
      },
    };
  }
}
