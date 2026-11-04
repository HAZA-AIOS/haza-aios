import type { DatabaseClient } from "../../../database/client.js";
import { AutonomousTaskRepository } from "../repositories/autonomous-task.repository.js";
import { AutonomousSchedulerService } from "./autonomous-scheduler.service.js";
import { AutonomousRecoveryService } from "./autonomous-recovery.service.js";
import type { AgentOrchestrationService } from "./agent-orchestration.service.js";
import type { AgentRuntimeService } from "./agent-runtime.service.js";
import type {
  AutonomousTaskDefinitionEntity,
  AutonomousTaskPolicyEntity,
  AutonomousTaskRunEntity,
  AutonomousTaskTriggerEntity,
  AutonomyLevel,
  CreateTaskDefinitionDto,
  CreateTaskTriggerDto,
  TaskRunStatus,
  TaskStatus,
  TriggerTaskRunDto,
  UpdateTaskDefinitionDto,
} from "../autonomous.types.js";

export class AutonomousTaskService {
  private readonly repository: AutonomousTaskRepository;
  private readonly scheduler: AutonomousSchedulerService;
  private readonly recovery: AutonomousRecoveryService;

  constructor(
    database: DatabaseClient,
    injectedRepository?: AutonomousTaskRepository,
    injectedScheduler?: AutonomousSchedulerService,
    injectedRecovery?: AutonomousRecoveryService,
    private readonly orchestrationService?: AgentOrchestrationService,
    private readonly agentRuntimeService?: AgentRuntimeService,
  ) {
    this.repository = injectedRepository || new AutonomousTaskRepository({ db: database.db });
    this.scheduler = injectedScheduler || new AutonomousSchedulerService();
    this.recovery = injectedRecovery || new AutonomousRecoveryService();
  }

  // -------------------------------------------------------------
  // 1. POLICIES & GOVERNANCE
  // -------------------------------------------------------------
  async getPolicy(organizationId: string, workspaceId: string): Promise<AutonomousTaskPolicyEntity> {
    const policy = await this.repository.getPolicy(organizationId, workspaceId);
    if (policy) return policy;

    // Default policy if not explicitly set
    return await this.repository.upsertPolicy({
      organizationId,
      workspaceId,
      maxActiveTasks: 10,
      maxGlobalConcurrency: 5,
      defaultAutonomyLevel: "L0",
      allowedAutonomyLevels: ["L0", "L1", "L2", "L3"],
      emergencyStopAll: false,
    });
  }

  async updatePolicy(input: {
    organizationId: string;
    workspaceId: string;
    maxActiveTasks?: number;
    maxGlobalConcurrency?: number;
    defaultAutonomyLevel?: AutonomyLevel;
    allowedAutonomyLevels?: AutonomyLevel[];
    emergencyStopAll?: boolean;
    emergencyStoppedBy?: string | null;
  }): Promise<AutonomousTaskPolicyEntity> {
    return await this.repository.upsertPolicy(input);
  }

  async emergencyStopAll(organizationId: string, workspaceId: string, stoppedBy?: string): Promise<AutonomousTaskPolicyEntity> {
    return await this.repository.upsertPolicy({
      organizationId,
      workspaceId,
      emergencyStopAll: true,
      emergencyStoppedBy: stoppedBy,
    });
  }

  async resumeAll(organizationId: string, workspaceId: string): Promise<AutonomousTaskPolicyEntity> {
    return await this.repository.upsertPolicy({
      organizationId,
      workspaceId,
      emergencyStopAll: false,
      emergencyStoppedBy: null,
    });
  }

  // -------------------------------------------------------------
  // 2. TASK DEFINITION MANAGEMENT
  // -------------------------------------------------------------
  async createTask(
    organizationId: string,
    workspaceId: string,
    input: CreateTaskDefinitionDto,
    createdBy?: string,
  ): Promise<AutonomousTaskDefinitionEntity> {
    const policy = await this.getPolicy(organizationId, workspaceId);

    // Verify organization active task limit
    const existingTasks = await this.repository.listDefinitions(organizationId, workspaceId, "active");
    if (existingTasks.length >= policy.maxActiveTasks) {
      throw new Error(
        `Organization task limit exceeded: Maximum ${policy.maxActiveTasks} active tasks permitted.`,
      );
    }

    // Verify autonomy level is permitted
    const autonomy = input.autonomyLevel || policy.defaultAutonomyLevel;
    if (!policy.allowedAutonomyLevels.includes(autonomy)) {
      throw new Error(
        `Autonomy level '${autonomy}' is not allowed by organization policy (permitted: ${policy.allowedAutonomyLevels.join(", ")}).`,
      );
    }

    return await this.repository.createDefinition(organizationId, workspaceId, input, createdBy);
  }

