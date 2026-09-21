import { apiClient } from "@/api/api-client";
import type { AuditLogEntry } from "@/admin/platform-admin.types";

type AuditRecord = {
  id: string;
  action: string;
  operation: string;
  actorType: string;
  actorUserId: string | null;
  resourceType: string;
  resourceId: string | null;
  result: "success" | "failure" | "denied";
  createdAt: string;
};

type AuditPage = {
  items: AuditRecord[];
  total: number;
  limit: number;
  offset: number;
};

const knownActionTypes = new Set<AuditLogEntry["actionType"]>([
  "create",
  "update",
  "delete",
  "login",
  "system",
]);

const knownTargetTypes = new Set<AuditLogEntry["targetType"]>([
  "organization",
  "user",
  "system",
  "session",
]);

function actionTypeFor(operation: string): AuditLogEntry["actionType"] {
  const normalized = operation.toLowerCase() as AuditLogEntry["actionType"];
  return knownActionTypes.has(normalized) ? normalized : "system";
}

function targetTypeFor(resourceType: string): AuditLogEntry["targetType"] {
  const normalized = resourceType.toLowerCase() as AuditLogEntry["targetType"];
  return knownTargetTypes.has(normalized) ? normalized : "system";
}

export const operationalService = {
  async getAuditLog(organizationId: string): Promise<AuditLogEntry[]> {
    const page = await apiClient.request<AuditPage>(
      `/api/v1/organizations/${organizationId}/audit-logs?limit=100&offset=0`,
    );

    return page.items.map((entry) => ({
      id: entry.id,
      action: entry.action,
      actionType: actionTypeFor(entry.operation),
      actor: entry.actorUserId ?? entry.actorType,
      actorEmail: entry.actorType,
      target: entry.resourceId ?? entry.resourceType,
      targetType: targetTypeFor(entry.resourceType),
      details: `${entry.result}: ${entry.resourceType}`,
      timestamp: entry.createdAt,
    }));
  },
};
