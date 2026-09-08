import { ApiError } from "../../../common/errors/api-error.js";
import type { DatabaseClient } from "../../../database/client.js";
import { createRepositoryContext } from "../../../database/repositories/repository-context.js";
import { withTransaction } from "../../../database/transactions.js";
import type {
  AgentConversationRecord,
  AgentDefinitionWithTools,
  AgentMessageRecord,
  AgentRunRecord,
  AgentRunStatus,
  CreateAgentRunInput,
  CreateConversationInput,
  CreateMessageInput,
  JsonRecord,
  PaginationInput,
  UpdateAgentRunInput,
} from "../agent.types.js";
import { AgentRepository } from "../repositories/agent.repository.js";
import { AgentRuntimeRepository } from "../repositories/agent-runtime.repository.js";

const allowedTransitions: Record<AgentRunStatus, AgentRunStatus[]> = {
  queued: ["running", "waiting", "completed", "failed", "cancelled"],
  running: ["waiting", "completed", "failed", "cancelled"],
  waiting: ["running", "completed", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: [],
};

export class AgentRuntimeService {
  constructor(private readonly database: DatabaseClient) {}

  async listRuns(
    organizationId: string,
    agentId: string,
    userId: string,
    pagination: PaginationInput,
  ): Promise<AgentRunRecord[]> {
    await this.assertExecutableAgent(organizationId, agentId);
    return new AgentRuntimeRepository(createRepositoryContext(this.database.db)).listRuns(
      organizationId,
      agentId,
      userId,
      pagination,
    );
  }

  async getRun(organizationId: string, runId: string, userId: string): Promise<AgentRunRecord> {
    const run = await new AgentRuntimeRepository(createRepositoryContext(this.database.db)).getRun(
      organizationId,
      runId,
      userId,
    );
    if (!run) throw new ApiError(404, "NOT_FOUND", "Agent run not found.");
    return run;
  }

  async createRun(
    input: CreateAgentRunInput,
  ): Promise<{
    run: AgentRunRecord;
    conversation: AgentConversationRecord;
    userMessage: AgentMessageRecord;
  }> {
    const agent = await this.assertExecutableAgent(input.organizationId, input.agentId);
    return withTransaction(this.database, async ({ tx }) => {
      const repository = new AgentRuntimeRepository(createRepositoryContext(tx));
      const conversation = input.conversationId
        ? await this.requireConversation(
            repository,
            input.organizationId,
            input.conversationId,
            input.userId,
            agent.id,
          )
        : await repository.createConversation({
            organizationId: input.organizationId,
            workspaceId: agent.workspaceId,
            agentId: agent.id,
            userId: input.userId,
            title: titleFromInput(input.input),
          });

      const run = await repository.createRun({
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
        metadata: {
          ...input.metadata,
          conversationId: conversation.id,
          userMessagePersisted: true,
        },
        startedAt: new Date(),
      });

      const userMessage = await repository.createMessage({
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

  async updateRun(input: UpdateAgentRunInput): Promise<AgentRunRecord> {
    const existing = await this.getRun(input.organizationId, input.runId, input.userId);
    this.assertTransition(existing.status, input.status);
    const completedAt = ["completed", "failed", "cancelled"].includes(input.status)
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
      const updated = await repository.updateRun(input.organizationId, input.runId, input.userId, {
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

      return updated;
    });
  }

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
    return new AgentRuntimeRepository(createRepositoryContext(this.database.db)).createConversation(
      {
        organizationId: input.organizationId,
        workspaceId: agent.workspaceId,
        agentId: agent.id,
        userId: input.userId,
        title: input.title,
      },
    );
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
    if (!allowedTransitions[current].includes(next)) {
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
