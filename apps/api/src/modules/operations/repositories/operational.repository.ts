import { and, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  auditLogs,
  communicationDeliveries,
  domainEvents,
  notificationPreferences,
  operationalEvents,
  sisNotifications,
  workspaces,
} from "../../../database/schema.js";
import type { RepositoryContext } from "../../../database/repositories/repository-context.js";
import type {
  AuditQuery,
  CreateAuditInput,
  CreateDomainEventInput,
  CreateOperationalEventInput,
  CreateUserNotificationInput,
  EventQuery,
  JsonRecord,
  RecordDeliveryAttemptInput,
} from "../operational.types.js";

export class OperationalRepository {
  constructor(private readonly context: RepositoryContext) {}

  async createAudit(input: CreateAuditInput) {
    const id = randomUUID();
    await this.context.db.insert(auditLogs).values({
      id,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId ?? null,
      actorType: input.actorType ?? "user",
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      operation: input.operation,
      result: input.result ?? "success",
      source: input.source ?? "api",
      requestId: input.requestId ?? null,
      correlationId: input.correlationId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      beforeSnapshot: input.beforeSnapshot ?? null,
      afterSnapshot: input.afterSnapshot ?? null,
      changedFields: input.changedFields ?? null,
      metadata: input.metadata ?? {},
    });
    return this.getAudit(input.organizationId, id);
  }

