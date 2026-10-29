import { ApiError } from "../../../common/errors/api-error.js";
import type { DatabaseClient } from "../../../database/client.js";
import { createRepositoryContext } from "../../../database/repositories/repository-context.js";
import { withTransaction } from "../../../database/transactions.js";
import type {
  AgentApprovalDecisionRecord,
  AgentApprovalRequestRecord,
  AgentApprovalStatus,
  AgentConversationRecord,
  AgentDefinitionWithTools,
  AgentMessageRecord,
  AgentRunAttemptRecord,
  AgentRunEventRecord,
  AgentRunRecord,
  AgentRunStatus,
  AgentRuntimeUsageRecord,
  CreateAgentRunInput,
  CreateConversationInput,
  CreateMessageInput,
  JsonRecord,
  PaginationInput,
  RuntimeMonitoringMetrics,
  UpdateAgentRunInput,
} from "../agent.types.js";
import { RUNTIME_STATE_TRANSITIONS } from "../agent.types.js";
import { AgentRepository } from "../repositories/agent.repository.js";
import { AgentBuilderRepository } from "../repositories/agent-builder.repository.js";
import { AgentRuntimeRepository } from "../repositories/agent-runtime.repository.js";
import { OperationalService } from "../../operations/services/operational.service.js";
import { MeteringService } from "../../metering/metering.service.js";
import { AiProviderRegistry } from "../providers/provider-registry.js";
import type { ModelInvocationRequest } from "../providers/ai-provider.types.js";

export class AgentRuntimeService {
  constructor(private readonly database: DatabaseClient) {}

  async listRuns(
    organizationId: string,
    agentId?: string,
    userId?: string,
    pagination: PaginationInput = { limit: 50, offset: 0 },
    status?: AgentRunStatus,
  ): Promise<AgentRunRecord[]> {
    if (agentId) {
      await this.assertExecutableAgent(organizationId, agentId);
    }
    return new AgentRuntimeRepository(createRepositoryContext(this.database.db)).listRuns(
      organizationId,
      agentId,
      userId,
      pagination,
      status,
    );
  }

  async getRun(organizationId: string, runId: string, userId?: string): Promise<AgentRunRecord> {
    const run = await new AgentRuntimeRepository(createRepositoryContext(this.database.db)).getRun(
      organizationId,
      runId,
      userId,
    );
    if (!run) throw new ApiError(404, "NOT_FOUND", "Agent run not found.");
    return run;
  }

