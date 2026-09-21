import { and, eq } from "drizzle-orm";
import { ApiError } from "../../../common/errors/api-error.js";
import type { DatabaseClient, DatabaseTransaction } from "../../../database/client.js";
import {
  aiAgentRuns,
  announcements,
  communicationMessages,
  organizationMemberships,
  sisNotifications,
  workflowRuns,
  workspaces,
} from "../../../database/schema.js";
import { createRepositoryContext } from "../../../database/repositories/repository-context.js";
import { withTransaction } from "../../../database/transactions.js";
import { OperationalRepository } from "../repositories/operational.repository.js";
import { sanitizeOperationalRecord, sanitizeOperationalText } from "../operational-sanitization.js";
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

export class OperationalService {
  constructor(private readonly database: DatabaseClient) {}

  listAudits(organizationId: string, query: AuditQuery) {
    return this.repository().listAudits(organizationId, query);
  }

  async recordAudit(input: CreateAuditInput, tx?: DatabaseTransaction) {
    if (input.workspaceId) await this.assertWorkspace(input.organizationId, input.workspaceId, tx);
    return this.repository(tx).createAudit({
      ...input,
      beforeSnapshot: input.beforeSnapshot ? sanitizeOperationalRecord(input.beforeSnapshot) : null,
      afterSnapshot: input.afterSnapshot ? sanitizeOperationalRecord(input.afterSnapshot) : null,
      metadata: sanitizeOperationalRecord(input.metadata ?? {}),
      ipAddress: sanitizeOperationalText(input.ipAddress, 80),
      userAgent: sanitizeOperationalText(input.userAgent, 500),
    });
  }

  listDomainEvents(organizationId: string, query: EventQuery) {
    return this.repository().listDomainEvents(organizationId, query);
  }

  async emitDomainEvent(input: CreateDomainEventInput, tx?: DatabaseTransaction) {
    if (input.workspaceId) await this.assertWorkspace(input.organizationId, input.workspaceId, tx);
    return this.repository(tx).createDomainEvent({
      ...input,
      payload: sanitizeOperationalRecord(input.payload ?? {}),
      metadata: sanitizeOperationalRecord(input.metadata ?? {}),
    });
  }

  listOperationalEvents(organizationId: string, query: EventQuery) {
    return this.repository().listOperationalEvents(organizationId, query);
  }

  async recordOperationalEvent(input: CreateOperationalEventInput, tx?: DatabaseTransaction) {
    if (input.workspaceId) await this.assertWorkspace(input.organizationId, input.workspaceId, tx);
    if (input.workflowRunId)
      await this.assertWorkflowRun(input.organizationId, input.workflowRunId, tx);
    if (input.agentRunId) await this.assertAgentRun(input.organizationId, input.agentRunId, tx);
    return this.repository(tx).createOperationalEvent({
      ...input,
      summary: sanitizeOperationalText(input.summary, 500) ?? "Operational event",
      safeErrorCode: sanitizeOperationalText(input.safeErrorCode, 120),
      safeErrorMessage: sanitizeOperationalText(input.safeErrorMessage, 1000),
      metadata: sanitizeOperationalRecord(input.metadata ?? {}),
    });
  }

  async createEventNotification(
    event: CreateDomainEventInput,
    notification: Omit<CreateUserNotificationInput, "organizationId" | "sourceEventId">,
  ) {
    await this.assertWorkspace(event.organizationId, notification.workspaceId);
    await this.assertActiveMember(event.organizationId, notification.recipientUserId);
    return withTransaction(this.database, async ({ tx }) => {
      const repository = this.repository(tx);
      const createdEvent = await repository.createDomainEvent({
        ...event,
        payload: sanitizeOperationalRecord(event.payload ?? {}),
        metadata: sanitizeOperationalRecord(event.metadata ?? {}),
      });
      if (!createdEvent) throw new Error("Domain event create failed.");
      const createdNotification = await repository.createUserNotification({
        ...notification,
        organizationId: event.organizationId,
        sourceEventId: createdEvent.id,
      });
      return { event: createdEvent, notification: createdNotification };
    });
  }

  async createUserNotification(input: CreateUserNotificationInput, tx?: DatabaseTransaction) {
    await this.assertWorkspace(input.organizationId, input.workspaceId, tx);
    await this.assertActiveMember(input.organizationId, input.recipientUserId, tx);
    return this.repository(tx).createUserNotification({
      ...input,
      title: sanitizeOperationalText(input.title, 220) ?? "Notification",
      message: sanitizeOperationalText(input.message, 2000) ?? "",
    });
  }

  listUserNotifications(
    organizationId: string,
    userId: string,
    query: { limit: number; offset: number; unreadOnly: boolean },
  ) {
    return this.repository().listNotificationsForUser(organizationId, userId, query);
  }

  async markNotificationRead(organizationId: string, userId: string, notificationId: string) {
    const repository = this.repository();
    const notification = await repository.getNotificationForUser(
      organizationId,
      userId,
      notificationId,
    );
    if (!notification) throw new ApiError(404, "NOT_FOUND", "Notification not found.");
    await repository.markNotificationRead(notification.workspaceId, userId, notificationId);
    return repository.getNotificationForUser(organizationId, userId, notificationId);
  }

