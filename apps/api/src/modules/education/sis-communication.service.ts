import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { ApiError } from '../../common/errors/api-error.js';
import type { DatabaseClient } from '../../database/client.js';
import { mapDatabaseError } from '../../database/errors.js';
import {
  announcements,
  communicationDeliveries,
  communicationMessages,
  communicationTemplates,
  enrollments,
  notificationPreferences,
  sisNotifications,
  teachingAssignments,
} from '../../database/schema.js';
import { SisService } from './sis.service.js';

type JsonRecord = Record<string, unknown>;
type Tenant = { organizationId: string; workspaceId: string };
type Actor = { userId?: string; role?: string; staffId?: string } | undefined;
type Recipient = { id: string; organizationId: string; kind: string; displayName: string; email?: string; phone?: string; userId?: string; studentId?: string; guardianId?: string; staffId?: string };

const managerRoles = new Set(['Owner', 'Admin']);
const allowedVars = new Set([
  'student_name',
  'parent_name',
  'guardian_name',
  'school_name',
  'campus_name',
  'class_name',
  'section_name',
  'invoice_number',
  'due_date',
  'amount_due',
  'amount',
  'event_date',
  'exam_name',
  'staff_name',
]);

function uuid() { return randomUUID(); }
function now() { return new Date().toISOString(); }
function assertText(v: unknown, label: string) { const out = String(v ?? '').trim(); if (!out) throw new ApiError(400, 'VALIDATION_FAILED', `${label} is required.`); return out; }
function payloadOf(value: unknown): JsonRecord { if (typeof value === 'string') { try { return JSON.parse(value) as JsonRecord; } catch { return {}; } } return value && typeof value === 'object' ? value as JsonRecord : {}; }
function clean<T extends JsonRecord>(value: T): T { return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T; }
function dbError(error: unknown): never { const mapped = mapDatabaseError(error); if (mapped.code === 'DATABASE_UNIQUE_CONSTRAINT') throw new ApiError(409, 'DATABASE_UNIQUE_CONSTRAINT', 'A communication record with the same unique scope already exists.'); throw error; }
function assertPermission(actor: Actor, permission: string): void { const role = String(actor?.role ?? 'Owner'); if (managerRoles.has(role)) return; if (role === 'Teacher' && ['communication.view', 'communication.send', 'announcement.view', 'notification.view', 'template.view', 'delivery_history.view', 'message.view', 'message.send'].includes(permission)) return; if ((role === 'Parent' || role === 'guardian' || role === 'student' || role === 'Member') && ['notification.view', 'announcement.view', 'message.view', 'message.send'].includes(permission)) return; throw new ApiError(403, 'FORBIDDEN', `Unauthorized: missing permission ${permission}`); }
function dto<T extends JsonRecord>(tenant: Tenant, row: { payload: JsonRecord }): T { return { ...payloadOf(row.payload), organizationId: tenant.organizationId } as unknown as T; }
function studentName(s: JsonRecord) { return `${String(s.firstName ?? '')} ${String(s.lastName ?? '')}`.trim(); }
function guardianName(g: JsonRecord) { return `${String(g.firstName ?? '')} ${String(g.lastName ?? '')}`.trim(); }
function staffName(s: JsonRecord) { return `${String(s.firstName ?? '')} ${String(s.lastName ?? '')}`.trim(); }

export class SisCommunicationService {
  constructor(private readonly database: DatabaseClient) {}

  async resolveAudience(tenant: Tenant, audience: JsonRecord, actor?: Actor): Promise<Recipient[]> {
    const sis = new SisService(this.database);
    const [studentRows, staffRows] = await Promise.all([sis.listStudents(tenant), sis.listStaff(tenant)]);
    const activeStudents = studentRows.filter((s) => s.status === 'active') as JsonRecord[];
    const activeStaff = staffRows.filter((s) => s.status === 'active') as JsonRecord[];
    let selectedStudents: JsonRecord[] = [];
    let selectedStaff: JsonRecord[] = [];
    const recipients: Recipient[] = [];
    const type = String(audience.type ?? '');
    if (type === 'organization') { selectedStudents = activeStudents; selectedStaff = activeStaff; }
    else if (type === 'all_students' || type === 'all_guardians') selectedStudents = activeStudents;
    else if (type === 'all_staff') selectedStaff = activeStaff;
    else if (type === 'all_teachers') selectedStaff = activeStaff.filter((s) => s.staffType === 'teacher');
    else if (type === 'class' || type === 'section') {
      if (!audience.academicYear || !audience.gradeId) throw new ApiError(400, 'VALIDATION_FAILED', 'Class audience requires academic year and class.');
      if (type === 'section' && !audience.sectionId) throw new ApiError(400, 'VALIDATION_FAILED', 'Section audience requires a section.');
      const enrollmentRows = await this.database.db.select().from(enrollments).where(and(eq(enrollments.workspaceId, tenant.workspaceId), eq(enrollments.academicYear, String(audience.academicYear)), eq(enrollments.gradeId, String(audience.gradeId)), eq(enrollments.status, 'active')));
      const scoped = audience.sectionId ? enrollmentRows.filter((e) => e.sectionId === String(audience.sectionId)) : enrollmentRows;
      selectedStudents = activeStudents.filter((s) => scoped.some((e) => e.studentId === s.id));
      if (actor?.role === 'Teacher' && actor.staffId) {
        const assignments = await sis.listTeachingAssignments(tenant, { staffId: actor.staffId, academicYear: String(audience.academicYear), gradeId: String(audience.gradeId), sectionId: audience.sectionId ? String(audience.sectionId) : undefined });
        if (!assignments.some((a) => a.isActive)) throw new ApiError(403, 'FORBIDDEN', 'Teacher is not authorized for this academic communication scope.');
      }
    } else if (type === 'selected_students') selectedStudents = activeStudents.filter((s) => (audience.studentIds as unknown[] | undefined)?.map(String).includes(String(s.id)));
    else if (type === 'selected_guardians') selectedStudents = activeStudents.filter((s) => (s.guardians as JsonRecord[] | undefined)?.some((g) => (audience.guardianIds as unknown[] | undefined)?.map(String).includes(String(g.id))));
    else if (type === 'selected_staff') selectedStaff = activeStaff.filter((s) => (audience.staffIds as unknown[] | undefined)?.map(String).includes(String(s.id)));
    else if (type === 'selected_users') {
      recipients.push(...(audience.userIds as unknown[] | undefined ?? []).map((id) => ({ id: String(id), organizationId: tenant.organizationId, kind: 'user', displayName: String(id), userId: String(id) })));
    }
    if (['organization', 'all_students', 'class', 'section', 'selected_students'].includes(type)) recipients.push(...selectedStudents.map((s) => ({ id: String(s.id), organizationId: tenant.organizationId, kind: 'student', displayName: studentName(s), email: s.email as string | undefined, phone: s.phone as string | undefined, studentId: String(s.id) })));
    if (['organization', 'all_guardians', 'class', 'section', 'selected_guardians'].includes(type)) for (const s of selectedStudents) for (const g of (s.guardians as JsonRecord[] | undefined) ?? []) { if (type === 'selected_guardians' && !(audience.guardianIds as unknown[] | undefined)?.map(String).includes(String(g.id))) continue; recipients.push({ id: String(g.id), organizationId: tenant.organizationId, kind: 'guardian', displayName: guardianName(g), email: g.email as string | undefined, phone: g.phone as string | undefined, studentId: String(s.id), guardianId: String(g.id), userId: g.userId as string | undefined }); }
    recipients.push(...selectedStaff.map((s) => ({ id: String(s.id), organizationId: tenant.organizationId, kind: s.staffType === 'teacher' ? 'teacher' : 'staff', displayName: staffName(s), email: s.email as string | undefined, phone: s.phone as string | undefined, userId: s.userId as string | undefined, staffId: String(s.id) })));
    const seen = new Set<string>();
    return recipients.filter((r) => { const k = `${r.kind}:${r.id}`; if (seen.has(k)) return false; seen.add(k); return true; });
  }