  async createRun(input: CreateAgentRunInput): Promise<{
    run: AgentRunRecord;
    conversation: AgentConversationRecord;
    userMessage: AgentMessageRecord;
  }> {
    const agent = await this.assertExecutableAgent(input.organizationId, input.agentId);

    return withTransaction(this.database, async ({ tx }) => {
      const repoContext = createRepositoryContext(tx);
      const runtimeRepo = new AgentRuntimeRepository(repoContext);
      const builderRepo = new AgentBuilderRepository(repoContext);

      // Snapshot active configuration revision if present
      let configurationRevisionId: string | null = agent.activeRevisionId ?? null;
      let configurationSnapshot: JsonRecord = agent.configuration ?? {};

      if (configurationRevisionId) {
        const rev = await builderRepo.getRevisionById(
          input.organizationId,
          agent.id,
          configurationRevisionId,
        );
        if (rev) {
          configurationSnapshot = {
            revisionNumber: rev.revisionNumber,
            version: rev.version,
            configuration: rev.configuration,
            instructions: agent.instructions,
            modelProvider: agent.modelProvider,
            modelSelection: agent.modelSelection,
            tools: agent.tools.map((t) => ({ toolKey: t.toolKey, configuration: t.configuration })),
            approvalPolicy: agent.humanApprovalPolicy,
          };
        }
      }

      const conversation = input.conversationId
        ? await this.requireConversation(
            runtimeRepo,
            input.organizationId,
            input.conversationId,
            input.userId,
            agent.id,
          )
        : await runtimeRepo.createConversation({
            organizationId: input.organizationId,
            workspaceId: agent.workspaceId,
            agentId: agent.id,
            userId: input.userId,
            title: titleFromInput(input.input),
          });

      const run = await runtimeRepo.createRun({
        organizationId: input.organizationId,
        workspaceId: agent.workspaceId,
        agentId: agent.id,
        conversationId: conversation.id,
        requestedBy: input.userId,
        executionMode: input.executionMode,
        idempotencyKey: input.idempotencyKey ?? null,
        input: normalizePayload(input.input),
        provider: agent.modelProvider,
        model: agent.modelSelection,
        configurationRevisionId,
        configurationSnapshot,
        attemptCount: 0,
        maxAttempts: 3,
        priority: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCostMicros: 0,
        metadata: {
          ...input.metadata,
          conversationId: conversation.id,
          userMessagePersisted: true,
        },
        startedAt: new Date(),
      });

      // Record audit & lifecycle events
      await runtimeRepo.recordEvent({
        organizationId: input.organizationId,
        workspaceId: agent.workspaceId,
        runId: run.id,
        eventType: "run_created",
        payload: {
          agentId: agent.id,
          requestedBy: input.userId,
          executionMode: input.executionMode,
          configurationRevisionId,
        },
      });

      await runtimeRepo.recordEvent({
        organizationId: input.organizationId,
        workspaceId: agent.workspaceId,
        runId: run.id,
        eventType: "run_queued",
        payload: {
          queuePriority: 0,
          queuedAt: new Date().toISOString(),
        },
      });

      const userMessage = await runtimeRepo.createMessage({
        organizationId: input.organizationId,
        workspaceId: agent.workspaceId,
        conversationId: conversation.id,
        agentRunId: run.id,
        role: "user",
        content: contentFromPayload(input.input),
        metadata: { source: "agent-run-create" },
      });

      return { run, conversation, userMessage };
    });
  }

  async claimAndExecute(workerId: string, organizationId?: string): Promise<{
    run: AgentRunRecord | null;
    attempt: AgentRunAttemptRecord | null;
    executed: boolean;
  }> {
    const runtimeRepo = new AgentRuntimeRepository(createRepositoryContext(this.database.db));
    const claimed = await runtimeRepo.claimQueuedRun(workerId, 300, organizationId);
    if (!claimed) {
      return { run: null, attempt: null, executed: false };
    }

    const { run, leaseToken, attemptNumber } = claimed;

    // Create attempt record
    const attempt = await runtimeRepo.createAttempt({
      organizationId: run.organizationId,
      workspaceId: run.workspaceId,
      runId: run.id,
      attemptNumber,
      status: "running",
      workerId,
      leaseToken,
      startedAt: new Date(),
      completedAt: null,
      durationMs: null,
      errorCode: null,
      errorMessage: null,
      errorDetails: null,
      inputTokens: 0,
      outputTokens: 0,
      metadata: { workerId },
    });

    await runtimeRepo.recordEvent({
      organizationId: run.organizationId,
      workspaceId: run.workspaceId,
      runId: run.id,
      attemptId: attempt.id,
      eventType: "worker_claimed",
      payload: { workerId, leaseToken, attemptNumber },
    });

    await runtimeRepo.recordEvent({
      organizationId: run.organizationId,
      workspaceId: run.workspaceId,
      runId: run.id,
      attemptId: attempt.id,
      eventType: "run_started",
      payload: { attemptNumber, startedAt: new Date().toISOString() },
    });

    // Execute run attempt
    await this.executeAttempt(run, attempt);

    const updatedRun = await runtimeRepo.getRun(run.organizationId, run.id);
    return { run: updatedRun, attempt, executed: true };
  }

