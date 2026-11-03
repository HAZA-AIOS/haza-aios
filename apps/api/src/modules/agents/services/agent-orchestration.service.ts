import { ApiError } from "../../../common/errors/api-error.js";
import type { DatabaseClient } from "../../../database/client.js";
import { createRepositoryContext } from "../../../database/repositories/repository-context.js";
import { AgentWorkflowRepository } from "../repositories/agent-workflow.repository.js";
import { AgentTeamRepository } from "../repositories/agent-team.repository.js";
import { AgentRepository } from "../repositories/agent.repository.js";
import { AgentRuntimeService } from "./agent-runtime.service.js";
import { validateWorkflowDAG } from "../validation/orchestration-validation.js";
import type {
  AgentWorkflowDefinitionRecord,
  AgentWorkflowEventRecord,
  AgentWorkflowRunRecord,
  AgentWorkflowStepRecord,
  CreateWorkflowDefinitionInput,
  WorkflowValidationResult,
  AgentTeamRole,
} from "../orchestration.types.js";

export class AgentOrchestrationService {
  private readonly workflowRepo: AgentWorkflowRepository;
  private readonly teamRepo: AgentTeamRepository;
  private readonly agentRepo: AgentRepository;
  private readonly runtimeService: AgentRuntimeService;

  constructor(
    private readonly database: DatabaseClient,
    deps?: {
      workflowRepo?: AgentWorkflowRepository;
      teamRepo?: AgentTeamRepository;
      agentRepo?: AgentRepository;
      runtimeService?: AgentRuntimeService;
    },
  ) {
    const repoCtx = this.database?.db ? createRepositoryContext(this.database.db) : ({} as any);
    this.workflowRepo = deps?.workflowRepo ?? new AgentWorkflowRepository(repoCtx);
    this.teamRepo = deps?.teamRepo ?? new AgentTeamRepository(repoCtx);
    this.agentRepo = deps?.agentRepo ?? new AgentRepository(repoCtx);
    this.runtimeService = deps?.runtimeService ?? new AgentRuntimeService(this.database);
  }

  async createDefinition(
    input: CreateWorkflowDefinitionInput,
  ): Promise<AgentWorkflowDefinitionRecord> {
    let teamRoles: AgentTeamRole[] | undefined;
    if (input.teamId) {
      const team = await this.teamRepo.getTeam(input.organizationId, input.teamId);
      if (team && team.members) {
        teamRoles = team.members.map((m) => m.role);
      }
    }

    const validation = validateWorkflowDAG(input.steps, teamRoles);
    if (!validation.valid) {
      throw new ApiError(
        400,
        "BAD_REQUEST",
        `Invalid workflow DAG: ${validation.errors.join("; ")}`,
      );
    }

    return this.workflowRepo.createDefinition(input);
  }

  async getDefinition(
    organizationId: string,
    definitionId: string,
  ): Promise<AgentWorkflowDefinitionRecord> {
    const def = await this.workflowRepo.getDefinition(organizationId, definitionId);
    if (!def) {
      throw new ApiError(404, "NOT_FOUND", `Workflow definition '${definitionId}' not found.`);
    }
    if (def.teamId) {
      def.team = await this.teamRepo.getTeam(organizationId, def.teamId);
    }
    return def;
  }

  async listDefinitions(
    organizationId: string,
    workspaceId?: string,
  ): Promise<AgentWorkflowDefinitionRecord[]> {
    return this.workflowRepo.listDefinitions(organizationId, workspaceId);
  }

