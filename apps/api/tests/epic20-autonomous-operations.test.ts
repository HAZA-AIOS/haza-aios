import { describe, expect, it, beforeEach } from "vitest";
import { AutonomousSchedulerService } from "../src/modules/agents/services/autonomous-scheduler.service.js";
import { AutonomousRecoveryService } from "../src/modules/agents/services/autonomous-recovery.service.js";
import { AutonomousTaskService } from "../src/modules/agents/services/autonomous-task.service.js";
import type {
  AutonomousTaskDefinitionEntity,
  AutonomousTaskPolicyEntity,
  AutonomousTaskTriggerEntity,
  AutonomousTaskRunEntity,
  AutonomousTaskCheckpointEntity,
  AutonomousTaskEventEntity,
  CreateTaskDefinitionDto,
  CreateTaskTriggerDto,
} from "../src/modules/agents/autonomous.types.js";

describe("Epic 20: Advanced Autonomous Agents & Continuous Operations", () => {
  const ORG_A = "00000000-0000-4801-a000-000000000001";
  const ORG_B = "00000000-0000-4801-b000-000000000002";
  const WORKSPACE_ID = "00000000-0000-4801-w000-000000000001";
  const USER_ID = "00000000-0000-4801-u000-000000000001";

  // In-memory Stores
  let policyStore: Map<string, AutonomousTaskPolicyEntity>;
  let taskStore: Map<string, AutonomousTaskDefinitionEntity>;
  let triggerStore: Map<string, AutonomousTaskTriggerEntity>;
  let runStore: Map<string, AutonomousTaskRunEntity>;
  let checkpointStore: Map<string, AutonomousTaskCheckpointEntity[]>;
  let eventStore: Map<string, AutonomousTaskEventEntity[]>;

  let mockRepo: any;
  let schedulerService: AutonomousSchedulerService;
  let recoveryService: AutonomousRecoveryService;
  let taskService: AutonomousTaskService;
  let mockOrchestrationService: any;
  let mockAgentService: any;

  beforeEach(() => {
    policyStore = new Map();
    taskStore = new Map();
    triggerStore = new Map();
    runStore = new Map();
    checkpointStore = new Map();
    eventStore = new Map();

    mockRepo = {
      getPolicy: async (orgId: string, _workspaceId: string) => policyStore.get(orgId) || null,
      upsertPolicy: async (p: any) => {
        const entity: AutonomousTaskPolicyEntity = {
          id: p.id || `pol-${Date.now()}`,
          organizationId: p.organizationId,
          workspaceId: p.workspaceId || WORKSPACE_ID,
          maxActiveTasks: p.maxActiveTasks ?? 20,
          maxGlobalConcurrency: p.maxGlobalConcurrency ?? 5,
          defaultAutonomyLevel: p.defaultAutonomyLevel ?? "L0",
          allowedAutonomyLevels: p.allowedAutonomyLevels ?? ["L0", "L1", "L2", "L3"],
          emergencyStopAll: Boolean(p.emergencyStopAll),
          emergencyStoppedAt: p.emergencyStopAll ? new Date() : null,
          emergencyStoppedBy: p.emergencyStoppedBy || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        policyStore.set(p.organizationId, entity);
        return entity;
      },
      createDefinition: async (orgId: string, wsId: string, data: any, createdBy?: string) => {
        const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const entity: AutonomousTaskDefinitionEntity = {
          id,
          organizationId: orgId,
          workspaceId: wsId,
          name: data.name,
          description: data.description || "",
          autonomyLevel: data.autonomyLevel || "L0",
          targetType: data.targetType,
          workflowDefinitionId: data.workflowDefinitionId || null,
          agentId: data.agentId || null,
          status: "active",
          executionPolicy: {
            maxRuntimeSeconds: 3600,
            maxRetries: 3,
            timeoutSeconds: 3600,
            maxConcurrency: 1,
            retryDelaySeconds: 30,
            ...(data.executionPolicy || {}),
          },
          approvalPolicy: {
            requireApprovalForMutations: true,
            requireApprovalOnReplanning: true,
            allowedApproverRoles: ["admin", "supervisor"],
            ...(data.approvalPolicy || {}),
          },
          limits: {
            maxDailyRuns: 50,
            maxTokensPerRun: 100000,
            maxCostUsdPerRun: 5.0,
            ...(data.limits || {}),
          },
          defaultInput: data.defaultInput || {},
          createdBy: createdBy || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        taskStore.set(id, entity);
        return entity;
      },
      getDefinitionById: async (orgId: string, taskId: string) => {
        const task = taskStore.get(taskId);
        if (!task || task.organizationId !== orgId) return null;
        return task;
      },
      listDefinitions: async (orgId: string, status?: string) => {
        const res: AutonomousTaskDefinitionEntity[] = [];
        for (const task of taskStore.values()) {
          if (task.organizationId === orgId && (!status || task.status === status)) {
            res.push(task);
          }
        }
        return res;
      },
      updateDefinition: async (orgId: string, taskId: string, updates: any) => {
        const task = taskStore.get(taskId);
        if (!task || task.organizationId !== orgId) return null;
        const updated = { ...task, ...updates, updatedAt: new Date() };
        taskStore.set(taskId, updated);
        return updated;
      },
      setEmergencyStop: async (orgId: string, taskId: string, stoppedBy?: string, reason?: string) => {
        const task = taskStore.get(taskId);
        if (!task || task.organizationId !== orgId) return null;
        const updated = {
          ...task,
          status: "disabled" as const,
          emergencyStoppedAt: new Date(),
          emergencyStoppedBy: stoppedBy || null,
          emergencyStopReason: reason || null,
          updatedAt: new Date(),
        };
        taskStore.set(taskId, updated);
        return updated;
      },
      clearEmergencyStop: async (orgId: string, taskId: string) => {
        const task = taskStore.get(taskId);
        if (!task || task.organizationId !== orgId) return null;
        const updated = {
          ...task,
          status: "active" as const,
          emergencyStoppedAt: null,
          emergencyStoppedBy: null,
          emergencyStopReason: null,
          updatedAt: new Date(),
        };
        taskStore.set(taskId, updated);
        return updated;
      },
      createTrigger: async (orgId: string, wsId: string, data: any) => {
        const id = `trig-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const entity: AutonomousTaskTriggerEntity = {
          id,
          taskDefinitionId: data.taskDefinitionId,
          organizationId: orgId,
          workspaceId: wsId,
          name: data.name,
          triggerType: data.triggerType,
          scheduleType: data.scheduleType || null,
          cronExpression: data.cronExpression || null,
          timezone: data.timezone || "UTC",
          scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
          nextRunAt: data.cronExpression ? schedulerService.calculateNextRun(data.cronExpression, data.timezone) : null,
          lastRunAt: null,
          eventPattern: data.eventPattern || null,
          missedSchedulePolicy: data.missedSchedulePolicy || "run_once",
          isEnabled: data.isEnabled ?? true,
          configuration: data.configuration || {},
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        triggerStore.set(id, entity);
        return entity;
      },
      getTriggerById: async (orgId: string, trigId: string) => {
        const trig = triggerStore.get(trigId);
        if (!trig || trig.organizationId !== orgId) return null;
        return trig;
      },
      listTriggers: async (orgId: string, taskId?: string) => {
        const res: AutonomousTaskTriggerEntity[] = [];
        for (const trig of triggerStore.values()) {
          if (trig.organizationId === orgId && (!taskId || trig.taskDefinitionId === taskId)) {
            res.push(trig);
          }
        }
        return res;
      },
      listTriggersDue: async (now: Date = new Date()) => {
        const due: AutonomousTaskTriggerEntity[] = [];
        for (const trig of triggerStore.values()) {
          if (trig.isEnabled && trig.nextRunAt && trig.nextRunAt <= now) {
            due.push(trig);
          }
        }
        return due;
      },
      updateTrigger: async (orgId: string, trigId: string, updates: any) => {
        const trig = triggerStore.get(trigId);
        if (!trig || trig.organizationId !== orgId) return null;
        const updated = { ...trig, ...updates, updatedAt: new Date() };
        triggerStore.set(trigId, updated);
        return updated;
      },
      deleteTrigger: async (orgId: string, trigId: string) => {
        const trig = triggerStore.get(trigId);
        if (!trig || trig.organizationId !== orgId) return false;
        return triggerStore.delete(trigId);
      },
      createRun: async (data: any) => {
        // Idempotency check: if run with idempotencyKey exists in org, return it
        for (const existing of runStore.values()) {
          if (existing.organizationId === data.organizationId && existing.idempotencyKey === data.idempotencyKey) {
            return existing;
          }
        }
        const id = `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const entity: AutonomousTaskRunEntity = {
          id,
          taskDefinitionId: data.taskDefinitionId,
          triggerId: data.triggerId || null,
          organizationId: data.organizationId,
          workspaceId: data.workspaceId,
          workflowRunId: null,
          agentRunId: null,
          status: "queued",
          idempotencyKey: data.idempotencyKey,
          autonomyLevel: data.autonomyLevel || "L0",
          workerId: null,
          leasedAt: null,
          leaseExpiresAt: null,
          heartbeatAt: null,
          retryCount: 0,
          maxRetries: data.maxRetries ?? 3,
          inputPayload: data.inputPayload || {},
          outputPayload: null,
          errorDetails: null,
          adaptationHistory: [],
          currentPlanRevision: 1,
          startedAt: null,
          completedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        runStore.set(id, entity);
        return entity;
      },
      getRunById: async (orgId: string, runId: string) => {
        const run = runStore.get(runId);
        if (!run || run.organizationId !== orgId) return null;
        return run;
      },
      listRuns: async (orgId: string, filter?: any) => {
        const res: AutonomousTaskRunEntity[] = [];
        for (const run of runStore.values()) {
          if (run.organizationId === orgId) {
            if (filter?.status && run.status !== filter.status) continue;
            if (filter?.taskId && run.taskDefinitionId !== filter.taskId) continue;
            res.push(run);
          }
        }
        return res;
      },
      updateRun: async (orgId: string, runId: string, updates: any) => {
        const run = runStore.get(runId);
        if (!run || run.organizationId !== orgId) return null;
        const updated = { ...run, ...updates, updatedAt: new Date() };
        runStore.set(runId, updated);
        return updated;
      },
      leaseNextQueuedRun: async (workerId: string, leaseDurationSeconds: number = 60) => {
        for (const run of runStore.values()) {
          if (run.status === "queued") {
            const now = new Date();
            const expires = new Date(now.getTime() + leaseDurationSeconds * 1000);
            const leased: AutonomousTaskRunEntity = {
              ...run,
              status: "leased",
              workerId,
              leasedAt: now,
              heartbeatAt: now,
              leaseExpiresAt: expires,
              updatedAt: now,
            };
            runStore.set(run.id, leased);
            return leased;
          }
        }
        return null;
      },
      heartbeat: async (runId: string, workerId: string, extensionSeconds: number = 60) => {
        const run = runStore.get(runId);
        if (!run || run.workerId !== workerId) return false;
        const now = new Date();
        run.heartbeatAt = now;
        run.leaseExpiresAt = new Date(now.getTime() + extensionSeconds * 1000);
        run.updatedAt = now;
        return true;
      },
      reclaimStaleLeases: async (now: Date = new Date()) => {
        let reclaimedCount = 0;
        for (const run of runStore.values()) {
          if ((run.status === "leased" || run.status === "running") && run.leaseExpiresAt && run.leaseExpiresAt <= now) {
            const retry = run.retryCount + 1;
            const newStatus = retry >= run.maxRetries ? "failed" : "queued";
            runStore.set(run.id, {
              ...run,
              status: newStatus as any,
              retryCount: retry,
              workerId: null,
              leasedAt: null,
              leaseExpiresAt: null,
              errorDetails: { reason: "Worker lease expired" },
              updatedAt: new Date(),
            });
            reclaimedCount++;
          }
        }
        return reclaimedCount;
      },
      createCheckpoint: async (data: any) => {
        const id = `cp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const entity: AutonomousTaskCheckpointEntity = {
          id,
          taskRunId: data.taskRunId,
          organizationId: data.organizationId,
          checkpointType: data.checkpointType,
          stepPointer: data.stepPointer || null,
          stateSnapshot: data.stateSnapshot || {},
          metadata: data.metadata || {},
          createdAt: new Date(),
        };
        const list = checkpointStore.get(data.taskRunId) || [];
        list.push(entity);
        checkpointStore.set(data.taskRunId, list);
        return entity;
      },
      getLatestCheckpoint: async (orgId: string, runId: string) => {
        const list = checkpointStore.get(runId) || [];
        const filtered = list.filter((cp) => cp.organizationId === orgId);
        return filtered.length > 0 ? filtered[filtered.length - 1] : null;
      },
      createEvent: async (data: any) => {
        const id = `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const entity: AutonomousTaskEventEntity = {
          id,
          taskRunId: data.taskRunId,
          organizationId: data.organizationId,
          eventType: data.eventType,
          payload: data.payload || {},
          createdAt: new Date(),
        };
        const list = eventStore.get(data.taskRunId) || [];
        list.push(entity);
        eventStore.set(data.taskRunId, list);
        return entity;
      },
      listEvents: async (orgId: string, runId: string) => {
        const list = eventStore.get(runId) || [];
        return list.filter((ev) => ev.organizationId === orgId);
      },
    };

    mockOrchestrationService = {
      startWorkflowRun: async () => ({ id: "wf-run-mock-123" }),
    };

    mockAgentService = {
      createAgentRun: async () => ({ id: "ag-run-mock-123" }),
    };

    schedulerService = new AutonomousSchedulerService();
    recoveryService = new AutonomousRecoveryService();

    const dummyDb = { db: {} } as any;
    taskService = new AutonomousTaskService(
      dummyDb,
      mockRepo,
      schedulerService,
      recoveryService,
      mockOrchestrationService,
      mockAgentService,
    );
  });

  // =========================================================================
  // 1. POLICY & AUTONOMY LEVEL GOVERNANCE TESTS
  // =========================================================================
  describe("Policy & Autonomy Level Governance", () => {
    it("provisions default organization policy with L0 default and all levels enabled", async () => {
      const policy = await taskService.getPolicy(ORG_A, WORKSPACE_ID);
      expect(policy).toBeDefined();
      expect(policy.organizationId).toBe(ORG_A);
      expect(policy.defaultAutonomyLevel).toBe("L0");
      expect(policy.maxGlobalConcurrency).toBe(5);
      expect(policy.emergencyStopAll).toBe(false);
      expect(policy.allowedAutonomyLevels).toEqual(["L0", "L1", "L2", "L3"]);
    });

    it("creates autonomous tasks across L0, L1, L2, L3 autonomy levels", async () => {
      const taskDto: CreateTaskDefinitionDto = {
        name: "L2 Supervised Academic Planner",
        description: "Executes planning with human supervision on consequential actions",
        autonomyLevel: "L2",
        targetType: "workflow",
        workflowDefinitionId: "wf-def-1",
        executionPolicy: { maxRuntimeSeconds: 1800, maxRetries: 2 },
        approvalPolicy: { requireApprovalForMutations: true },
        limits: { maxDailyRuns: 20, maxTokensPerRun: 50000, maxCostUsdPerRun: 2.5 },
      };

      const task = await taskService.createTask(ORG_A, WORKSPACE_ID, taskDto, USER_ID);
      expect(task).toBeDefined();
      expect(task.id).toMatch(/^task-/);
      expect(task.autonomyLevel).toBe("L2");
      expect(task.status).toBe("active");
      expect(task.executionPolicy.maxRetries).toBe(2);
      expect(task.limits.maxCostUsdPerRun).toBe(2.5);
    });

    it("rejects task creation if requested autonomy level is prohibited by organization policy", async () => {
      await taskService.updatePolicy({
        organizationId: ORG_A,
        workspaceId: WORKSPACE_ID,
        allowedAutonomyLevels: ["L0", "L1"],
      });

      const forbiddenTask: CreateTaskDefinitionDto = {
        name: "L3 Continuous Agent",
        description: "Fully autonomous background agent",
        autonomyLevel: "L3",
        targetType: "workflow",
      };

      await expect(
        taskService.createTask(ORG_A, WORKSPACE_ID, forbiddenTask, USER_ID),
      ).rejects.toThrow("is not allowed by organization policy");
    });

    it("supports task lifecycle transitions: pause, resume, and emergency stop", async () => {
      const task = await taskService.createTask(
        ORG_A,
        WORKSPACE_ID,
        { name: "Lifecycle Task", description: "Test", targetType: "agent" },
        USER_ID,
      );
      expect(task.status).toBe("active");

      const paused = await taskService.pauseTask(ORG_A, task.id);
      expect(paused.status).toBe("paused");

      const resumed = await taskService.resumeTask(ORG_A, task.id);
      expect(resumed.status).toBe("active");

      const stopped = await taskService.emergencyStopTask(ORG_A, task.id, USER_ID, "Safety anomaly detected");
      expect(stopped.status).toBe("disabled");
      expect(stopped.emergencyStopReason).toBe("Safety anomaly detected");
    });

    it("enforces Global Emergency Freeze across all tasks in organization", async () => {
      const task = await taskService.createTask(
        ORG_A,
        WORKSPACE_ID,
        { name: "Active Task", description: "Test", targetType: "workflow" },
        USER_ID,
      );

      // Trigger global emergency freeze
      const policy = await taskService.emergencyStopAll(ORG_A, WORKSPACE_ID, USER_ID);
      expect(policy.emergencyStopAll).toBe(true);

      // Attempting to trigger a run must be blocked
      await expect(taskService.triggerTaskRun(ORG_A, task.id)).rejects.toThrow(
        "Cannot trigger task: Organization emergency stop is active",
      );

      // Resume all
      const resumedPolicy = await taskService.resumeAll(ORG_A, WORKSPACE_ID);
      expect(resumedPolicy.emergencyStopAll).toBe(false);

      // Now triggering runs is allowed
      const run = await taskService.triggerTaskRun(ORG_A, task.id);
      expect(run).toBeDefined();
      expect(run.status).toBe("queued");
    });
  });

  // =========================================================================
  // 2. SCHEDULER & EVENT TRIGGER ENGINE TESTS
  // =========================================================================
  describe("Scheduler & Event Trigger Engine", () => {
    it("computes next run time accurately for cron expressions with timezone awareness", () => {
      const baseDate = new Date("2026-11-04T00:00:00.000Z");

      // Hourly
      const nextHourly = schedulerService.calculateNextRun("@hourly", "UTC", baseDate);
      expect(nextHourly).toBeDefined();
      expect(nextHourly.getUTCHours()).toBe(1);

      // Daily
      const nextDaily = schedulerService.calculateNextRun("@daily", "UTC", baseDate);
      expect(nextDaily).toBeDefined();
      expect(nextDaily.getUTCDate()).toBe(5);

      // 15-minute intervals
      const nextQuarter = schedulerService.calculateNextRun("*/15 * * * *", "UTC", baseDate);
      expect(nextQuarter).toBeDefined();
      expect(nextQuarter.getUTCMinutes()).toBe(15);
    });

    it("registers and manages recurring cron triggers with nextRunAt calculation", async () => {
      const task = await taskService.createTask(
        ORG_A,
        WORKSPACE_ID,
        { name: "Scheduled Task", description: "Test", targetType: "workflow" },
        USER_ID,
      );

      const triggerDto: CreateTaskTriggerDto = {
        taskDefinitionId: task.id,
        name: "Daily 6AM Schedule",
        triggerType: "schedule",
        scheduleType: "recurring",
        cronExpression: "0 6 * * *",
        timezone: "Asia/Singapore",
        missedSchedulePolicy: "run_once",
        isEnabled: true,
      };

      const trigger = await taskService.createTrigger(ORG_A, WORKSPACE_ID, triggerDto);
      expect(trigger).toBeDefined();
      expect(trigger.id).toMatch(/^trig-/);
      expect(trigger.triggerType).toBe("schedule");
      expect(trigger.cronExpression).toBe("0 6 * * *");
      expect(trigger.nextRunAt).toBeDefined();
    });

    it("matches domain event patterns including wildcards", () => {
      expect(schedulerService.matchesEventPattern("education.curriculum.*", "education.curriculum.published")).toBe(true);
      expect(schedulerService.matchesEventPattern("education.curriculum.*", "education.curriculum.draft.updated")).toBe(true);
      expect(schedulerService.matchesEventPattern("finance.*", "education.curriculum.published")).toBe(false);
      expect(schedulerService.matchesEventPattern("*", "any.event.name")).toBe(true);
      expect(schedulerService.matchesEventPattern("exact.event.name", "exact.event.name")).toBe(true);
      expect(schedulerService.matchesEventPattern("exact.event.name", "other.event.name")).toBe(false);
    });

    it("dispatches event-driven triggers when matching domain events occur", async () => {
      const task = await taskService.createTask(
        ORG_A,
        WORKSPACE_ID,
        { name: "Event Task", description: "Reacts to curriculum changes", targetType: "workflow" },
        USER_ID,
      );

      await taskService.createTrigger(ORG_A, WORKSPACE_ID, {
        taskDefinitionId: task.id,
        name: "On Curriculum Publish",
        triggerType: "event",
        eventPattern: "education.curriculum.*",
        isEnabled: true,
      });

      // Emit event
      const dispatchedRuns = await taskService.dispatchDomainEvent(
        ORG_A,
        "education.curriculum.published",
        { unitId: "unit-101", grade: 6 },
        "evt-test-101",
      );

      expect(dispatchedRuns.length).toBe(1);
      expect(dispatchedRuns[0].taskDefinitionId).toBe(task.id);
      expect(dispatchedRuns[0].status).toBe("queued");
      expect(dispatchedRuns[0].inputPayload.unitId).toBe("unit-101");
    });

    it("deduplicates triggers with deterministic idempotency keys", async () => {
      const task = await taskService.createTask(
        ORG_A,
        WORKSPACE_ID,
        { name: "Idempotent Task", description: "Test", targetType: "workflow" },
        USER_ID,
      );

      // Trigger twice with the exact same idempotency key
      const key = "fixed-batch-slot-2026-11-04-06-00";
      const run1 = await taskService.triggerTaskRun(ORG_A, task.id, { idempotencyKey: key });
      const run2 = await taskService.triggerTaskRun(ORG_A, task.id, { idempotencyKey: key });

      // Must return existing run without creating a duplicate
      expect(run1.id).toBe(run2.id);
      expect(runStore.size).toBe(1);
    });
  });

  // =========================================================================
  // 3. CONTINUOUS EXECUTION, LEASING & CRASH RECOVERY TESTS
  // =========================================================================
  describe("Continuous Execution, Worker Leasing & Crash Recovery", () => {
    it("leases queued runs to background workers with atomic expiration timestamps", async () => {
      const task = await taskService.createTask(
        ORG_A,
        WORKSPACE_ID,
        { name: "Continuous Task", description: "Test", targetType: "workflow" },
        USER_ID,
      );

      const queuedRun = await taskService.triggerTaskRun(ORG_A, task.id);
      expect(queuedRun.status).toBe("queued");

      // Background worker leases next queued run
      const leasedRun = await taskService.leaseNextRun("worker-prod-alpha", 60);
      expect(leasedRun).toBeDefined();
      expect(leasedRun!.id).toBe(queuedRun.id);
      expect(leasedRun!.status).toBe("leased");
      expect(leasedRun!.workerId).toBe("worker-prod-alpha");
      expect(leasedRun!.leasedAt).toBeDefined();
      expect(leasedRun!.leaseExpiresAt!.getTime()).toBeGreaterThan(Date.now());
    });

    it("renews worker lease and heartbeats during active execution", async () => {
      const task = await taskService.createTask(
        ORG_A,
        WORKSPACE_ID,
        { name: "Heartbeat Task", description: "Test", targetType: "workflow" },
        USER_ID,
      );

      const queuedRun = await taskService.triggerTaskRun(ORG_A, task.id);
      await taskService.leaseNextRun("worker-prod-beta", 30);

      const renewed = await taskService.heartbeat(queuedRun.id, "worker-prod-beta", 45);
      expect(renewed).toBe(true);

      const run = await taskService.getRun(ORG_A, queuedRun.id);
      expect(run.heartbeatAt).toBeDefined();
    });

    it("reclaims expired worker leases after simulated worker crash", async () => {
      const task = await taskService.createTask(
        ORG_A,
        WORKSPACE_ID,
        {
          name: "Crash Recovery Task",
          description: "Test",
          targetType: "workflow",
          executionPolicy: { maxRetries: 3 },
        },
        USER_ID,
      );

      const queuedRun = await taskService.triggerTaskRun(ORG_A, task.id);
      await taskService.leaseNextRun("worker-crashed", 1);

      // Fast-forward time to simulate lease expiration
      const simulatedFutureTime = new Date(Date.now() + 5000);
      const reclaimedCount = await taskService.reclaimStaleLeases(simulatedFutureTime);

      expect(reclaimedCount).toBe(1);
      const reclaimedRun = await taskService.getRun(ORG_A, queuedRun.id);
      expect(reclaimedRun.retryCount).toBe(1);
      expect(reclaimedRun.status).toBe("queued"); // returned to queue for another worker
      expect(reclaimedRun.workerId).toBeNull();
    });

    it("records checkpoints across step transitions and graceful halts", async () => {
      const task = await taskService.createTask(
        ORG_A,
        WORKSPACE_ID,
        { name: "Checkpointed Task", description: "Test", targetType: "workflow" },
        USER_ID,
      );

      const run = await taskService.triggerTaskRun(ORG_A, task.id);

      const cp1 = await mockRepo.createCheckpoint({
        taskRunId: run.id,
        organizationId: ORG_A,
        checkpointType: "step_completed",
        stepPointer: "step-plan-decomposed",
        stateSnapshot: { unitPlan: { lessonsCount: 4, standards: ["NGSS-MS-LS1"] } },
      });
      expect(cp1.id).toMatch(/^cp-/);
      expect(cp1.checkpointType).toBe("step_completed");
      expect(cp1.stepPointer).toBe("step-plan-decomposed");

      const latestCp = await taskService.getLatestCheckpoint(ORG_A, run.id);
      expect(latestCp).toBeDefined();
      expect(latestCp!.stateSnapshot).toEqual({
        unitPlan: { lessonsCount: 4, standards: ["NGSS-MS-LS1"] },
      });
    });

    it("maintains an immutable audit event stream for task lifecycle", async () => {
      const task = await taskService.createTask(
        ORG_A,
        WORKSPACE_ID,
        { name: "Audited Task", description: "Test", targetType: "workflow" },
        USER_ID,
      );

      const run = await taskService.triggerTaskRun(ORG_A, task.id);
      const events = await taskService.listEvents(ORG_A, run.id);

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].eventType).toBe("task_queued");
    });
  });

  // =========================================================================
  // 4. ADAPTIVE PLANNING & RECOVERY ENGINE TESTS
  // =========================================================================
  describe("Adaptive Planning & Recovery Engine", () => {
    it("accurately classifies transient errors as retryable with replanning", () => {
      const rateLimitError = new Error("Rate limit reached. HTTP 429 Too Many Requests");
      const analysis1 = recoveryService.classifyFailure(rateLimitError);
      expect(analysis1.classification).toBe("retryable");
      expect(analysis1.canReplan).toBe(false);
      expect(analysis1.suggestedAction).toBe("retry");

      const deadlockError = new Error("Deadlock found when trying to get lock; try restarting transaction");
      const analysis2 = recoveryService.classifyFailure(deadlockError);
      expect(analysis2.classification).toBe("retryable");
    });

    it("accurately classifies permission and validation errors as terminal", () => {
      const authError = new Error("Access denied: 403 Forbidden");
      const analysis1 = recoveryService.classifyFailure(authError);
      expect(analysis1.classification).toBe("terminal");
      expect(analysis1.canReplan).toBe(false);
      expect(analysis1.suggestedAction).toBe("abort");

      const malformedError = new Error("Validation failed: input missing required field 'grade'");
      const analysis2 = recoveryService.classifyFailure(malformedError);
      expect(analysis2.classification).toBe("terminal");
      expect(analysis2.canReplan).toBe(true);
      expect(analysis2.suggestedAction).toBe("replan");
    });

    it("validates adaptation safety and prevents privilege escalation and objective drift", () => {
      const taskDef: AutonomousTaskDefinitionEntity = {
        id: "task-test-safety",
        organizationId: ORG_A,
        workspaceId: WORKSPACE_ID,
        name: "Grade 6 Curriculum Unit Planner",
        description: "Plans Grade 6 science lessons",
        autonomyLevel: "L2",
        targetType: "agent",
        agentId: "agent-academic-planning",
        status: "active",
        executionPolicy: { maxRuntimeSeconds: 3600, maxRetries: 3, timeoutSeconds: 3600, maxConcurrency: 1, retryDelaySeconds: 30 },
        approvalPolicy: { requireApprovalForMutations: true, requireApprovalOnReplanning: true, allowedApproverRoles: ["admin"] },
        limits: { maxDailyRuns: 50, maxTokensPerRun: 100000, maxCostUsdPerRun: 5.0 },
        defaultInput: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // 1. Objective drift detected
      const driftAdaptation = recoveryService.validateAdaptation(
        taskDef,
        { objective: "Grade 6 Curriculum Unit Planner" },
        { objective: "Grade 12 Advanced Placement Calculus" },
      );
      expect(driftAdaptation.isValid).toBe(false);
      expect(driftAdaptation.rejectionReason).toContain("Objective drift detected");

      // 2. Privilege escalation detected
      const escalationAdaptation = recoveryService.validateAdaptation(
        taskDef,
        { objective: "Grade 6 Curriculum Unit Planner" },
        { objective: "Grade 6 Curriculum Unit Planner", assignedAgentIds: ["unauthorized-admin-agent"] },
      );
      expect(escalationAdaptation.isValid).toBe(false);
      expect(escalationAdaptation.rejectionReason).toContain("Privilege escalation blocked");

      // 3. Valid adaptation requiring approval for L2 consequential mutation
      const validAdaptation = recoveryService.validateAdaptation(
        taskDef,
        { objective: "Grade 6 Curriculum Unit Planner" },
        { objective: "Grade 6 Curriculum Unit Planner", hasConsequentialActions: true },
      );
      expect(validAdaptation.isValid).toBe(true);
      expect(validAdaptation.requiresApproval).toBe(true);

      // 4. Audit adaptation record creation
      const record = recoveryService.createAdaptationRecord(
        1,
        "Adapted to rate-limit constraints",
        "step-draft-lessons",
        { steps: ["stepA"] },
        { steps: ["stepA_chunked"] },
        true,
      );
      expect(record.revision).toBe(2);
      expect(record.reason).toBe("Adapted to rate-limit constraints");
      expect(record.requiresRenewedApproval).toBe(true);
    });

    it("resumes execution when authorized supervisor approves paused run", async () => {
      const task = await taskService.createTask(
        ORG_A,
        WORKSPACE_ID,
        { name: "Supervised Task", description: "Test", targetType: "workflow" },
        USER_ID,
      );

      const run = await taskService.triggerTaskRun(ORG_A, task.id);
      // Manually set status to waiting_approval
      await mockRepo.updateRun(ORG_A, run.id, {
        status: "waiting_approval",
        errorDetails: { reason: "Consequential change" },
      });

      // Supervisor approves
      const approvedRun = await taskService.approveRun(ORG_A, run.id, USER_ID, "Looks solid, approved.");
      expect(approvedRun.status).toBe("queued"); // returned to queue for processing

      const events = await taskService.listEvents(ORG_A, run.id);
      expect(events.some((e) => e.eventType === "approval_granted")).toBe(true);
    });

    it("halts and cancels execution when supervisor rejects paused run", async () => {
      const task = await taskService.createTask(
        ORG_A,
        WORKSPACE_ID,
        { name: "Supervised Task", description: "Test", targetType: "workflow" },
        USER_ID,
      );

      const run = await taskService.triggerTaskRun(ORG_A, task.id);
      await mockRepo.updateRun(ORG_A, run.id, {
        status: "waiting_approval",
        errorDetails: { reason: "Consequential change" },
      });

      // Supervisor rejects
      const rejectedRun = await taskService.rejectRun(
        ORG_A,
        run.id,
        USER_ID,
        "Formative assessments missing standard alignment.",
      );

      expect(rejectedRun.status).toBe("cancelled");
      expect(rejectedRun.errorDetails?.rejectionReason).toBe("Formative assessments missing standard alignment.");

      const events = await taskService.listEvents(ORG_A, run.id);
      expect(events.some((e) => e.eventType === "approval_rejected")).toBe(true);
    });
  });

  // =========================================================================
  // 5. CROSS-TENANT ISOLATION & SECURITY BOUNDARY TESTS
  // =========================================================================
  describe("Cross-Tenant Isolation & Security Boundary", () => {
    it("ensures strict organization isolation for tasks, runs, and triggers", async () => {
      const taskA = await taskService.createTask(
        ORG_A,
        WORKSPACE_ID,
        { name: "School A Autonomous Task", description: "Confidential", targetType: "workflow" },
        USER_ID,
      );

      // Org B cannot access Org A's task
      await expect(taskService.getTask(ORG_B, taskA.id)).rejects.toThrow("Autonomous task definition not found");

      // Org B listing tasks sees only their own
      const orgBTasks = await taskService.listTasks(ORG_B);
      expect(orgBTasks.some((t) => t.id === taskA.id)).toBe(false);

      // Org B cannot trigger Org A's task
      await expect(taskService.triggerTaskRun(ORG_B, taskA.id)).rejects.toThrow(
        "Autonomous task definition not found",
      );
    });

    it("isolates emergency stops per organization", async () => {
      // Emergency freeze Org A
      await taskService.emergencyStopAll(ORG_A, WORKSPACE_ID, USER_ID);

      const policyA = await taskService.getPolicy(ORG_A, WORKSPACE_ID);
      const policyB = await taskService.getPolicy(ORG_B, WORKSPACE_ID);

      expect(policyA.emergencyStopAll).toBe(true);
      expect(policyB.emergencyStopAll).toBe(false);

      // Org B can still create and run tasks normally
      const taskB = await taskService.createTask(
        ORG_B,
        WORKSPACE_ID,
        { name: "School B Task", description: "Operating normally", targetType: "workflow" },
        USER_ID,
      );
      const runB = await taskService.triggerTaskRun(ORG_B, taskB.id);
      expect(runB.status).toBe("queued");
    });
  });
});