  private async executeAttempt(
    run: AgentRunRecord,
    attempt: AgentRunAttemptRecord,
  ): Promise<void> {
    const runtimeRepo = new AgentRuntimeRepository(createRepositoryContext(this.database.db));
    const agentRepo = new AgentRepository(createRepositoryContext(this.database.db));

    const startTime = Date.now();
    try {
      const agent = await agentRepo.getByIdForOrganization(run.organizationId, run.agentId);
      if (!agent) throw new ApiError(404, "NOT_FOUND", "Agent definition not found.");

      // Check Human Approval Policy for sensitive capabilities / tools
      const approvalPolicy = agent.humanApprovalPolicy;
      const requiresApproval =
        approvalPolicy?.required &&
        approvalPolicy.approverRoles.length > 0;

      // Check if this run has an already approved request
      const existingApprovals = await runtimeRepo.listApprovalRequests(run.organizationId);
      const runApproval = existingApprovals.find(
        (a) => a.runId === run.id && a.status === "approved",
      );

      if (requiresApproval && !runApproval) {
        // High-risk operation requiring approval
        const approvalReq = await runtimeRepo.createApprovalRequest({
          organizationId: run.organizationId,
          workspaceId: run.workspaceId,
          runId: run.id,
          attemptId: attempt.id,
          actionName: `execute_agent_${agent.agentKey}`,
          actionType: "agent_execution",
          actionPayload: { input: run.input },
          riskLevel: "medium",
          policy: "human_in_the_loop",
          requiredRoles: approvalPolicy.approverRoles,
          requestedBy: run.requestedBy,
          expiresAt: approvalPolicy.escalationTimeoutHours
            ? new Date(Date.now() + approvalPolicy.escalationTimeoutHours * 3600 * 1000)
            : null,
        });

        await runtimeRepo.recordEvent({
          organizationId: run.organizationId,
          workspaceId: run.workspaceId,
          runId: run.id,
          attemptId: attempt.id,
          eventType: "approval_requested",
          payload: {
            approvalRequestId: approvalReq.id,
            actionName: approvalReq.actionName,
            requiredRoles: approvalReq.requiredRoles,
          },
        });

        await runtimeRepo.updateRun(run.organizationId, run.id, {
          status: "awaiting_approval",
          leaseToken: null,
          leaseExpiresAt: null,
        });

        await runtimeRepo.updateAttempt(attempt.id, {
          status: "awaiting_approval",
          metadata: { ...attempt.metadata, approvalRequestId: approvalReq.id },
        });

        return;
      }

      // Execute AI Model Inference
      const providerRegistry = AiProviderRegistry.getInstance();
      const requestedProvider = agent.modelProvider || "mock";
      const modelSelection = agent.modelSelection || "mock-gpt-4o";

      let provider = providerRegistry.get(requestedProvider);
      let isMockFallback = false;

      if (!provider) {
        provider = providerRegistry.get("mock");
        isMockFallback = true;
      }

      if (!provider) {
        throw new Error("No AI provider available.");
      }

      await runtimeRepo.recordEvent({
        organizationId: run.organizationId,
        workspaceId: run.workspaceId,
        runId: run.id,
        attemptId: attempt.id,
        eventType: "model_invoked",
        payload: {
          provider: provider.id,
          model: modelSelection,
          isMockFallback,
          liveInferenceConfigured: !isMockFallback,
        },
      });

      const invocationRequest: ModelInvocationRequest = {
        model: modelSelection,
        messages: [
          { role: "system", content: agent.instructions || "You are a helpful AI assistant." },
          { role: "user", content: contentFromPayload(run.input) },
        ],
        temperature: 0.7,
        maxTokens: 2000,
        timeoutMs: 30000,
      };

      const response = await provider.invoke(invocationRequest);

      await runtimeRepo.recordEvent({
        organizationId: run.organizationId,
        workspaceId: run.workspaceId,
        runId: run.id,
        attemptId: attempt.id,
        eventType: "model_responded",
        payload: {
          provider: response.provider,
          finishReason: response.finishReason,
          tokens: response.usage.totalTokens,
        },
      });

      const durationMs = Math.max(1, Date.now() - startTime);
      const inputTokens = response.usage.promptTokens;
      const outputTokens = response.usage.completionTokens;
      const totalTokens = response.usage.totalTokens;
      // Calculate micro-USD (e.g. prompt $0.0015/1k = 1.5 micro/token, completion $0.002/1k = 2 micro/token)
      const costMicros = Math.round(inputTokens * 1.5 + outputTokens * 2.0);

      // Record runtime usage
      await runtimeRepo.recordUsage({
        organizationId: run.organizationId,
        workspaceId: run.workspaceId,
        runId: run.id,
        agentId: run.agentId,
        provider: response.provider,
        model: response.model,
        inputTokens,
        outputTokens,
        totalTokens,
        durationMs,
        costMicros,
      });

      // Complete attempt
      await runtimeRepo.updateAttempt(attempt.id, {
        status: "completed",
        completedAt: new Date(),
        durationMs,
        inputTokens,
        outputTokens,
        metadata: {
          ...attempt.metadata,
          responseFinishReason: response.finishReason,
          isMockFallback,
        },
      });

      const outputData = {
        result: response.content,
        provider: response.provider,
        model: response.model,
        liveInferenceConfigured: !isMockFallback,
      };

      // Complete run
      await runtimeRepo.updateRun(run.organizationId, run.id, {
        status: "completed",
        output: outputData,
        completedAt: new Date(),
        durationMs,
        totalInputTokens: inputTokens,
        totalOutputTokens: outputTokens,
        totalCostMicros: costMicros,
        leaseToken: null,
        leaseExpiresAt: null,
      });

      await runtimeRepo.recordEvent({
        organizationId: run.organizationId,
        workspaceId: run.workspaceId,
        runId: run.id,
        attemptId: attempt.id,
        eventType: "run_completed",
        payload: {
          durationMs,
          totalTokens,
          costMicros,
        },
      });

      // Persist assistant message in conversation if present
      if (run.conversationId) {
        await runtimeRepo.createMessage({
          organizationId: run.organizationId,
          workspaceId: run.workspaceId,
          conversationId: run.conversationId,
          agentRunId: run.id,
          role: "assistant",
          content: response.content,
          metadata: { source: "agent-run-complete", provider: response.provider },
        });
      }

      await new MeteringService(this.database).recordTerminalRun({
        organizationId: run.organizationId,
        workspaceId: run.workspaceId,
        sourceType: "agent_run",
        sourceId: run.id,
        outcome: "completed",
        occurredAt: new Date(),
      });
    } catch (err: any) {
      const durationMs = Math.max(1, Date.now() - startTime);
      const safeMessage = sanitizeError(err.message || "Execution failed.");
      const errorCode = err.code || "RUNTIME_ERROR";

      await runtimeRepo.updateAttempt(attempt.id, {
        status: "failed",
        completedAt: new Date(),
        durationMs,
        errorCode,
        errorMessage: safeMessage,
      });

      // Check retry capability
      const maxAttempts = run.maxAttempts ?? 3;
      const canRetry = attempt.attemptNumber < maxAttempts;

      if (canRetry) {
        await runtimeRepo.updateRun(run.organizationId, run.id, {
          status: "queued",
          leaseToken: null,
          leaseExpiresAt: null,
        });

        await runtimeRepo.recordEvent({
          organizationId: run.organizationId,
          workspaceId: run.workspaceId,
          runId: run.id,
          attemptId: attempt.id,
          eventType: "retry_scheduled",
          payload: {
            failedAttempt: attempt.attemptNumber,
            maxAttempts,
            reason: safeMessage,
          },
        });
      } else {
        await runtimeRepo.updateRun(run.organizationId, run.id, {
          status: "failed",
          errorCode,
          safeErrorMessage: safeMessage,
          completedAt: new Date(),
          durationMs,
          leaseToken: null,
          leaseExpiresAt: null,
        });

        await runtimeRepo.recordEvent({
          organizationId: run.organizationId,
          workspaceId: run.workspaceId,
          runId: run.id,
          attemptId: attempt.id,
          eventType: "run_failed",
          payload: {
            errorCode,
            errorMessage: safeMessage,
            totalAttempts: attempt.attemptNumber,
          },
        });

        await new OperationalService(this.database).recordOperationalEvent({
          organizationId: run.organizationId,
          workspaceId: run.workspaceId,
          severity: "error",
          component: "agent-runtime",
          eventType: "agent.run.failed",
          status: "failed",
          resourceType: "agent_run",
          resourceId: run.id,
          agentRunId: run.id,
          correlationId: run.id,
          summary: "Agent run failed.",
          safeErrorCode: errorCode,
          safeErrorMessage: safeMessage,
          metadata: { agentId: run.agentId, conversationId: run.conversationId },
        });

        await new MeteringService(this.database).recordTerminalRun({
          organizationId: run.organizationId,
          workspaceId: run.workspaceId,
          sourceType: "agent_run",
          sourceId: run.id,
          outcome: "failed",
          occurredAt: new Date(),
        });
      }
    }
  }

