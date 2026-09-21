export type JsonRecord = Record<string, unknown>;
export type WorkflowStatus = "draft" | "active" | "archived";
export type WorkflowStepType =
  "agent" | "tool" | "knowledge" | "condition" | "save" | "notification";
export type WorkflowRunStatus =
  "pending" | "running" | "waiting" | "completed" | "failed" | "cancelled";
export type WorkflowStepRunStatus = "pending" | "running" | "completed" | "failed" | "skipped";
export type WorkflowTaskStatus =
  | "pending"
  | "assigned"
  | "in_progress"
  | "blocked"
  | "waiting"
  | "completed"
  | "cancelled"
  | "failed";

export type WorkflowRecord = {
  id: string;
  organizationId: string;
  workspaceId: string;
  agentId: string | null;
  name: string;
  description: string;
  status: WorkflowStatus;
  version: string;
  revision: number;
  configuration: JsonRecord;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

export type WorkflowStepRecord = {
  id: string;
  organizationId: string;
  workflowId: string;
  name: string;
  type: WorkflowStepType;
  stepOrder: number;
  revision: number;
  configuration: JsonRecord;
  timeoutSeconds: number | null;
  maxAttempts: number;
  retryDelayMs: number;
  createdAt: Date;
  updatedAt: Date;
};

export type WorkflowRunRecord = {
  id: string;
  organizationId: string;
  workspaceId: string;
  workflowId: string;
  workflowRevision: number;
  agentRunId: string | null;
  requestedBy: string;
  status: WorkflowRunStatus;
  idempotencyKey: string | null;
  input: JsonRecord;
  output: JsonRecord | null;
  executionContext: JsonRecord;
  definitionSnapshot: JsonRecord;
  stepsSnapshot: JsonRecord[];
  executionAuthority: string;
  currentStepId: string | null;
  safeErrorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type WorkflowStepRunRecord = {
  id: string;
  organizationId: string;
  workflowRunId: string;
  workflowStepId: string;
  status: WorkflowStepRunStatus;
  attempt: number;
  input: JsonRecord;
  output: JsonRecord | null;
  metadata: JsonRecord;
  safeErrorMessage: string | null;
  reportedBy: string;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type WorkflowTaskRecord = {
  id: string;
  organizationId: string;
  workspaceId: string;
  workflowRunId: string;
  workflowStepId: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  status: WorkflowTaskStatus;
  assignedUserId: string | null;
  assignedRole: string | null;
  assignedAgentId: string | null;
  input: JsonRecord;
  output: JsonRecord | null;
  metadata: JsonRecord;
  dueAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

export type WorkflowStepInput = {
  id?: string;
  name: string;
  type: WorkflowStepType;
  order: number;
  configuration: JsonRecord;
  timeoutSeconds?: number;
  retryPolicy?: { maxAttempts: number; delay: number };
};

export type CreateWorkflowInput = {
  id?: string;
  organizationId: string;
  workspaceId: string;
  agentId?: string;
  name: string;
  description: string;
  status: WorkflowStatus;
  version: string;
  configuration: JsonRecord;
  createdBy: string;
};

export type UpdateWorkflowInput = Partial<
  Pick<
    CreateWorkflowInput,
    "agentId" | "name" | "description" | "status" | "version" | "configuration"
  >
>;

export type UpdateWorkflowRequest = UpdateWorkflowInput & { expectedRevision: number };

export type CreateWorkflowRunInput = {
  id?: string;
  organizationId: string;
  workflowId: string;
  requestedBy: string;
  agentRunId?: string;
  input: JsonRecord;
  executionContext: JsonRecord;
  idempotencyKey?: string;
};

export type UpdateWorkflowRunInput = {
  status: WorkflowRunStatus;
  currentStepId?: string | null;
  output?: JsonRecord;
  error?: string;
  executionContext?: JsonRecord;
  stepResults?: Record<
    string,
    {
      success: boolean;
      status: WorkflowStepRunStatus;
      data?: unknown;
      error?: string;
      metadata?: JsonRecord;
      startedAt?: string;
      completedAt?: string;
    }
  >;
  reportedBy: string;
};

export type CreateWorkflowTaskInput = {
  organizationId: string;
  workflowRunId: string;
  workflowStepId: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  assignedUserId?: string;
  assignedRole?: string;
  assignedAgentId?: string;
  input: JsonRecord;
  metadata: JsonRecord;
  dueAt?: Date;
  createdBy: string;
};

export type UpdateWorkflowTaskInput = {
  status: WorkflowTaskStatus;
  output?: JsonRecord;
  assignedUserId?: string | null;
  assignedRole?: string | null;
  assignedAgentId?: string | null;
};
