import { and, desc, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { DatabaseClient } from "../../../database/client.js";
import {
  aiModelPricingCatalog,
  aiProviderAuditLogs,
  aiProviderTenantConfigs,
  aiUsageBudgets,
  aiUsageLedger,
} from "../../../database/schema.js";
import { maskApiKey, redactObject } from "../utils/secret-redactor.js";
import type { EnvironmentMode, TenantProviderConfig } from "../providers/ai-provider.types.js";

export type UpdateTenantConfigInput = {
  providerId: string;
  liveModeEnabled?: boolean;
  environmentMode?: EnvironmentMode;
  apiKey?: string;
  defaultModel?: string;
  allowedModels?: string[];
  embeddingModel?: string;
  embeddingLiveEnabled?: boolean;
  status?: "inactive" | "configured" | "active" | "degraded" | "error";
  statusMessage?: string;
};

export type UpdateBudgetInput = {
  monthlyBudgetUsd?: number;
  dailyBudgetUsd?: number;
  perRequestMaxCostUsd?: number;
  enforceHardLimit?: boolean;
  notifyThresholdPercent?: number;
  status?: string;
};

export class AiProviderConfigRepository {
  constructor(private readonly database: DatabaseClient) {}

  async getTenantConfig(
    organizationId: string,
    providerId: string,
  ): Promise<TenantProviderConfig | null> {
    const rows = await this.database.db
      .select()
      .from(aiProviderTenantConfigs)
      .where(
        and(
          eq(aiProviderTenantConfigs.organizationId, organizationId),
          eq(aiProviderTenantConfigs.providerId, providerId),
        ),
      )
      .limit(1);

    if (rows.length === 0) return null;
    const r = rows[0];

    return {
      id: r.id,
      organizationId: r.organizationId,
      providerId: r.providerId,
      liveModeEnabled: r.liveModeEnabled,
      environmentMode: r.environmentMode as EnvironmentMode,
      apiKeyMasked: r.apiKeyMasked,
      defaultModel: r.defaultModel,
      allowedModels: r.allowedModels,
      embeddingModel: r.embeddingModel,
      embeddingLiveEnabled: r.embeddingLiveEnabled,
      status: r.status as any,
      statusMessage: r.statusMessage,
      lastHealthCheckAt: r.lastHealthCheckAt,
      updatedBy: r.updatedBy,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  async listTenantConfigs(organizationId: string): Promise<TenantProviderConfig[]> {
    const rows = await this.database.db
      .select()
      .from(aiProviderTenantConfigs)
      .where(eq(aiProviderTenantConfigs.organizationId, organizationId));

    return rows.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      providerId: r.providerId,
      liveModeEnabled: r.liveModeEnabled,
      environmentMode: r.environmentMode as EnvironmentMode,
      apiKeyMasked: r.apiKeyMasked,
      defaultModel: r.defaultModel,
      allowedModels: r.allowedModels,
      embeddingModel: r.embeddingModel,
      embeddingLiveEnabled: r.embeddingLiveEnabled,
      status: r.status as any,
      statusMessage: r.statusMessage,
      lastHealthCheckAt: r.lastHealthCheckAt,
      updatedBy: r.updatedBy,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async upsertTenantConfig(
    organizationId: string,
    input: UpdateTenantConfigInput,
    userId: string,
    ipAddress?: string,
  ): Promise<TenantProviderConfig> {
    const existing = await this.getTenantConfig(organizationId, input.providerId);
    const id = existing ? existing.id : randomUUID();

    const maskedKey = input.apiKey ? maskApiKey(input.apiKey) : (existing?.apiKeyMasked ?? null);
    const encryptedKey = input.apiKey ? input.apiKey : null; // Stored securely in database entity

    const allowedModels = input.allowedModels ?? (existing?.allowedModels || ["gpt-4o-mini", "gpt-4o"]);
    const defaultModel = input.defaultModel ?? (existing?.defaultModel || "gpt-4o-mini");
    const environmentMode = input.environmentMode ?? (existing?.environmentMode || "mock");
    const liveModeEnabled = input.liveModeEnabled ?? (existing?.liveModeEnabled || false);
    const embeddingModel = input.embeddingModel ?? (existing?.embeddingModel || "text-embedding-3-small");
    const embeddingLiveEnabled = input.embeddingLiveEnabled ?? (existing?.embeddingLiveEnabled || false);
    const status = input.status ?? (input.apiKey ? "configured" : existing?.status || "inactive");
    const statusMessage = input.statusMessage ?? existing?.statusMessage ?? null;

    if (existing) {
      const updateData: Record<string, unknown> = {
        liveModeEnabled,
        environmentMode,
        defaultModel,
        allowedModels,
        embeddingModel,
        embeddingLiveEnabled,
        status,
        statusMessage,
        updatedBy: userId,
        updatedAt: new Date(),
      };
      if (input.apiKey) {
        updateData.apiKeyEncrypted = encryptedKey;
        updateData.apiKeyMasked = maskedKey;
      }

      await this.database.db
        .update(aiProviderTenantConfigs)
        .set(updateData)
        .where(eq(aiProviderTenantConfigs.id, id));
    } else {
      await this.database.db.insert(aiProviderTenantConfigs).values({
        id,
        organizationId,
        providerId: input.providerId,
        liveModeEnabled,
        environmentMode,
        apiKeyEncrypted: encryptedKey,
        apiKeyMasked: maskedKey,
        defaultModel,
        allowedModels,
        embeddingModel,
        embeddingLiveEnabled,
        status,
        statusMessage,
        updatedBy: userId,
      });
    }

    // Write audit log
    await this.database.db.insert(aiProviderAuditLogs).values({
      id: randomUUID(),
      organizationId,
      providerId: input.providerId,
      action: existing ? "UPDATE_CONFIG" : "CREATE_CONFIG",
      performedBy: userId,
      previousState: existing ? redactObject(existing) : null,
      newState: redactObject({
        liveModeEnabled,
        environmentMode,
        defaultModel,
        allowedModels,
        embeddingModel,
        embeddingLiveEnabled,
        status,
        apiKeyMasked: maskedKey,
      }),
      ipAddress: ipAddress ?? null,
    });

    const updated = await this.getTenantConfig(organizationId, input.providerId);
    return updated!;
  }

  async getRawApiKey(organizationId: string, providerId: string): Promise<string | null> {
    const rows = await this.database.db
      .select({ apiKeyEncrypted: aiProviderTenantConfigs.apiKeyEncrypted })
      .from(aiProviderTenantConfigs)
      .where(
        and(
          eq(aiProviderTenantConfigs.organizationId, organizationId),
          eq(aiProviderTenantConfigs.providerId, providerId),
        ),
      )
      .limit(1);

    if (rows.length === 0) return null;
    return rows[0].apiKeyEncrypted ?? null;
  }

  async updateHealthCheckStatus(
    organizationId: string,
    providerId: string,
    status: "inactive" | "configured" | "active" | "degraded" | "error",
    statusMessage?: string,
  ): Promise<void> {
    await this.database.db
      .update(aiProviderTenantConfigs)
      .set({
        status,
        statusMessage: statusMessage ?? null,
        lastHealthCheckAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(aiProviderTenantConfigs.organizationId, organizationId),
          eq(aiProviderTenantConfigs.providerId, providerId),
        ),
      );
  }

  // ==========================================
  // BUDGETS
  // ==========================================

  async getBudget(organizationId: string, workspaceId?: string) {
    const conditions = [eq(aiUsageBudgets.organizationId, organizationId)];
    if (workspaceId) {
      conditions.push(eq(aiUsageBudgets.workspaceId, workspaceId));
    }

    const rows = await this.database.db
      .select()
      .from(aiUsageBudgets)
      .where(and(...conditions))
      .limit(1);

    if (rows.length > 0) {
      return rows[0];
    }

    // Initialize default budget if not found
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const defaultBudget = {
      id: randomUUID(),
      organizationId,
      workspaceId: workspaceId ?? null,
      monthlyBudgetUsd: "50.0000",
      dailyBudgetUsd: "10.0000",
      perRequestMaxCostUsd: "1.0000",
      currentMonthSpendUsd: "0.0000",
      currentDaySpendUsd: "0.0000",
      monthResetAt: nextMonth,
      dayResetAt: tomorrow,
      enforceHardLimit: true,
      notifyThresholdPercent: 80,
      status: "active",
      updatedBy: null,
    };

    await this.database.db.insert(aiUsageBudgets).values(defaultBudget);
    return defaultBudget;
  }

  async updateBudget(
    organizationId: string,
    input: UpdateBudgetInput,
    userId: string,
    workspaceId?: string,
  ) {
    const existing = await this.getBudget(organizationId, workspaceId);

    const updateData: Record<string, unknown> = {
      updatedBy: userId,
      updatedAt: new Date(),
    };
    if (input.monthlyBudgetUsd !== undefined) {
      updateData.monthlyBudgetUsd = input.monthlyBudgetUsd.toFixed(4);
    }
    if (input.dailyBudgetUsd !== undefined) {
      updateData.dailyBudgetUsd = input.dailyBudgetUsd.toFixed(4);
    }
    if (input.perRequestMaxCostUsd !== undefined) {
      updateData.perRequestMaxCostUsd = input.perRequestMaxCostUsd.toFixed(4);
    }
    if (input.enforceHardLimit !== undefined) {
      updateData.enforceHardLimit = input.enforceHardLimit;
    }
    if (input.notifyThresholdPercent !== undefined) {
      updateData.notifyThresholdPercent = input.notifyThresholdPercent;
    }
    if (input.status !== undefined) {
      updateData.status = input.status;
    }

    await this.database.db
      .update(aiUsageBudgets)
      .set(updateData)
      .where(eq(aiUsageBudgets.id, existing.id));

    // Audit trail
    await this.database.db.insert(aiProviderAuditLogs).values({
      id: randomUUID(),
      organizationId,
      providerId: "system_budget",
      action: "UPDATE_BUDGET",
      performedBy: userId,
      previousState: redactObject(existing),
      newState: redactObject(updateData),
      ipAddress: null,
    });

    return this.getBudget(organizationId, workspaceId);
  }

  // ==========================================
  // USAGE LEDGER & METERING
  // ==========================================

  async insertLedgerEntry(entry: {
    organizationId: string;
    workspaceId?: string;
    agentId?: string;
    runId?: string;
    providerId: string;
    modelId: string;
    operationType: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
    actualCostUsd?: number;
    latencyMs: number;
    finishReason?: string;
    isLiveMode: boolean;
    correlationId?: string;
  }): Promise<void> {
    const id = randomUUID();
    await this.database.db.insert(aiUsageLedger).values({
      id,
      organizationId: entry.organizationId,
      workspaceId: entry.workspaceId ?? null,
      agentId: entry.agentId ?? null,
      runId: entry.runId ?? null,
      providerId: entry.providerId,
      modelId: entry.modelId,
      operationType: entry.operationType,
      promptTokens: entry.promptTokens,
      completionTokens: entry.completionTokens,
      totalTokens: entry.totalTokens,
      estimatedCostUsd: entry.estimatedCostUsd.toFixed(6),
      actualCostUsd: entry.actualCostUsd !== undefined ? entry.actualCostUsd.toFixed(6) : null,
      latencyMs: entry.latencyMs,
      finishReason: entry.finishReason ?? null,
      isLiveMode: entry.isLiveMode,
      correlationId: entry.correlationId ?? null,
    });

    // Update cumulative spend in budget
    const cost = entry.actualCostUsd ?? entry.estimatedCostUsd;
    if (cost > 0) {
      await this.database.db
        .update(aiUsageBudgets)
        .set({
          currentDaySpendUsd: sql`${aiUsageBudgets.currentDaySpendUsd} + ${cost}`,
          currentMonthSpendUsd: sql`${aiUsageBudgets.currentMonthSpendUsd} + ${cost}`,
          updatedAt: new Date(),
        })
        .where(eq(aiUsageBudgets.organizationId, entry.organizationId));
    }
  }

  async getUsageMetrics(organizationId: string, limit = 50) {
    const rows = await this.database.db
      .select()
      .from(aiUsageLedger)
      .where(eq(aiUsageLedger.organizationId, organizationId))
      .orderBy(desc(aiUsageLedger.createdAt))
      .limit(limit);

    return rows;
  }

  // ==========================================
  // MODEL PRICING CATALOG
  // ==========================================

  async getModelPricing(providerId: string, modelId: string) {
    const rows = await this.database.db
      .select()
      .from(aiModelPricingCatalog)
      .where(
        and(
          eq(aiModelPricingCatalog.providerId, providerId),
          eq(aiModelPricingCatalog.modelId, modelId),
          eq(aiModelPricingCatalog.isActive, true),
        ),
      )
      .limit(1);

    if (rows.length === 0) return null;
    return rows[0];
  }
}
