import { apiClient } from "@/api/api-client";
import { readStoredAuth } from "@/auth/auth-storage";

export interface BuilderCatalogOptions {
  providers: Array<{ id: string; name: string; version: string }>;
  models: Array<{
    id: string;
    name: string;
    provider: string;
    contextWindow: number;
    maxOutputTokens: number;
    capabilities: string[];
  }>;
  capabilities: Array<{
    key: string;
    name: string;
    description: string;
    riskLevel: "low" | "medium" | "high";
    requiresApproval: boolean;
  }>;
  tools: Array<{
    toolKey: string;
    name: string;
    description: string;
    category: string;
    riskLevel: "low" | "medium" | "high";
    requiresApproval: boolean;
    permissions: string[];
  }>;
  knowledgeSources: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
  }>;
}

export interface AgentBuilderFullConfig {
  identity: {
    name: string;
    agentKey: string;
    description: string;
    category?: string;
    industry?: string;
    icon?: string;
    tags?: string[];
  };
  model: {
    provider: string;
    modelSelection: string;
    temperature: number;
    maxTokens: number;
    timeoutSeconds: number;
    contextWindow?: number;
    responseQuality?: "fast" | "balanced" | "high";
  };
  instructions: {
    role: string;
    objectives: string;
    boundaryConstraints: string;
    behavioralRules: string;
    outputFormat: string;
    prohibitedActions: string;
    escalationRequirements: string;
    systemInstructions: string;
  };
  capabilities: Array<{
    key: string;
    name: string;
    description: string;
    riskLevel: "low" | "medium" | "high";
    requiresApproval: boolean;
  }>;
  tools: Array<{
    toolKey: string;
    name: string;
    description: string;
    category: string;
    riskLevel: "low" | "medium" | "high";
    requiresApproval: boolean;
    permissions: string[];
    configuration?: Record<string, unknown>;
  }>;
  knowledge: Array<{
    sourceId: string;
    name?: string;
    sourceType?: string;
    accessPolicy?: "read_only" | "search_only";
    enabled: boolean;
  }>;
  humanApproval: {
    policy: "never" | "always" | "risk_threshold";
    riskThreshold?: "low" | "medium" | "high";
    approverRoles: string[];
    escalationTimeoutHours: number;
    fallbackAction: "deny" | "escalate";
    sensitiveCapabilities: string[];
  };
}

export interface BuilderRevisionItem {
  id: string;
  organizationId: string;
  workspaceId: string;
  agentId: string;
  revisionNumber: number;
  version: string;
  status: "draft" | "published" | "archived";
  configuration: AgentBuilderFullConfig;
  validationStatus: "valid" | "invalid" | "warning";
  validationErrors?: Array<{ field: string; message: string; severity: "error" | "warning"; section?: string }> | null;
  changelog: string | null;
  createdBy: string;
  publishedBy: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BuilderContextResponse {
  agent: {
    id: string;
    name: string;
    description: string;
    agentKey: string;
    status: string;
    enabled: boolean;
    instructions: string;
    modelProvider: string;
    modelSelection: string;
    installedVersion?: string;
    tools: Array<{ id: string; toolKey: string; status: string }>;
  };
  activeRevision: BuilderRevisionItem | null;
  draftRevision: BuilderRevisionItem | null;
  latestRevision: BuilderRevisionItem | null;
  totalRevisions: number;
  catalogOptions: BuilderCatalogOptions;
}

export interface ValidationResponse {
  valid: boolean;
  status: "valid" | "invalid" | "warning";
  errors: Array<{ field: string; message: string; severity: "error"; section?: string }>;
  warnings: Array<{ field: string; message: string; severity: "warning"; section?: string }>;
}

export interface PreviewResponse {
  preview: {
    simulated: boolean;
    provider: string;
    model: string;
    content: string;
    finishReason: string;
    latencyMs: number;
    simulatedUsage?: { promptTokens: number; completionTokens: number; totalTokens: number };
    simulatedToolCalls?: Array<{
      name: string;
      description: string;
      riskLevel: "low" | "medium" | "high";
      requiresApproval: boolean;
      arguments: Record<string, unknown>;
    }>;
    validationWarnings?: string[];
  };
}

export interface RevisionDiffItem {
  field: string;
  path: string;
  before: unknown;
  after: unknown;
  action: "added" | "removed" | "modified";
}

export class AgentBuilderApiClient {
  private static getAuthToken(): string | undefined {
    return readStoredAuth()?.session.accessToken;
  }

  static async getCatalogOptions(organizationId: string): Promise<BuilderCatalogOptions> {
    const res = await apiClient.request<{ catalogOptions: BuilderCatalogOptions }>(
      `/api/v1/organizations/${organizationId}/agents/builder/catalog-options`,
      { authToken: this.getAuthToken() },
    );
    return res.catalogOptions;
  }