  async validateDefinition(
    organizationId: string,
    definitionId: string,
  ): Promise<WorkflowValidationResult> {
    const def = await this.getDefinition(organizationId, definitionId);
    let teamRoles: AgentTeamRole[] | undefined;
    if (def.teamId) {
      const team = await this.teamRepo.getTeam(organizationId, def.teamId);
      if (team && team.members) {
        teamRoles = team.members.map((m) => m.role);
      }
    }

    const steps = (def.steps || []).map((s) => ({
      stepKey: s.stepKey,
      name: s.name,
      description: s.description,
      stepOrder: s.stepOrder,
      assignedRole: s.assignedRole,
      assignedAgentId: s.assignedAgentId,
      dependsOnStepKeys: s.dependsOnStepKeys,
      requiresApproval: s.requiresApproval,
      approvalRoles: s.approvalRoles || [],
      inputMapping: s.inputMapping,
      outputKey: s.outputKey,
      maxRetries: s.maxRetries,
      timeoutSeconds: s.timeoutSeconds,
      configuration: s.configuration,
    }));

    const result = validateWorkflowDAG(steps, teamRoles);
    if (result.valid && def.status === "draft") {
      await this.workflowRepo.updateDefinitionStatus(organizationId, definitionId, "validated");
    }
    return result;
  }

  async startWorkflowRun(
    organizationId: string,
    definitionId: string,
    initialInput: Record<string, unknown>,
    userId: string,
    idempotencyKey?: string,
  ): Promise<AgentWorkflowRunRecord> {
    const def = await this.getDefinition(organizationId, definitionId);

    // Validate DAG before running
    const validation = await this.validateDefinition(organizationId, definitionId);
    if (!validation.valid) {
      throw new ApiError(
        400,
        "BAD_REQUEST",
        `Cannot execute invalid workflow definition: ${validation.errors.join("; ")}`,
      );
    }

    const run = await this.workflowRepo.createRun({
      organizationId,
      workspaceId: def.workspaceId,
      workflowDefinitionId: def.id,
      teamId: def.teamId,
      workflowRevision: def.revision,
      initiatorUserId: userId,
      initialInput,
      idempotencyKey,
    });

    await this.workflowRepo.updateRun(organizationId, run.id, {
      status: "running",
      startedAt: new Date(),
    });

    await this.workflowRepo.recordEvent({
      workflowRunId: run.id,
      organizationId,
      eventType: "workflow_started",
      payload: {
        definitionId: def.id,
        definitionName: def.name,
        pattern: def.pattern,
        initiatorUserId: userId,
      },
    });

    // Start dispatching initial runnable steps (DAG roots)
    await this.dispatchRunnableSteps(organizationId, run.id);

    const updatedRun = await this.workflowRepo.getRun(organizationId, run.id);
    return updatedRun!;
  }

  async getWorkflowRun(
    organizationId: string,
    runId: string,
  ): Promise<AgentWorkflowRunRecord> {
    const run = await this.workflowRepo.getRun(organizationId, runId);
    if (!run) {
      throw new ApiError(404, "NOT_FOUND", `Workflow run '${runId}' not found.`);
    }
    return run;
  }

  async listWorkflowRuns(
    organizationId: string,
    filter?: { definitionId?: string; status?: any; workspaceId?: string },
  ): Promise<AgentWorkflowRunRecord[]> {
    return this.workflowRepo.listRuns(organizationId, filter);
  }

  async listWorkflowEvents(
    organizationId: string,
    runId: string,
  ): Promise<AgentWorkflowEventRecord[]> {
    await this.getWorkflowRun(organizationId, runId);
    return this.workflowRepo.listEvents(runId);
  }

  async cancelWorkflowRun(
    organizationId: string,
    runId: string,
    userId: string,
  ): Promise<AgentWorkflowRunRecord> {
    const run = await this.getWorkflowRun(organizationId, runId);
    if (run.status === "completed" || run.status === "failed" || run.status === "cancelled") {
      throw new ApiError(400, "BAD_REQUEST", `Cannot cancel a workflow run in status '${run.status}'.`);
    }

    await this.workflowRepo.updateRun(organizationId, runId, {
      status: "cancelled",
      completedAt: new Date(),
      safeErrorMessage: `Workflow run cancelled by user ${userId}.`,
    });

    await this.workflowRepo.recordEvent({
      workflowRunId: runId,
      organizationId,
      eventType: "workflow_cancelled",
      payload: { cancelledBy: userId },
    });

    return this.getWorkflowRun(organizationId, runId);
  }

