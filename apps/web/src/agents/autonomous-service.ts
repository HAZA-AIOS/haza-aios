import { apiClient } from "../api/api-client";
import { readStoredAuth } from "../auth/auth-storage";

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

export interface AutonomousTaskPolicy {
  id: string;
  organizationId: string;
  workspaceId: string;
  maxActiveTasks: number;
  maxGlobalConcurrency: number;
  defaultAutonomyLevel: AutonomyLevel;
  allowedAutonomyLevels: AutonomyLevel[];
  emergencyStopAll: boolean;
  emergencyStoppedAt?: string | null;
  emergencyStoppedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AutonomousTaskDefinition {
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
  emergencyStoppedAt?: string | null;
  emergencyStoppedBy?: string | null;
  emergencyStopReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AutonomousTaskTrigger {
  id: string;
  taskDefinitionId: string;
  organizationId: string;
  workspaceId: string;
  name: string;
  triggerType: TriggerType;
  scheduleType?: ScheduleType | null;
  cronExpression?: string | null;
  timezone: string;
  scheduledAt?: string | null;
  nextRunAt?: string | null;
  lastRunAt?: string | null;
  eventPattern?: string | null;
  missedSchedulePolicy: MissedSchedulePolicy;
  isEnabled: boolean;
  configuration: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
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

export interface AutonomousTaskRun {
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
  leasedAt?: string | null;
  leaseExpiresAt?: string | null;
  heartbeatAt?: string | null;
  retryCount: number;
  maxRetries: number;
  inputPayload: Record<string, unknown>;
  outputPayload?: Record<string, unknown> | null;
  errorDetails?: Record<string, unknown> | null;
  adaptationHistory: PlanAdaptation[];
  currentPlanRevision: number;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AutonomousTaskCheckpoint {
  id: string;
  taskRunId: string;
  organizationId: string;
  checkpointType: CheckpointType;
  stepPointer?: string | null;
  stateSnapshot: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AutonomousTaskEvent {
  id: string;
  taskRunId: string;
  organizationId: string;
  eventType: AutonomousEventType;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface CreateTaskDefinitionPayload {
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

export interface CreateTriggerPayload {
  name: string;
  triggerType: TriggerType;
  scheduleType?: ScheduleType;
  cronExpression?: string;
  timezone?: string;
  scheduledAt?: string;
  eventPattern?: string;
  missedSchedulePolicy?: MissedSchedulePolicy;
  isEnabled?: boolean;
  configuration?: Record<string, unknown>;
}

export class AutonomousService {
  private getAuthToken(): string | null {
    return readStoredAuth()?.session?.accessToken ?? null;
  }

  // --- Policy Controls ---
  async getPolicy(organizationId: string): Promise<AutonomousTaskPolicy> {
    const res = await apiClient.request<{ policy: AutonomousTaskPolicy }>(
      `/api/v1/organizations/${organizationId}/autonomous-tasks/policy`,
      { authToken: this.getAuthToken() },
    );
    return res.policy;
  }

  async updatePolicy(
    organizationId: string,
    updates: Partial<AutonomousTaskPolicy>,
  ): Promise<AutonomousTaskPolicy> {
    const res = await apiClient.request<{ policy: AutonomousTaskPolicy }>(
      `/api/v1/organizations/${organizationId}/autonomous-tasks/policy`,
      {
        method: "PUT",
        body: JSON.stringify(updates),
        authToken: this.getAuthToken(),
      },
    );
    return res.policy;
  }

  async emergencyStopAll(
    organizationId: string,
    reason: string,
  ): Promise<AutonomousTaskPolicy> {
    const res = await apiClient.request<{ policy: AutonomousTaskPolicy }>(
      `/api/v1/organizations/${organizationId}/autonomous-tasks/emergency-stop-all`,
      {
        method: "POST",
        body: JSON.stringify({ reason }),
        authToken: this.getAuthToken(),
      },
    );
    return res.policy;
  }

  async resumeAll(organizationId: string): Promise<AutonomousTaskPolicy> {
    const res = await apiClient.request<{ policy: AutonomousTaskPolicy }>(
      `/api/v1/organizations/${organizationId}/autonomous-tasks/resume-all`,
      {
        method: "POST",
        body: JSON.stringify({}),
        authToken: this.getAuthToken(),
      },
    );
    return res.policy;
  }

  // --- Task Definitions ---
  async listTasks(
    organizationId: string,
    status?: TaskStatus,
  ): Promise<AutonomousTaskDefinition[]> {
    const q = status ? `?status=${encodeURIComponent(status)}` : "";
    const res = await apiClient.request<{ tasks: AutonomousTaskDefinition[] }>(
      `/api/v1/organizations/${organizationId}/autonomous-tasks${q}`,
      { authToken: this.getAuthToken() },
    );
    return res.tasks;
  }

  async createTask(
    organizationId: string,
    payload: CreateTaskDefinitionPayload,
  ): Promise<AutonomousTaskDefinition> {
    const res = await apiClient.request<{ task: AutonomousTaskDefinition }>(
      `/api/v1/organizations/${organizationId}/autonomous-tasks`,
      {
        method: "POST",
        body: JSON.stringify(payload),
        authToken: this.getAuthToken(),
      },
    );
    return res.task;
  }

  async getTask(
    organizationId: string,
    taskId: string,
  ): Promise<AutonomousTaskDefinition> {
    const res = await apiClient.request<{ task: AutonomousTaskDefinition }>(
      `/api/v1/organizations/${organizationId}/autonomous-tasks/${taskId}`,
      { authToken: this.getAuthToken() },
    );
    return res.task;
  }

  async updateTask(
    organizationId: string,
    taskId: string,
    updates: Partial<CreateTaskDefinitionPayload>,
  ): Promise<AutonomousTaskDefinition> {
    const res = await apiClient.request<{ task: AutonomousTaskDefinition }>(
      `/api/v1/organizations/${organizationId}/autonomous-tasks/${taskId}`,
      {
        method: "PUT",
        body: JSON.stringify(updates),
        authToken: this.getAuthToken(),
      },
    );
    return res.task;
  }

  async pauseTask(
    organizationId: string,
    taskId: string,
  ): Promise<AutonomousTaskDefinition> {
    const res = await apiClient.request<{ task: AutonomousTaskDefinition }>(
      `/api/v1/organizations/${organizationId}/autonomous-tasks/${taskId}/pause`,
      {
        method: "POST",
        body: JSON.stringify({}),
        authToken: this.getAuthToken(),
      },
    );
    return res.task;
  }

  async resumeTask(
    organizationId: string,
    taskId: string,
  ): Promise<AutonomousTaskDefinition> {
    const res = await apiClient.request<{ task: AutonomousTaskDefinition }>(
      `/api/v1/organizations/${organizationId}/autonomous-tasks/${taskId}/resume`,
      {
        method: "POST",
        body: JSON.stringify({}),
        authToken: this.getAuthToken(),
      },
    );
    return res.task;
  }

  async emergencyStopTask(
    organizationId: string,
    taskId: string,
    reason?: string,
  ): Promise<AutonomousTaskDefinition> {
    const res = await apiClient.request<{ task: AutonomousTaskDefinition }>(
      `/api/v1/organizations/${organizationId}/autonomous-tasks/${taskId}/emergency-stop`,
      {
        method: "POST",
        body: JSON.stringify({ reason }),
        authToken: this.getAuthToken(),
      },
    );
    return res.task;
  }

  async runTaskNow(
    organizationId: string,
    taskId: string,
    inputOverride?: Record<string, unknown>,
  ): Promise<AutonomousTaskRun> {
    const res = await apiClient.request<{ run: AutonomousTaskRun }>(
      `/api/v1/organizations/${organizationId}/autonomous-tasks/${taskId}/run-now`,
      {
        method: "POST",
        body: JSON.stringify({ input: inputOverride }),
        authToken: this.getAuthToken(),
      },
    );
    return res.run;
  }

  // --- Triggers ---
  async listTriggers(
    organizationId: string,
    taskId: string,
  ): Promise<AutonomousTaskTrigger[]> {
    const res = await apiClient.request<{ triggers: AutonomousTaskTrigger[] }>(
      `/api/v1/organizations/${organizationId}/autonomous-tasks/${taskId}/triggers`,
      { authToken: this.getAuthToken() },
    );
    return res.triggers;
  }

  async createTrigger(
    organizationId: string,
    taskId: string,
    payload: CreateTriggerPayload,
  ): Promise<AutonomousTaskTrigger> {
    const res = await apiClient.request<{ trigger: AutonomousTaskTrigger }>(
      `/api/v1/organizations/${organizationId}/autonomous-tasks/${taskId}/triggers`,
      {
        method: "POST",
        body: JSON.stringify(payload),
        authToken: this.getAuthToken(),
      },
    );
    return res.trigger;
  }

  async updateTrigger(
    organizationId: string,
    taskId: string,
    triggerId: string,
    updates: Partial<CreateTriggerPayload>,
  ): Promise<AutonomousTaskTrigger> {
    const res = await apiClient.request<{ trigger: AutonomousTaskTrigger }>(
      `/api/v1/organizations/${organizationId}/autonomous-tasks/${taskId}/triggers/${triggerId}`,
      {
        method: "PUT",
        body: JSON.stringify(updates),
        authToken: this.getAuthToken(),
      },
    );
    return res.trigger;
  }

  async deleteTrigger(
    organizationId: string,
    taskId: string,
    triggerId: string,
  ): Promise<{ success: boolean }> {
    return apiClient.request<{ success: boolean }>(
      `/api/v1/organizations/${organizationId}/autonomous-tasks/${taskId}/triggers/${triggerId}`,
      {
        method: "DELETE",
        authToken: this.getAuthToken(),
      },
    );
  }

  // --- Runs, Checkpoints & Events ---
  async listRuns(
    organizationId: string,
    filters?: { taskId?: string; status?: TaskRunStatus; limit?: number },
  ): Promise<AutonomousTaskRun[]> {
    const params = new URLSearchParams();
    if (filters?.taskId) params.set("taskId", filters.taskId);
    if (filters?.status) params.set("status", filters.status);
    if (filters?.limit) params.set("limit", filters.limit.toString());
    const query = params.toString() ? `?${params.toString()}` : "";

    const res = await apiClient.request<{ runs: AutonomousTaskRun[] }>(
      `/api/v1/organizations/${organizationId}/autonomous-task-runs${query}`,
      { authToken: this.getAuthToken() },
    );
    return res.runs;
  }

  async getRun(organizationId: string, runId: string): Promise<AutonomousTaskRun> {
    const res = await apiClient.request<{ run: AutonomousTaskRun }>(
      `/api/v1/organizations/${organizationId}/autonomous-task-runs/${runId}`,
      { authToken: this.getAuthToken() },
    );
    return res.run;
  }

  async getCheckpoints(
    organizationId: string,
    runId: string,
  ): Promise<AutonomousTaskCheckpoint[]> {
    const res = await apiClient.request<{ checkpoints: AutonomousTaskCheckpoint[] }>(
      `/api/v1/organizations/${organizationId}/autonomous-task-runs/${runId}/checkpoints`,
      { authToken: this.getAuthToken() },
    );
    return res.checkpoints;
  }

  async getEvents(
    organizationId: string,
    runId: string,
  ): Promise<AutonomousTaskEvent[]> {
    const res = await apiClient.request<{ events: AutonomousTaskEvent[] }>(
      `/api/v1/organizations/${organizationId}/autonomous-task-runs/${runId}/events`,
      { authToken: this.getAuthToken() },
    );
    return res.events;
  }

  async approveRun(
    organizationId: string,
    runId: string,
    feedback?: string,
  ): Promise<AutonomousTaskRun> {
    const res = await apiClient.request<{ run: AutonomousTaskRun }>(
      `/api/v1/organizations/${organizationId}/autonomous-task-runs/${runId}/approve`,
      {
        method: "POST",
        body: JSON.stringify({ feedback }),
        authToken: this.getAuthToken(),
      },
    );
    return res.run;
  }

  async rejectRun(
    organizationId: string,
    runId: string,
    reason: string,
  ): Promise<AutonomousTaskRun> {
    const res = await apiClient.request<{ run: AutonomousTaskRun }>(
      `/api/v1/organizations/${organizationId}/autonomous-task-runs/${runId}/reject`,
      {
        method: "POST",
        body: JSON.stringify({ reason }),
        authToken: this.getAuthToken(),
      },
    );
    return res.run;
  }

  async createCheckpoint(
    organizationId: string,
    runId: string,
    checkpointType: CheckpointType,
    snapshot: Record<string, unknown>,
  ): Promise<AutonomousTaskCheckpoint> {
    const res = await apiClient.request<{ checkpoint: AutonomousTaskCheckpoint }>(
      `/api/v1/organizations/${organizationId}/autonomous-task-runs/${runId}/checkpoint`,
      {
        method: "POST",
        body: JSON.stringify({ checkpointType, snapshot }),
        authToken: this.getAuthToken(),
      },
    );
    return res.checkpoint;
  }
}
