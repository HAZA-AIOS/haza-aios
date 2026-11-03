import { apiClient } from "../api/api-client";
import { readStoredAuth } from "../auth/auth-storage";

export type EnvironmentMode = "mock" | "staging" | "production";

export interface TenantProviderConfig {
  id: string;
  organizationId: string;
  providerId: string;
  liveModeEnabled: boolean;
  environmentMode: EnvironmentMode;
  apiKeyMasked?: string | null;
  defaultModel: string;
  allowedModels: string[];
  embeddingModel: string;
  embeddingLiveEnabled: boolean;
  status: "inactive" | "configured" | "active" | "degraded" | "error";
  statusMessage?: string | null;
  lastHealthCheckAt?: string | null;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ModelPricing {
  promptPerThousandTokensUsd: number;
  completionPerThousandTokensUsd: number;
  embeddingPerThousandTokensUsd?: number;
}

export interface ModelMetadata {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  maxOutputTokens: number;
  capabilities: string[];
  pricing?: ModelPricing;
}

export interface AiBudget {
  id: string;
  organizationId: string;
  workspaceId?: string | null;
  monthlyBudgetUsd: string;
  dailyBudgetUsd: string;
  perRequestMaxCostUsd: string;
  currentMonthSpendUsd: string;
  currentDaySpendUsd: string;
  monthResetAt: string;
  dayResetAt: string;
  enforceHardLimit: boolean;
  notifyThresholdPercent: number;
  status: string;
}

export interface AiUsageRecord {
  id: string;
  organizationId: string;
  workspaceId?: string | null;
  agentId?: string | null;
  runId?: string | null;
  providerId: string;
  modelId: string;
  operationType: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: string;
  actualCostUsd?: string | null;
  latencyMs: number;
  finishReason?: string | null;
  isLiveMode: boolean;
  correlationId?: string | null;
  createdAt: string;
}

export class AgentProviderService {
  private getAuthToken(): string | null {
    return readStoredAuth()?.session?.accessToken ?? null;
  }

  async listConfigs(organizationId: string): Promise<TenantProviderConfig[]> {
    const res = await apiClient.request<{ configs: TenantProviderConfig[] }>(
      `/api/v1/organizations/${organizationId}/agents/providers/config`,
      { authToken: this.getAuthToken() },
    );
    return res.configs;
  }

  async updateConfig(
    organizationId: string,
    input: {
      providerId: string;
      liveModeEnabled?: boolean;
      environmentMode?: EnvironmentMode;
      apiKey?: string;
      defaultModel?: string;
      allowedModels?: string[];
      embeddingModel?: string;
      embeddingLiveEnabled?: boolean;
      status?: string;
      statusMessage?: string;
    },
  ): Promise<TenantProviderConfig> {
    const res = await apiClient.request<{ config: TenantProviderConfig }>(
      `/api/v1/organizations/${organizationId}/agents/providers/config`,
      {
        method: "PUT",
        body: JSON.stringify(input),
        authToken: this.getAuthToken(),
      },
    );
    return res.config;
  }

  async validateProvider(
    organizationId: string,
    providerId: string,
  ): Promise<{ status: string; message?: string; latencyMs?: number }> {
    const res = await apiClient.request<{ validation: { status: string; message?: string; latencyMs?: number } }>(
      `/api/v1/organizations/${organizationId}/agents/providers/validate`,
      {
        method: "POST",
        body: JSON.stringify({ providerId }),
        authToken: this.getAuthToken(),
      },
    );
    return res.validation;
  }

  async listModels(organizationId: string, providerId?: string): Promise<ModelMetadata[]> {
    const query = providerId ? `?providerId=${encodeURIComponent(providerId)}` : "";
    const res = await apiClient.request<{ models: ModelMetadata[] }>(
      `/api/v1/organizations/${organizationId}/agents/providers/models${query}`,
      { authToken: this.getAuthToken() },
    );
    return res.models;
  }

  async getBudget(organizationId: string, workspaceId?: string): Promise<AiBudget> {
    const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";
    const res = await apiClient.request<{ budget: AiBudget }>(
      `/api/v1/organizations/${organizationId}/agents/providers/budgets${query}`,
      { authToken: this.getAuthToken() },
    );
    return res.budget;
  }

  async updateBudget(
    organizationId: string,
    input: {
      monthlyBudgetUsd?: number;
      dailyBudgetUsd?: number;
      perRequestMaxCostUsd?: number;
      enforceHardLimit?: boolean;
      notifyThresholdPercent?: number;
      status?: string;
      workspaceId?: string;
    },
  ): Promise<AiBudget> {
    const res = await apiClient.request<{ budget: AiBudget }>(
      `/api/v1/organizations/${organizationId}/agents/providers/budgets`,
      {
        method: "PUT",
        body: JSON.stringify(input),
        authToken: this.getAuthToken(),
      },
    );
    return res.budget;
  }

  async getUsage(organizationId: string, limit = 50): Promise<AiUsageRecord[]> {
    const res = await apiClient.request<{ usage: AiUsageRecord[] }>(
      `/api/v1/organizations/${organizationId}/agents/providers/usage?limit=${limit}`,
      { authToken: this.getAuthToken() },
    );
    return res.usage;
  }
}

export const agentProviderService = new AgentProviderService();
