import { apiClient } from "@/api/api-client";
import { readStoredAuth } from "@/auth/auth-storage";

export type AgentRunStatus =
  | "queued"
  | "running"
  | "waiting"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "cancelled"
  | "rejected";

export interface AgentRunItem {
  id: string;
  organizationId: string;
  workspaceId: string;
  agentId: string;
  conversationId: string | null;
  configurationRevisionId?: string | null;
  status: AgentRunStatus;
  executionMode?: "manual" | "scheduled" | "trigger" | "subagent" | string;
  priority?: number;
  workerId?: string | null;
  attemptCount?: number;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  totalCostMicros?: number;
  input: Record<string, unknown>;
  output?: Record<string, unknown> | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  safeErrorMessage?: string | null;
  cancellationReason?: string | null;
  cancelledBy?: string | null;
  cancelledAt?: string | null;
  metadata?: Record<string, unknown>;
  startedAt: string;
  completedAt?: string | null;
  durationMs?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentRunEventItem {
  id: string;
  organizationId: string;
  workspaceId: string;
  runId: string;
  attemptId?: string | null;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface AgentRunAttemptItem {
  id: string;
  organizationId: string;
  workspaceId: string;
  runId: string;
  attemptNumber: number;
  status: string;
  workerId: string;
  durationMs?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  inputTokens: number;
  outputTokens: number;
  metadata?: Record<string, unknown>;
  startedAt: string;
  completedAt?: string | null;
}

export interface AgentRuntimeUsageItem {
  id: string;
  organizationId: string;
  workspaceId: string;
  runId: string;
  attemptId?: string | null;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costMicros: number;
  currency: string;
  createdAt: string;
}

export interface AgentApprovalRequestItem {
  id: string;
  organizationId: string;
  workspaceId: string;
  runId: string;
  attemptId?: string | null;
  actionName: string;
  actionType: string;
  actionPayload: Record<string, unknown>;
  riskLevel: "low" | "medium" | "high" | "critical" | string;
  policy: string;
  requiredRoles: string[];
  status: "pending" | "approved" | "rejected" | "expired";
  requestedBy: string;
  createdAt: string;
  expiresAt?: string | null;
}

export interface RuntimeMonitoringMetrics {
  activeQueuedRuns: number;
  activeExecutingRuns: number;
  awaitingApprovalRuns: number;
  completedLast24h: number;
  failedLast24h: number;
  successRatePercentage: number;
  averageDurationMs: number;
  totalTokensLast24h: number;
  totalCostMicrosLast24h: number;
}

export class AgentRuntimeService {
  private static getAuthToken(): string | undefined {
    return readStoredAuth()?.session.accessToken;
  }

  static async createRun(
    organizationId: string,
    agentId: string,
    input: Record<string, unknown>,
    options?: {
      autoExecute?: boolean;
      executionMode?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<{ run: AgentRunItem; conversation?: any; userMessage?: any }> {
    const autoExecute = options?.autoExecute ?? true;
    const query = autoExecute ? "?autoExecute=true" : "";
    return apiClient.request(
      `/api/v1/organizations/${organizationId}/agents/${agentId}/runs${query}`,
      {
        method: "POST",
        body: JSON.stringify({
          input,
          executionMode: options?.executionMode ?? "manual",
          metadata: options?.metadata,
        }),
        authToken: this.getAuthToken(),
      },
    );
  }

  static async listRuns(
    organizationId: string,
    options?: {
      agentId?: string;
      status?: AgentRunStatus;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ runs: AgentRunItem[] }> {
    const params = new URLSearchParams();
    if (options?.status) params.set("status", options.status);
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.offset) params.set("offset", String(options.offset));

    const path = options?.agentId
      ? `/api/v1/organizations/${organizationId}/agents/${options.agentId}/runs?${params.toString()}`
      : `/api/v1/organizations/${organizationId}/agents/runs?${params.toString()}`;

    return apiClient.request(path, { authToken: this.getAuthToken() });
  }

  static async getRun(
    organizationId: string,
    runId: string,
  ): Promise<{ run: AgentRunItem }> {
    return apiClient.request(
      `/api/v1/organizations/${organizationId}/agents/runs/${runId}`,
      { authToken: this.getAuthToken() },
    );
  }

  static async cancelRun(
    organizationId: string,
    runId: string,
    reason?: string,
  ): Promise<{ run: AgentRunItem }> {
    return apiClient.request(
      `/api/v1/organizations/${organizationId}/agents/runs/${runId}/cancel`,
      {
        method: "POST",
        body: JSON.stringify({ reason }),
        authToken: this.getAuthToken(),
      },
    );
  }

  static async retryRun(
    organizationId: string,
    runId: string,
  ): Promise<{ run: AgentRunItem }> {
    return apiClient.request(
      `/api/v1/organizations/${organizationId}/agents/runs/${runId}/retry`,
      {
        method: "POST",
        authToken: this.getAuthToken(),
      },
    );
  }

  static async getRunEvents(
    organizationId: string,
    runId: string,
  ): Promise<{ events: AgentRunEventItem[] }> {
    return apiClient.request(
      `/api/v1/organizations/${organizationId}/agents/runs/${runId}/events`,
      { authToken: this.getAuthToken() },
    );
  }

  static async getRunAttempts(
    organizationId: string,
    runId: string,
  ): Promise<{ attempts: AgentRunAttemptItem[] }> {
    return apiClient.request(
      `/api/v1/organizations/${organizationId}/agents/runs/${runId}/attempts`,
      { authToken: this.getAuthToken() },
    );
  }

  static async getRunUsage(
    organizationId: string,
    runId: string,
  ): Promise<{ usage: AgentRuntimeUsageItem[] }> {
    return apiClient.request(
      `/api/v1/organizations/${organizationId}/agents/runs/${runId}/usage`,
      { authToken: this.getAuthToken() },
    );
  }

  static async listApprovals(
    organizationId: string,
    status?: "pending" | "approved" | "rejected" | "expired",
  ): Promise<{ approvals: AgentApprovalRequestItem[] }> {
    const query = status ? `?status=${status}` : "";
    return apiClient.request(
      `/api/v1/organizations/${organizationId}/agents/approvals${query}`,
      { authToken: this.getAuthToken() },
    );
  }

  static async getApproval(
    organizationId: string,
    approvalId: string,
  ): Promise<{ approval: AgentApprovalRequestItem }> {
    return apiClient.request(
      `/api/v1/organizations/${organizationId}/agents/approvals/${approvalId}`,
      { authToken: this.getAuthToken() },
    );
  }

  static async approveApproval(
    organizationId: string,
    approvalId: string,
    reason?: string,
  ): Promise<{ request: AgentApprovalRequestItem; decision: any }> {
    return apiClient.request(
      `/api/v1/organizations/${organizationId}/agents/approvals/${approvalId}/approve`,
      {
        method: "POST",
        body: JSON.stringify({ reason }),
        authToken: this.getAuthToken(),
      },
    );
  }

  static async rejectApproval(
    organizationId: string,
    approvalId: string,
    reason?: string,
  ): Promise<{ request: AgentApprovalRequestItem; decision: any }> {
    return apiClient.request(
      `/api/v1/organizations/${organizationId}/agents/approvals/${approvalId}/reject`,
      {
        method: "POST",
        body: JSON.stringify({ reason }),
        authToken: this.getAuthToken(),
      },
    );
  }

  static async getMonitoringMetrics(
    organizationId: string,
  ): Promise<{ metrics: RuntimeMonitoringMetrics }> {
    return apiClient.request(
      `/api/v1/organizations/${organizationId}/agents/runtime/monitoring`,
      { authToken: this.getAuthToken() },
    );
  }

  static async triggerWorkerTick(
    organizationId: string,
    workerId?: string,
  ): Promise<{ executed: boolean; run?: AgentRunItem; attempt?: any }> {
    return apiClient.request(
      `/api/v1/organizations/${organizationId}/agents/runtime/worker/tick`,
      {
        method: "POST",
        body: JSON.stringify({ workerId }),
        authToken: this.getAuthToken(),
      },
    );
  }
}