  async getAudit(organizationId: string, id: string) {
    const rows = await this.context.db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.organizationId, organizationId), eq(auditLogs.id, id)))
      .limit(1);
    return rows[0] ? normalizeAudit(rows[0]) : null;
  }

  async listAudits(organizationId: string, query: AuditQuery) {
    const conditions = auditConditions(organizationId, query);
    const [items, totals] = await Promise.all([
      this.context.db
        .select()
        .from(auditLogs)
        .where(and(...conditions))
        .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
        .limit(query.limit)
        .offset(query.offset),
      this.context.db
        .select({ count: sql<number>`count(*)` })
        .from(auditLogs)
        .where(and(...conditions)),
    ]);
    return {
      items: items.map(normalizeAudit),
      total: Number(totals[0]?.count ?? 0),
      limit: query.limit,
      offset: query.offset,
    };
  }

  async createDomainEvent(input: CreateDomainEventInput) {
    if (input.idempotencyKey) {
      const existing = await this.context.db
        .select()
        .from(domainEvents)
        .where(
          and(
            eq(domainEvents.organizationId, input.organizationId),
            eq(domainEvents.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1);
      if (existing[0]) return normalizeDomainEvent(existing[0]);
    }
    const id = randomUUID();
    await this.context.db.insert(domainEvents).values({
      id,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId ?? null,
      eventType: input.eventType,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      actorUserId: input.actorUserId ?? null,
      schemaVersion: input.schemaVersion ?? 1,
      payload: input.payload ?? {},
      metadata: input.metadata ?? {},
      correlationId: input.correlationId ?? null,
      causationId: input.causationId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      occurredAt: input.occurredAt ?? new Date(),
    });
    const created = await this.context.db
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.id, id))
      .limit(1);
    return created[0] ? normalizeDomainEvent(created[0]) : undefined;
  }

  async listDomainEvents(organizationId: string, query: EventQuery) {
    const conditions = domainEventConditions(organizationId, query);
    const items = await this.context.db
      .select()
      .from(domainEvents)
      .where(and(...conditions))
      .orderBy(desc(domainEvents.occurredAt), desc(domainEvents.id))
      .limit(query.limit)
      .offset(query.offset);
    return { items: items.map(normalizeDomainEvent), limit: query.limit, offset: query.offset };
  }

  async createOperationalEvent(input: CreateOperationalEventInput) {
    const id = randomUUID();
    await this.context.db.insert(operationalEvents).values({
      id,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId ?? null,
      severity: input.severity ?? "info",
      component: input.component,
      eventType: input.eventType,
      status: input.status,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      workflowRunId: input.workflowRunId ?? null,
      agentRunId: input.agentRunId ?? null,
      correlationId: input.correlationId ?? null,
      summary: input.summary,
      safeErrorCode: input.safeErrorCode ?? null,
      safeErrorMessage: input.safeErrorMessage ?? null,
      metadata: input.metadata ?? {},
      occurredAt: input.occurredAt ?? new Date(),
    });
    const created = await this.context.db
      .select()
      .from(operationalEvents)
      .where(eq(operationalEvents.id, id))
      .limit(1);
    return created[0] ? normalizeOperationalEvent(created[0]) : undefined;
  }

  async listOperationalEvents(organizationId: string, query: EventQuery) {
    const conditions = operationalEventConditions(organizationId, query);
    const items = await this.context.db
      .select()
      .from(operationalEvents)
      .where(and(...conditions))
      .orderBy(desc(operationalEvents.occurredAt), desc(operationalEvents.id))
      .limit(query.limit)
      .offset(query.offset);
    return {
      items: items.map(normalizeOperationalEvent),
      limit: query.limit,
      offset: query.offset,
    };
  }

  async createUserNotification(input: CreateUserNotificationInput) {
    const id = randomUUID();
    const now = new Date();
    const payload = {
      id,
      recipientKind: "user",
      recipientId: input.recipientUserId,
      recipientUserId: input.recipientUserId,
      type: input.notificationType,
      title: input.title,
      message: input.message,
      priority: input.priority ?? "normal",
      relatedResourceType: input.relatedResourceType,
      relatedResourceId: input.relatedResourceId,
      actionPath: input.actionPath,
      isRead: false,
      createdAt: now.toISOString(),
    };
    await this.context.db.insert(sisNotifications).values({
      id,
      workspaceId: input.workspaceId,
      recipientKind: "user",
      recipientId: input.recipientUserId,
      recipientUserId: input.recipientUserId,
      notificationType: input.notificationType,
      sourceEventId: input.sourceEventId ?? null,
      expiresAt: input.expiresAt ?? null,
      isRead: false,
      payload,
    });
    return this.getNotificationForUser(input.organizationId, input.recipientUserId, id);
  }

  async listNotificationsForUser(
    organizationId: string,
    userId: string,
    query: { limit: number; offset: number; unreadOnly: boolean },
  ) {
    const conditions: SQL[] = [
      eq(workspaces.organizationId, organizationId),
      eq(sisNotifications.recipientUserId, userId),
    ];
    if (query.unreadOnly) conditions.push(eq(sisNotifications.isRead, false));
    const rows = await this.context.db
      .select({ notification: sisNotifications })
      .from(sisNotifications)
      .innerJoin(workspaces, eq(sisNotifications.workspaceId, workspaces.id))
      .where(and(...conditions))
      .orderBy(desc(sisNotifications.createdAt))
      .limit(query.limit)
      .offset(query.offset);
    return rows.map((row) => normalizeNotification(row.notification));
  }

  async getNotificationForUser(organizationId: string, userId: string, notificationId: string) {
    const rows = await this.context.db
      .select({ notification: sisNotifications })
      .from(sisNotifications)
      .innerJoin(workspaces, eq(sisNotifications.workspaceId, workspaces.id))
      .where(
        and(
          eq(workspaces.organizationId, organizationId),
          eq(sisNotifications.recipientUserId, userId),
          eq(sisNotifications.id, notificationId),
        ),
      )
      .limit(1);
    return rows[0]?.notification ? normalizeNotification(rows[0].notification) : null;
  }

  async markNotificationRead(workspaceId: string, userId: string, notificationId: string) {
    const now = new Date();
    await this.context.db
      .update(sisNotifications)
      .set({ isRead: true, readAt: now, updatedAt: now })
      .where(
        and(
          eq(sisNotifications.workspaceId, workspaceId),
          eq(sisNotifications.recipientUserId, userId),
          eq(sisNotifications.id, notificationId),
        ),
      );
  }

  async acknowledgeNotification(workspaceId: string, userId: string, notificationId: string) {
    const now = new Date();
    await this.context.db
      .update(sisNotifications)
      .set({ isRead: true, readAt: now, acknowledgedAt: now, updatedAt: now })
      .where(
        and(
          eq(sisNotifications.workspaceId, workspaceId),
          eq(sisNotifications.recipientUserId, userId),
          eq(sisNotifications.id, notificationId),
        ),
      );
  }

  async markAllNotificationsRead(organizationId: string, userId: string): Promise<number> {
    const rows = await this.context.db
      .select({ id: sisNotifications.id })
      .from(sisNotifications)
      .innerJoin(workspaces, eq(sisNotifications.workspaceId, workspaces.id))
      .where(
        and(
          eq(workspaces.organizationId, organizationId),
          eq(sisNotifications.recipientUserId, userId),
          eq(sisNotifications.isRead, false),
        ),
      );
    if (!rows.length) return 0;
    const now = new Date();
    await this.context.db
      .update(sisNotifications)
      .set({ isRead: true, readAt: now, updatedAt: now })
      .where(
        inArray(
          sisNotifications.id,
          rows.map((row) => row.id),
        ),
      );
    return rows.length;
  }

  async getUserPreference(organizationId: string, userId: string) {
    const rows = await this.context.db
      .select({ preference: notificationPreferences })
      .from(notificationPreferences)
      .innerJoin(workspaces, eq(notificationPreferences.workspaceId, workspaces.id))
      .where(
        and(
          eq(workspaces.organizationId, organizationId),
          eq(notificationPreferences.recipientKind, "user"),
          eq(notificationPreferences.recipientId, userId),
        ),
      )
      .limit(1);
    return rows[0]?.preference ? normalizePreference(rows[0].preference) : null;
  }

  async upsertUserPreference(workspaceId: string, userId: string, preferences: JsonRecord) {
    const existing = await this.context.db
      .select()
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.workspaceId, workspaceId),
          eq(notificationPreferences.recipientKind, "user"),
          eq(notificationPreferences.recipientId, userId),
        ),
      )
      .limit(1);
    const now = new Date();
    if (existing[0]) {
      await this.context.db
        .update(notificationPreferences)
        .set({ payload: preferences, updatedAt: now })
        .where(eq(notificationPreferences.id, existing[0].id));
      return normalizePreference({ ...existing[0], payload: preferences, updatedAt: now });
    }
    const record = {
      id: randomUUID(),
      workspaceId,
      recipientKind: "user",
      recipientId: userId,
      payload: preferences,
      createdAt: now,
      updatedAt: now,
    };
    await this.context.db.insert(notificationPreferences).values(record);
    return normalizePreference(record);
  }

  async recordDeliveryAttempt(input: RecordDeliveryAttemptInput) {
    const id = randomUUID();
    const payload = input.metadata ?? {};
    await this.context.db.insert(communicationDeliveries).values({
      id,
      workspaceId: input.workspaceId,
      communicationId: input.communicationId ?? null,
      announcementId: input.announcementId ?? null,
      notificationId: input.notificationId ?? null,
      recipientId: input.recipientId,
      recipientKind: input.recipientKind,
      channel: input.channel,
      status: input.status,
      attemptNumber: input.attemptNumber ?? 1,
      providerReference: input.providerReference ?? null,
      safeErrorCode: input.safeErrorCode ?? null,
      safeErrorMessage: input.safeErrorMessage ?? null,
      attemptedAt: input.attemptedAt ?? new Date(),
      completedAt: input.completedAt ?? null,
      payload,
    });
    const rows = await this.context.db
      .select()
      .from(communicationDeliveries)
      .where(eq(communicationDeliveries.id, id))
      .limit(1);
    return rows[0] ? normalizeDelivery(rows[0]) : undefined;
  }
}

