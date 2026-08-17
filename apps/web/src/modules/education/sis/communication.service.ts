import { workspaceService } from "@/workspace/workspace-service";
import { EnrollmentService } from "./enrollment.service";
import { StaffService } from "./staff.service";
import { StudentService } from "./student.service";
import { TeachingAssignmentService } from "./teaching-assignment.service";
import type {
  Announcement,
  CommunicationAudience,
  CommunicationChannel,
  CommunicationMessage,
  CommunicationPriority,
  CommunicationStatus,
  CommunicationSummary,
  CommunicationTemplate,
  DeliveryAttempt,
  NotificationPreference,
  RecipientKind,
  ResolvedRecipient,
  SisNotification,
  Staff,
  Student,
  StudentGuardian,
} from "./sis.types";

const ANNOUNCEMENTS_KEY = "haza-aios.sis.communication.announcements";
const COMMUNICATIONS_KEY = "haza-aios.sis.communication.messages";
const NOTIFICATIONS_KEY = "haza-aios.sis.communication.notifications";
const TEMPLATES_KEY = "haza-aios.sis.communication.templates";
const DELIVERIES_KEY = "haza-aios.sis.communication.deliveries";
const PREFERENCES_KEY = "haza-aios.sis.communication.preferences";

type ActorRole = "Owner" | "Admin" | "Member" | "Teacher" | "Accountant";
type CommunicationPermission =
  | "communication.view"
  | "communication.send"
  | "communication.manage"
  | "announcement.view"
  | "announcement.create"
  | "announcement.update"
  | "announcement.publish"
  | "notification.view"
  | "notification.manage"
  | "template.view"
  | "template.manage"
  | "delivery_history.view";

interface ActorContext {
  userId: string;
  role: ActorRole;
  staffId?: string;
}

interface SendCommunicationInput {
  subject: string;
  body: string;
  senderId: string;
  audience: CommunicationAudience;
  channels: CommunicationChannel[];
  priority: CommunicationPriority;
  scheduledAt?: string;
  templateId?: string;
  variables?: Record<string, string>;
  idempotencyKey?: string;
}

const managerRoles = new Set<ActorRole>(["Owner", "Admin"]);
const allowedTemplateVariables = new Set([
  "student_name",
  "guardian_name",
  "class_name",
  "section_name",
  "exam_name",
  "due_date",
  "amount",
  "school_name",
  "staff_name",
]);

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

function defaultActor(): ActorContext {
  return { userId: "system", role: "Owner" };
}

function assertPermission(actor: ActorContext | undefined, permission: CommunicationPermission): ActorContext {
  const activeActor = actor || defaultActor();
  if (managerRoles.has(activeActor.role)) return activeActor;
  if (activeActor.role === "Teacher" && ["communication.view", "communication.send", "announcement.view", "notification.view", "template.view", "delivery_history.view"].includes(permission)) {
    return activeActor;
  }
  throw new Error(`Unauthorized: missing permission ${permission}`);
}

function assertText(value: string, label: string): void {
  if (!value.trim()) throw new Error(`${label} is required.`);
}

