import { apiClient } from "@/api/api-client";
import { readStoredAuth } from "@/auth/auth-storage";

export interface AgentToolItem {
  toolId: string;
  toolKey: string;
  name: string;
  description: string;
  category: string;
  industry: string;
  version: string;
  riskLevel: "low" | "medium" | "high";
  executionMode: "sync" | "async";
  approvalPolicy: string;
  requiredPermissions: string[];
  enabled: boolean;
  deprecated?: boolean;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  approvalPolicyOverride?: string | null;
  customRateLimitPerMinute?: number | null;
  allowedAgentIds?: string[] | null;
}

export interface AgentToolExecutionItem {
  id: string;
  organizationId: string;
  workspaceId: string;
  runId: string;
  attemptId?: string | null;
  agentId: string;
  configurationRevisionId?: string | null;
  toolId: string;
  toolVersion: string;
  toolKey: string;
  requestedBy: string;
  inputDigest: string;
  inputSnapshot?: Record<string, unknown> | null;
  outputSnapshot?: Record<string, unknown> | null;
  status: "pending" | "running" | "awaiting_approval" | "completed" | "failed" | "cancelled";
  approvalRequestId?: string | null;
  startedAt: string;
  completedAt?: string | null;
  durationMs?: number | null;
  errorCategory?: string | null;
  errorMessage?: string | null;
  correlationId?: string | null;
  idempotencyKey?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface AgentToolMetrics {
  totalInvocations: number;
  completedCount: number;
  failedCount: number;
  awaitingApprovalCount: number;
  successRate: number;
  avgDurationMs: number;
}

class AgentToolService {
  private getAuthToken(): string | null {
    const auth = readStoredAuth();
    return auth?.session?.accessToken ?? null;
  }

  async listTools(
    organizationId: string,
    workspaceId?: string,
    filters?: { category?: string; industry?: string },
  ): Promise<AgentToolItem[]> {
    const params = new URLSearchParams();
    if (filters?.category) params.append("category", filters.category);
    if (filters?.industry) params.append("industry", filters.industry);
    if (workspaceId) params.append("workspaceId", workspaceId);

    const path = workspaceId
      ? `/api/v1/organizations/${organizationId}/workspaces/${workspaceId}/agent-tools?${params.toString()}`
      : `/api/v1/organizations/${organizationId}/agent-tools?${params.toString()}`;

    const res = await apiClient.request<{ tools: AgentToolItem[] }>(path, {
      method: "GET",
      authToken: this.getAuthToken(),
    });
    return res?.tools ?? [];
  }

  async getTool(
    organizationId: string,
    workspaceId: string,
    toolKey: string,
  ): Promise<AgentToolItem | null> {
    const path = `/api/v1/organizations/${organizationId}/workspaces/${workspaceId}/agent-tools/${encodeURIComponent(toolKey)}`;
    const res = await apiClient.request<{ tool: AgentToolItem }>(path, {
      method: "GET",
      authToken: this.getAuthToken(),
    });
    return res?.tool ?? null;
  }

  async listToolVersions(
    organizationId: string,
    workspaceId: string,
    toolKey: string,
  ): Promise<Record<string, unknown>[]> {
    const path = `/api/v1/organizations/${organizationId}/workspaces/${workspaceId}/agent-tools/${encodeURIComponent(toolKey)}/versions`;
    const res = await apiClient.request<{ versions: Record<string, unknown>[] }>(path, {
      method: "GET",
      authToken: this.getAuthToken(),
    });
    return res?.versions ?? [];
  }

  async updatePolicy(
    organizationId: string,
    workspaceId: string,
    toolKey: string,
    policy: {
      enabled: boolean;
      approvalPolicyOverride?: string | null;
      customRateLimitPerMinute?: number | null;
      allowedAgentIds?: string[] | null;
    },
  ): Promise<Record<string, unknown> | undefined> {
    const path = `/api/v1/organizations/${organizationId}/workspaces/${workspaceId}/agent-tools/${encodeURIComponent(toolKey)}/policy`;
    const res = await apiClient.request<{ policy: Record<string, unknown> }>(path, {
      method: "PUT",
      body: JSON.stringify(policy),
      authToken: this.getAuthToken(),
    });
    return res?.policy;
  }

  async listExecutions(
    organizationId: string,
    workspaceId: string,
    filters?: {
      runId?: string;
      agentId?: string;
      toolKey?: string;
      status?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ executions: AgentToolExecutionItem[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.runId) params.append("runId", filters.runId);
    if (filters?.agentId) params.append("agentId", filters.agentId);
    if (filters?.toolKey) params.append("toolKey", filters.toolKey);
    if (filters?.status) params.append("status", filters.status);
    if (filters?.limit) params.append("limit", String(filters.limit));
    if (filters?.offset) params.append("offset", String(filters.offset));

    const path = `/api/v1/organizations/${organizationId}/workspaces/${workspaceId}/agent-tools/executions?${params.toString()}`;
    const res = await apiClient.request<{ executions: AgentToolExecutionItem[]; total: number }>(path, {
      method: "GET",
      authToken: this.getAuthToken(),
    });
    return res ?? { executions: [], total: 0 };
  }

  async getExecution(
    organizationId: string,
    workspaceId: string,
    executionId: string,
  ): Promise<AgentToolExecutionItem | null> {
    const path = `/api/v1/organizations/${organizationId}/workspaces/${workspaceId}/agent-tools/executions/${executionId}`;
    const res = await apiClient.request<{ execution: AgentToolExecutionItem }>(path, {
      method: "GET",
      authToken: this.getAuthToken(),
    });
    return res?.execution ?? null;
  }

  async getMetrics(
    organizationId: string,
    workspaceId: string,
  ): Promise<AgentToolMetrics> {
    const path = `/api/v1/organizations/${organizationId}/workspaces/${workspaceId}/agent-tools/metrics`;
    const res = await apiClient.request<{ metrics: AgentToolMetrics }>(path, {
      method: "GET",
      authToken: this.getAuthToken(),
    });
    return (
      res?.metrics ?? {
        totalInvocations: 0,
        completedCount: 0,
        failedCount: 0,
        awaitingApprovalCount: 0,
        successRate: 100,
        avgDurationMs: 0,
      }
    );
  }
}

export const agentToolService = new AgentToolService();