  async cancelRun(
    organizationId: string,
    runId: string,
    userId: string,
    reason?: string,
  ): Promise<AgentRunRecord> {
    const run = await this.getRun(organizationId, runId);
    if (["completed", "failed", "cancelled", "rejected"].includes(run.status)) {
      throw new ApiError(409, "VALIDATION_FAILED", `Cannot cancel run in terminal status ${run.status}.`);
    }

    const runtimeRepo = new AgentRuntimeRepository(createRepositoryContext(this.database.db));
    const now = new Date();

    const updated = await runtimeRepo.updateRun(organizationId, runId, {
      status: "cancelled",
      cancelledBy: userId,
      cancelledAt: now,
      cancellationReason: reason ?? "User requested cancellation.",
      completedAt: now,
      leaseToken: null,
      leaseExpiresAt: null,
    });

    if (!updated) throw new ApiError(404, "NOT_FOUND", "Run not found.");

    await runtimeRepo.recordEvent({
      organizationId,
      workspaceId: run.workspaceId,
      runId,
      eventType: "run_cancelled",
      payload: {
        cancelledBy: userId,
        reason: reason ?? "User requested cancellation.",
      },
    });

    await new MeteringService(this.database).recordTerminalRun({
      organizationId,
      workspaceId: run.workspaceId,
      sourceType: "agent_run",
      sourceId: run.id,
      outcome: "cancelled",
      occurredAt: now,
    });

    return updated;
  }