function auditConditions(organizationId: string, query: AuditQuery): SQL[] {
  const conditions: SQL[] = [eq(auditLogs.organizationId, organizationId)];
  if (query.workspaceId) conditions.push(eq(auditLogs.workspaceId, query.workspaceId));
  if (query.actorUserId) conditions.push(eq(auditLogs.actorUserId, query.actorUserId));
  if (query.action) conditions.push(eq(auditLogs.action, query.action));
  if (query.resourceType) conditions.push(eq(auditLogs.resourceType, query.resourceType));
  if (query.resourceId) conditions.push(eq(auditLogs.resourceId, query.resourceId));
  if (query.result) conditions.push(eq(auditLogs.result, query.result));
  if (query.from) conditions.push(gte(auditLogs.createdAt, query.from));
  if (query.to) conditions.push(lte(auditLogs.createdAt, query.to));
  return conditions;
}

function domainEventConditions(organizationId: string, query: EventQuery): SQL[] {
  const conditions: SQL[] = [eq(domainEvents.organizationId, organizationId)];
  if (query.workspaceId) conditions.push(eq(domainEvents.workspaceId, query.workspaceId));
  if (query.eventType) conditions.push(eq(domainEvents.eventType, query.eventType));
  if (query.aggregateType) conditions.push(eq(domainEvents.aggregateType, query.aggregateType));
  if (query.aggregateId) conditions.push(eq(domainEvents.aggregateId, query.aggregateId));
  if (query.from) conditions.push(gte(domainEvents.occurredAt, query.from));
  if (query.to) conditions.push(lte(domainEvents.occurredAt, query.to));
  return conditions;
}

function operationalEventConditions(organizationId: string, query: EventQuery): SQL[] {
  const conditions: SQL[] = [eq(operationalEvents.organizationId, organizationId)];
  if (query.workspaceId) conditions.push(eq(operationalEvents.workspaceId, query.workspaceId));
  if (query.eventType) conditions.push(eq(operationalEvents.eventType, query.eventType));
  if (query.component) conditions.push(eq(operationalEvents.component, query.component));
  if (query.severity) conditions.push(eq(operationalEvents.severity, query.severity));
  if (query.status) conditions.push(eq(operationalEvents.status, query.status));
  if (query.from) conditions.push(gte(operationalEvents.occurredAt, query.from));
  if (query.to) conditions.push(lte(operationalEvents.occurredAt, query.to));
  return conditions;
}

function jsonValue<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return (value as T) ?? fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeAudit(row: typeof auditLogs.$inferSelect) {
  return {
    ...row,
    beforeSnapshot: jsonValue(row.beforeSnapshot, null),
    afterSnapshot: jsonValue(row.afterSnapshot, null),
    changedFields: jsonValue(row.changedFields, null),
    metadata: jsonValue(row.metadata, {}),
  };
}

function normalizeDomainEvent(row: typeof domainEvents.$inferSelect) {
  return { ...row, payload: jsonValue(row.payload, {}), metadata: jsonValue(row.metadata, {}) };
}

function normalizeOperationalEvent(row: typeof operationalEvents.$inferSelect) {
  return { ...row, metadata: jsonValue(row.metadata, {}) };
}

function normalizeNotification(row: typeof sisNotifications.$inferSelect) {
  return { ...row, payload: jsonValue(row.payload, {}) };
}

function normalizePreference(row: typeof notificationPreferences.$inferSelect) {
  return { ...row, payload: jsonValue(row.payload, {}) };
}

function normalizeDelivery(row: typeof communicationDeliveries.$inferSelect) {
  return { ...row, payload: jsonValue(row.payload, {}) };
}
