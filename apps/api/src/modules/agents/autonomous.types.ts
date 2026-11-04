export type AutonomyLevel = "L0" | "L1" | "L2" | "L3";

export type TaskTargetType = "workflow" | "agent";

export type TaskStatus = "draft" | "active" | "paused" | "disabled" | "archived";

export type TriggerType = "schedule" | "event" | "webhook" | "manual";

export type ScheduleType = "once" | "recurring";

export type MissedSchedulePolicy = "run_once" | "skip" | "run_all";

export type TaskRunStatus =
  | "queued"
  | "leased"
  | "running"
  | "paused"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "cancelled"
  | "timed_out";

export type CheckpointType =
  | "step_completed"
  | "waiting_approval"
  | "retry_recovery"
  | "graceful_shutdown";

export type AutonomousEventType =
  | "task_queued"
  | "lease_acquired"
  | "lease_renewed"
  | "step_dispatched"
  | "approval_requested"
  | "approval_granted"
  | "approval_rejected"
  | "plan_adapted"
  | "checkpoint_saved"
  | "task_completed"
  | "task_failed"
  | "task_cancelled"
  | "emergency_stopped";

export interface TaskExecutionPolicy {
  maxRuntimeSeconds: number;
  maxRetries: number;
  timeoutSeconds: number;
  maxConcurrency: number;
  retryDelaySeconds: number;
}

export interface TaskApprovalPolicy {
  requireApprovalForMutations: boolean;
  requireApprovalOnReplanning: boolean;
  allowedApproverRoles: string[];
}

export interface TaskLimits {
  maxDailyRuns: number;
  maxTokensPerRun: number;
  maxCostUsdPerRun: number;
}

export interface AutonomousTaskPolicyEntity {
  id: string;
  organizationId: string;
  workspaceId: string;
  maxActiveTasks: number;
  maxGlobalConcurrency: number;
  defaultAutonomyLevel: AutonomyLevel;
  allowedAutonomyLevels: AutonomyLevel[];
  emergencyStopAll: boolean;
  emergencyStoppedAt?: Date | null;
  emergencyStoppedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutonomousTaskDefinitionEntity {
  id: string;
  organizationId: string;
  workspaceId: string;
  name: string;
  description: string;
  autonomyLevel: AutonomyLevel;
  targetType: TaskTargetType;
  workflowDefinitionId?: string | null;
  agentId?: string | null;
  status: TaskStatus;
  executionPolicy: TaskExecutionPolicy;
  approvalPolicy: TaskApprovalPolicy;
  limits: TaskLimits;
  defaultInput: Record<string, unknown>;
  createdBy?: string | null;
  emergencyStoppedAt?: Date | null;
  emergencyStoppedBy?: string | null;
  emergencyStopReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutonomousTaskTriggerEntity {
  id: string;
  taskDefinitionId: string;
  organizationId: string;
  workspaceId: string;
  name: string;
  triggerType: TriggerType;
  scheduleType?: ScheduleType | null;
  cronExpression?: string | null;
  timezone: string;
  scheduledAt?: Date | null;
  nextRunAt?: Date | null;
  lastRunAt?: Date | null;
  eventPattern?: string | null;
  missedSchedulePolicy: MissedSchedulePolicy;
  isEnabled: boolean;
  configuration: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlanAdaptation {
  revision: number;
  reason: string;
  failedStepKey?: string;
  originalPlan: Record<string, unknown>;
  adaptedPlan: Record<string, unknown>;
  adaptedAt: string;
  requiresRenewedApproval: boolean;
}

export interface AutonomousTaskRunEntity {
  id: string;
  taskDefinitionId: string;
  triggerId?: string | null;
  organizationId: string;
  workspaceId: string;
  workflowRunId?: string | null;
  agentRunId?: string | null;
  status: TaskRunStatus;
  idempotencyKey: string;
  autonomyLevel: AutonomyLevel;
  workerId?: string | null;
  leasedAt?: Date | null;
  leaseExpiresAt?: Date | null;
  heartbeatAt?: Date | null;
  retryCount: number;
  maxRetries: number;
  inputPayload: Record<string, unknown>;
  outputPayload?: Record<string, unknown> | null;
  errorDetails?: Record<string, unknown> | null;
  adaptationHistory: PlanAdaptation[];
  currentPlanRevision: number;
  startedAt?: Date | null;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutonomousTaskCheckpointEntity {
  id: string;
  taskRunId: string;
  organizationId: string;
  checkpointType: CheckpointType;
  stepPointer?: string | null;
  stateSnapshot: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface AutonomousTaskEventEntity {
  id: string;
  taskRunId: string;
  organizationId: string;
  eventType: AutonomousEventType;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export type FailureClassification = "retryable" | "terminal";

export interface FailureAnalysis {
  classification: FailureClassification;
  reason: string;
  canReplan: boolean;
  suggestedAction: "retry" | "replan" | "abort" | "require_approval";
}

// Request DTOs
export interface CreateTaskDefinitionDto {
  name: string;
  description: string;
  autonomyLevel?: AutonomyLevel;
  targetType: TaskTargetType;
  workflowDefinitionId?: string;
  agentId?: string;
  executionPolicy?: Partial<TaskExecutionPolicy>;
  approvalPolicy?: Partial<TaskApprovalPolicy>;
  limits?: Partial<TaskLimits>;
  defaultInput?: Record<string, unknown>;
}

export interface UpdateTaskDefinitionDto {
  name?: string;
  description?: string;
  autonomyLevel?: AutonomyLevel;
  status?: TaskStatus;
  executionPolicy?: Partial<TaskExecutionPolicy>;
  approvalPolicy?: Partial<TaskApprovalPolicy>;
  limits?: Partial<TaskLimits>;
  defaultInput?: Record<string, unknown>;
}

export interface CreateTaskTriggerDto {
  taskDefinitionId: string;
  name: string;
  triggerType: TriggerType;
  scheduleType?: ScheduleType;
  cronExpression?: string;
  timezone?: string;
  scheduledAt?: string;
  eventPattern?: string;
  missedSchedulePolicy?: MissedSchedulePolicy;
  configuration?: Record<string, unknown>;
}

export interface TriggerTaskRunDto {
  input?: Record<string, unknown>;
  idempotencyKey?: string;
  autonomyLevelOverride?: AutonomyLevel;
}