  async retryRun(organizationId: string, runId: string, userId: string): Promise<AgentRunRecord> {
    const run = await this.getRun(organizationId, runId);
    if (!["failed", "cancelled"].includes(run.status)) {
      throw new ApiError(409, "VALIDATION_FAILED", `Can only retry failed or cancelled runs (current: ${run.status}).`);
    }

    const runtimeRepo = new AgentRuntimeRepository(createRepositoryContext(this.database.db));
    const updated = await runtimeRepo.updateRun(organizationId, runId, {
      status: "queued",
      errorCode: null,
      safeErrorMessage: null,
      completedAt: null,
      leaseToken: null,
      leaseExpiresAt: null,
    });

    if (!updated) throw new ApiError(404, "NOT_FOUND", "Run not found.");

    await runtimeRepo.recordEvent({
      organizationId,
      workspaceId: run.workspaceId,
      runId,
      eventType: "run_queued",
      payload: {
        triggeredBy: userId,
        action: "manual_retry",
      },
    });

    return updated;
  }

  // --- Approvals ---

  async listApprovalRequests(
    organizationId: string,
    status?: AgentApprovalStatus,
    pagination: PaginationInput = { limit: 50, offset: 0 },
  ): Promise<AgentApprovalRequestRecord[]> {
    return new AgentRuntimeRepository(createRepositoryContext(this.database.db)).listApprovalRequests(
      organizationId,
      status,
      pagination,
    );
  }

  async getApprovalRequest(
    organizationId: string,
    requestId: string,
  ): Promise<AgentApprovalRequestRecord> {
    const req = await new AgentRuntimeRepository(
      createRepositoryContext(this.database.db),
    ).getApprovalRequest(organizationId, requestId);
    if (!req) throw new ApiError(404, "NOT_FOUND", "Approval request not found.");
    return req;
  }

