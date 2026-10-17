import { jsonBody, sisRequest } from "./sis-api";
import type {
  Announcement,
  CommunicationAudience,
  CommunicationChannel,
  CommunicationMessage,
  CommunicationPriority,
  CommunicationSummary,
  CommunicationTemplate,
  DeliveryAttempt,
  DirectMessageContact,
  DirectMessageConversation,
  DirectMessageItem,
  NotificationPreference,
  RecipientKind,
  ResolvedRecipient,
  SisNotification,
} from "./sis.types";

type ActorRole = "Owner" | "Admin" | "Member" | "Teacher" | "Accountant" | "Parent" | "guardian" | "student" | "Student";
interface ActorContext { userId: string; role: ActorRole; staffId?: string }
interface SendCommunicationInput { subject: string; body: string; senderId: string; audience: CommunicationAudience; channels: CommunicationChannel[]; priority: CommunicationPriority; scheduledAt?: string; templateId?: string; variables?: Record<string, string>; idempotencyKey?: string }
function withActor<T>(data: T, actor?: ActorContext): T & { actor?: ActorContext } { return (actor ? { ...data, actor } : data) as T & { actor?: ActorContext }; }

export class CommunicationServiceClass {
  async resolveAudience(organizationId: string, audience: CommunicationAudience, actor?: ActorContext): Promise<ResolvedRecipient[]> {
    return (await sisRequest<{ recipients: ResolvedRecipient[] }>(organizationId, "/communication/audience/resolve", { method: "POST", ...jsonBody({ audience, actor }) })).recipients;
  }

