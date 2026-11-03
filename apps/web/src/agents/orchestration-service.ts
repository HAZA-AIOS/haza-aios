import { apiClient } from "../api/api-client";
import { readStoredAuth } from "../auth/auth-storage";

export type AgentTeamRole = "planner" | "specialist" | "reviewer" | "supervisor";
export type WorkflowPattern = "sequential" | "parallel" | "supervisor_worker";
export type WorkflowRunStatus =
  | "draft"
  | "validated"
  | "queued"
  | "running"
  | "waiting_approval"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";

export interface AgentTeamMember {
  id: string;
  teamId: string;
  agentId: string;
  role: AgentTeamRole;
  capabilities: string[];
  priority: number;
  status: "active" | "inactive";
  agentName?: string;
  agentKey?: string;
}

export interface AgentTeam {
  id: string;
  organizationId: string;
  workspaceId: string;
  name: string;
  description: string;
  status: "active" | "inactive" | "archived";
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  members?: AgentTeamMember[];
}

export interface WorkflowStep {
  id: string;
  workflowDefinitionId: string;
  stepKey: string;
  name: string;
  description: string;
  stepOrder: number;
  assignedRole: AgentTeamRole;
  assignedAgentId?: string | null;
  dependsOnStepKeys: string[];
  requiresApproval: boolean;
  approvalRoles?: string[];
  inputMapping: Record<string, unknown>;
  outputKey: string;
  maxRetries: number;
  timeoutSeconds: number;
  configuration: Record<string, unknown>;
}

export interface WorkflowDefinition {
  id: string;
  organizationId: string;
  workspaceId: string;
  teamId?: string | null;
  name: string;
  description: string;
  pattern: WorkflowPattern;
  status: "draft" | "validated" | "active" | "archived";
  version: string;
  revision: number;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown> | null;
  configuration: Record<string, unknown>;
  steps?: WorkflowStep[];
  team?: AgentTeam | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowArtifact {
  id: string;
  workflowRunId: string;
  stepRunId?: string | null;
  artifactType: string;
  name: string;
  content: Record<string, unknown>;
  provenance: {
    producerAgentId?: string;
    stepKey?: string;
    modelId?: string;
    timestamp?: string;
    [key: string]: unknown;
  };
  citations?: Array<Record<string, unknown>> | null;
  visibility: "private" | "workspace" | "organization";
  createdAt: string;
}

export interface WorkflowStepRun {
  id: string;
  workflowRunId: string;
  stepId: string;
  stepKey: string;
  assignedAgentId?: string | null;
  agentRunId?: string | null;
  status: "pending" | "running" | "waiting_approval" | "completed" | "failed" | "skipped" | "cancelled";
  attempt: number;
  inputPayload: Record<string, unknown>;
  outputPayload?: Record<string, unknown> | null;
  stepArtifacts?: Array<Record<string, unknown>> | null;
  safeErrorMessage?: string | null;
  durationMs: number;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface WorkflowRun {
  id: string;
  organizationId: string;
  workspaceId: string;
  workflowDefinitionId: string;
  teamId?: string | null;
  workflowRevision: number;
  initiatorUserId: string;
  status: WorkflowRunStatus;
  initialInput: Record<string, unknown>;
  finalOutput?: Record<string, unknown> | null;
  sharedContext: Record<string, unknown>;
  currentStepKey?: string | null;
  totalDurationMs: number;
  totalEstimatedCostUsd: string;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  safeErrorMessage?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  stepRuns?: WorkflowStepRun[];
  artifacts?: WorkflowArtifact[];
}

export interface WorkflowEvent {
  id: string;
  workflowRunId: string;
  stepRunId?: string | null;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface WorkflowValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  cycleDetected: boolean;
  unresolvedRoles: string[];
  dependencyGraph: Record<string, string[]>;
  executionOrder: string[];
}

export class OrchestrationService {
  private getAuthToken(): string | null {
    return readStoredAuth()?.session?.accessToken ?? null;
  }

  // Agent Teams
  async listTeams(organizationId: string, workspaceId?: string): Promise<AgentTeam[]> {
    const q = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";
    const res = await apiClient.request<{ teams: AgentTeam[] }>(
      `/api/v1/organizations/${organizationId}/agent-teams${q}`,
      { authToken: this.getAuthToken() },
    );
    return res.teams;
  }

  async createTeam(
    organizationId: string,
    payload: {
      workspaceId: string;
      name: string;
      description?: string;
      members: Array<{
        agentId: string;
        role: AgentTeamRole;
        capabilities?: string[];
        priority?: number;
      }>;
    },
  ): Promise<AgentTeam> {
    const res = await apiClient.request<{ team: AgentTeam }>(
      `/api/v1/organizations/${organizationId}/agent-teams`,
      {
        method: "POST",
        body: payload,
        authToken: this.getAuthToken(),
      },
    );
    return res.team;
  }