  async approveApprovalRequest(
    organizationId: string,
    requestId: string,
    userId: string,
    reason?: string,
  ): Promise<{ request: AgentApprovalRequestRecord; decision: AgentApprovalDecisionRecord }> {
    const req = await this.getApprovalRequest(organizationId, requestId);
    if (req.status !== "pending") {
      throw new ApiError(409, "VALIDATION_FAILED", `Approval request is already ${req.status}.`);
    }

    // Separation of duties: requester cannot approve their own high-risk request
    if (req.requestedBy === userId) {
      throw new ApiError(403, "FORBIDDEN", "Self-approval is forbidden under separation of duties policy.");
    }

    return withTransaction(this.database, async ({ tx }) => {
      const runtimeRepo = new AgentRuntimeRepository(createRepositoryContext(tx));
      const res = await runtimeRepo.resolveApprovalRequest(
        organizationId,
        req.workspaceId,
        requestId,
        "approved",
        userId,
        reason,
      );

      // Transition run from awaiting_approval to queued
      const run = await runtimeRepo.getRun(organizationId, req.runId);
      if (run && run.status === "awaiting_approval") {
        await runtimeRepo.updateRun(organizationId, run.id, {
          status: "queued",
          leaseToken: null,
          leaseExpiresAt: null,
        });

        await runtimeRepo.recordEvent({
          organizationId,
          workspaceId: req.workspaceId,
          runId: run.id,
          eventType: "approval_approved",
          payload: {
            approvalRequestId: requestId,
            approvedBy: userId,
            reason: reason ?? null,
          },
        });

        await runtimeRepo.recordEvent({
          organizationId,
          workspaceId: req.workspaceId,
          runId: run.id,
          eventType: "run_resumed",
          payload: {
            approvalRequestId: requestId,
            resumedAt: new Date().toISOString(),
          },
        });
      }

      return res;
    });
  }

  async rejectApprovalRequest(
    organizationId: string,
    requestId: string,
    userId: string,
    reason?: string,
  ): Promise<{ request: AgentApprovalRequestRecord; decision: AgentApprovalDecisionRecord }> {
    const req = await this.getApprovalRequest(organizationId, requestId);
    if (req.status !== "pending") {
      throw new ApiError(409, "VALIDATION_FAILED", `Approval request is already ${req.status}.`);
    }

    return withTransaction(this.database, async ({ tx }) => {
      const runtimeRepo = new AgentRuntimeRepository(createRepositoryContext(tx));
      const res = await runtimeRepo.resolveApprovalRequest(
        organizationId,
        req.workspaceId,
        requestId,
        "rejected",
        userId,
        reason,
      );

      // Transition run to rejected
      const run = await runtimeRepo.getRun(organizationId, req.runId);
      if (run) {
        await runtimeRepo.updateRun(organizationId, run.id, {
          status: "rejected",
          completedAt: new Date(),
          leaseToken: null,
          leaseExpiresAt: null,
        });

        await runtimeRepo.recordEvent({
          organizationId,
          workspaceId: req.workspaceId,
          runId: run.id,
          eventType: "approval_rejected",
          payload: {
            approvalRequestId: requestId,
            rejectedBy: userId,
            reason: reason ?? null,
          },
        });
      }

      return res;
    });
  }

  // --- Events & Usage & Observability ---

  async listRunEvents(organizationId: string, runId: string): Promise<AgentRunEventRecord[]> {
    await this.getRun(organizationId, runId);
    return new AgentRuntimeRepository(createRepositoryContext(this.database.db)).listEvents(runId);
  }

  async listRunAttempts(organizationId: string, runId: string): Promise<AgentRunAttemptRecord[]> {
    await this.getRun(organizationId, runId);
    return new AgentRuntimeRepository(createRepositoryContext(this.database.db)).listAttempts(runId);
  }

  async getRunUsage(organizationId: string, runId: string): Promise<AgentRuntimeUsageRecord[]> {
    await this.getRun(organizationId, runId);
    return new AgentRuntimeRepository(createRepositoryContext(this.database.db)).getUsageForRun(runId);
  }