  async getTask(organizationId: string, taskId: string): Promise<AutonomousTaskDefinitionEntity> {
    const task = await this.repository.getDefinitionById(organizationId, taskId);
    if (!task) throw new Error(`Autonomous task definition not found: ${taskId}`);
    return task;
  }

  async listTasks(
    organizationId: string,
    workspaceId?: string,
    status?: TaskStatus,
  ): Promise<AutonomousTaskDefinitionEntity[]> {
    return await this.repository.listDefinitions(organizationId, workspaceId, status);
  }

  async updateTask(
    organizationId: string,
    taskId: string,
    updates: UpdateTaskDefinitionDto,
  ): Promise<AutonomousTaskDefinitionEntity> {
    const updated = await this.repository.updateDefinition(organizationId, taskId, updates);
    if (!updated) throw new Error(`Autonomous task definition not found: ${taskId}`);
    return updated;
  }

  async pauseTask(organizationId: string, taskId: string): Promise<AutonomousTaskDefinitionEntity> {
    return await this.updateTask(organizationId, taskId, { status: "paused" });
  }

  async resumeTask(organizationId: string, taskId: string): Promise<AutonomousTaskDefinitionEntity> {
    const task = await this.getTask(organizationId, taskId);
    if (task.emergencyStoppedAt) {
      const cleared = await this.repository.clearEmergencyStop(organizationId, taskId);
      if (!cleared) throw new Error(`Failed to clear emergency stop on task: ${taskId}`);
      return cleared;
    }
    return await this.updateTask(organizationId, taskId, { status: "active" });
  }

  async emergencyStopTask(
    organizationId: string,
    taskId: string,
    stoppedBy?: string,
    reason?: string,
  ): Promise<AutonomousTaskDefinitionEntity> {
    const stopped = await this.repository.setEmergencyStop(organizationId, taskId, stoppedBy, reason);
    if (!stopped) throw new Error(`Autonomous task definition not found: ${taskId}`);
    return stopped;
  }

  // -------------------------------------------------------------
  // 3. TRIGGER MANAGEMENT & SCHEDULING
  // -------------------------------------------------------------
  async createTrigger(
    organizationId: string,
    workspaceId: string,
    input: CreateTaskTriggerDto,
  ): Promise<AutonomousTaskTriggerEntity> {
    // Validate task exists
    await this.getTask(organizationId, input.taskDefinitionId);

    return await this.repository.createTrigger(organizationId, workspaceId, input);
  }

  async listTriggers(
    organizationId: string,
    taskDefinitionId?: string,
  ): Promise<AutonomousTaskTriggerEntity[]> {
    return await this.repository.listTriggers(organizationId, taskDefinitionId);
  }

  async toggleTrigger(
    organizationId: string,
    triggerId: string,
    isEnabled: boolean,
  ): Promise<AutonomousTaskTriggerEntity> {
    const updated = await this.repository.updateTrigger(organizationId, triggerId, { isEnabled });
    if (!updated) throw new Error(`Autonomous task trigger not found: ${triggerId}`);
    return updated;
  }

  async deleteTrigger(organizationId: string, triggerId: string): Promise<boolean> {
    return await this.repository.deleteTrigger(organizationId, triggerId);
  }

