import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  aiAgentTools,
  aiAgentToolVersions,
  aiAgentToolTenantPolicies,
  aiAgentToolExecutions,
} from "../../../database/schema.js";
import type { RepositoryContext } from "../../../database/repositories/repository-context.js";
import type {
  ToolDefinition,
  ToolVersionDefinition,
  ToolTenantPolicy,
  ToolExecutionRecord,
  TrustedToolRegistration,
} from "../tools/agent-tool.types.js";

export class AgentToolRepository {
  constructor(private readonly context: RepositoryContext) {}

  async ensureTrustedToolsSeeded(trustedTools: TrustedToolRegistration[]): Promise<void> {
    for (const tool of trustedTools) {
      const existing = await this.getToolByKey(tool.toolKey);
      let toolId: string;

      if (!existing) {
        toolId = tool.toolId || randomUUID();
        await this.context.db.insert(aiAgentTools).values({
          id: toolId,
          toolKey: tool.toolKey,
          name: tool.name,
          description: tool.description,
          category: tool.category,
          industry: tool.industry,
          riskLevel: tool.riskLevel,
          executionMode: tool.executionMode,
          requiredPermissions: tool.requiredPermissions as string[],
          approvalPolicy: tool.approvalPolicy,
          timeoutMs: tool.timeoutMs,
          maxAttempts: tool.maxAttempts,
          status: tool.enabled ? "active" : "disabled",
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } else {
        toolId = existing.toolId;
        await this.context.db
          .update(aiAgentTools)
          .set({
            name: tool.name,
            description: tool.description,
            category: tool.category,
            industry: tool.industry,
            riskLevel: tool.riskLevel,
            executionMode: tool.executionMode,
            requiredPermissions: tool.requiredPermissions as string[],
            approvalPolicy: tool.approvalPolicy,
            timeoutMs: tool.timeoutMs,
            maxAttempts: tool.maxAttempts,
            updatedAt: new Date(),
          })
          .where(eq(aiAgentTools.id, toolId));
      }

      // Seed/update tool version
      const existingVersion = await this.getToolVersion(toolId, tool.version);
      if (!existingVersion) {
        await this.context.db.insert(aiAgentToolVersions).values({
          id: randomUUID(),
          toolId,
          version: tool.version,
          inputSchema: tool.inputSchema,
          outputSchema: tool.outputSchema,
          deprecated: tool.deprecated,
          changelog: "Initial verified release",
          createdAt: new Date(),
        });
      } else {
        await this.context.db
          .update(aiAgentToolVersions)
          .set({
            inputSchema: tool.inputSchema,
            outputSchema: tool.outputSchema,
            deprecated: tool.deprecated,
          })
          .where(and(eq(aiAgentToolVersions.toolId, toolId), eq(aiAgentToolVersions.version, tool.version)));
      }
    }
  }

  async listTools(filters?: {
    category?: string;
    industry?: string;
    status?: string;
  }): Promise<ToolDefinition[]> {
    const conditions: SQL[] = [];
    if (filters?.category) conditions.push(eq(aiAgentTools.category, filters.category));
    if (filters?.industry) conditions.push(eq(aiAgentTools.industry, filters.industry));
    if (filters?.status) conditions.push(eq(aiAgentTools.status, filters.status));

    const rows = await this.context.db
      .select()
      .from(aiAgentTools)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(aiAgentTools.category, aiAgentTools.name);

    const tools: ToolDefinition[] = [];
    for (const r of rows) {
      const versions = await this.context.db
        .select()
        .from(aiAgentToolVersions)
        .where(eq(aiAgentToolVersions.toolId, r.id))
        .orderBy(desc(aiAgentToolVersions.createdAt))
        .limit(1);

      const latestVersion = versions[0];
      tools.push({
        toolId: r.id,
        toolKey: r.toolKey,
        name: r.name,
        description: r.description,
        category: r.category as any,
        industry: r.industry as any,
        version: latestVersion?.version ?? "1.0.0",
        inputSchema: latestVersion?.inputSchema ?? {},
        outputSchema: latestVersion?.outputSchema ?? {},
        executionMode: r.executionMode as any,
        riskLevel: r.riskLevel as any,
        requiredPermissions: r.requiredPermissions ?? [],
        supportedScopes: ["organization", "workspace"],
        approvalPolicy: r.approvalPolicy as any,
        timeoutMs: r.timeoutMs,
        maxAttempts: r.maxAttempts,
        enabled: r.status === "active",
        deprecated: latestVersion?.deprecated ?? false,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      });
    }

    return tools;
  }

  async getToolByKey(toolKey: string): Promise<ToolDefinition | null> {
    const rows = await this.context.db
      .select()
      .from(aiAgentTools)
      .where(eq(aiAgentTools.toolKey, toolKey))
      .limit(1);

    if (rows.length === 0) return null;
    const r = rows[0];

    const versions = await this.context.db
      .select()
      .from(aiAgentToolVersions)
      .where(eq(aiAgentToolVersions.toolId, r.id))
      .orderBy(desc(aiAgentToolVersions.createdAt))
      .limit(1);

    const latest = versions[0];

    return {
      toolId: r.id,
      toolKey: r.toolKey,
      name: r.name,
      description: r.description,
      category: r.category as any,
      industry: r.industry as any,
      version: latest?.version ?? "1.0.0",
      inputSchema: latest?.inputSchema ?? {},
      outputSchema: latest?.outputSchema ?? {},
      executionMode: r.executionMode as any,
      riskLevel: r.riskLevel as any,
      requiredPermissions: r.requiredPermissions ?? [],
      supportedScopes: ["organization", "workspace"],
      approvalPolicy: r.approvalPolicy as any,
      timeoutMs: r.timeoutMs,
      maxAttempts: r.maxAttempts,
      enabled: r.status === "active",
      deprecated: latest?.deprecated ?? false,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  async getToolById(toolId: string): Promise<ToolDefinition | null> {
    const rows = await this.context.db
      .select()
      .from(aiAgentTools)
      .where(eq(aiAgentTools.id, toolId))
      .limit(1);

    if (rows.length === 0) return null;
    const r = rows[0];

    const versions = await this.context.db
      .select()
      .from(aiAgentToolVersions)
      .where(eq(aiAgentToolVersions.toolId, r.id))
      .orderBy(desc(aiAgentToolVersions.createdAt))
      .limit(1);

    const latest = versions[0];

    return {
      toolId: r.id,
      toolKey: r.toolKey,
      name: r.name,
      description: r.description,
      category: r.category as any,
      industry: r.industry as any,
      version: latest?.version ?? "1.0.0",
      inputSchema: latest?.inputSchema ?? {},
      outputSchema: latest?.outputSchema ?? {},
      executionMode: r.executionMode as any,
      riskLevel: r.riskLevel as any,
      requiredPermissions: r.requiredPermissions ?? [],
      supportedScopes: ["organization", "workspace"],
      approvalPolicy: r.approvalPolicy as any,
      timeoutMs: r.timeoutMs,
      maxAttempts: r.maxAttempts,
      enabled: r.status === "active",
      deprecated: latest?.deprecated ?? false,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  async getToolVersion(toolId: string, version: string): Promise<ToolVersionDefinition | null> {
    const rows = await this.context.db
      .select()
      .from(aiAgentToolVersions)
      .where(and(eq(aiAgentToolVersions.toolId, toolId), eq(aiAgentToolVersions.version, version)))
      .limit(1);

    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      toolId: r.toolId,
      version: r.version,
      inputSchema: r.inputSchema,
      outputSchema: r.outputSchema,
      deprecated: r.deprecated,
      changelog: r.changelog,
      createdAt: r.createdAt,
    };
  }

  async listToolVersions(toolId: string): Promise<ToolVersionDefinition[]> {
    const rows = await this.context.db
      .select()
      .from(aiAgentToolVersions)
      .where(eq(aiAgentToolVersions.toolId, toolId))
      .orderBy(desc(aiAgentToolVersions.createdAt));

    return rows.map((r) => ({
      id: r.id,
      toolId: r.toolId,
      version: r.version,
      inputSchema: r.inputSchema,
      outputSchema: r.outputSchema,
      deprecated: r.deprecated,
      changelog: r.changelog,
      createdAt: r.createdAt,
    }));
  }

  async listTenantPolicies(organizationId: string, workspaceId?: string): Promise<ToolTenantPolicy[]> {
    const conditions: SQL[] = [eq(aiAgentToolTenantPolicies.organizationId, organizationId)];
    if (workspaceId) {
      conditions.push(eq(aiAgentToolTenantPolicies.workspaceId, workspaceId));
    }

    const rows = await this.context.db
      .select({
        policy: aiAgentToolTenantPolicies,
        tool: aiAgentTools,
      })
      .from(aiAgentToolTenantPolicies)
      .innerJoin(aiAgentTools, eq(aiAgentToolTenantPolicies.toolId, aiAgentTools.id))
      .where(and(...conditions));

    return rows.map(({ policy: r, tool }) => ({
      id: r.id,
      organizationId: r.organizationId,
      workspaceId: r.workspaceId,
      toolId: r.toolId,
      toolKey: tool.toolKey,
      enabled: r.enabled,
      approvalPolicyOverride: r.approvalPolicyOverride as any,
      customRateLimitPerMinute: r.customRateLimitPerMinute,
      allowedAgentIds: r.allowedAgentIds,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async getTenantPolicy(
    organizationId: string,
    toolId: string,
    workspaceId?: string,
  ): Promise<ToolTenantPolicy | null> {
    const conditions: SQL[] = [
      eq(aiAgentToolTenantPolicies.organizationId, organizationId),
      eq(aiAgentToolTenantPolicies.toolId, toolId),
    ];
    if (workspaceId) {
      conditions.push(eq(aiAgentToolTenantPolicies.workspaceId, workspaceId));
    }

    const rows = await this.context.db
      .select({
        policy: aiAgentToolTenantPolicies,
        tool: aiAgentTools,
      })
      .from(aiAgentToolTenantPolicies)
      .innerJoin(aiAgentTools, eq(aiAgentToolTenantPolicies.toolId, aiAgentTools.id))
      .where(and(...conditions))
      .limit(1);

    if (rows.length === 0) return null;
    const { policy: r, tool } = rows[0];

    return {
      id: r.id,
      organizationId: r.organizationId,
      workspaceId: r.workspaceId,
      toolId: r.toolId,
      toolKey: tool.toolKey,
      enabled: r.enabled,
      approvalPolicyOverride: r.approvalPolicyOverride as any,
      customRateLimitPerMinute: r.customRateLimitPerMinute,
      allowedAgentIds: r.allowedAgentIds,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  async setTenantPolicy(input: {
    organizationId: string;
    workspaceId?: string | null;
    toolId: string;
    enabled: boolean;
    approvalPolicyOverride?: string | null;
    customRateLimitPerMinute?: number | null;
    allowedAgentIds?: string[] | null;
  }): Promise<ToolTenantPolicy> {
    const existing = await this.getTenantPolicy(
      input.organizationId,
      input.toolId,
      input.workspaceId ?? undefined,
    );

    const now = new Date();
    if (existing) {
      await this.context.db
        .update(aiAgentToolTenantPolicies)
        .set({
          enabled: input.enabled,
          approvalPolicyOverride: input.approvalPolicyOverride ?? null,
          customRateLimitPerMinute: input.customRateLimitPerMinute ?? null,
          allowedAgentIds: input.allowedAgentIds ?? null,
          updatedAt: now,
        })
        .where(eq(aiAgentToolTenantPolicies.id, existing.id));

      return {
        ...existing,
        enabled: input.enabled,
        approvalPolicyOverride: input.approvalPolicyOverride as any,
        customRateLimitPerMinute: input.customRateLimitPerMinute,
        allowedAgentIds: input.allowedAgentIds,
        updatedAt: now,
      };
    } else {
      const id = randomUUID();
      await this.context.db.insert(aiAgentToolTenantPolicies).values({
        id,
        organizationId: input.organizationId,
        workspaceId: input.workspaceId ?? null,
        toolId: input.toolId,
        enabled: input.enabled,
        approvalPolicyOverride: input.approvalPolicyOverride ?? null,
        customRateLimitPerMinute: input.customRateLimitPerMinute ?? null,
        allowedAgentIds: input.allowedAgentIds ?? null,
        createdAt: now,
        updatedAt: now,
      });

      const created = await this.getTenantPolicy(
        input.organizationId,
        input.toolId,
        input.workspaceId ?? undefined,
      );
      return created!;
    }
  }

  async createExecution(input: Omit<ToolExecutionRecord, "id" | "createdAt">): Promise<ToolExecutionRecord> {
    const existingTool = await this.getToolById(input.toolId);
    if (!existingTool) {
      const { listTrustedTools } = await import("../tools/trusted-tool-registry.js");
      await this.ensureTrustedToolsSeeded(listTrustedTools());
    }
    const id = randomUUID();
    const now = new Date();

    await this.context.db.insert(aiAgentToolExecutions).values({
      id,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      runId: input.runId,
      attemptId: input.attemptId ?? null,
      agentId: input.agentId,
      configurationRevisionId: input.configurationRevisionId ?? null,
      toolId: input.toolId,
      toolVersion: input.toolVersion,
      toolKey: input.toolKey,
      requestedBy: input.requestedBy,
      inputDigest: input.inputDigest,
      inputSnapshot: input.inputSnapshot ?? null,
      outputSnapshot: input.outputSnapshot ?? null,
      status: input.status,
      approvalRequestId: input.approvalRequestId ?? null,
      startedAt: input.startedAt,
      completedAt: input.completedAt ?? null,
      durationMs: input.durationMs ?? null,
      errorCategory: input.errorCategory ?? null,
      errorMessage: input.errorMessage ?? null,
      correlationId: input.correlationId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      metadata: input.metadata ?? null,
      createdAt: now,
    });

    return {
      ...input,
      id,
      createdAt: now,
    };
  }

  async updateExecution(
    executionId: string,
    updates: Partial<ToolExecutionRecord>,
  ): Promise<void> {
    await this.context.db
      .update(aiAgentToolExecutions)
      .set({
        status: updates.status,
        completedAt: updates.completedAt ?? (updates.status === "completed" || updates.status === "failed" ? new Date() : undefined),
        durationMs: updates.durationMs,
        outputSnapshot: updates.outputSnapshot,
        errorCategory: updates.errorCategory,
        errorMessage: updates.errorMessage,
        approvalRequestId: updates.approvalRequestId,
        metadata: updates.metadata,
      })
      .where(eq(aiAgentToolExecutions.id, executionId));
  }

  async getExecutionById(organizationId: string, executionId: string): Promise<ToolExecutionRecord | null> {
    const rows = await this.context.db
      .select()
      .from(aiAgentToolExecutions)
      .where(and(eq(aiAgentToolExecutions.organizationId, organizationId), eq(aiAgentToolExecutions.id, executionId)))
      .limit(1);

    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      organizationId: r.organizationId,
      workspaceId: r.workspaceId,
      runId: r.runId,
      attemptId: r.attemptId,
      agentId: r.agentId,
      configurationRevisionId: r.configurationRevisionId,
      toolId: r.toolId,
      toolVersion: r.toolVersion,
      toolKey: r.toolKey,
      requestedBy: r.requestedBy,
      inputDigest: r.inputDigest,
      inputSnapshot: r.inputSnapshot,
      outputSnapshot: r.outputSnapshot,
      status: r.status as any,
      approvalRequestId: r.approvalRequestId,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      durationMs: r.durationMs,
      errorCategory: r.errorCategory,
      errorMessage: r.errorMessage,
      correlationId: r.correlationId,
      idempotencyKey: r.idempotencyKey,
      metadata: r.metadata,
      createdAt: r.createdAt,
    };
  }

  async listExecutions(
    organizationId: string,
    filters?: {
      workspaceId?: string;
      runId?: string;
      agentId?: string;
      toolKey?: string;
      status?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ executions: ToolExecutionRecord[]; total: number }> {
    const conditions: SQL[] = [eq(aiAgentToolExecutions.organizationId, organizationId)];
    if (filters?.workspaceId) conditions.push(eq(aiAgentToolExecutions.workspaceId, filters.workspaceId));
    if (filters?.runId) conditions.push(eq(aiAgentToolExecutions.runId, filters.runId));
    if (filters?.agentId) conditions.push(eq(aiAgentToolExecutions.agentId, filters.agentId));
    if (filters?.toolKey) conditions.push(eq(aiAgentToolExecutions.toolKey, filters.toolKey));
    if (filters?.status) conditions.push(eq(aiAgentToolExecutions.status, filters.status));

    const countRows = await this.context.db
      .select({ count: sql<number>`count(*)` })
      .from(aiAgentToolExecutions)
      .where(and(...conditions));

    const total = Number(countRows[0]?.count ?? 0);
    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;

    const rows = await this.context.db
      .select()
      .from(aiAgentToolExecutions)
      .where(and(...conditions))
      .orderBy(desc(aiAgentToolExecutions.createdAt))
      .limit(limit)
      .offset(offset);

    const executions: ToolExecutionRecord[] = rows.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      workspaceId: r.workspaceId,
      runId: r.runId,
      attemptId: r.attemptId,
      agentId: r.agentId,
      configurationRevisionId: r.configurationRevisionId,
      toolId: r.toolId,
      toolVersion: r.toolVersion,
      toolKey: r.toolKey,
      requestedBy: r.requestedBy,
      inputDigest: r.inputDigest,
      inputSnapshot: r.inputSnapshot,
      outputSnapshot: r.outputSnapshot,
      status: r.status as any,
      approvalRequestId: r.approvalRequestId,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      durationMs: r.durationMs,
      errorCategory: r.errorCategory,
      errorMessage: r.errorMessage,
      correlationId: r.correlationId,
      idempotencyKey: r.idempotencyKey,
      metadata: r.metadata,
      createdAt: r.createdAt,
    }));

    return { executions, total };
  }
}