  async getMonitoringMetrics(organizationId: string): Promise<RuntimeMonitoringMetrics> {
    return new AgentRuntimeRepository(createRepositoryContext(this.database.db)).getMonitoringMetrics(
      organizationId,
    );
  }

  // --- Conversations & Messages ---

  async listConversations(
    organizationId: string,
    userId: string,
    pagination: PaginationInput,
    agentId?: string,
  ): Promise<AgentConversationRecord[]> {
    if (agentId) await this.assertExecutableAgent(organizationId, agentId);
    return new AgentRuntimeRepository(createRepositoryContext(this.database.db)).listConversations(
      organizationId,
      userId,
      pagination,
      agentId,
    );
  }

  async createConversation(input: CreateConversationInput): Promise<AgentConversationRecord> {
    const agent = await this.assertExecutableAgent(input.organizationId, input.agentId);
    return new AgentRuntimeRepository(createRepositoryContext(this.database.db)).createConversation({
      organizationId: input.organizationId,
      workspaceId: agent.workspaceId,
      agentId: agent.id,
      userId: input.userId,
      title: input.title,
    });
  }

  async getConversation(
    organizationId: string,
    conversationId: string,
    userId: string,
  ): Promise<AgentConversationRecord> {
    const conversation = await new AgentRuntimeRepository(
      createRepositoryContext(this.database.db),
    ).getConversation(organizationId, conversationId, userId);
    if (!conversation) throw new ApiError(404, "NOT_FOUND", "Conversation not found.");
    return conversation;
  }

  async listMessages(
    organizationId: string,
    conversationId: string,
    userId: string,
    pagination: PaginationInput,
  ): Promise<AgentMessageRecord[]> {
    await this.getConversation(organizationId, conversationId, userId);
    return new AgentRuntimeRepository(createRepositoryContext(this.database.db)).listMessages(
      organizationId,
      conversationId,
      userId,
      pagination,
    );
  }

  async createMessage(input: CreateMessageInput): Promise<AgentMessageRecord> {
    const conversation = await this.getConversation(
      input.organizationId,
      input.conversationId,
      input.userId,
    );
    if (input.agentRunId) {
      const run = await new AgentRuntimeRepository(
        createRepositoryContext(this.database.db),
      ).getRunForConversation(
        input.organizationId,
        input.agentRunId,
        input.conversationId,
        input.userId,
      );
      if (!run) throw new ApiError(404, "NOT_FOUND", "Agent run not found for conversation.");
    }
    return new AgentRuntimeRepository(createRepositoryContext(this.database.db)).createMessage({
      organizationId: input.organizationId,
      workspaceId: conversation.workspaceId,
      conversationId: conversation.id,
      agentRunId: input.agentRunId ?? null,
      role: input.role,
      content: input.content,
      metadata: input.metadata,
    });
  }