  renderTemplate(template: CommunicationTemplate, variables: Record<string, string>): { subject: string; content: string } {
    const allowed = new Set([
      "student_name",
      "parent_name",
      "guardian_name",
      "school_name",
      "campus_name",
      "class_name",
      "section_name",
      "invoice_number",
      "due_date",
      "amount_due",
      "amount",
      "event_date",
      "exam_name",
      "staff_name",
    ]);
    const supported = new Set(template.supportedVariables);
    const render = (value: string) => value.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
      if (!allowed.has(key) || (!supported.has(key) && supported.size > 0)) {
        throw new Error(`Unsupported template variable: ${key}`);
      }
      return variables[key] ?? (key === "parent_name" ? variables["guardian_name"] : key === "amount_due" ? variables["amount"] : "");
    });
    return { subject: render(template.subject), content: render(template.content) };
  }

  async createTemplate(organizationId: string, data: Omit<CommunicationTemplate, "id" | "organizationId" | "createdAt" | "updatedAt">, actor?: ActorContext): Promise<CommunicationTemplate> {
    return (await sisRequest<{ template: CommunicationTemplate }>(organizationId, "/communication/templates", { method: "POST", ...jsonBody(withActor(data, actor)) })).template;
  }
  async getTemplate(organizationId: string, id: string): Promise<CommunicationTemplate> {
    return (await sisRequest<{ template: CommunicationTemplate }>(organizationId, `/communication/templates/${id}`)).template;
  }
  async updateTemplate(organizationId: string, id: string, updates: Partial<CommunicationTemplate>, actor?: ActorContext): Promise<CommunicationTemplate> {
    return (await sisRequest<{ template: CommunicationTemplate }>(organizationId, `/communication/templates/${id}`, { method: "PATCH", ...jsonBody(withActor(updates, actor)) })).template;
  }
  async deleteTemplate(organizationId: string, id: string, actor?: ActorContext): Promise<{ success: boolean }> {
    return sisRequest<{ success: boolean }>(organizationId, `/communication/templates/${id}`, { method: "DELETE", ...jsonBody(withActor({}, actor)) });
  }
  async getTemplates(organizationId: string): Promise<CommunicationTemplate[]> {
    return (await sisRequest<{ templates: CommunicationTemplate[] }>(organizationId, "/communication/templates")).templates;
  }

  async createAnnouncement(organizationId: string, data: Omit<Announcement, "id" | "organizationId" | "recipientCount" | "createdAt" | "updatedAt" | "publishedAt">, actor?: ActorContext): Promise<Announcement> {
    return (await sisRequest<{ announcement: Announcement }>(organizationId, "/communication/announcements", { method: "POST", ...jsonBody(withActor(data, actor)) })).announcement;
  }
  async getAnnouncement(organizationId: string, id: string): Promise<Announcement> {
    return (await sisRequest<{ announcement: Announcement }>(organizationId, `/communication/announcements/${id}`)).announcement;
  }
  async updateAnnouncement(organizationId: string, id: string, updates: Partial<Announcement>, actor?: ActorContext): Promise<Announcement> {
    return (await sisRequest<{ announcement: Announcement }>(organizationId, `/communication/announcements/${id}`, { method: "PATCH", ...jsonBody(withActor(updates, actor)) })).announcement;
  }
  async deleteAnnouncement(organizationId: string, id: string, actor?: ActorContext): Promise<{ success: boolean }> {
    return sisRequest<{ success: boolean }>(organizationId, `/communication/announcements/${id}`, { method: "DELETE", ...jsonBody(withActor({}, actor)) });
  }
  async publishAnnouncement(organizationId: string, id: string, actor?: ActorContext): Promise<Announcement> {
    return (await sisRequest<{ announcement: Announcement }>(organizationId, `/communication/announcements/${id}/publish`, { method: "POST", ...jsonBody({ actor }) })).announcement;
  }
  async archiveAnnouncement(organizationId: string, id: string, actor?: ActorContext): Promise<Announcement> {
    return (await sisRequest<{ announcement: Announcement }>(organizationId, `/communication/announcements/${id}/archive`, { method: "POST", ...jsonBody({ actor }) })).announcement;
  }
  async getAnnouncements(organizationId: string, filters?: { status?: string; category?: string; priority?: string; campusId?: string; search?: string; recipientKind?: string; recipientId?: string; gradeId?: string; sectionId?: string }): Promise<Announcement[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.category) params.set("category", filters.category);
    if (filters?.priority) params.set("priority", filters.priority);
    if (filters?.campusId) params.set("campusId", filters.campusId);
    if (filters?.search) params.set("search", filters.search);
    if (filters?.recipientKind) params.set("recipientKind", filters.recipientKind);
    if (filters?.recipientId) params.set("recipientId", filters.recipientId);
    if (filters?.gradeId) params.set("gradeId", filters.gradeId);
    if (filters?.sectionId) params.set("sectionId", filters.sectionId);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return (await sisRequest<{ announcements: Announcement[] }>(organizationId, `/communication/announcements${qs}`)).announcements;
  }

  async sendCommunication(organizationId: string, input: SendCommunicationInput, actor?: ActorContext): Promise<CommunicationMessage> {
    return (await sisRequest<{ message: CommunicationMessage }>(organizationId, "/communication/messages", { method: "POST", ...jsonBody(withActor(input, actor)) })).message;
  }
  async getCommunications(organizationId: string): Promise<CommunicationMessage[]> {
    return (await sisRequest<{ messages: CommunicationMessage[] }>(organizationId, "/communication/messages")).messages;
  }

  /* ─────────────────── Direct Messaging ─────────────────── */

  async getDirectMessageContacts(organizationId: string, actor?: ActorContext): Promise<DirectMessageContact[]> {
    return (await sisRequest<{ contacts: DirectMessageContact[] }>(organizationId, "/communication/contacts", { method: "GET" })).contacts;
  }
  async getConversations(organizationId: string, actor?: ActorContext): Promise<DirectMessageConversation[]> {
    return (await sisRequest<{ conversations: DirectMessageConversation[] }>(organizationId, "/communication/conversations", { method: "GET" })).conversations;
  }
  async getConversationMessages(organizationId: string, conversationId: string, actor?: ActorContext): Promise<DirectMessageItem[]> {
    return (await sisRequest<{ messages: DirectMessageItem[] }>(organizationId, `/communication/conversations/${conversationId}/messages`, { method: "GET" })).messages;
  }
  async sendDirectMessage(organizationId: string, input: { recipientUserId: string; subject?: string; body: string; conversationId?: string; attachments?: unknown[] }, actor?: ActorContext): Promise<DirectMessageItem> {
    return (await sisRequest<{ message: DirectMessageItem }>(organizationId, "/communication/conversations", { method: "POST", ...jsonBody(withActor(input, actor)) })).message;
  }
  async replyToConversation(organizationId: string, conversationId: string, bodyText: string, actor?: ActorContext): Promise<DirectMessageItem> {
    return (await sisRequest<{ message: DirectMessageItem }>(organizationId, `/communication/conversations/${conversationId}/reply`, { method: "POST", ...jsonBody(withActor({ body: bodyText }, actor)) })).message;
  }
  async archiveConversation(organizationId: string, conversationId: string, actor?: ActorContext): Promise<{ success: boolean }> {
    return sisRequest<{ success: boolean }>(organizationId, `/communication/conversations/${conversationId}/archive`, { method: "POST", ...jsonBody(withActor({}, actor)) });
  }

  /* ─────────────────── Notifications ─────────────────── */

  async createNotification(organizationId: string, data: Omit<SisNotification, "id" | "organizationId" | "isRead" | "createdAt" | "readAt">): Promise<SisNotification> {
    return (await sisRequest<{ notification: SisNotification }>(organizationId, "/communication/notifications", { method: "POST", ...jsonBody(data) })).notification;
  }
  async getNotification(organizationId: string, id: string, recipient?: { kind: RecipientKind; id: string }): Promise<SisNotification> {
    const qs = recipient ? `?kind=${encodeURIComponent(recipient.kind)}&id=${encodeURIComponent(recipient.id)}` : "";
    return (await sisRequest<{ notification: SisNotification }>(organizationId, `/communication/notifications/${id}${qs}`)).notification;
  }
  async getNotifications(organizationId: string, recipient?: { kind: RecipientKind; id: string }): Promise<SisNotification[]> {
    const qs = recipient ? `?kind=${encodeURIComponent(recipient.kind)}&id=${encodeURIComponent(recipient.id)}` : "";
    return (await sisRequest<{ notifications: SisNotification[] }>(organizationId, `/communication/notifications${qs}`)).notifications;
  }
  async getUnreadCount(organizationId: string, recipient: { kind: RecipientKind; id: string }): Promise<number> {
    return (await this.getNotifications(organizationId, recipient)).filter((notification) => !notification.isRead).length;
  }
  async markNotificationRead(organizationId: string, id: string, recipient?: { kind: RecipientKind; id: string }): Promise<SisNotification> {
    return (await sisRequest<{ notification: SisNotification }>(organizationId, `/communication/notifications/${id}/read`, { method: "POST", ...jsonBody({ recipient }) })).notification;
  }
  async markAllNotificationsRead(organizationId: string, recipient: { kind: RecipientKind; id: string }): Promise<number> {
    return (await sisRequest<{ count: number }>(organizationId, "/communication/notifications/read-all", { method: "POST", ...jsonBody({ recipient }) })).count;
  }

  /* ─────────────────── Deliveries & Retries ─────────────────── */

  async getDeliveryHistory(organizationId: string): Promise<DeliveryAttempt[]> {
    return (await sisRequest<{ deliveries: DeliveryAttempt[] }>(organizationId, "/communication/deliveries")).deliveries;
  }
  async retryDelivery(organizationId: string, deliveryId: string, actor?: ActorContext): Promise<DeliveryAttempt> {
    return (await sisRequest<{ delivery: DeliveryAttempt }>(organizationId, `/communication/deliveries/${deliveryId}/retry`, { method: "POST", ...jsonBody({ actor }) })).delivery;
  }

  /* ─────────────────── Preferences ─────────────────── */

  async getPreferences(organizationId: string, recipient?: { kind: string; id: string }): Promise<NotificationPreference> {
    const qs = recipient ? `?kind=${encodeURIComponent(recipient.kind)}&id=${encodeURIComponent(recipient.id)}` : "";
    return (await sisRequest<{ preference: NotificationPreference }>(organizationId, `/communication/preferences${qs}`)).preference;
  }
  async savePreference(organizationId: string, data: Partial<NotificationPreference>, actor?: ActorContext): Promise<NotificationPreference> {
    return (await sisRequest<{ preference: NotificationPreference }>(organizationId, "/communication/preferences", { method: "POST", ...jsonBody(withActor(data, actor)) })).preference;
  }

  /* ─────────────────── Domain SIS Event Notifications ─────────────────── */

  async emitDomainNotification(organizationId: string, eventType: string, audience: CommunicationAudience, payload: { title: string; message: string; priority?: CommunicationPriority; relatedResourceType?: string; relatedResourceId?: string; actionPath?: string }): Promise<SisNotification[]> {
    return (await sisRequest<{ notifications: SisNotification[] }>(organizationId, "/communication/domain-notifications", { method: "POST", ...jsonBody({ eventType, audience, payload }) })).notifications;
  }
  async getSummary(organizationId: string): Promise<CommunicationSummary> {
    return (await sisRequest<{ summary: CommunicationSummary }>(organizationId, "/communication/summary")).summary;
  }
}

export const CommunicationService = new CommunicationServiceClass();
