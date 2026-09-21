import type {
  auditLogs,
  domainEvents,
  operationalEvents,
  sisNotifications,
} from "../../database/schema.js";

export type JsonRecord = Record<string, unknown>;
export type AuditLogRecord = typeof auditLogs.$inferSelect;
export type DomainEventRecord = typeof domainEvents.$inferSelect;
export type OperationalEventRecord = typeof operationalEvents.$inferSelect;
export type NotificationRecord = typeof sisNotifications.$inferSelect;

export type PageQuery = {
  limit: number;
  offset: number;
};

export type AuditQuery = PageQuery & {
  workspaceId?: string;
  actorUserId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  result?: "success" | "failure" | "denied";
  from?: Date;
  to?: Date;
};

export type EventQuery = PageQuery & {
  workspaceId?: string;
  eventType?: string;
  aggregateType?: string;
  aggregateId?: string;
  component?: string;
  severity?: "info" | "warning" | "error" | "critical";
  status?: string;
  from?: Date;
  to?: Date;
};

export type CreateAuditInput = {
  organizationId: string;
  workspaceId?: string | null;
  actorType?: string;
  actorUserId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  operation: string;
  result?: "success" | "failure" | "denied";
  source?: string;
  requestId?: string | null;
  correlationId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  beforeSnapshot?: JsonRecord | null;
  afterSnapshot?: JsonRecord | null;
  changedFields?: string[] | null;
  metadata?: JsonRecord;
};

export type CreateDomainEventInput = {
  organizationId: string;
  workspaceId?: string | null;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  actorUserId?: string | null;
  schemaVersion?: number;
  payload?: JsonRecord;
  metadata?: JsonRecord;
  correlationId?: string | null;
  causationId?: string | null;
  idempotencyKey?: string | null;
  occurredAt?: Date;
};

export type CreateOperationalEventInput = {
  organizationId: string;
  workspaceId?: string | null;
  severity?: "info" | "warning" | "error" | "critical";
  component: string;
  eventType: string;
  status: string;
  resourceType?: string | null;
  resourceId?: string | null;
  workflowRunId?: string | null;
  agentRunId?: string | null;
  correlationId?: string | null;
  summary: string;
  safeErrorCode?: string | null;
  safeErrorMessage?: string | null;
  metadata?: JsonRecord;
  occurredAt?: Date;
};

export type CreateUserNotificationInput = {
  organizationId: string;
  workspaceId: string;
  recipientUserId: string;
  notificationType: string;
  title: string;
  message: string;
  priority?: string;
  sourceEventId?: string | null;
  relatedResourceType?: string;
  relatedResourceId?: string;
  actionPath?: string;
  expiresAt?: Date | null;
};

export type RecordDeliveryAttemptInput = {
  organizationId: string;
  workspaceId: string;
  notificationId?: string | null;
  communicationId?: string | null;
  announcementId?: string | null;
  recipientId: string;
  recipientKind: string;
  channel: string;
  status: string;
  attemptNumber?: number;
  providerReference?: string | null;
  safeErrorCode?: string | null;
  safeErrorMessage?: string | null;
  metadata?: JsonRecord;
  attemptedAt?: Date;
  completedAt?: Date | null;
};