  async updateRun(input: UpdateAgentRunInput): Promise<AgentRunRecord> {
    const existing = await this.getRun(input.organizationId, input.runId, input.userId);
    this.assertTransition(existing.status, input.status);
    const completedAt = ["completed", "failed", "cancelled", "rejected"].includes(input.status)
      ? new Date()
      : existing.completedAt;
    const durationMs = completedAt
      ? (input.durationMs ?? Math.max(0, completedAt.getTime() - existing.startedAt.getTime()))
      : existing.durationMs;
    const safeErrorMessage =
      input.status === "failed"
        ? sanitizeError(input.error ?? "Agent run failed.")
        : existing.safeErrorMessage;
    const errorCode =
      input.status === "failed" ? (input.errorCode ?? "RUNTIME_ERROR") : existing.errorCode;
    const output = input.output === undefined ? existing.output : normalizePayload(input.output);
    const metadata = input.metadata
      ? { ...existing.metadata, ...input.metadata }
      : existing.metadata;

    return withTransaction(this.database, async ({ tx }) => {
      const repository = new AgentRuntimeRepository(createRepositoryContext(tx));
      const updated = await repository.updateRun(input.organizationId, input.runId, {
        status: input.status,
        output,
        errorCode,
        safeErrorMessage,
        metadata,
        completedAt,
        durationMs,
      });
      if (!updated) throw new ApiError(404, "NOT_FOUND", "Agent run not found.");

      if (input.status === "completed" && input.output !== undefined && updated.conversationId) {
        await repository.createMessage({
          organizationId: updated.organizationId,
          workspaceId: updated.workspaceId,
          conversationId: updated.conversationId,
          agentRunId: updated.id,
          role: "assistant",
          content: contentFromPayload(input.output),
          metadata: { source: "agent-run-complete" },
        });
      }

      if (input.status === "failed") {
        await new OperationalService(this.database).recordOperationalEvent(
          {
            organizationId: updated.organizationId,
            workspaceId: updated.workspaceId,
            severity: "error",
            component: "agent-runtime",
            eventType: "agent.run.failed",
            status: "failed",
            resourceType: "agent_run",
            resourceId: updated.id,
            agentRunId: updated.id,
            correlationId: updated.id,
            summary: "Agent run failed.",
            safeErrorCode: updated.errorCode,
            safeErrorMessage: updated.safeErrorMessage,
            metadata: { agentId: updated.agentId, conversationId: updated.conversationId },
          },
          tx,
        );
      }

      if (["completed", "failed", "cancelled"].includes(input.status)) {
        await new MeteringService(this.database).recordTerminalRun(
          {
            organizationId: updated.organizationId,
            workspaceId: updated.workspaceId,
            sourceType: "agent_run",
            sourceId: updated.id,
            outcome: input.status as "completed" | "failed" | "cancelled",
            occurredAt: completedAt ?? new Date(),
          },
          tx,
        );
      }

      return updated;
    });
  }

  private async assertExecutableAgent(
    organizationId: string,
    agentId: string,
  ): Promise<AgentDefinitionWithTools> {
    const agent = await new AgentRepository(
      createRepositoryContext(this.database.db),
    ).getByIdForOrganization(organizationId, agentId);
    if (!agent) throw new ApiError(404, "NOT_FOUND", "Agent not found.");
    if (!agent.enabled || !["active", "configured"].includes(agent.status)) {
      throw new ApiError(409, "VALIDATION_FAILED", "Agent is not enabled for execution.");
    }
    return agent;
  }

  private async requireConversation(
    repository: AgentRuntimeRepository,
    organizationId: string,
    conversationId: string,
    userId: string,
    agentId: string,
  ): Promise<AgentConversationRecord> {
    const conversation = await repository.getConversation(organizationId, conversationId, userId);
    if (!conversation || conversation.agentId !== agentId || conversation.status !== "active") {
      throw new ApiError(404, "NOT_FOUND", "Conversation not found.");
    }
    return conversation;
  }

  private assertTransition(current: AgentRunStatus, next: AgentRunStatus): void {
    if (current === next) return;
    const allowed = RUNTIME_STATE_TRANSITIONS[current] ?? [];
    if (!allowed.includes(next)) {
      throw new ApiError(
        409,
        "VALIDATION_FAILED",
        `Cannot transition run from ${current} to ${next}.`,
      );
    }
  }
}

function normalizePayload(value: unknown): JsonRecord {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as JsonRecord;
  return { value };
}

function contentFromPayload(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function titleFromInput(value: unknown): string {
  const content = contentFromPayload(value).trim().replace(/\s+/g, " ");
  return content.length > 60 ? `${content.slice(0, 57)}...` : content || "New Conversation";
}

function sanitizeError(value: string): string {
  return value
    .replace(/sk-[a-z0-9_-]+/gi, "[redacted]")
    .replace(/ghp_[a-z0-9_]+/gi, "[redacted]")
    .replace(/github_pat_[a-z0-9_]+/gi, "[redacted]")
    .replace(/authorization:\s*bearer\s+\S+/gi, "authorization: bearer [redacted]")
    .slice(0, 1000);
}