  async approveStepRun(
    organizationId: string,
    runId: string,
    stepKey: string,
    decision: "approved" | "rejected",
    userId: string,
    notes?: string,
  ): Promise<AgentWorkflowRunRecord> {
    await this.getWorkflowRun(organizationId, runId);
    const stepRuns = await this.workflowRepo.listStepRuns(runId);
    const waitingStep = stepRuns.find(
      (sr) => sr.stepKey === stepKey && sr.status === "waiting_approval",
    );

    if (!waitingStep) {
      throw new ApiError(
        404,
        "NOT_FOUND",
        `Step run '${stepKey}' is not awaiting approval in workflow run '${runId}'.`,
      );
    }

    if (decision === "rejected") {
      await this.workflowRepo.updateStepRun(waitingStep.id, {
        status: "failed",
        safeErrorMessage: notes || "Rejected by authorized reviewer.",
        completedAt: new Date(),
      });

      await this.workflowRepo.updateRun(organizationId, runId, {
        status: "failed",
        safeErrorMessage: `Step '${stepKey}' rejected by human reviewer.`,
        completedAt: new Date(),
      });

      await this.workflowRepo.recordEvent({
        workflowRunId: runId,
        stepRunId: waitingStep.id,
        organizationId,
        eventType: "approval_rejected",
        payload: { stepKey, rejectedBy: userId, notes },
      });

      return this.getWorkflowRun(organizationId, runId);
    }

    // Approved: Mark step as completed and resume workflow
    await this.workflowRepo.updateStepRun(waitingStep.id, {
      status: "completed",
      completedAt: new Date(),
    });

    await this.workflowRepo.recordEvent({
      workflowRunId: runId,
      stepRunId: waitingStep.id,
      organizationId,
      eventType: "approval_granted",
      payload: { stepKey, approvedBy: userId, notes },
    });

    await this.workflowRepo.updateRun(organizationId, runId, {
      status: "running",
    });

    // Continue execution of downstream steps
    await this.dispatchRunnableSteps(organizationId, runId);

    return this.getWorkflowRun(organizationId, runId);
  }

  /**
   * Resolves runnable steps from the DAG and executes them.
   * Supports parallel branches where multiple steps are concurrently runnable.
   */
  async dispatchRunnableSteps(organizationId: string, runId: string): Promise<void> {
    const run = await this.workflowRepo.getRun(organizationId, runId);
    if (!run || run.status === "completed" || run.status === "failed" || run.status === "cancelled") {
      return;
    }

    const def = await this.workflowRepo.getDefinition(organizationId, run.workflowDefinitionId);
    if (!def || !def.steps) return;

    const existingStepRuns = await this.workflowRepo.listStepRuns(runId);
    const completedStepKeys = new Set(
      existingStepRuns.filter((sr) => sr.status === "completed").map((sr) => sr.stepKey),
    );
    const activeStepKeys = new Set(
      existingStepRuns
        .filter((sr) => sr.status === "running" || sr.status === "waiting_approval")
        .map((sr) => sr.stepKey),
    );
    const failedStepKeys = new Set(
      existingStepRuns.filter((sr) => sr.status === "failed").map((sr) => sr.stepKey),
    );

    if (failedStepKeys.size > 0) {
      await this.workflowRepo.updateRun(organizationId, runId, {
        status: "failed",
        safeErrorMessage: `Step '${Array.from(failedStepKeys).join(", ")}' failed during execution.`,
        completedAt: new Date(),
      });
      return;
    }

    // If any step is waiting for approval, workflow status must be waiting_approval
    if (existingStepRuns.some((sr) => sr.status === "waiting_approval")) {
      await this.workflowRepo.updateRun(organizationId, runId, {
        status: "waiting_approval",
      });
      return;
    }

    // Check if ALL steps are completed
    if (completedStepKeys.size === def.steps.length) {
      // Assemble final output from all output keys
      const finalOutput: Record<string, unknown> = {};
      for (const step of def.steps) {
        if (run.sharedContext && run.sharedContext[step.outputKey]) {
          finalOutput[step.outputKey] = run.sharedContext[step.outputKey];
        }
      }

      const totalDuration = existingStepRuns.reduce((sum, sr) => sum + (sr.durationMs || 0), 0);

      await this.workflowRepo.updateRun(organizationId, runId, {
        status: "completed",
        finalOutput,
        totalDurationMs: totalDuration,
        completedAt: new Date(),
      });

      await this.workflowRepo.recordEvent({
        workflowRunId: runId,
        organizationId,
        eventType: "workflow_completed",
        payload: {
          stepsCompleted: completedStepKeys.size,
          totalDurationMs: totalDuration,
        },
      });
      return;
    }

    // Find all runnable steps: steps whose dependencies are all completed and not already started
    const runnableSteps = def.steps.filter((step) => {
      if (completedStepKeys.has(step.stepKey) || activeStepKeys.has(step.stepKey)) {
        return false;
      }
      return (step.dependsOnStepKeys || []).every((dep) => completedStepKeys.has(dep));
    });

    if (runnableSteps.length === 0) {
      // No runnable steps and not all completed -> waiting on active steps or stalled
      return;
    }

    // Execute runnable steps (parallel if multiple are ready!)
    await Promise.all(
      runnableSteps.map((step) => this.executeStep(run, def, step)),
    );

    // Recursively check if new downstream steps became runnable
    await this.dispatchRunnableSteps(organizationId, runId);
  }