  static async getBuilderContext(
    organizationId: string,
    agentId: string,
  ): Promise<BuilderContextResponse> {
    return apiClient.request<BuilderContextResponse>(
      `/api/v1/organizations/${organizationId}/agents/${agentId}/builder`,
      { authToken: this.getAuthToken() },
    );
  }

  static async createNewAgent(
    organizationId: string,
    workspaceId: string,
    configuration: AgentBuilderFullConfig,
  ): Promise<{ agent: any; revision: BuilderRevisionItem; validation: ValidationResponse }> {
    return apiClient.request(
      `/api/v1/organizations/${organizationId}/agents/builder/new`,
      {
        method: "POST",
        body: JSON.stringify({ workspaceId, configuration }),
        authToken: this.getAuthToken(),
      },
    );
  }

  static async saveDraft(
    organizationId: string,
    agentId: string,
    configuration: AgentBuilderFullConfig,
    version?: string,
    changelog?: string,
  ): Promise<{ revision: BuilderRevisionItem; validation: ValidationResponse }> {
    return apiClient.request(
      `/api/v1/organizations/${organizationId}/agents/${agentId}/builder/draft`,
      {
        method: "PUT",
        body: JSON.stringify({ configuration, version, changelog }),
        authToken: this.getAuthToken(),
      },
    );
  }

  static async publishRevision(
    organizationId: string,
    agentId: string,
    version?: string,
    changelog?: string,
    revisionId?: string,
  ): Promise<{ revision: BuilderRevisionItem; agent: any }> {
    return apiClient.request(
      `/api/v1/organizations/${organizationId}/agents/${agentId}/builder/publish`,
      {
        method: "POST",
        body: JSON.stringify({ version, changelog, revisionId }),
        authToken: this.getAuthToken(),
      },
    );
  }

  static async duplicateAgent(
    organizationId: string,
    workspaceId: string,
    sourceAgentId: string,
    newName: string,
    newAgentKey: string,
  ): Promise<{ agent: any; revision: BuilderRevisionItem }> {
    return apiClient.request(
      `/api/v1/organizations/${organizationId}/agents/${sourceAgentId}/builder/duplicate`,
      {
        method: "POST",
        body: JSON.stringify({ workspaceId, newName, newAgentKey }),
        authToken: this.getAuthToken(),
      },
    );
  }

  static async validateConfiguration(
    organizationId: string,
    agentId: string,
    configuration: AgentBuilderFullConfig,
  ): Promise<ValidationResponse> {
    return apiClient.request(
      `/api/v1/organizations/${organizationId}/agents/${agentId}/builder/validate`,
      {
        method: "POST",
        body: JSON.stringify({ configuration }),
        authToken: this.getAuthToken(),
      },
    );
  }

  static async listRevisions(
    organizationId: string,
    agentId: string,
    page = 1,
    pageSize = 20,
  ): Promise<{
    items: BuilderRevisionItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    return apiClient.request(
      `/api/v1/organizations/${organizationId}/agents/${agentId}/builder/revisions?page=${page}&pageSize=${pageSize}`,
      { authToken: this.getAuthToken() },
    );
  }

  static async compareRevisions(
    organizationId: string,
    agentId: string,
    baseRevisionId: string,
    targetRevisionId: string,
  ): Promise<{
    baseRevision: BuilderRevisionItem;
    targetRevision: BuilderRevisionItem;
    diffs: RevisionDiffItem[];
  }> {
    return apiClient.request(
      `/api/v1/organizations/${organizationId}/agents/${agentId}/builder/revisions/compare?baseRevisionId=${baseRevisionId}&targetRevisionId=${targetRevisionId}`,
      { authToken: this.getAuthToken() },
    );
  }

  static async restoreRevision(
    organizationId: string,
    agentId: string,
    revisionId: string,
  ): Promise<{ revision: BuilderRevisionItem }> {
    return apiClient.request(
      `/api/v1/organizations/${organizationId}/agents/${agentId}/builder/revisions/${revisionId}/restore`,
      {
        method: "POST",
        authToken: this.getAuthToken(),
      },
    );
  }

  static async executeMockPreview(
    organizationId: string,
    agentId: string,
    testPrompt: string,
    configuration: AgentBuilderFullConfig,
  ): Promise<PreviewResponse> {
    return apiClient.request(
      `/api/v1/organizations/${organizationId}/agents/${agentId}/builder/preview`,
      {
        method: "POST",
        body: JSON.stringify({ testPrompt, configuration }),
        authToken: this.getAuthToken(),
      },
    );
  }
}