function uniqueRecipients(recipients: ResolvedRecipient[]): ResolvedRecipient[] {
  const seen = new Set<string>();
  const deduped: ResolvedRecipient[] = [];
  for (const recipient of recipients) {
    const key = `${recipient.kind}:${recipient.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(recipient);
    }
  }
  return deduped;
}

function studentName(student: Student): string {
  return `${student.firstName} ${student.lastName}`.trim();
}

function guardianName(guardian: StudentGuardian): string {
  return `${guardian.firstName} ${guardian.lastName}`.trim();
}

function staffName(staff: Staff): string {
  return `${staff.firstName} ${staff.lastName}`.trim();
}

export class CommunicationServiceClass {
  private getAnnouncementsDb(): Announcement[] {
    return readCollection<Announcement>(ANNOUNCEMENTS_KEY);
  }

  private saveAnnouncementsDb(announcements: Announcement[]): void {
    writeCollection(ANNOUNCEMENTS_KEY, announcements);
  }

  private getCommunicationsDb(): CommunicationMessage[] {
    return readCollection<CommunicationMessage>(COMMUNICATIONS_KEY);
  }

  private saveCommunicationsDb(messages: CommunicationMessage[]): void {
    writeCollection(COMMUNICATIONS_KEY, messages);
  }

  private getNotificationsDb(): SisNotification[] {
    return readCollection<SisNotification>(NOTIFICATIONS_KEY);
  }

  private saveNotificationsDb(notifications: SisNotification[]): void {
    writeCollection(NOTIFICATIONS_KEY, notifications);
  }

  private getTemplatesDb(): CommunicationTemplate[] {
    return readCollection<CommunicationTemplate>(TEMPLATES_KEY);
  }

  private saveTemplatesDb(templates: CommunicationTemplate[]): void {
    writeCollection(TEMPLATES_KEY, templates);
  }

  private getDeliveriesDb(): DeliveryAttempt[] {
    return readCollection<DeliveryAttempt>(DELIVERIES_KEY);
  }

  private saveDeliveriesDb(deliveries: DeliveryAttempt[]): void {
    writeCollection(DELIVERIES_KEY, deliveries);
  }

  private getPreferencesDb(): NotificationPreference[] {
    return readCollection<NotificationPreference>(PREFERENCES_KEY);
  }

  private savePreferencesDb(preferences: NotificationPreference[]): void {
    writeCollection(PREFERENCES_KEY, preferences);
  }

  private async audit(organizationId: string, action: string, details: string): Promise<void> {
    await workspaceService.addActivityLog(organizationId, {
      action,
      actor: "System Operator",
      details,
    });
  }

  async resolveAudience(organizationId: string, audience: CommunicationAudience, actor?: ActorContext): Promise<ResolvedRecipient[]> {
    const activeActor = actor || defaultActor();
    const [students, staff] = await Promise.all([
      StudentService.getStudents(organizationId),
      StaffService.getStaffList(organizationId),
    ]);
    let selectedStudents: Student[] = [];
    let selectedStaff: Staff[] = [];
    let recipients: ResolvedRecipient[] = [];

    if (audience.type === "organization") {
      selectedStudents = students.filter((student) => student.status === "active");
      selectedStaff = staff.filter((member) => member.status === "active");
    } else if (audience.type === "all_students" || audience.type === "all_guardians") {
      selectedStudents = students.filter((student) => student.status === "active");
    } else if (audience.type === "all_staff") {
      selectedStaff = staff.filter((member) => member.status === "active");
    } else if (audience.type === "all_teachers") {
      selectedStaff = staff.filter((member) => member.status === "active" && member.staffType === "teacher");
    } else if (audience.type === "class" || audience.type === "section") {
      if (!audience.academicYear || !audience.gradeId) throw new Error("Class audience requires academic year and class.");
      if (audience.type === "section" && !audience.sectionId) throw new Error("Section audience requires a section.");
      const enrollments = await EnrollmentService.getEnrollments(organizationId, {
        academicYear: audience.academicYear,
        gradeId: audience.gradeId,
        sectionId: audience.sectionId,
        status: "active",
      });
      selectedStudents = students.filter((student) => enrollments.some((enrollment) => enrollment.studentId === student.id));
      if (activeActor.role === "Teacher" && activeActor.staffId) {
        const teacherAssignments = audience.sectionId
          ? await TeachingAssignmentService.getAssignmentsByClass(audience.academicYear, audience.gradeId, audience.sectionId, organizationId)
          : await TeachingAssignmentService.getAssignmentsByStaff(activeActor.staffId, organizationId);
        const allowed = teacherAssignments.some((assignment) => assignment.staffId === activeActor.staffId && assignment.gradeId === audience.gradeId && (!audience.sectionId || assignment.sectionId === audience.sectionId) && assignment.isActive);
        if (!allowed) throw new Error("Teacher is not authorized for this academic communication scope.");
      }
    } else if (audience.type === "selected_students") {
      selectedStudents = students.filter((student) => audience.studentIds?.includes(student.id));
      if (new Set(audience.studentIds || []).size !== selectedStudents.length) throw new Error("One or more selected students are invalid.");
    } else if (audience.type === "selected_guardians") {
      selectedStudents = students.filter((student) => student.guardians.some((guardian) => audience.guardianIds?.includes(guardian.id)));
    } else if (audience.type === "selected_staff") {
      selectedStaff = staff.filter((member) => audience.staffIds?.includes(member.id));
      if (new Set(audience.staffIds || []).size !== selectedStaff.length) throw new Error("One or more selected staff recipients are invalid.");
    } else if (audience.type === "selected_users") {
      const members = await workspaceService.getMembers(organizationId);
      recipients = members
        .filter((member) => audience.userIds?.includes(member.userId))
        .map((member) => ({
          id: member.userId,
          organizationId,
          kind: "user",
          displayName: member.name,
          email: member.email,
          userId: member.userId,
        }));
      if (new Set(audience.userIds || []).size !== recipients.length) throw new Error("One or more selected users are invalid.");
    }

    if (["organization", "all_students", "class", "section", "selected_students"].includes(audience.type)) {
      recipients.push(...selectedStudents.map((student) => ({
        id: student.id,
        organizationId,
        kind: "student" as RecipientKind,
        displayName: studentName(student),
        email: student.email,
        phone: student.phone,
        studentId: student.id,
      })));
    }
    if (["organization", "all_guardians", "class", "section", "selected_guardians"].includes(audience.type)) {
      for (const student of selectedStudents) {
        for (const guardian of student.guardians) {
          if (audience.type === "selected_guardians" && !audience.guardianIds?.includes(guardian.id)) continue;
          recipients.push({
            id: guardian.id,
            organizationId,
            kind: "guardian",
            displayName: guardianName(guardian),
            email: guardian.email,
            phone: guardian.phone,
            studentId: student.id,
            guardianId: guardian.id,
          });
        }
      }
    }
    recipients.push(...selectedStaff.map((member) => ({
      id: member.id,
      organizationId,
      kind: member.staffType === "teacher" ? "teacher" as RecipientKind : "staff" as RecipientKind,
      displayName: staffName(member),
      email: member.email,
      phone: member.phone,
      userId: member.userId,
      staffId: member.id,
    })));

    return uniqueRecipients(recipients);
  }

  renderTemplate(template: CommunicationTemplate, variables: Record<string, string>): { subject: string; content: string } {
    const render = (value: string) => value.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
      if (!allowedTemplateVariables.has(key) || !template.supportedVariables.includes(key)) {
        throw new Error(`Unsupported template variable: ${key}`);
      }
      return variables[key] || "";
    });
    return { subject: render(template.subject), content: render(template.content) };
  }

  async createTemplate(
    organizationId: string,
    data: Omit<CommunicationTemplate, "id" | "organizationId" | "createdAt" | "updatedAt">,
    actor?: ActorContext,
  ): Promise<CommunicationTemplate> {
    assertPermission(actor, "template.manage");
    assertText(data.name, "Template name");
    for (const variable of data.supportedVariables) {
      if (!allowedTemplateVariables.has(variable)) throw new Error(`Unsupported template variable: ${variable}`);
    }
    const now = new Date().toISOString();
    const template: CommunicationTemplate = {
      ...data,
      id: createId("comm-template"),
      organizationId,
      createdAt: now,
      updatedAt: now,
    };
    const templates = this.getTemplatesDb();
    templates.push(template);
    this.saveTemplatesDb(templates);
    await this.audit(organizationId, "Communication Template Created", `Created template ${template.name}.`);
    return template;
  }

  async updateTemplate(organizationId: string, id: string, updates: Partial<CommunicationTemplate>, actor?: ActorContext): Promise<CommunicationTemplate> {
    assertPermission(actor, "template.manage");
    const templates = this.getTemplatesDb();
    const index = templates.findIndex((template) => template.id === id && template.organizationId === organizationId);
    if (index === -1) throw new Error("Template not found.");
    templates[index] = { ...templates[index], ...updates, organizationId, updatedAt: new Date().toISOString() };
    this.saveTemplatesDb(templates);
    await this.audit(organizationId, "Communication Template Updated", `Updated template ${templates[index].name}.`);
    return templates[index];
  }

  async getTemplates(organizationId: string): Promise<CommunicationTemplate[]> {
    assertPermission(undefined, "template.view");
    return this.getTemplatesDb().filter((template) => template.organizationId === organizationId);
  }

  async createAnnouncement(
    organizationId: string,
    data: Omit<Announcement, "id" | "organizationId" | "recipientCount" | "createdAt" | "updatedAt" | "publishedAt">,
    actor?: ActorContext,
  ): Promise<Announcement> {
    assertPermission(actor, "announcement.create");
    assertText(data.title, "Announcement title");
    assertText(data.content, "Announcement content");
    const recipients = await this.resolveAudience(organizationId, data.audience, actor);
    const now = new Date().toISOString();
    const announcement: Announcement = {
      ...data,
      id: createId("announcement"),
      organizationId,
      recipientCount: recipients.length,
      createdAt: now,
      updatedAt: now,
      publishedAt: data.status === "published" ? now : undefined,
    };
    const announcements = this.getAnnouncementsDb();
    announcements.push(announcement);
    this.saveAnnouncementsDb(announcements);
    await this.audit(organizationId, "Announcement Created", `Created announcement ${announcement.title}.`);
    if (announcement.status === "published") {
      await this.dispatchAnnouncement(announcement, recipients);
    }
    return announcement;
  }

  async publishAnnouncement(organizationId: string, id: string, actor?: ActorContext): Promise<Announcement> {
    assertPermission(actor, "announcement.publish");
    const announcements = this.getAnnouncementsDb();
    const index = announcements.findIndex((announcement) => announcement.id === id && announcement.organizationId === organizationId);
    if (index === -1) throw new Error("Announcement not found.");
    if (announcements[index].status === "published") return announcements[index];
    const recipients = await this.resolveAudience(organizationId, announcements[index].audience, actor);
    announcements[index] = {
      ...announcements[index],
      status: "published",
      recipientCount: recipients.length,
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.saveAnnouncementsDb(announcements);
    await this.dispatchAnnouncement(announcements[index], recipients);
    await this.audit(organizationId, "Announcement Published", `Published announcement ${announcements[index].title}.`);
    return announcements[index];
  }

  async archiveAnnouncement(organizationId: string, id: string, actor?: ActorContext): Promise<Announcement> {
    assertPermission(actor, "announcement.update");
    const announcements = this.getAnnouncementsDb();
    const index = announcements.findIndex((announcement) => announcement.id === id && announcement.organizationId === organizationId);
    if (index === -1) throw new Error("Announcement not found.");
    announcements[index] = { ...announcements[index], status: "archived", updatedAt: new Date().toISOString() };
    this.saveAnnouncementsDb(announcements);
    await this.audit(organizationId, "Announcement Archived", `Archived announcement ${announcements[index].title}.`);
    return announcements[index];
  }

  async getAnnouncements(organizationId: string): Promise<Announcement[]> {
    assertPermission(undefined, "announcement.view");
    return this.getAnnouncementsDb().filter((announcement) => announcement.organizationId === organizationId);
  }

  private async dispatchAnnouncement(announcement: Announcement, recipients: ResolvedRecipient[]): Promise<void> {
    for (const recipient of recipients) {
      const notification = await this.createNotification(announcement.organizationId, {
        recipientKind: recipient.kind,
        recipientId: recipient.id,
        recipientUserId: recipient.userId,
        type: "announcement.published",
        title: announcement.title,
        message: announcement.content,
        priority: announcement.priority,
        relatedResourceType: "announcement",
        relatedResourceId: announcement.id,
        actionPath: "/workspace/education/communication/announcements",
      });
      this.recordDelivery(announcement.organizationId, {
        announcementId: announcement.id,
        notificationId: notification.id,
        recipientId: recipient.id,
        recipientKind: recipient.kind,
        channel: "in_app",
        status: "sent",
      });
    }
  }

  async sendCommunication(organizationId: string, input: SendCommunicationInput, actor?: ActorContext): Promise<CommunicationMessage> {
    assertPermission(actor, "communication.send");
    assertText(input.subject, "Subject");
    assertText(input.body, "Message");
    if (input.channels.length === 0) throw new Error("At least one delivery channel is required.");
    const existing = input.idempotencyKey
      ? this.getCommunicationsDb().find((message) => message.organizationId === organizationId && message.idempotencyKey === input.idempotencyKey)
      : undefined;
    if (existing) return existing;

    let subject = input.subject;
    let body = input.body;
    if (input.templateId) {
      const template = this.getTemplatesDb().find((item) => item.id === input.templateId && item.organizationId === organizationId);
      if (!template) throw new Error("Template not found.");
      const rendered = this.renderTemplate(template, input.variables || {});
      subject = rendered.subject;
      body = rendered.content;
    }

    const recipients = await this.resolveAudience(organizationId, input.audience, actor);
    if (recipients.length === 0) throw new Error("No valid recipients resolved.");
    const now = new Date().toISOString();
    const status: CommunicationStatus = input.scheduledAt && input.scheduledAt > now ? "scheduled" : "sent";
    const message: CommunicationMessage = {
      id: createId("communication"),
      organizationId,
      subject,
      body,
      senderId: input.senderId,
      audience: input.audience,
      channels: input.channels,
      priority: input.priority,
      status,
      scheduledAt: input.scheduledAt,
      templateId: input.templateId,
      idempotencyKey: input.idempotencyKey,
      recipientCount: recipients.length,
      createdAt: now,
      updatedAt: now,
      sentAt: status === "sent" ? now : undefined,
    };
    const messages = this.getCommunicationsDb();
    messages.push(message);
    this.saveCommunicationsDb(messages);

    if (status === "sent") {
      for (const recipient of recipients) {
        for (const channel of input.channels) {
          if (channel === "in_app") {
            const notification = await this.createNotification(organizationId, {
              recipientKind: recipient.kind,
              recipientId: recipient.id,
              recipientUserId: recipient.userId,
              type: "communication.sent",
              title: subject,
              message: body,
              priority: input.priority,
              relatedResourceType: "communication",
              relatedResourceId: message.id,
              actionPath: "/workspace/education/communication/notifications",
            });
            this.recordDelivery(organizationId, { communicationId: message.id, notificationId: notification.id, recipientId: recipient.id, recipientKind: recipient.kind, channel, status: "sent" });
          } else {
            this.recordDelivery(organizationId, { communicationId: message.id, recipientId: recipient.id, recipientKind: recipient.kind, channel, status: "queued" });
          }
        }
      }
    }
    await this.audit(organizationId, "Communication Sent", `Sent communication ${message.subject} to ${message.recipientCount} recipient(s).`);
    return message;
  }

  async getCommunications(organizationId: string): Promise<CommunicationMessage[]> {
    assertPermission(undefined, "communication.view");
    return this.getCommunicationsDb().filter((message) => message.organizationId === organizationId);
  }

  async createNotification(
    organizationId: string,
    data: Omit<SisNotification, "id" | "organizationId" | "isRead" | "createdAt" | "readAt">,
  ): Promise<SisNotification> {
    const notification: SisNotification = {
      ...data,
      id: createId("notification"),
      organizationId,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    const notifications = this.getNotificationsDb();
    notifications.push(notification);
    this.saveNotificationsDb(notifications);
    return notification;
  }

  async getNotifications(organizationId: string, recipient?: { kind: RecipientKind; id: string }): Promise<SisNotification[]> {
    assertPermission(undefined, "notification.view");
    return this.getNotificationsDb().filter(
      (notification) =>
        notification.organizationId === organizationId &&
        (!recipient || (notification.recipientKind === recipient.kind && notification.recipientId === recipient.id)),
    );
  }

  async getUnreadCount(organizationId: string, recipient: { kind: RecipientKind; id: string }): Promise<number> {
    return (await this.getNotifications(organizationId, recipient)).filter((notification) => !notification.isRead).length;
  }

  async markNotificationRead(organizationId: string, id: string, recipient?: { kind: RecipientKind; id: string }): Promise<SisNotification> {
    const notifications = this.getNotificationsDb();
    const index = notifications.findIndex((notification) => notification.id === id && notification.organizationId === organizationId);
    if (index === -1) throw new Error("Notification not found.");
    if (recipient && (notifications[index].recipientKind !== recipient.kind || notifications[index].recipientId !== recipient.id)) {
      throw new Error("Notification does not belong to this recipient.");
    }
    notifications[index] = { ...notifications[index], isRead: true, readAt: new Date().toISOString() };
    this.saveNotificationsDb(notifications);
    return notifications[index];
  }

  async markAllNotificationsRead(organizationId: string, recipient: { kind: RecipientKind; id: string }): Promise<number> {
    const notifications = this.getNotificationsDb();
    let updated = 0;
    const next = notifications.map((notification) => {
      if (notification.organizationId === organizationId && notification.recipientKind === recipient.kind && notification.recipientId === recipient.id && !notification.isRead) {
        updated += 1;
        return { ...notification, isRead: true, readAt: new Date().toISOString() };
      }
      return notification;
    });
    this.saveNotificationsDb(next);
    return updated;
  }

  private recordDelivery(
    organizationId: string,
    data: Pick<DeliveryAttempt, "recipientId" | "recipientKind" | "channel" | "status"> & Partial<Pick<DeliveryAttempt, "communicationId" | "announcementId" | "notificationId" | "errorCategory">>,
  ): DeliveryAttempt {
    const now = new Date().toISOString();
    const delivery: DeliveryAttempt = {
      id: createId("delivery"),
      organizationId,
      communicationId: data.communicationId,
      announcementId: data.announcementId,
      notificationId: data.notificationId,
      recipientId: data.recipientId,
      recipientKind: data.recipientKind,
      channel: data.channel,
      status: data.status,
      queuedAt: now,
      sentAt: data.status === "sent" ? now : undefined,
      deliveredAt: data.status === "delivered" ? now : undefined,
      failedAt: data.status === "failed" ? now : undefined,
      errorCategory: data.errorCategory,
      retryCount: 0,
    };
    const deliveries = this.getDeliveriesDb();
    deliveries.push(delivery);
    this.saveDeliveriesDb(deliveries);
    return delivery;
  }

  async getDeliveryHistory(organizationId: string): Promise<DeliveryAttempt[]> {
    assertPermission(undefined, "delivery_history.view");
    return this.getDeliveriesDb().filter((delivery) => delivery.organizationId === organizationId);
  }

  async savePreference(
    organizationId: string,
    data: Omit<NotificationPreference, "id" | "organizationId" | "createdAt" | "updatedAt"> & Partial<Pick<NotificationPreference, "id">>,
    actor?: ActorContext,
  ): Promise<NotificationPreference> {
    assertPermission(actor, "notification.manage");
    const preferences = this.getPreferencesDb();
    const index = data.id ? preferences.findIndex((preference) => preference.id === data.id && preference.organizationId === organizationId) : -1;
    const now = new Date().toISOString();
    const preference: NotificationPreference = {
      ...data,
      id: data.id || createId("notification-preference"),
      organizationId,
      createdAt: index >= 0 ? preferences[index].createdAt : now,
      updatedAt: now,
    };
    if (index >= 0) preferences[index] = preference;
    else preferences.push(preference);
    this.savePreferencesDb(preferences);
    await this.audit(organizationId, "Notification Preference Updated", "Updated notification preferences.");
    return preference;
  }

  async emitDomainNotification(
    organizationId: string,
    eventType: string,
    audience: CommunicationAudience,
    payload: { title: string; message: string; priority?: CommunicationPriority; relatedResourceType?: string; relatedResourceId?: string; actionPath?: string },
  ): Promise<SisNotification[]> {
    const recipients = await this.resolveAudience(organizationId, audience);
    const notifications: SisNotification[] = [];
    for (const recipient of recipients) {
      notifications.push(await this.createNotification(organizationId, {
        recipientKind: recipient.kind,
        recipientId: recipient.id,
        recipientUserId: recipient.userId,
        type: eventType,
        title: payload.title,
        message: payload.message,
        priority: payload.priority || "normal",
        relatedResourceType: payload.relatedResourceType,
        relatedResourceId: payload.relatedResourceId,
        actionPath: payload.actionPath,
      }));
    }
    return notifications;
  }

  async getSummary(organizationId: string): Promise<CommunicationSummary> {
    const announcements = await this.getAnnouncements(organizationId);
    const communications = await this.getCommunications(organizationId);
    const deliveries = await this.getDeliveryHistory(organizationId);
    const notifications = await this.getNotifications(organizationId);
    return {
      publishedAnnouncements: announcements.filter((announcement) => announcement.status === "published").length,
      communicationsSent: communications.filter((message) => message.status === "sent").length,
      pendingDeliveries: deliveries.filter((delivery) => delivery.status === "pending" || delivery.status === "queued").length,
      failedDeliveries: deliveries.filter((delivery) => delivery.status === "failed").length,
      unreadNotifications: notifications.filter((notification) => !notification.isRead).length,
    };
  }
}

export const CommunicationService = new CommunicationServiceClass();