  async getTeam(organizationId: string, teamId: string): Promise<AgentTeam> {
    const res = await apiClient.request<{ team: AgentTeam }>(
      `/api/v1/organizations/${organizationId}/agent-teams/${teamId}`,
      { authToken: this.getAuthToken() },
    );
    return res.team;
  }

  async deleteTeam(organizationId: string, teamId: string): Promise<void> {
    await apiClient.request<{ success: boolean }>(
      `/api/v1/organizations/${organizationId}/agent-teams/${teamId}`,
      {
        method: "DELETE",
        authToken: this.getAuthToken(),
      },
    );
  }

  // Workflow Definitions
  async listWorkflows(organizationId: string, workspaceId?: string): Promise<WorkflowDefinition[]> {
    const q = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";
    const res = await apiClient.request<{ workflows: WorkflowDefinition[] }>(
      `/api/v1/organizations/${organizationId}/agent-workflows${q}`,
      { authToken: this.getAuthToken() },
    );
    return res.workflows;
  }

  async createWorkflow(
    organizationId: string,
    payload: {
      workspaceId: string;
      teamId?: string | null;
      name: string;
      description: string;
      pattern?: WorkflowPattern;
      steps: Array<{
        stepKey: string;
        name: string;
        description: string;
        assignedRole: AgentTeamRole;
        assignedAgentId?: string | null;
        dependsOnStepKeys?: string[];
        requiresApproval?: boolean;
        approvalRoles?: string[];
        outputKey?: string;
        configuration?: Record<string, unknown>;
      }>;
    },
  ): Promise<WorkflowDefinition> {
    const res = await apiClient.request<{ workflow: WorkflowDefinition }>(
      `/api/v1/organizations/${organizationId}/agent-workflows`,
      {
        method: "POST",
        body: payload,
        authToken: this.getAuthToken(),
      },
    );
    return res.workflow;
  }

  async getWorkflow(organizationId: string, workflowId: string): Promise<WorkflowDefinition> {
    const res = await apiClient.request<{ workflow: WorkflowDefinition }>(
      `/api/v1/organizations/${organizationId}/agent-workflows/${workflowId}`,
      { authToken: this.getAuthToken() },
    );
    return res.workflow;
  }

  async validateWorkflow(
    organizationId: string,
    workflowId: string,
  ): Promise<WorkflowValidationResult> {
    const res = await apiClient.request<{ validation: WorkflowValidationResult }>(
      `/api/v1/organizations/${organizationId}/agent-workflows/${workflowId}/validate`,
      {
        method: "POST",
        authToken: this.getAuthToken(),
      },
    );
    return res.validation;
  }

  // Workflow Execution
  async startWorkflowRun(
    organizationId: string,
    workflowId: string,
    input: Record<string, unknown>,
    idempotencyKey?: string,
  ): Promise<WorkflowRun> {
    const res = await apiClient.request<{ run: WorkflowRun }>(
      `/api/v1/organizations/${organizationId}/agent-workflows/${workflowId}/runs`,
      {
        method: "POST",
        body: { input, idempotencyKey },
        authToken: this.getAuthToken(),
      },
    );
    return res.run;
  }

  async getWorkflowRun(organizationId: string, runId: string): Promise<WorkflowRun> {
    const res = await apiClient.request<{ run: WorkflowRun }>(
      `/api/v1/organizations/${organizationId}/agent-workflow-runs/${runId}`,
      { authToken: this.getAuthToken() },
    );
    return res.run;
  }

  async cancelWorkflowRun(organizationId: string, runId: string): Promise<WorkflowRun> {
    const res = await apiClient.request<{ run: WorkflowRun }>(
      `/api/v1/organizations/${organizationId}/agent-workflow-runs/${runId}/cancel`,
      {
        method: "POST",
        authToken: this.getAuthToken(),
      },
    );
    return res.run;
  }

  async listWorkflowEvents(organizationId: string, runId: string): Promise<WorkflowEvent[]> {
    const res = await apiClient.request<{ events: WorkflowEvent[] }>(
      `/api/v1/organizations/${organizationId}/agent-workflow-runs/${runId}/events`,
      { authToken: this.getAuthToken() },
    );
    return res.events;
  }

  async submitApproval(
    organizationId: string,
    runId: string,
    stepKey: string,
    decision: "approved" | "rejected",
    notes?: string,
  ): Promise<WorkflowRun> {
    const res = await apiClient.request<{ run: WorkflowRun }>(
      `/api/v1/organizations/${organizationId}/agent-workflow-runs/${runId}/steps/${stepKey}/approval`,
      {
        method: "POST",
        body: { decision, notes },
        authToken: this.getAuthToken(),
      },
    );
    return res.run;
  }
}

