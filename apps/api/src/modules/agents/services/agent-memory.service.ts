import { ApiError } from "../../../common/errors/api-error.js";
import type { DatabaseClient } from "../../../database/client.js";
import { createRepositoryContext } from "../../../database/repositories/repository-context.js";
import type {
  AgentDefinitionWithTools,
  AgentMemoryQuery,
  AgentMemoryRecord,
  CreateAgentMemoryInput,
  UpdateAgentMemoryInput,
} from "../agent.types.js";
import { AgentMemoryRepository } from "../repositories/agent-memory.repository.js";
import { AgentRepository } from "../repositories/agent.repository.js";

const sharedScopes = new Set(["agent", "workspace", "organization"]);

export class AgentMemoryService {
  constructor(private readonly database: DatabaseClient) {}

  async listMemories(query: AgentMemoryQuery): Promise<AgentMemoryRecord[]> {
    await this.assertAgent(query.organizationId, query.agentId);
    const repository = new AgentMemoryRepository(createRepositoryContext(this.database.db));
    const memories = await repository.listForAgent(query);
    await repository.markUsed(memories.map((memory) => memory.id));
    return memories;
  }

  async getMemory(
    organizationId: string,
    memoryId: string,
    userId: string,
    canManage: boolean,
  ): Promise<AgentMemoryRecord> {
    const memory = await new AgentMemoryRepository(
      createRepositoryContext(this.database.db),
    ).findById(organizationId, memoryId);
    if (!memory || !this.canAccessMemory(memory, userId, canManage)) {
      throw new ApiError(404, "NOT_FOUND", "Agent memory not found.");
    }
    return memory;
  }

  async createMemory(
    input: CreateAgentMemoryInput,
    canManage: boolean,
  ): Promise<AgentMemoryRecord> {
    const agent = await this.assertAgent(input.organizationId, input.agentId);
    this.assertScopeAllowed(input.scope, canManage);
    const repository = new AgentMemoryRepository(createRepositoryContext(this.database.db));
    await this.validateSourceReferences(repository, input, agent);

    return repository.create({
      organizationId: input.organizationId,
      workspaceId: agent.workspaceId,
      agentId: agent.id,
      userId: memoryUserId(input.scope, input.userId),
      scope: input.scope,
      type: input.type,
      content: input.content,
      source: input.source,
      sourceRunId: input.sourceRunId ?? null,
      sourceConversationId: input.sourceConversationId ?? null,
      sourceMessageId: input.sourceMessageId ?? null,
      importance: input.importance,
      metadata: input.metadata,
      createdBy: input.userId,
      updatedBy: null,
      expiresAt: input.expiresAt ?? null,
    });
  }

  async updateMemory(
    input: UpdateAgentMemoryInput,
    canManage: boolean,
  ): Promise<AgentMemoryRecord> {
    const repository = new AgentMemoryRepository(createRepositoryContext(this.database.db));
    const existing = await this.getMemory(
      input.organizationId,
      input.memoryId,
      input.userId,
      canManage,
    );
    await this.assertAgent(existing.organizationId, existing.agentId);
    const nextScope = input.scope ?? existing.scope;
    this.assertScopeAllowed(nextScope, canManage, existing, input.userId);
    const updated = await repository.update(input.organizationId, input.memoryId, {
      scope: input.scope,
      type: input.type,
      content: input.content,
      status: input.status,
      importance: input.importance,
      metadata: input.metadata,
      expiresAt: input.expiresAt,
      updatedBy: input.userId,
    });
    if (!updated) throw new ApiError(404, "NOT_FOUND", "Agent memory not found.");
    return updated;
  }

  async forgetMemory(
    organizationId: string,
    memoryId: string,
    userId: string,
    canManage: boolean,
  ): Promise<AgentMemoryRecord> {
    await this.getMemory(organizationId, memoryId, userId, canManage);
    const updated = await new AgentMemoryRepository(
      createRepositoryContext(this.database.db),
    ).update(organizationId, memoryId, { status: "deleted", updatedBy: userId });
    if (!updated) throw new ApiError(404, "NOT_FOUND", "Agent memory not found.");
    return updated;
  }

  private async assertAgent(
    organizationId: string,
    agentId: string,
  ): Promise<AgentDefinitionWithTools> {
    const agent = await new AgentRepository(
      createRepositoryContext(this.database.db),
    ).getByIdForOrganization(organizationId, agentId);
    if (!agent) throw new ApiError(404, "NOT_FOUND", "Agent not found.");
    if (!agent.enabled || ["disabled", "archived"].includes(agent.status)) {
      throw new ApiError(409, "VALIDATION_FAILED", "Agent is not enabled for memory operations.");
    }
    return agent;
  }

  private assertScopeAllowed(
    scope: string,
    canManage: boolean,
    existing?: AgentMemoryRecord,
    userId?: string,
  ): void {
    if (sharedScopes.has(scope) && !canManage) {
      throw new ApiError(403, "FORBIDDEN", "Shared agent memory requires manage permission.");
    }
    if (
      existing &&
      ["user", "conversation"].includes(existing.scope) &&
      existing.userId !== userId &&
      !canManage
    ) {
      throw new ApiError(404, "NOT_FOUND", "Agent memory not found.");
    }
  }

  private canAccessMemory(memory: AgentMemoryRecord, userId: string, canManage: boolean): boolean {
    if (memory.scope === "user" || memory.scope === "conversation") {
      return memory.userId === userId || canManage;
    }
    return canManage || memory.status === "active";
  }

  private async validateSourceReferences(
    repository: AgentMemoryRepository,
    input: CreateAgentMemoryInput,
    agent: AgentDefinitionWithTools,
  ): Promise<void> {
    if (input.sourceConversationId) {
      const conversation = await repository.findConversation(
        input.organizationId,
        input.sourceConversationId,
        input.userId,
      );
      if (
        !conversation ||
        conversation.agentId !== agent.id ||
        conversation.workspaceId !== agent.workspaceId
      ) {
        throw new ApiError(404, "NOT_FOUND", "Source conversation not found.");
      }
    }
    if (input.sourceRunId) {
      const run = await repository.findRun(input.organizationId, input.sourceRunId, input.userId);
      if (!run || run.agentId !== agent.id || run.workspaceId !== agent.workspaceId) {
        throw new ApiError(404, "NOT_FOUND", "Source run not found.");
      }
    }
    if (input.sourceMessageId) {
      const source = await repository.findMessage(
        input.organizationId,
        input.sourceMessageId,
        input.userId,
      );
      if (
        !source ||
        source.conversation.agentId !== agent.id ||
        source.conversation.workspaceId !== agent.workspaceId
      ) {
        throw new ApiError(404, "NOT_FOUND", "Source message not found.");
      }
    }
  }
}

function memoryUserId(scope: string, userId: string): string | null {
  return scope === "user" || scope === "conversation" ? userId : null;
}