  /**
   * Evaluates due scheduled triggers and enqueues runs.
   */
  async processDueTriggers(now: Date = new Date()): Promise<AutonomousTaskRunEntity[]> {
    const dueTriggers = await this.repository.listTriggersDue(now);
    const enqueuedRuns: AutonomousTaskRunEntity[] = [];

    for (const trigger of dueTriggers) {
      try {
        const task = await this.repository.getDefinitionById(trigger.organizationId, trigger.taskDefinitionId);
        if (!task || task.status !== "active" || task.emergencyStoppedAt) {
          continue;
        }

        const policy = await this.getPolicy(task.organizationId, task.workspaceId);
        if (policy.emergencyStopAll) {
          continue;
        }

        const evaluation = this.scheduler.evaluateMissedWindows(trigger, now);
        for (const windowTime of evaluation.windowsToRun) {
          const idempotencyKey = this.scheduler.generateIdempotencyKey(
            task.id,
            trigger.id,
            windowTime.getTime(),
          );

          const run = await this.repository.createRun({
            taskDefinitionId: task.id,
            triggerId: trigger.id,
            organizationId: task.organizationId,
            workspaceId: task.workspaceId,
            autonomyLevel: task.autonomyLevel,
            idempotencyKey,
            inputPayload: {
              ...task.defaultInput,
              ...trigger.configuration,
              _scheduledAt: windowTime.toISOString(),
            },
            maxRetries: task.executionPolicy.maxRetries,
          });

          await this.repository.createEvent({
            taskRunId: run.id,
            organizationId: task.organizationId,
            eventType: "task_queued",
            payload: { triggerId: trigger.id, scheduledTime: windowTime.toISOString() },
          });

          enqueuedRuns.push(run);
        }

        // Update trigger next_run_at and last_run_at
        await this.repository.updateTrigger(trigger.organizationId, trigger.id, {
          nextRunAt: evaluation.nextScheduledRun,
          lastRunAt: now,
          isEnabled: evaluation.nextScheduledRun !== null,
        });
      } catch (err) {
        // Individual trigger failure does not halt scheduler
        console.error(`Error processing trigger ${trigger.id}:`, err);
      }
    }

    return enqueuedRuns;
  }

  /**
   * Dispatches application domain events to matching triggers.
   */
  async dispatchDomainEvent(
    organizationId: string,
    eventName: string,
    eventPayload: Record<string, unknown>,
    eventId: string,
  ): Promise<AutonomousTaskRunEntity[]> {
    const triggers = await this.repository.listTriggers(organizationId);
    const triggeredRuns: AutonomousTaskRunEntity[] = [];

    for (const trigger of triggers) {
      if (!trigger.isEnabled || trigger.triggerType !== "event") continue;
      if (!this.scheduler.matchesEventPattern(trigger.eventPattern, eventName)) continue;

      const task = await this.repository.getDefinitionById(organizationId, trigger.taskDefinitionId);
      if (!task || task.status !== "active" || task.emergencyStoppedAt) continue;

      const policy = await this.getPolicy(organizationId, task.workspaceId);
      if (policy.emergencyStopAll) continue;

      const idempotencyKey = this.scheduler.generateIdempotencyKey(task.id, trigger.id, eventId);

      const run = await this.repository.createRun({
        taskDefinitionId: task.id,
        triggerId: trigger.id,
        organizationId: task.organizationId,
        workspaceId: task.workspaceId,
        autonomyLevel: task.autonomyLevel,
        idempotencyKey,
        inputPayload: {
          ...task.defaultInput,
          ...eventPayload,
          _eventName: eventName,
          _eventId: eventId,
        },
        maxRetries: task.executionPolicy.maxRetries,
      });

      await this.repository.createEvent({
        taskRunId: run.id,
        organizationId: task.organizationId,
        eventType: "task_queued",
        payload: { eventName, eventId, triggerId: trigger.id },
      });

      triggeredRuns.push(run);
    }

    return triggeredRuns;
  }

