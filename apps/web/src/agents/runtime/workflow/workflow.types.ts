export type WorkflowStatus = "draft" | "active" | "archived";

export interface Workflow {
  id: string;
  organizationId: string;
  agentInstanceId?: string; // Optional: If the workflow belongs directly to an agent
  name: string;
  description: string;
  status: WorkflowStatus;
  version: string;
  configuration: Record<string, any>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type StepType = "agent" | "tool" | "knowledge" | "condition" | "save" | "notification";
export type StepStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export interface RetryPolicy {
  maxAttempts: number;
  delay: number;
}

export interface WorkflowStep {
  id: string;
  workflowId: string;
  name: string;
  type: StepType;
  order: number;
  configuration: Record<string, any>;
  timeoutSeconds?: number;
  retryPolicy?: RetryPolicy;
  status?: StepStatus;
}

export type TaskStatus = "pending" | "running" | "waiting" | "completed" | "failed" | "cancelled";

export interface Task {
  id: string;
  organizationId: string;
  workflowId: string;
  agentRunId?: string; // If this task is part of an overarching agent run
  status: TaskStatus;
  input: Record<string, any>;
  output?: Record<string, any>;
  currentStepId?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  stepResults: Record<string, StepResult>; // stepId -> StepResult
}

export interface StepResult {
  stepId: string;
  success: boolean;
  status: StepStatus;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
  startedAt: string;
  completedAt: string;
}

export interface WorkflowExecutionContext {
  organizationId: string;
  userId: string;
  agentInstanceId?: string;
  taskId: string;
  task?: Task;
  workflow: Workflow;
  steps: WorkflowStep[];
  previousResults: Record<string, any>;
  variables: Record<string, any>;
}
