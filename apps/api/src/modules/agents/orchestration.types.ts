export type AgentTeamRole = "planner" | "specialist" | "reviewer" | "supervisor";
export type AgentTeamStatus = "active" | "inactive" | "archived";

export type WorkflowPattern = "sequential" | "parallel" | "supervisor_worker";
export type WorkflowDefinitionStatus = "draft" | "validated" | "active" | "archived";

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

export type WorkflowStepRunStatus =
  | "pending"
  | "running"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "skipped"
  | "cancelled";

export type WorkflowArtifactVisibility = "private" | "workspace" | "organization";

export interface AgentTeamRecord {
  id: string;
  organizationId: string;
  workspaceId: string;
  name: string;
  description: string;
  status: AgentTeamStatus;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  members?: AgentTeamMemberRecord[];
}

export interface AgentTeamMemberRecord {
  id: string;
  teamId: string;
  organizationId: string;
  agentId: string;
  role: AgentTeamRole;
  capabilities: string[];
  priority: number;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
  agentName?: string;
  agentKey?: string;
}

export interface AgentWorkflowStepRecord {
  id: string;
  workflowDefinitionId: string;
  organizationId: string;
  stepKey: string;
  name: string;
  description: string;
  stepOrder: number;
  assignedRole: AgentTeamRole;
  assignedAgentId: string | null;
  dependsOnStepKeys: string[];
  requiresApproval: boolean;
  approvalRoles?: string[] | null;
  inputMapping: Record<string, unknown>;
  outputKey: string;
  maxRetries: number;
  timeoutSeconds: number;
  configuration: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentWorkflowDefinitionRecord {
  id: string;
  organizationId: string;
  workspaceId: string;
  teamId: string | null;
  name: string;
  description: string;
  pattern: WorkflowPattern;
  status: WorkflowDefinitionStatus;
  version: string;
  revision: number;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown> | null;
  configuration: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  steps?: AgentWorkflowStepRecord[];
  team?: AgentTeamRecord | null;
}

export interface AgentWorkflowRunRecord {
  id: string;
  organizationId: string;
  workspaceId: string;
  workflowDefinitionId: string;
  teamId: string | null;
  workflowRevision: number;
  initiatorUserId: string;
  status: WorkflowRunStatus;
  idempotencyKey?: string | null;
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
  stepRuns?: AgentWorkflowStepRunRecord[];
  artifacts?: AgentWorkflowArtifactRecord[];
}

export interface AgentWorkflowStepRunRecord {
  id: string;
  workflowRunId: string;
  stepId: string;
  stepKey: string;
  organizationId: string;
  assignedAgentId?: string | null;
  agentRunId?: string | null;
  status: WorkflowStepRunStatus;
  attempt: number;
  inputPayload: Record<string, unknown>;
  outputPayload?: Record<string, unknown> | null;
  stepArtifacts?: Array<Record<string, unknown>> | null;
  safeErrorMessage?: string | null;
  durationMs: number;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentWorkflowArtifactRecord {
  id: string;
  workflowRunId: string;
  stepRunId?: string | null;
  organizationId: string;
  workspaceId: string;
  artifactType: string;
  name: string;
  content: Record<string, unknown>;
  provenance: {
    producerAgentId?: string;
    stepKey?: string;
    modelId?: string;
    timestamp?: string;
    inputHash?: string;
    [key: string]: unknown;
  };
  citations?: Array<Record<string, unknown>> | null;
  visibility: WorkflowArtifactVisibility;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentWorkflowEventRecord {
  id: string;
  workflowRunId: string;
  stepRunId?: string | null;
  organizationId: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface CreateAgentTeamInput {
  organizationId: string;
  workspaceId: string;
  name: string;
  description: string;
  members: Array<{
    agentId: string;
    role: AgentTeamRole;
    capabilities?: string[];
    priority?: number;
  }>;
  createdBy: string;
}

export interface UpdateAgentTeamInput {
  name?: string;
  description?: string;
  status?: AgentTeamStatus;
  members?: Array<{
    agentId: string;
    role: AgentTeamRole;
    capabilities?: string[];
    priority?: number;
  }>;
}

export interface CreateWorkflowStepInput {
  stepKey: string;
  name: string;
  description: string;
  stepOrder?: number;
  assignedRole: AgentTeamRole;
  assignedAgentId?: string | null;
  dependsOnStepKeys?: string[];
  requiresApproval?: boolean;
  approvalRoles?: string[];
  inputMapping?: Record<string, unknown>;
  outputKey: string;
  maxRetries?: number;
  timeoutSeconds?: number;
  configuration?: Record<string, unknown>;
}

export interface CreateWorkflowDefinitionInput {
  organizationId: string;
  workspaceId: string;
  teamId?: string | null;
  name: string;
  description: string;
  pattern?: WorkflowPattern;
  version?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown> | null;
  configuration?: Record<string, unknown>;
  steps: CreateWorkflowStepInput[];
  createdBy: string;
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