  // -------------------------------------------------------------
  // 4. MANUAL & ON-DEMAND RUN LAUNCH
  // -------------------------------------------------------------
  async triggerTaskRun(
    organizationId: string,
    taskId: string,
    dto: TriggerTaskRunDto = {},
  ): Promise<AutonomousTaskRunEntity> {
    const task = await this.getTask(organizationId, taskId);
    if (task.status !== "active") {
      throw new Error(`Cannot trigger task: Current status is '${task.status}'.`);
    }
    if (task.emergencyStoppedAt) {
      throw new Error(`Cannot trigger task: Emergency stopped (${task.emergencyStopReason}).`);
    }

    const policy = await this.getPolicy(organizationId, task.workspaceId);
    if (policy.emergencyStopAll) {
      throw new Error("Cannot trigger task: Organization emergency stop is active.");
    }

    const autonomy = dto.autonomyLevelOverride || task.autonomyLevel;
    const idempotencyKey =
      dto.idempotencyKey || `manual_${taskId}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const run = await this.repository.createRun({
      taskDefinitionId: task.id,
      organizationId,
      workspaceId: task.workspaceId,
      autonomyLevel: autonomy,
      idempotencyKey,
      inputPayload: { ...task.defaultInput, ...(dto.input || {}) },
      maxRetries: task.executionPolicy.maxRetries,
    });

    await this.repository.createEvent({
      taskRunId: run.id,
      organizationId,
      eventType: "task_queued",
      payload: { mode: "manual", autonomyLevel: autonomy },
    });

    return run;
  }

  // -------------------------------------------------------------
  // 5. WORKER LEASING & EXECUTION ENGINE
  // -------------------------------------------------------------
  async leaseNextRun(workerId: string, leaseDurationSeconds: number = 60): Promise<AutonomousTaskRunEntity | null> {
    const run = await this.repository.leaseNextQueuedRun(workerId, leaseDurationSeconds);
    if (!run) return null;

    await this.repository.createEvent({
      taskRunId: run.id,
      organizationId: run.organizationId,
      eventType: "lease_acquired",
      payload: { workerId, leaseDurationSeconds },
    });

    return run;
  }

  async heartbeat(runId: string, workerId: string, extensionSeconds: number = 60): Promise<boolean> {
    return await this.repository.heartbeat(runId, workerId, extensionSeconds);
  }

  async reclaimStaleLeases(now: Date = new Date()): Promise<number> {
    return await this.repository.reclaimStaleLeases(now);
  }

  async executeLeasedRun(
    organizationId: string,
    runId: string,
    workerId: string,
  ): Promise<AutonomousTaskRunEntity> {
    const run = await this.repository.getRunById(organizationId, runId);
    if (!run) throw new Error(`Task run not found: ${runId}`);
    if (run.workerId !== workerId) {
      throw new Error(`Worker mismatch: Run is leased to '${run.workerId}', not '${workerId}'.`);
    }

    const task = await this.getTask(organizationId, run.taskDefinitionId);

    // If autonomy is L0, immediately transition to waiting_approval before running
    if (run.autonomyLevel === "L0") {
      const paused = await this.repository.updateRun(organizationId, runId, {
        status: "waiting_approval",
      });
      await this.repository.createEvent({
        taskRunId: runId,
        organizationId,
        eventType: "approval_requested",
        payload: { reason: "L0 Full Manual Approval required prior to execution." },
      });
      return paused!;
    }

    // Transition to running
    await this.repository.updateRun(organizationId, runId, { status: "running" });

    try {
      let output: Record<string, unknown> = {};

      if (task.targetType === "workflow" && task.workflowDefinitionId && this.orchestrationService) {
        // Dispatch via durable multi-agent workflow runtime
        const wfRun = await this.orchestrationService.startWorkflowRun(
          organizationId,
          task.workflowDefinitionId,
          run.inputPayload,
          task.createdBy || "system",
        );

        await this.repository.updateRun(organizationId, runId, { workflowRunId: wfRun.id });
        output = { workflowRunId: wfRun.id, status: wfRun.status };
      } else if (task.targetType === "agent" && task.agentId && this.agentRuntimeService) {
        // Dispatch to single agent runtime
        const agentResult = await this.agentRuntimeService.createRun({
          organizationId,
          agentId: task.agentId,
          userId: task.createdBy || "system",
          input: run.inputPayload,
          executionMode: "standard",
          metadata: {},
        });

        await this.repository.updateRun(organizationId, runId, { agentRunId: agentResult.run.id });
        output = { agentRunId: agentResult.run.id, status: agentResult.run.status };
      } else {
        // Standard autonomous unit execution
        output = {
          success: true,
          taskName: task.name,
          processedAt: new Date().toISOString(),
          autonomyLevel: run.autonomyLevel,
        };
      }

      // Checkpoint step completion
      await this.repository.createCheckpoint({
        taskRunId: runId,
        organizationId,
        checkpointType: "step_completed",
        stepPointer: "completed",
        stateSnapshot: output,
      });

      const completed = await this.repository.updateRun(organizationId, runId, {
        status: "completed",
        outputPayload: output,
        completedAt: new Date(),
      });

      await this.repository.createEvent({
        taskRunId: runId,
        organizationId,
        eventType: "task_completed",
        payload: output,
      });

      return completed!;
    } catch (err: any) {
      // Analyze failure
      const analysis = this.recovery.classifyFailure(err);

      if (analysis.classification === "retryable" && run.retryCount < run.maxRetries) {
        // Requeue for retry
        const requeued = await this.repository.updateRun(organizationId, runId, {
          status: "queued",
          retryCount: run.retryCount + 1,
          workerId: null,
          leaseExpiresAt: null,
          errorDetails: { message: err?.message || String(err), analysis },
        });

        await this.repository.createEvent({
          taskRunId: runId,
          organizationId,
          eventType: "task_failed",
          payload: { action: "requeued_for_retry", attempt: run.retryCount + 1, analysis },
        });

        return requeued!;
      }

      // Terminal failure
      const failed = await this.repository.updateRun(organizationId, runId, {
        status: "failed",
        errorDetails: { message: err?.message || String(err), analysis },
        completedAt: new Date(),
      });

      await this.repository.createEvent({
        taskRunId: runId,
        organizationId,
        eventType: "task_failed",
        payload: { terminal: true, error: err?.message || String(err), analysis },
      });

      return failed!;
    }
  }

  // -------------------------------------------------------------
  // 6. HUMAN APPROVALS & EXCEPTION HANDLING
  // -------------------------------------------------------------
  async approveRun(
    organizationId: string,
    runId: string,
    approverUserId: string,
  ): Promise<AutonomousTaskRunEntity> {
    const run = await this.repository.getRunById(organizationId, runId);
    if (!run) throw new Error(`Task run not found: ${runId}`);
    if (run.status !== "waiting_approval") {
      throw new Error(`Cannot approve run: Current status is '${run.status}' (expected 'waiting_approval').`);
    }

    const resumed = await this.repository.updateRun(organizationId, runId, {
      status: "queued", // Re-enters queue ready to be leased and processed
    });

    await this.repository.createEvent({
      taskRunId: runId,
      organizationId,
      eventType: "approval_granted",
      payload: { approverUserId },
    });

    return resumed!;
  }

  async rejectRun(
    organizationId: string,
    runId: string,
    rejecterUserId: string,
    rejectionReason?: string,
  ): Promise<AutonomousTaskRunEntity> {
    const run = await this.repository.getRunById(organizationId, runId);
    if (!run) throw new Error(`Task run not found: ${runId}`);

    const cancelled = await this.repository.updateRun(organizationId, runId, {
      status: "cancelled",
      completedAt: new Date(),
      errorDetails: { rejectionReason: rejectionReason || "Rejected by authorized operator", rejecterUserId },
    });

    await this.repository.createEvent({
      taskRunId: runId,
      organizationId,
      eventType: "approval_rejected",
      payload: { rejecterUserId, rejectionReason },
    });

    return cancelled!;
  }

  async cancelRun(organizationId: string, runId: string, reason?: string): Promise<AutonomousTaskRunEntity> {
    const run = await this.repository.getRunById(organizationId, runId);
    if (!run) throw new Error(`Task run not found: ${runId}`);

    const cancelled = await this.repository.updateRun(organizationId, runId, {
      status: "cancelled",
      completedAt: new Date(),
      errorDetails: { cancellationReason: reason || "Cancelled by operator" },
    });

    await this.repository.createEvent({
      taskRunId: runId,
      organizationId,
      eventType: "task_cancelled",
      payload: { reason },
    });

    return cancelled!;
  }

  // -------------------------------------------------------------
  // 7. INSPECTION & OBSERVABILITY
  // -------------------------------------------------------------
  async getRun(organizationId: string, runId: string): Promise<AutonomousTaskRunEntity> {
    const run = await this.repository.getRunById(organizationId, runId);
    if (!run) throw new Error(`Task run not found: ${runId}`);
    return run;
  }

  async listRuns(
    organizationId: string,
    filters?: { taskDefinitionId?: string; status?: TaskRunStatus; workspaceId?: string; limit?: number },
  ): Promise<AutonomousTaskRunEntity[]> {
    return await this.repository.listRuns(organizationId, filters);
  }

  async listEvents(organizationId: string, runId: string) {
    return await this.repository.listEvents(organizationId, runId);
  }

  async getLatestCheckpoint(organizationId: string, runId: string) {
    return await this.repository.getLatestCheckpoint(organizationId, runId);
  }
}