  private async executeStep(
    run: AgentWorkflowRunRecord,
    def: AgentWorkflowDefinitionRecord,
    step: AgentWorkflowStepRecord,
  ): Promise<void> {
    const organizationId = run.organizationId;
    const startTime = Date.now();

    // Check if step requires human approval before proceeding
    if (step.requiresApproval) {
      const stepRun = await this.workflowRepo.createStepRun({
        workflowRunId: run.id,
        stepId: step.id,
        stepKey: step.stepKey,
        organizationId,
        status: "waiting_approval",
        inputPayload: {
          stepName: step.name,
          description: step.description,
          context: run.sharedContext,
        },
      });

      await this.workflowRepo.recordEvent({
        workflowRunId: run.id,
        stepRunId: stepRun.id,
        organizationId,
        eventType: "approval_requested",
        payload: {
          stepKey: step.stepKey,
          stepName: step.name,
          approvalRoles: step.approvalRoles,
        },
      });

      await this.workflowRepo.updateRun(organizationId, run.id, {
        status: "waiting_approval",
        currentStepKey: step.stepKey,
      });

      return;
    }

    // Resolve assigned agent
    let targetAgentId = step.assignedAgentId;
    if (!targetAgentId && def.teamId) {
      const team = await this.teamRepo.getTeam(organizationId, def.teamId);
      if (team && team.members) {
        const matchingMember = team.members.find(
          (m) => m.role === step.assignedRole && m.status === "active",
        );
        if (matchingMember) {
          targetAgentId = matchingMember.agentId;
        }
      }
    }

    // If still no agent resolved, fall back to any active agent in org or fail
    if (!targetAgentId) {
      const agents = await this.agentRepo.listByOrganization(organizationId);
      if (agents.length > 0) {
        targetAgentId = agents[0].id;
      } else {
        throw new ApiError(
          400,
          "BAD_REQUEST",
          `No agent found to fulfill role '${step.assignedRole}' for step '${step.stepKey}'.`,
        );
      }
    }

    // Build context-aware input payload from shared context & upstream step outputs
    const upstreamContext: Record<string, unknown> = {};
    for (const depKey of step.dependsOnStepKeys || []) {
      const depStep = def.steps?.find((s) => s.stepKey === depKey);
      if (depStep && run.sharedContext[depStep.outputKey]) {
        upstreamContext[depStep.outputKey] = run.sharedContext[depStep.outputKey];
      }
    }

    const stepInputPayload: Record<string, unknown> = {
      task: step.description || step.name,
      initialInput: run.initialInput,
      upstreamOutputs: upstreamContext,
      stepConfiguration: step.configuration,
    };

    // Create step run record
    const stepRun = await this.workflowRepo.createStepRun({
      workflowRunId: run.id,
      stepId: step.id,
      stepKey: step.stepKey,
      organizationId,
      assignedAgentId: targetAgentId,
      status: "running",
      inputPayload: stepInputPayload,
    });

    await this.workflowRepo.recordEvent({
      workflowRunId: run.id,
      stepRunId: stepRun.id,
      organizationId,
      eventType: "step_dispatched",
      payload: {
        stepKey: step.stepKey,
        assignedAgentId: targetAgentId,
        assignedRole: step.assignedRole,
      },
    });

    try {
      // Dispatch through the existing Agent Runtime!
      const userPrompt = `Workflow Step: ${step.name}\nObjective: ${step.description}\n\nContext:\n${JSON.stringify(
        stepInputPayload,
        null,
        2,
      )}`;

      const { run: agentRun } = await this.runtimeService.createRun({
        organizationId,
        agentId: targetAgentId,
        userId: run.initiatorUserId,
        input: { prompt: userPrompt, ...stepInputPayload },
        executionMode: "direct",
        metadata: { workflowRunId: run.id, stepKey: step.stepKey },
      });

      // Claim and execute through runtime worker coordinator
      const executionResult = await this.runtimeService.claimAndExecute(
        `orchestrator-${run.id}`,
        organizationId,
      );

      const executedAgentRun = executionResult.run || agentRun;
      const durationMs = Math.max(1, Date.now() - startTime);

      const agentOutput =
        executedAgentRun.output && typeof executedAgentRun.output === "object"
          ? executedAgentRun.output
          : { result: "Step executed successfully." };

      // Create structured artifact for this step output
      const artifact = await this.workflowRepo.createArtifact({
        workflowRunId: run.id,
        stepRunId: stepRun.id,
        organizationId,
        workspaceId: run.workspaceId,
        artifactType: (step.configuration?.artifactType as string) || "step_output",
        name: `${step.name} Output`,
        content: agentOutput as Record<string, unknown>,
        provenance: {
          producerAgentId: targetAgentId,
          stepKey: step.stepKey,
          workflowRunId: run.id,
          timestamp: new Date().toISOString(),
        },
        visibility: "workspace",
        createdBy: run.initiatorUserId,
      });

      // Update step run to completed
      await this.workflowRepo.updateStepRun(stepRun.id, {
        status: "completed",
        agentRunId: executedAgentRun.id,
        outputPayload: agentOutput as Record<string, unknown>,
        stepArtifacts: [artifact as unknown as Record<string, unknown>],
        durationMs,
        completedAt: new Date(),
      });

      // Update shared context with step's outputKey
      const updatedContext = {
        ...run.sharedContext,
        [step.outputKey]: agentOutput,
      };

      await this.workflowRepo.updateRun(organizationId, run.id, {
        sharedContext: updatedContext,
        currentStepKey: step.stepKey,
        totalPromptTokens: run.totalPromptTokens + (executedAgentRun.totalInputTokens || 0),
        totalCompletionTokens: run.totalCompletionTokens + (executedAgentRun.totalOutputTokens || 0),
      });

      await this.workflowRepo.recordEvent({
        workflowRunId: run.id,
        stepRunId: stepRun.id,
        organizationId,
        eventType: "step_completed",
        payload: {
          stepKey: step.stepKey,
          durationMs,
          artifactId: artifact.id,
        },
      });
    } catch (err: any) {
      const durationMs = Math.max(1, Date.now() - startTime);
      await this.workflowRepo.updateStepRun(stepRun.id, {
        status: "failed",
        safeErrorMessage: err.message || "Step execution failed.",
        durationMs,
        completedAt: new Date(),
      });

      await this.workflowRepo.recordEvent({
        workflowRunId: run.id,
        stepRunId: stepRun.id,
        organizationId,
        eventType: "step_failed",
        payload: {
          stepKey: step.stepKey,
          error: err.message || String(err),
        },
      });
    }
  }
}