  async acknowledgeNotification(organizationId: string, userId: string, notificationId: string) {
    const repository = this.repository();
    const notification = await repository.getNotificationForUser(
      organizationId,
      userId,
      notificationId,
    );
    if (!notification) throw new ApiError(404, "NOT_FOUND", "Notification not found.");
    await repository.acknowledgeNotification(notification.workspaceId, userId, notificationId);
    return repository.getNotificationForUser(organizationId, userId, notificationId);
  }

  markAllNotificationsRead(organizationId: string, userId: string) {
    return this.repository().markAllNotificationsRead(organizationId, userId);
  }

  async getUserPreference(organizationId: string, userId: string) {
    const preference = await this.repository().getUserPreference(organizationId, userId);
    return preference?.payload ?? {};
  }

  async saveUserPreference(
    organizationId: string,
    workspaceId: string,
    userId: string,
    preferences: JsonRecord,
  ) {
    await this.assertWorkspace(organizationId, workspaceId);
    return this.repository().upsertUserPreference(
      workspaceId,
      userId,
      sanitizeOperationalRecord(preferences),
    );
  }

  async recordDeliveryAttempt(input: RecordDeliveryAttemptInput, tx?: DatabaseTransaction) {
    await this.assertWorkspace(input.organizationId, input.workspaceId, tx);
    await this.assertDeliveryReferences(input, tx);
    return this.repository(tx).recordDeliveryAttempt({
      ...input,
      providerReference: sanitizeOperationalText(input.providerReference, 255),
      safeErrorCode: sanitizeOperationalText(input.safeErrorCode, 120),
      safeErrorMessage: sanitizeOperationalText(input.safeErrorMessage, 1000),
      metadata: sanitizeOperationalRecord(input.metadata ?? {}),
    });
  }

  private repository(tx?: DatabaseTransaction) {
    return new OperationalRepository(createRepositoryContext(tx ?? this.database.db));
  }

  private async assertWorkspace(
    organizationId: string,
    workspaceId: string,
    tx?: DatabaseTransaction,
  ): Promise<void> {
    const rows = await (tx ?? this.database.db)
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(and(eq(workspaces.organizationId, organizationId), eq(workspaces.id, workspaceId)))
      .limit(1);
    if (!rows[0]) throw new ApiError(404, "NOT_FOUND", "Workspace not found.");
  }

  private async assertActiveMember(
    organizationId: string,
    userId: string,
    tx?: DatabaseTransaction,
  ): Promise<void> {
    const rows = await (tx ?? this.database.db)
      .select({ id: organizationMemberships.id })
      .from(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.organizationId, organizationId),
          eq(organizationMemberships.userId, userId),
          eq(organizationMemberships.status, "active"),
        ),
      )
      .limit(1);
    if (!rows[0]) throw new ApiError(404, "NOT_FOUND", "Notification recipient not found.");
  }

  private async assertWorkflowRun(
    organizationId: string,
    runId: string,
    tx?: DatabaseTransaction,
  ): Promise<void> {
    const rows = await (tx ?? this.database.db)
      .select({ id: workflowRuns.id })
      .from(workflowRuns)
      .where(and(eq(workflowRuns.organizationId, organizationId), eq(workflowRuns.id, runId)))
      .limit(1);
    if (!rows[0]) throw new ApiError(404, "NOT_FOUND", "Workflow run not found.");
  }

  private async assertAgentRun(
    organizationId: string,
    runId: string,
    tx?: DatabaseTransaction,
  ): Promise<void> {
    const rows = await (tx ?? this.database.db)
      .select({ id: aiAgentRuns.id })
      .from(aiAgentRuns)
      .where(and(eq(aiAgentRuns.organizationId, organizationId), eq(aiAgentRuns.id, runId)))
      .limit(1);
    if (!rows[0]) throw new ApiError(404, "NOT_FOUND", "Agent run not found.");
  }

  private async assertDeliveryReferences(
    input: RecordDeliveryAttemptInput,
    tx?: DatabaseTransaction,
  ): Promise<void> {
    const db = tx ?? this.database.db;
    if (input.notificationId) {
      const rows = await db
        .select({ id: sisNotifications.id })
        .from(sisNotifications)
        .where(
          and(
            eq(sisNotifications.id, input.notificationId),
            eq(sisNotifications.workspaceId, input.workspaceId),
            eq(sisNotifications.recipientId, input.recipientId),
          ),
        )
        .limit(1);
      if (!rows[0]) throw new ApiError(404, "NOT_FOUND", "Notification not found.");
    }
    if (input.communicationId) {
      const rows = await db
        .select({ id: communicationMessages.id })
        .from(communicationMessages)
        .where(
          and(
            eq(communicationMessages.id, input.communicationId),
            eq(communicationMessages.workspaceId, input.workspaceId),
          ),
        )
        .limit(1);
      if (!rows[0]) throw new ApiError(404, "NOT_FOUND", "Communication not found.");
    }
    if (input.announcementId) {
      const rows = await db
        .select({ id: announcements.id })
        .from(announcements)
        .where(
          and(
            eq(announcements.id, input.announcementId),
            eq(announcements.workspaceId, input.workspaceId),
          ),
        )
        .limit(1);
      if (!rows[0]) throw new ApiError(404, "NOT_FOUND", "Announcement not found.");
    }
  }
}