  renderTemplate(template: JsonRecord, variables: Record<string, string>) {
    const supported = new Set((template.supportedVariables as string[] | undefined) ?? []);
    const render = (value: unknown) => String(value ?? '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
      if (!allowedVars.has(key) || (!supported.has(key) && supported.size > 0)) {
        throw new ApiError(400, 'VALIDATION_FAILED', `Unsupported template variable: ${key}`);
      }
      return variables[key] ?? (key === 'parent_name' ? variables['guardian_name'] : key === 'amount_due' ? variables['amount'] : '');
    });
    return { subject: render(template.subject), content: render(template.content) };
  }

  async createTemplate(tenant: Tenant, data: JsonRecord, actor?: Actor) {
    assertPermission(actor, 'template.manage');
    assertText(data.name, 'Template name');
    for (const variable of (data.supportedVariables as string[] | undefined) ?? []) {
      if (!allowedVars.has(variable)) throw new ApiError(400, 'VALIDATION_FAILED', `Unsupported template variable: ${variable}`);
    }
    const record = this.withTenant<JsonRecord>(tenant, { ...data, id: uuid(), createdAt: now(), updatedAt: now() });
    await this.database.db.insert(communicationTemplates).values({ id: String(record.id), workspaceId: tenant.workspaceId, name: String(record.name), category: String(record.category ?? 'general'), status: String(record.status ?? 'active'), payload: record }).catch(dbError);
    return record;
  }
  async getTemplate(tenant: Tenant, id: string) { assertPermission(undefined, 'template.view'); return this.getPayload(tenant, communicationTemplates, communicationTemplates.id, id, 'Template'); }
  async updateTemplate(tenant: Tenant, id: string, data: JsonRecord, actor?: Actor) {
    assertPermission(actor, 'template.manage');
    const current = await this.getPayload<JsonRecord>(tenant, communicationTemplates, communicationTemplates.id, id, 'Template');
    const record = this.withTenant<JsonRecord>(tenant, { ...current, ...data, id, updatedAt: now() });
    await this.database.db.update(communicationTemplates).set({ name: String(record.name), category: String(record.category ?? 'general'), status: String(record.status ?? 'active'), payload: record, updatedAt: new Date() }).where(and(eq(communicationTemplates.workspaceId, tenant.workspaceId), eq(communicationTemplates.id, id))).catch(dbError);
    return record;
  }
  async deleteTemplate(tenant: Tenant, id: string, actor?: Actor) {
    assertPermission(actor, 'template.manage');
    await this.getPayload(tenant, communicationTemplates, communicationTemplates.id, id, 'Template');
    await this.database.db.delete(communicationTemplates).where(and(eq(communicationTemplates.workspaceId, tenant.workspaceId), eq(communicationTemplates.id, id)));
    return { success: true };
  }
  async listTemplates(tenant: Tenant) {
    assertPermission(undefined, 'template.view');
    return (await this.database.db.select().from(communicationTemplates).where(eq(communicationTemplates.workspaceId, tenant.workspaceId))).map((r) => dto(tenant, r));
  }

  async createAnnouncement(tenant: Tenant, data: JsonRecord, actor?: Actor) {
    assertPermission(actor, 'announcement.create');
    assertText(data.title, 'Announcement title');
    assertText(data.content, 'Announcement content');
    const recipients = await this.resolveAudience(tenant, data.audience as JsonRecord, actor);
    const record = this.withTenant<JsonRecord>(tenant, { ...data, id: uuid(), recipientCount: recipients.length, publishedAt: data.status === 'published' ? now() : undefined, createdAt: now(), updatedAt: now() });
    await this.database.db.insert(announcements).values({ id: String(record.id), workspaceId: tenant.workspaceId, title: String(record.title), status: String(record.status ?? 'draft'), priority: String(record.priority ?? 'normal'), payload: record });
    if (record.status === 'published') await this.dispatchAnnouncement(tenant, record, recipients);
    return record;
  }
  async getAnnouncement(tenant: Tenant, id: string) { assertPermission(undefined, 'announcement.view'); return this.getPayload(tenant, announcements, announcements.id, id, 'Announcement'); }
  async updateAnnouncement(tenant: Tenant, id: string, data: JsonRecord, actor?: Actor) {
    assertPermission(actor, 'announcement.create');
    const current = await this.getPayload<JsonRecord>(tenant, announcements, announcements.id, id, 'Announcement');
    if (data.title) assertText(data.title, 'Announcement title');
    if (data.content) assertText(data.content, 'Announcement content');
    const audience = (data.audience as JsonRecord) || (current.audience as JsonRecord);
    const recipients = await this.resolveAudience(tenant, audience, actor);
    const willPublish = data.status === 'published' && current.status !== 'published';
    const record = this.withTenant<JsonRecord>(tenant, { ...current, ...data, id, recipientCount: recipients.length, publishedAt: willPublish ? now() : current.publishedAt, updatedAt: now() });
    await this.database.db.update(announcements).set({ title: String(record.title), status: String(record.status), priority: String(record.priority ?? 'normal'), payload: record, updatedAt: new Date() }).where(and(eq(announcements.workspaceId, tenant.workspaceId), eq(announcements.id, id)));
    if (willPublish) await this.dispatchAnnouncement(tenant, record, recipients);
    return record;
  }
  async deleteAnnouncement(tenant: Tenant, id: string, actor?: Actor) {
    assertPermission(actor, 'announcement.create');
    const current = await this.getPayload<JsonRecord>(tenant, announcements, announcements.id, id, 'Announcement');
    if (current.status === 'published') throw new ApiError(400, 'VALIDATION_FAILED', 'Published announcements cannot be deleted. Archive them instead.');
    await this.database.db.delete(announcements).where(and(eq(announcements.workspaceId, tenant.workspaceId), eq(announcements.id, id)));
    return { success: true };
  }
  async publishAnnouncement(tenant: Tenant, id: string, actor?: Actor) {
    assertPermission(actor, 'announcement.publish');
    const current = await this.getPayload<JsonRecord>(tenant, announcements, announcements.id, id, 'Announcement');
    if (current.status === 'published') return current;
    const recipients = await this.resolveAudience(tenant, current.audience as JsonRecord, actor);
    const record = this.withTenant<JsonRecord>(tenant, { ...current, status: 'published', recipientCount: recipients.length, publishedAt: now(), updatedAt: now() });
    await this.database.db.update(announcements).set({ status: 'published', payload: record, updatedAt: new Date() }).where(and(eq(announcements.workspaceId, tenant.workspaceId), eq(announcements.id, id)));
    await this.dispatchAnnouncement(tenant, record, recipients);
    return record;
  }
  async archiveAnnouncement(tenant: Tenant, id: string, actor?: Actor) {
    assertPermission(actor, 'announcement.update');
    const current = await this.getPayload<JsonRecord>(tenant, announcements, announcements.id, id, 'Announcement');
    const record = this.withTenant<JsonRecord>(tenant, { ...current, status: 'archived', updatedAt: now() });
    await this.database.db.update(announcements).set({ status: 'archived', payload: record, updatedAt: new Date() }).where(and(eq(announcements.workspaceId, tenant.workspaceId), eq(announcements.id, id)));
    return record;
  }
  async listAnnouncements(tenant: Tenant, query?: { status?: string; category?: string; priority?: string; campusId?: string; search?: string; recipient?: { kind?: string; id?: string; gradeId?: string; sectionId?: string; staffType?: string } }) {
    assertPermission(undefined, 'announcement.view');
    const rows = (await this.database.db.select().from(announcements).where(eq(announcements.workspaceId, tenant.workspaceId))).map((r) => dto<JsonRecord>(tenant, r));
    return rows.filter((item) => {
      if (query?.status && item.status !== query.status) return false;
      if (query?.category && item.category !== query.category) return false;
      if (query?.priority && item.priority !== query.priority) return false;
      if (query?.campusId && item.campusId && item.campusId !== query.campusId) return false;
      if (query?.search) {
        const q = query.search.toLowerCase();
        const matchesTitle = String(item.title ?? '').toLowerCase().includes(q);
        const matchesContent = String(item.content ?? '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesContent) return false;
      }
      if (query?.recipient?.kind) {
        const r = query.recipient;
        const aud = (item.audience as JsonRecord) ?? { type: 'organization' };
        const audType = String(aud.type ?? '');
        if (audType === 'organization') return true;
        if (audType === 'all_students') return r.kind === 'student';
        if (audType === 'all_guardians') return r.kind === 'guardian';
        if (audType === 'all_staff') return r.kind === 'staff' || r.kind === 'teacher';
        if (audType === 'all_teachers') return r.kind === 'teacher';
        if (audType === 'class') return r.gradeId && String(aud.gradeId) === String(r.gradeId);
        if (audType === 'section') return r.gradeId && String(aud.gradeId) === String(r.gradeId) && (!aud.sectionId || String(aud.sectionId) === String(r.sectionId));
        if (audType === 'selected_students') return r.kind === 'student' && (aud.studentIds as unknown[] | undefined)?.map(String).includes(String(r.id));
        if (audType === 'selected_guardians') return r.kind === 'guardian' && (aud.guardianIds as unknown[] | undefined)?.map(String).includes(String(r.id));
        if (audType === 'selected_staff') return (r.kind === 'staff' || r.kind === 'teacher') && (aud.staffIds as unknown[] | undefined)?.map(String).includes(String(r.id));
        return false;
      }
      return true;
    });
  }

  async sendCommunication(tenant: Tenant, input: JsonRecord, actor?: Actor) {
    assertPermission(actor, 'communication.send');
    assertText(input.subject, 'Subject');
    assertText(input.body, 'Message');
    if (!Array.isArray(input.channels) || !input.channels.length) throw new ApiError(400, 'VALIDATION_FAILED', 'At least one delivery channel is required.');
    if (input.idempotencyKey) {
      const found = (await this.database.db.select().from(communicationMessages).where(and(eq(communicationMessages.workspaceId, tenant.workspaceId), eq(communicationMessages.idempotencyKey, String(input.idempotencyKey)))).limit(1))[0];
      if (found) return dto(tenant, found);
    }
    let subject = String(input.subject);
    let body = String(input.body);
    if (input.templateId) {
      const template = await this.getPayload<JsonRecord>(tenant, communicationTemplates, communicationTemplates.id, String(input.templateId), 'Template');
      const rendered = this.renderTemplate(template, (input.variables as Record<string, string>) ?? {});
      subject = rendered.subject;
      body = rendered.content;
    }
    const recipients = await this.resolveAudience(tenant, input.audience as JsonRecord, actor);
    if (!recipients.length) throw new ApiError(400, 'VALIDATION_FAILED', 'No valid recipients resolved.');
    const created = now();
    const status = input.scheduledAt && String(input.scheduledAt) > created ? 'scheduled' : 'sent';
    const record = this.withTenant<JsonRecord>(tenant, { id: uuid(), subject, body, senderId: input.senderId, audience: input.audience, channels: input.channels, priority: input.priority ?? 'normal', status, scheduledAt: input.scheduledAt, templateId: input.templateId, idempotencyKey: input.idempotencyKey, recipientCount: recipients.length, createdAt: created, updatedAt: created, sentAt: status === 'sent' ? created : undefined });
    await this.database.db.insert(communicationMessages).values({ id: String(record.id), workspaceId: tenant.workspaceId, subject, status, priority: String(record.priority), idempotencyKey: input.idempotencyKey ? String(input.idempotencyKey) : undefined, payload: record }).catch(dbError);
    if (status === 'sent') {
      for (const recipient of recipients) {
        for (const channel of input.channels as string[]) {
          if (channel === 'in_app') {
            const notification = await this.createNotification(tenant, { recipientKind: recipient.kind, recipientId: recipient.id, recipientUserId: recipient.userId, type: 'communication.sent', title: subject, message: body, priority: input.priority ?? 'normal', relatedResourceType: 'communication', relatedResourceId: record.id, actionPath: '/workspace/education/communication' });
            await this.recordDelivery(tenant, { communicationId: record.id, notificationId: notification.id, recipientId: recipient.id, recipientKind: recipient.kind, channel, status: 'sent' });
          } else if (channel === 'email') {
            await this.recordDelivery(tenant, { communicationId: record.id, recipientId: recipient.id, recipientKind: recipient.kind, channel, status: 'queued', providerReference: 'mock-email-transport' });
          } else {
            await this.recordDelivery(tenant, { communicationId: record.id, recipientId: recipient.id, recipientKind: recipient.kind, channel, status: 'failed', safeErrorCode: 'PROVIDER_UNAVAILABLE', safeErrorMessage: `${channel.toUpperCase()} provider is not configured.` });
          }
        }
      }
    }
    return record;
  }
  async listMessages(tenant: Tenant) { assertPermission(undefined, 'communication.view'); return (await this.database.db.select().from(communicationMessages).where(eq(communicationMessages.workspaceId, tenant.workspaceId))).map((r) => dto(tenant, r)); }

  /* ─────────────────── Direct Messaging ─────────────────── */

  async getDirectMessageContacts(tenant: Tenant, actor?: Actor) {
    const sis = new SisService(this.database);
    const [studentRows, staffRows] = await Promise.all([sis.listStudents(tenant), sis.listStaff(tenant)]);
    const role = String(actor?.role ?? 'Owner');
    const userId = actor?.userId;

    const contacts: Array<{ id: string; userId: string; name: string; role: string; email?: string; subtext?: string }> = [];

    if (managerRoles.has(role)) {
      for (const s of staffRows.filter((s) => s.status === 'active')) {
        if (s.userId && s.userId !== userId) {
          contacts.push({ id: String(s.id), userId: String(s.userId), name: `${s.firstName} ${s.lastName}`.trim(), role: s.staffType === 'teacher' ? 'Teacher' : 'Staff', email: s.email as string | undefined, subtext: s.staffType === 'teacher' ? 'Faculty' : 'Administrative Staff' });
        }
      }
      for (const st of studentRows.filter((s) => s.status === 'active')) {
        if (st.userId && st.userId !== userId) {
          contacts.push({ id: String(st.id), userId: String(st.userId), name: `${st.firstName} ${st.lastName}`.trim(), role: 'Student', email: st.email as string | undefined, subtext: `Admission: ${st.admissionNumber}` });
        }
        for (const g of (st.guardians as JsonRecord[] | undefined) ?? []) {
          if (g.userId && g.userId !== userId) {
            contacts.push({ id: String(g.id), userId: String(g.userId), name: `${g.firstName} ${g.lastName}`.trim(), role: 'Parent', email: g.email as string | undefined, subtext: `Guardian of ${st.firstName} ${st.lastName}` });
          }
        }
      }
    } else if (role === 'Teacher') {
      for (const s of staffRows.filter((s) => s.status === 'active')) {
        if (s.userId && s.userId !== userId) {
          contacts.push({ id: String(s.id), userId: String(s.userId), name: `${s.firstName} ${s.lastName}`.trim(), role: s.staffType === 'teacher' ? 'Teacher' : 'Staff', email: s.email as string | undefined, subtext: 'Colleague' });
        }
      }
      if (actor?.staffId) {
        const assignments = await sis.listTeachingAssignments(tenant, { staffId: actor.staffId });
        const activeAssignments = assignments.filter((a) => a.isActive);
        const gradeIds = new Set(activeAssignments.map((a) => a.gradeId));
        const sectionIds = new Set(activeAssignments.map((a) => a.sectionId).filter(Boolean));
        const enrolls = await this.database.db.select().from(enrollments).where(and(eq(enrollments.workspaceId, tenant.workspaceId), eq(enrollments.status, 'active')));
        const enrolledStudentIds = new Set(
          enrolls.filter((e) => gradeIds.has(e.gradeId) && (!e.sectionId || sectionIds.size === 0 || sectionIds.has(e.sectionId))).map((e) => e.studentId)
        );
        for (const st of studentRows.filter((s) => enrolledStudentIds.has(s.id))) {
          for (const g of (st.guardians as JsonRecord[] | undefined) ?? []) {
            if (g.userId && g.userId !== userId) {
              contacts.push({ id: String(g.id), userId: String(g.userId), name: `${g.firstName} ${g.lastName}`.trim(), role: 'Parent', email: g.email as string | undefined, subtext: `Parent of ${st.firstName}` });
            }
          }
        }
      }
    } else if (role === 'Parent' || role === 'guardian') {
      const linkedStudents = studentRows.filter((st) => (st.guardians as JsonRecord[] | undefined)?.some((g) => g.userId === userId));
      const studentIds = linkedStudents.map((s) => s.id);
      const enrolls = await this.database.db.select().from(enrollments).where(and(eq(enrollments.workspaceId, tenant.workspaceId), eq(enrollments.status, 'active')));
      const studentEnrolls = enrolls.filter((e) => studentIds.includes(e.studentId));
      const gradeIds = new Set(studentEnrolls.map((e) => e.gradeId));
      const assignments = await this.database.db.select().from(teachingAssignments).where(and(eq(teachingAssignments.workspaceId, tenant.workspaceId), eq(teachingAssignments.isActive, true)));
      const teacherStaffIds = new Set(assignments.filter((a) => gradeIds.has(a.gradeId)).map((a) => a.staffId));
      for (const t of staffRows.filter((s) => teacherStaffIds.has(s.id) && s.userId)) {
        contacts.push({ id: String(t.id), userId: String(t.userId), name: `${t.firstName} ${t.lastName}`.trim(), role: 'Teacher', email: t.email as string | undefined, subtext: 'Teacher' });
      }
      for (const a of staffRows.filter((s) => s.status === 'active' && s.userId && s.userId !== userId && (s.staffType === 'administrator' || s.staffType === 'coordinator'))) {
        contacts.push({ id: String(a.id), userId: String(a.userId), name: `${a.firstName} ${a.lastName}`.trim(), role: 'Staff', email: a.email as string | undefined, subtext: 'School Administration' });
      }
    } else if (role === 'student' || role === 'Student') {
      const student = studentRows.find((st) => st.userId === userId);
      if (student) {
        const enrolls = await this.database.db.select().from(enrollments).where(and(eq(enrollments.workspaceId, tenant.workspaceId), eq(enrollments.studentId, student.id), eq(enrollments.status, 'active')));
        const gradeIds = new Set(enrolls.map((e) => e.gradeId));
        const assignments = await this.database.db.select().from(teachingAssignments).where(and(eq(teachingAssignments.workspaceId, tenant.workspaceId), eq(teachingAssignments.isActive, true)));
        const teacherStaffIds = new Set(assignments.filter((a) => gradeIds.has(a.gradeId)).map((a) => a.staffId));
        for (const t of staffRows.filter((s) => teacherStaffIds.has(s.id) && s.userId)) {
          contacts.push({ id: String(t.id), userId: String(t.userId), name: `${t.firstName} ${t.lastName}`.trim(), role: 'Teacher', email: t.email as string | undefined, subtext: 'Teacher' });
        }
      }
    } else {
      for (const s of staffRows.filter((s) => s.status === 'active')) {
        if (s.userId && s.userId !== userId) {
          contacts.push({ id: String(s.id), userId: String(s.userId), name: `${s.firstName} ${s.lastName}`.trim(), role: s.staffType === 'teacher' ? 'Teacher' : 'Staff', email: s.email as string | undefined, subtext: 'Colleague' });
        }
      }
    }

    const seen = new Set<string>();
    return contacts.filter((c) => {
      if (seen.has(c.userId)) return false;
      seen.add(c.userId);
      return true;
    });
  }

  async sendDirectMessage(
    tenant: Tenant,
    input: { recipientUserId: string; subject?: string; body: string; conversationId?: string; attachments?: unknown[] },
    actor?: Actor
  ) {
    if (!actor?.userId) throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required.');
    assertText(input.body, 'Message content');
    assertText(input.recipientUserId, 'Recipient user');

    const sis = new SisService(this.database);
    const [studentRows, staffRows] = await Promise.all([sis.listStudents(tenant), sis.listStaff(tenant)]);

    let senderName = 'School Member';
    const senderStaff = staffRows.find((s) => s.userId === actor.userId);
    if (senderStaff) senderName = `${senderStaff.firstName} ${senderStaff.lastName}`.trim();
    else {
      const senderStudent = studentRows.find((s) => s.userId === actor.userId);
      if (senderStudent) senderName = `${senderStudent.firstName} ${senderStudent.lastName}`.trim();
      else {
        for (const s of studentRows) {
          const g = (s.guardians as JsonRecord[] | undefined)?.find((g) => g.userId === actor.userId);
          if (g) { senderName = `${g.firstName} ${g.lastName}`.trim(); break; }
        }
      }
    }

    let recipientName = 'Recipient';
    let recipientRole = 'User';
    const recipientStaff = staffRows.find((s) => s.userId === input.recipientUserId);
    if (recipientStaff) {
      recipientName = `${recipientStaff.firstName} ${recipientStaff.lastName}`.trim();
      recipientRole = recipientStaff.staffType === 'teacher' ? 'Teacher' : 'Staff';
    } else {
      const recipientStudent = studentRows.find((s) => s.userId === input.recipientUserId);
      if (recipientStudent) {
        recipientName = `${recipientStudent.firstName} ${recipientStudent.lastName}`.trim();
        recipientRole = 'Student';
      } else {
        for (const s of studentRows) {
          const g = (s.guardians as JsonRecord[] | undefined)?.find((g) => g.userId === input.recipientUserId);
          if (g) {
            recipientName = `${g.firstName} ${g.lastName}`.trim();
            recipientRole = 'Parent';
            break;
          }
        }
      }
    }

    const conversationId = input.conversationId || uuid();
    const created = now();
    const msgId = uuid();
    const subject = input.subject?.trim() || `Conversation with ${recipientName}`;

    const messageRecord = this.withTenant<JsonRecord>(tenant, {
      id: msgId,
      type: 'direct_message',
      conversationId,
      senderUserId: actor.userId,
      senderName,
      senderRole: actor.role || 'Member',
      recipientUserId: input.recipientUserId,
      recipientName,
      recipientRole,
      subject,
      body: input.body.trim(),
      attachments: input.attachments || [],
      read: false,
      status: 'sent',
      priority: 'normal',
      createdAt: created,
      updatedAt: created,
    });

    await this.database.db.insert(communicationMessages).values({
      id: msgId,
      workspaceId: tenant.workspaceId,
      subject,
      status: 'sent',
      priority: 'normal',
      payload: messageRecord,
    }).catch(dbError);

    await this.createNotification(tenant, {
      recipientKind: 'user',
      recipientId: input.recipientUserId,
      recipientUserId: input.recipientUserId,
      type: 'direct_message.received',
      title: `New message from ${senderName}`,
      message: input.body.substring(0, 120),
      priority: 'normal',
      relatedResourceType: 'conversation',
      relatedResourceId: conversationId,
      actionPath: `/workspace/education/communication?tab=messages&conversationId=${conversationId}`,
    });

    await this.recordDelivery(tenant, {
      communicationId: msgId,
      recipientId: input.recipientUserId,
      recipientKind: 'user',
      channel: 'in_app',
      status: 'sent',
    });

    return messageRecord;
  }

  async listConversations(tenant: Tenant, actor?: Actor) {
    if (!actor?.userId) return [];
    const rows = await this.database.db.select().from(communicationMessages).where(eq(communicationMessages.workspaceId, tenant.workspaceId));
    const msgs = rows.map((r) => dto<JsonRecord>(tenant, r)).filter((m) => m.type === 'direct_message');

    const actorMsgs = msgs.filter((m) => m.senderUserId === actor.userId || m.recipientUserId === actor.userId);
    const byConv = new Map<string, JsonRecord[]>();
    for (const m of actorMsgs) {
      const convId = String(m.conversationId || m.id);
      if (!byConv.has(convId)) byConv.set(convId, []);
      byConv.get(convId)!.push(m);
    }

    const conversations: JsonRecord[] = [];
    for (const [convId, list] of byConv.entries()) {
      list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      const latest = list[0];
      const isSender = latest.senderUserId === actor.userId;
      const otherUserId = isSender ? latest.recipientUserId : latest.senderUserId;
      const otherName = isSender ? latest.recipientName : latest.senderName;
      const otherRole = isSender ? latest.recipientRole : latest.senderRole;
      const unreadCount = list.filter((m) => m.recipientUserId === actor.userId && !m.read).length;

      conversations.push({
        conversationId: convId,
        participantUserId: otherUserId,
        participantName: otherName || 'User',
        participantRole: otherRole || 'Member',
        lastMessage: latest.body,
        lastMessageAt: latest.createdAt,
        unreadCount,
        totalMessages: list.length,
        archived: Boolean(latest.archived),
      });
    }

    conversations.sort((a, b) => String(b.lastMessageAt).localeCompare(String(a.lastMessageAt)));
    return conversations;
  }

  async getConversationMessages(tenant: Tenant, conversationId: string, actor?: Actor) {
    if (!actor?.userId) return [];
    const rows = await this.database.db.select().from(communicationMessages).where(eq(communicationMessages.workspaceId, tenant.workspaceId));
    const msgs = rows
      .map((r) => dto<JsonRecord>(tenant, r))
      .filter((m) => m.type === 'direct_message' && String(m.conversationId || m.id) === conversationId);

    for (const m of msgs) {
      if (m.recipientUserId === actor.userId && !m.read) {
        m.read = true;
        m.readAt = now();
        await this.database.db.update(communicationMessages).set({ payload: m, updatedAt: new Date() }).where(and(eq(communicationMessages.workspaceId, tenant.workspaceId), eq(communicationMessages.id, String(m.id))));
      }
    }

    msgs.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    return msgs;
  }

  async archiveConversation(tenant: Tenant, conversationId: string, actor?: Actor) {
    if (!actor?.userId) throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required.');
    const rows = await this.database.db.select().from(communicationMessages).where(eq(communicationMessages.workspaceId, tenant.workspaceId));
    const msgs = rows.map((r) => dto<JsonRecord>(tenant, r)).filter((m) => m.type === 'direct_message' && String(m.conversationId || m.id) === conversationId);
    for (const m of msgs) {
      m.archived = true;
      m.archivedAt = now();
      await this.database.db.update(communicationMessages).set({ payload: m, updatedAt: new Date() }).where(and(eq(communicationMessages.workspaceId, tenant.workspaceId), eq(communicationMessages.id, String(m.id))));
    }
    return { success: true };
  }

  /* ─────────────────── Notifications ─────────────────── */

  async createNotification(tenant: Tenant, data: JsonRecord) {
    const record = this.withTenant<JsonRecord>(tenant, { ...data, id: uuid(), isRead: false, createdAt: now() });
    await this.database.db.insert(sisNotifications).values({ id: String(record.id), workspaceId: tenant.workspaceId, recipientKind: String(record.recipientKind), recipientId: String(record.recipientId), recipientUserId: typeof record.recipientUserId === 'string' ? record.recipientUserId : undefined, notificationType: String(record.type), isRead: false, payload: record });
    return record;
  }
  async getNotification(tenant: Tenant, id: string, recipient?: { kind?: string; id?: string }) {
    const row = await this.getPayload<JsonRecord>(tenant, sisNotifications, sisNotifications.id, id, 'Notification');
    if (recipient?.kind && (row.recipientKind !== recipient.kind || row.recipientId !== recipient.id)) throw new ApiError(403, 'FORBIDDEN', 'Notification does not belong to this recipient.');
    return row;
  }
  async listNotifications(tenant: Tenant, recipient?: { kind?: string; id?: string }) {
    assertPermission(undefined, 'notification.view');
    const rows = await this.database.db.select().from(sisNotifications).where(eq(sisNotifications.workspaceId, tenant.workspaceId));
    return rows.map((r) => dto(tenant, r)).filter((n) => !recipient?.kind || (n.recipientKind === recipient.kind && n.recipientId === recipient.id));
  }
  async unreadCount(tenant: Tenant, recipient: { kind: string; id: string }) {
    return (await this.listNotifications(tenant, recipient)).filter((n) => !n.isRead).length;
  }
  async markRead(tenant: Tenant, id: string, recipient?: { kind?: string; id?: string }) {
    const current = await this.getPayload<JsonRecord>(tenant, sisNotifications, sisNotifications.id, id, 'Notification');
    if (recipient?.kind && (current.recipientKind !== recipient.kind || current.recipientId !== recipient.id)) throw new ApiError(403, 'FORBIDDEN', 'Notification does not belong to this recipient.');
    const record = this.withTenant<JsonRecord>(tenant, { ...current, isRead: true, readAt: now() });
    await this.database.db.update(sisNotifications).set({ isRead: true, payload: record, updatedAt: new Date() }).where(and(eq(sisNotifications.workspaceId, tenant.workspaceId), eq(sisNotifications.id, id)));
    return record;
  }
  async markAllRead(tenant: Tenant, recipient: { kind: string; id: string }) {
    const rows = await this.database.db.select().from(sisNotifications).where(and(eq(sisNotifications.workspaceId, tenant.workspaceId), eq(sisNotifications.recipientKind, recipient.kind), eq(sisNotifications.recipientId, recipient.id)));
    let count = 0;
    for (const row of rows) {
      const current = dto<JsonRecord>(tenant, row);
      if (!current.isRead) {
        count += 1;
        await this.markRead(tenant, row.id);
      }
    }
    return count;
  }

  /* ─────────────────── Deliveries & Retries ─────────────────── */

  async recordDelivery(tenant: Tenant, data: JsonRecord) {
    const created = now();
    const record = this.withTenant<JsonRecord>(tenant, { ...data, id: uuid(), attemptNumber: 1, queuedAt: created, sentAt: data.status === 'sent' ? created : undefined, deliveredAt: data.status === 'delivered' ? created : undefined, failedAt: data.status === 'failed' ? created : undefined, retryCount: 0 });
    await this.database.db.insert(communicationDeliveries).values({ id: String(record.id), workspaceId: tenant.workspaceId, communicationId: data.communicationId ? String(data.communicationId) : undefined, announcementId: data.announcementId ? String(data.announcementId) : undefined, notificationId: data.notificationId ? String(data.notificationId) : undefined, recipientId: String(data.recipientId), recipientKind: String(data.recipientKind), channel: String(data.channel), status: String(data.status), attemptNumber: 1, safeErrorCode: data.safeErrorCode ? String(data.safeErrorCode) : null, safeErrorMessage: data.safeErrorMessage ? String(data.safeErrorMessage) : null, payload: record });
    return record;
  }
  async deliveryHistory(tenant: Tenant) {
    assertPermission(undefined, 'delivery_history.view');
    return (await this.database.db.select().from(communicationDeliveries).where(eq(communicationDeliveries.workspaceId, tenant.workspaceId))).map((r) => dto(tenant, r));
  }
  async retryDelivery(tenant: Tenant, id: string, actor?: Actor) {
    assertPermission(actor, 'communication.send');
    const delivery = await this.getPayload<JsonRecord>(tenant, communicationDeliveries, communicationDeliveries.id, id, 'Delivery');
    const attempts = (Number(delivery.attemptNumber) || 1) + 1;
    const currentStatus = String(delivery.status);

    if (currentStatus === 'delivered' || currentStatus === 'sent') return delivery;

    const updated = this.withTenant<JsonRecord>(tenant, {
      ...delivery,
      attemptNumber: attempts,
      status: delivery.channel === 'in_app' || delivery.channel === 'email' ? 'sent' : 'queued',
      sentAt: now(),
      retriedAt: now(),
      safeErrorCode: undefined,
      safeErrorMessage: undefined,
      updatedAt: now(),
    });

    await this.database.db.update(communicationDeliveries).set({
      status: String(updated.status),
      attemptNumber: attempts,
      safeErrorCode: null,
      safeErrorMessage: null,
      payload: updated,
      updatedAt: new Date(),
    }).where(and(eq(communicationDeliveries.workspaceId, tenant.workspaceId), eq(communicationDeliveries.id, id)));

    return updated;
  }

  /* ─────────────────── Preferences ─────────────────── */

  async getPreferences(tenant: Tenant, recipient: { kind: string; id: string }) {
    const row = (await this.database.db.select().from(notificationPreferences).where(and(eq(notificationPreferences.workspaceId, tenant.workspaceId), eq(notificationPreferences.recipientKind, recipient.kind), eq(notificationPreferences.recipientId, recipient.id))).limit(1))[0];
    if (row) return dto<JsonRecord>(tenant, row);
    return {
      organizationId: tenant.organizationId,
      recipientKind: recipient.kind,
      recipientId: recipient.id,
      inAppEnabled: true,
      emailEnabled: true,
      smsEnabled: false,
      academicEnabled: true,
      financeEnabled: true,
      generalEnabled: true,
      examEnabled: true,
      attendanceEnabled: true,
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
    };
  }

  async savePreference(tenant: Tenant, data: JsonRecord, actor?: Actor) {
    assertPermission(actor, 'notification.manage');
    const current = data.id ? (await this.database.db.select().from(notificationPreferences).where(and(eq(notificationPreferences.workspaceId, tenant.workspaceId), eq(notificationPreferences.id, String(data.id)))).limit(1))[0] : undefined;
    const record = this.withTenant<JsonRecord>(tenant, { ...(current ? payloadOf(current.payload) : {}), ...data, id: current?.id ?? uuid(), createdAt: current ? (current.payload as JsonRecord).createdAt : now(), updatedAt: now() });
    if (current) await this.database.db.update(notificationPreferences).set({ recipientKind: String(record.recipientKind), recipientId: String(record.recipientId), payload: record, updatedAt: new Date() }).where(and(eq(notificationPreferences.workspaceId, tenant.workspaceId), eq(notificationPreferences.id, current.id)));
    else await this.database.db.insert(notificationPreferences).values({ id: String(record.id), workspaceId: tenant.workspaceId, recipientKind: String(record.recipientKind), recipientId: String(record.recipientId), payload: record }).catch(dbError);
    return record;
  }

  /* ─────────────────── Domain SIS Event Notifications ─────────────────── */

  async emitDomainNotification(tenant: Tenant, eventType: string, audience: JsonRecord, payload: JsonRecord) {
    const recipients = await this.resolveAudience(tenant, audience);
    const out: JsonRecord[] = [];
    for (const r of recipients) {
      out.push(await this.createNotification(tenant, {
        recipientKind: r.kind,
        recipientId: r.id,
        recipientUserId: r.userId,
        type: eventType,
        title: payload.title,
        message: payload.message,
        priority: payload.priority ?? 'normal',
        relatedResourceType: payload.relatedResourceType,
        relatedResourceId: payload.relatedResourceId,
        actionPath: payload.actionPath,
      }));
    }
    return out;
  }

  /* ─────────────────── Dashboard Summary ─────────────────── */

  async summary(tenant: Tenant) {
    const [ann, msg, del, not] = await Promise.all([
      this.listAnnouncements(tenant),
      this.listMessages(tenant),
      this.deliveryHistory(tenant),
      this.listNotifications(tenant),
    ]);

    const today = new Date().toISOString().split('T')[0];
    const messagesToday = msg.filter((m) => String(m.createdAt || '').startsWith(today)).length;
    const channelBreakdown = {
      in_app: del.filter((d) => d.channel === 'in_app').length,
      email: del.filter((d) => d.channel === 'email').length,
      sms: del.filter((d) => d.channel === 'sms').length,
    };

    const sortedDeliveries = [...del].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

    return {
      totalAnnouncements: ann.length,
      publishedAnnouncements: ann.filter((a) => a.status === 'published').length,
      scheduledAnnouncements: ann.filter((a) => a.status === 'scheduled').length,
      draftAnnouncements: ann.filter((a) => a.status === 'draft').length,
      totalMessages: msg.length,
      communicationsSent: msg.filter((m) => m.status === 'sent').length,
      messagesSentToday: messagesToday,
      scheduledMessages: msg.filter((m) => m.status === 'scheduled').length,
      draftMessages: msg.filter((m) => m.status === 'draft').length,
      deliveredMessages: del.filter((d) => d.status === 'delivered' || d.status === 'sent').length,
      pendingDeliveries: del.filter((d) => d.status === 'pending' || d.status === 'queued').length,
      failedDeliveries: del.filter((d) => d.status === 'failed').length,
      unreadNotifications: not.filter((n) => !n.isRead).length,
      channelBreakdown,
      recentActivity: sortedDeliveries.slice(0, 8),
      failedQueue: del.filter((d) => d.status === 'failed'),
    };
  }

  private async dispatchAnnouncement(tenant: Tenant, announcement: JsonRecord, recipients: Recipient[]) {
    for (const recipient of recipients) {
      const notification = await this.createNotification(tenant, {
        recipientKind: recipient.kind,
        recipientId: recipient.id,
        recipientUserId: recipient.userId,
        type: 'announcement.published',
        title: announcement.title,
        message: announcement.content,
        priority: announcement.priority,
        relatedResourceType: 'announcement',
        relatedResourceId: announcement.id,
        actionPath: '/workspace/education/communication',
      });
      await this.recordDelivery(tenant, {
        announcementId: announcement.id,
        notificationId: notification.id,
        recipientId: recipient.id,
        recipientKind: recipient.kind,
        channel: 'in_app',
        status: 'sent',
      });
    }
  }

  private withTenant<T extends JsonRecord>(tenant: Tenant, data: T): T & { organizationId: string } {
    return { ...clean(data), organizationId: tenant.organizationId } as unknown as T & { organizationId: string };
  }

  private async getPayload<T extends JsonRecord>(tenant: Tenant, table: { payload: unknown; workspaceId: unknown }, idCol: unknown, id: string, label: string): Promise<T> {
    const row = (await this.database.db.select().from(table as never).where(and(eq(table.workspaceId as never, tenant.workspaceId), eq(idCol as never, id))).limit(1))[0] as { payload: T } | undefined;
    if (!row) throw new ApiError(404, 'NOT_FOUND', `${label} not found.`);
    return { ...payloadOf(row.payload), organizationId: tenant.organizationId } as unknown as T;
  }
}
