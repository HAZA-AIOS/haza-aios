import { randomUUID } from "node:crypto";
import type { DatabaseClient } from "../../../database/client.js";
import {
  AiProvider,
  AiProviderError,
  ModelInvocationRequest,
  ModelInvocationResponse,
  ModelMetadata,
  StreamingOptions,
} from "./ai-provider.types.js";
import { MockAiProvider } from "./mock-ai-provider.js";
import { OpenAiProvider } from "./openai-provider.js";
import {
  AiProviderConfigRepository,
  UpdateBudgetInput,
  UpdateTenantConfigInput,
} from "../repositories/ai-provider-config.repository.js";

type CircuitBreakerState = {
  failures: number;
  lastFailureAt: number;
  isOpen: boolean;
};

export class UnifiedAiProviderGateway {
  private static instance: UnifiedAiProviderGateway | null = null;
  private database: DatabaseClient;
  private providers = new Map<string, AiProvider>();
  private circuitBreakers = new Map<string, CircuitBreakerState>();
  private repo: AiProviderConfigRepository;

  private readonly FAILURE_THRESHOLD = 5;
  private readonly COOL_OFF_MS = 60_000;

  constructor(database: DatabaseClient) {
    this.database = database;
    this.repo = new AiProviderConfigRepository(database);

    // Register primary providers
    const mock = new MockAiProvider();
    const openai = new OpenAiProvider();

    this.providers.set(mock.id, mock);
    this.providers.set(openai.id, openai);
  }

  static getInstance(database: DatabaseClient): UnifiedAiProviderGateway {
    if (!UnifiedAiProviderGateway.instance || UnifiedAiProviderGateway.instance.database !== database) {
      UnifiedAiProviderGateway.instance = new UnifiedAiProviderGateway(database);
    }
    return UnifiedAiProviderGateway.instance;
  }

  static resetInstance(): void {
    UnifiedAiProviderGateway.instance = null;
  }

  getProvider(providerId: string): AiProvider | null {
    return this.providers.get(providerId) ?? null;
  }

  // ==========================================
  // CONFIGURATION & CREDENTIAL MANAGEMENT
  // ==========================================

  async getTenantConfig(organizationId: string, providerId: string) {
    const config = await this.repo.getTenantConfig(organizationId, providerId);
    if (!config) {
      return {
        id: "",
        organizationId,
        providerId,
        liveModeEnabled: false,
        environmentMode: "mock" as const,
        apiKeyMasked: null,
        defaultModel: providerId === "openai" ? "gpt-4o-mini" : "mock-gpt-4o",
        allowedModels: providerId === "openai" ? ["gpt-4o-mini", "gpt-4o"] : ["mock-gpt-4o"],
        embeddingModel: "text-embedding-3-small",
        embeddingLiveEnabled: false,
        status: "inactive" as const,
        statusMessage: "Provider configuration not initialized.",
        lastHealthCheckAt: null,
        updatedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    return config;
  }

  async listTenantConfigs(organizationId: string) {
    const configs = await this.repo.listTenantConfigs(organizationId);
    // Ensure both mock and openai are represented
    const providerIds = new Set(configs.map((c) => c.providerId));
    if (!providerIds.has("openai")) {
      configs.push({
        id: "",
        organizationId,
        providerId: "openai",
        liveModeEnabled: false,
        environmentMode: "mock",
        apiKeyMasked: null,
        defaultModel: "gpt-4o-mini",
        allowedModels: ["gpt-4o-mini", "gpt-4o"],
        embeddingModel: "text-embedding-3-small",
        embeddingLiveEnabled: false,
        status: "inactive",
        statusMessage: "OpenAI live mode disabled.",
        lastHealthCheckAt: null,
        updatedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    if (!providerIds.has("mock")) {
      configs.push({
        id: "",
        organizationId,
        providerId: "mock",
        liveModeEnabled: false,
        environmentMode: "mock",
        apiKeyMasked: null,
        defaultModel: "mock-gpt-4o",
        allowedModels: ["mock-gpt-4o", "mock-claude-3-5-sonnet", "mock-gemini-1-5-pro"],
        embeddingModel: "mock-text-embedding",
        embeddingLiveEnabled: false,
        status: "active",
        statusMessage: "Mock provider active.",
        lastHealthCheckAt: new Date(),
        updatedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    return configs;
  }

  async updateTenantConfig(
    organizationId: string,
    input: UpdateTenantConfigInput,
    userId: string,
    ipAddress?: string,
  ) {
    // 1. Sanitize & validate
    if (input.apiKey && input.apiKey.trim().length > 0) {
      if (input.providerId === "openai" && !input.apiKey.startsWith("sk-")) {
        throw new AiProviderError("Invalid OpenAI API key format. Key must start with 'sk-'.", {
          code: "INVALID_REQUEST",
          provider: input.providerId,
          retryable: false,
          statusCode: 400,
        });
      }
    }

    // 2. Persist safely in repository
    await this.repo.upsertTenantConfig(organizationId, input, userId, ipAddress);

    // 3. Perform zero-cost validation probe if credentials provided
    if (input.apiKey) {
      await this.probeProvider(organizationId, input.providerId);
    }

    return this.getTenantConfig(organizationId, input.providerId);
  }

  /**
   * Probes provider connectivity without making paid inference calls.
   */
  async probeProvider(organizationId: string, providerId: string) {
    const rawKey = await this.repo.getRawApiKey(organizationId, providerId);
    const provider = this.getProvider(providerId);

    if (!provider) {
      return { status: "error", message: `Provider '${providerId}' not found.` };
    }

    if (provider instanceof OpenAiProvider) {
      // Temporarily inject key for probe
      const previousKey = provider.getApiKey();
      try {
        if (rawKey) {
          provider.setApiKey(rawKey);
        }
        const check = provider.healthCheck ? await provider.healthCheck() : { status: "healthy" as const };
        const mappedStatus = check.status === "healthy" ? "active" : check.status;
        await this.repo.updateHealthCheckStatus(
          organizationId,
          providerId,
          mappedStatus,
          check.message,
        );
        return check;
      } finally {
        provider.setApiKey(previousKey);
      }
    }

    if (provider.healthCheck) {
      const check = await provider.healthCheck();
      const mappedStatus = check.status === "healthy" ? "active" : check.status;
      await this.repo.updateHealthCheckStatus(
        organizationId,
        providerId,
        mappedStatus,
        check.message,
      );
      return check;
    }

    return { status: "healthy", message: "Provider operational." };
  }

  // ==========================================
  // MODEL CAPABILITIES & DISCOVERY
  // ==========================================

  async listAvailableModels(organizationId: string, providerId?: string): Promise<ModelMetadata[]> {
    const targetProviderId = providerId || "openai";
    const tenantConfig = await this.getTenantConfig(organizationId, targetProviderId);
    const provider = this.getProvider(targetProviderId);

    if (!provider) return [];

    const allModels = await provider.listModels();

    // Check pricing overrides in catalog
    const enriched: ModelMetadata[] = [];
    for (const m of allModels) {
      // Filter by tenant allowed models if configured
      if (tenantConfig.allowedModels.length > 0 && !tenantConfig.allowedModels.includes(m.id)) {
        continue;
      }

      const pricingOverride = await this.repo.getModelPricing(targetProviderId, m.id);
      if (pricingOverride) {
        enriched.push({
          ...m,
          contextWindow: pricingOverride.contextWindow,
          maxOutputTokens: pricingOverride.maxOutputTokens,
          pricing: {
            promptPerThousandTokensUsd: Number(pricingOverride.promptPerThousandTokensUsd),
            completionPerThousandTokensUsd: Number(pricingOverride.completionPerThousandTokensUsd),
            embeddingPerThousandTokensUsd: Number(pricingOverride.embeddingPerThousandTokensUsd),
          },
        });
      } else {
        enriched.push(m);
      }
    }

    return enriched;
  }

  // ==========================================
  // CIRCUIT BREAKER & BUDGET ENFORCEMENT
  // ==========================================

  private checkCircuitBreaker(providerId: string): void {
    const state = this.circuitBreakers.get(providerId);
    if (!state || !state.isOpen) return;

    const elapsed = Date.now() - state.lastFailureAt;
    if (elapsed > this.COOL_OFF_MS) {
      // Half-open: attempt recovery
      state.isOpen = false;
      state.failures = 0;
      return;
    }

    throw new AiProviderError(
      `Circuit breaker open for provider '${providerId}'. Upstream calls paused for ${Math.round((this.COOL_OFF_MS - elapsed) / 1000)}s to prevent cascading failures.`,
      {
        code: "CIRCUIT_BREAKER_OPEN",
        provider: providerId,
        retryable: true,
        statusCode: 503,
      },
    );
  }

  private recordSuccess(providerId: string): void {
    const state = this.circuitBreakers.get(providerId);
    if (state) {
      state.failures = 0;
      state.isOpen = false;
    }
  }

  private recordFailure(providerId: string, error: unknown): void {
    let state = this.circuitBreakers.get(providerId);
    if (!state) {
      state = { failures: 0, lastFailureAt: 0, isOpen: false };
      this.circuitBreakers.set(providerId, state);
    }

    const is5xx =
      error instanceof AiProviderError &&
      (error.statusCode === undefined || error.statusCode >= 500);

    if (is5xx) {
      state.failures += 1;
      state.lastFailureAt = Date.now();
      if (state.failures >= this.FAILURE_THRESHOLD) {
        state.isOpen = true;
      }
    }
  }

  async checkBudget(organizationId: string, workspaceId?: string): Promise<void> {
    const budget = await this.repo.getBudget(organizationId, workspaceId);
    if (!budget.enforceHardLimit) return;

    const currentDaySpend = Number(budget.currentDaySpendUsd);
    const dailyLimit = Number(budget.dailyBudgetUsd);
    const currentMonthSpend = Number(budget.currentMonthSpendUsd);
    const monthlyLimit = Number(budget.monthlyBudgetUsd);

    if (currentDaySpend >= dailyLimit) {
      throw new AiProviderError(
        `Daily AI budget limit of $${dailyLimit.toFixed(2)} USD exceeded ($${currentDaySpend.toFixed(2)} USD spent). Execution halted.`,
        {
          code: "BUDGET_EXCEEDED",
          provider: "gateway",
          retryable: false,
          statusCode: 429,
          details: { currentDaySpend, dailyLimit },
        },
      );
    }

    if (currentMonthSpend >= monthlyLimit) {
      throw new AiProviderError(
        `Monthly AI budget limit of $${monthlyLimit.toFixed(2)} USD exceeded ($${currentMonthSpend.toFixed(2)} USD spent). Execution halted.`,
        {
          code: "BUDGET_EXCEEDED",
          provider: "gateway",
          retryable: false,
          statusCode: 429,
          details: { currentMonthSpend, monthlyLimit },
        },
      );
    }
  }

  // ==========================================
  // INFERENCE EXECUTION
  // ==========================================

  async invoke(
    organizationId: string,
    request: ModelInvocationRequest,
    context?: { workspaceId?: string; agentId?: string; runId?: string },
  ): Promise<ModelInvocationResponse> {
    const correlationId = (request.metadata?.requestId as string) || randomUUID();

    // 1. Resolve tenant configuration
    const requestedProviderId = (request.metadata?.providerId as string) || "openai";
    const tenantConfig = await this.getTenantConfig(organizationId, requestedProviderId);

    // 2. Enforce mode & model allowlist
    let targetProviderId = requestedProviderId;
    let targetModel = request.model;
    let isLiveMode = false;

    if (!tenantConfig.liveModeEnabled || tenantConfig.environmentMode === "mock") {
      // Live mode is disabled by default: force deterministic mock provider
      targetProviderId = "mock";
      targetModel = request.model.startsWith("mock-") ? request.model : "mock-gpt-4o";
      isLiveMode = false;
    } else {
      isLiveMode = true;
      // Verify model permission in tenant allowlist
      if (
        tenantConfig.allowedModels.length > 0 &&
        !tenantConfig.allowedModels.includes(request.model)
      ) {
        throw new AiProviderError(
          `Model '${request.model}' is not in tenant's allowed models list: [${tenantConfig.allowedModels.join(", ")}].`,
          {
            code: "MODEL_FORBIDDEN",
            provider: targetProviderId,
            retryable: false,
            statusCode: 403,
          },
        );
      }
    }

    // 3. Enforce budget limits (fail-closed)
    if (isLiveMode) {
      await this.checkBudget(organizationId, context?.workspaceId);
      this.checkCircuitBreaker(targetProviderId);
    }

    // 4. Resolve provider instance
    const provider = this.getProvider(targetProviderId);
    if (!provider) {
      throw new AiProviderError(`Provider '${targetProviderId}' is not registered.`, {
        code: "PROVIDER_ERROR",
        provider: targetProviderId,
        retryable: false,
        statusCode: 500,
      });
    }

    // 5. Inject tenant credentials if live mode
    let previousKey: string | null = null;
    if (isLiveMode && provider instanceof OpenAiProvider) {
      const rawKey = await this.repo.getRawApiKey(organizationId, targetProviderId);
      if (!rawKey) {
        throw new AiProviderError(
          `Tenant '${organizationId}' has enabled live mode for '${targetProviderId}' but no API key is configured.`,
          {
            code: "AUTHENTICATION_FAILED",
            provider: targetProviderId,
            retryable: false,
            statusCode: 401,
          },
        );
      }
      previousKey = provider.getApiKey();
      provider.setApiKey(rawKey);
    }

    try {
      const response = await provider.invoke({
        ...request,
        model: targetModel,
        metadata: {
          ...request.metadata,
          organizationId,
          workspaceId: context?.workspaceId,
          correlationId,
        },
      });

      this.recordSuccess(targetProviderId);

      // Record in usage ledger
      await this.repo.insertLedgerEntry({
        organizationId,
        workspaceId: context?.workspaceId,
        agentId: context?.agentId,
        runId: context?.runId,
        providerId: targetProviderId,
        modelId: targetModel,
        operationType: "chat_completion",
        promptTokens: response.usage.promptTokens,
        completionTokens: response.usage.completionTokens,
        totalTokens: response.usage.totalTokens,
        estimatedCostUsd: response.usage.estimatedCostUsd ?? 0,
        latencyMs: response.latencyMs,
        finishReason: response.finishReason,
        isLiveMode,
        correlationId,
      });

      return response;
    } catch (err: unknown) {
      this.recordFailure(targetProviderId, err);
      throw err;
    } finally {
      if (previousKey !== null && provider instanceof OpenAiProvider) {
        provider.setApiKey(previousKey);
      }
    }
  }

  async stream(
    organizationId: string,
    request: ModelInvocationRequest,
    streamingOptions: StreamingOptions,
    context?: { workspaceId?: string; agentId?: string; runId?: string },
  ): Promise<ModelInvocationResponse> {
    const correlationId = (request.metadata?.requestId as string) || randomUUID();
    const requestedProviderId = (request.metadata?.providerId as string) || "openai";
    const tenantConfig = await this.getTenantConfig(organizationId, requestedProviderId);

    let targetProviderId = requestedProviderId;
    let targetModel = request.model;
    let isLiveMode = false;

    if (!tenantConfig.liveModeEnabled || tenantConfig.environmentMode === "mock") {
      targetProviderId = "mock";
      targetModel = request.model.startsWith("mock-") ? request.model : "mock-gpt-4o";
      isLiveMode = false;
    } else {
      isLiveMode = true;
      if (
        tenantConfig.allowedModels.length > 0 &&
        !tenantConfig.allowedModels.includes(request.model)
      ) {
        throw new AiProviderError(
          `Model '${request.model}' is not in tenant allowed models.`,
          {
            code: "MODEL_FORBIDDEN",
            provider: targetProviderId,
            retryable: false,
            statusCode: 403,
          },
        );
      }
      await this.checkBudget(organizationId, context?.workspaceId);
      this.checkCircuitBreaker(targetProviderId);
    }

    const provider = this.getProvider(targetProviderId);
    if (!provider) {
      throw new AiProviderError(`Provider '${targetProviderId}' not found.`, {
        code: "PROVIDER_ERROR",
        provider: targetProviderId,
        retryable: false,
      });
    }

    if (!provider.stream) {
      // Fallback to invoke if streaming not supported by provider
      const res = await this.invoke(organizationId, request, context);
      await streamingOptions.onChunk({
        id: res.id,
        model: res.model,
        delta: res.content,
        finishReason: res.finishReason,
        usage: res.usage,
      });
      return res;
    }

    let previousKey: string | null = null;
    if (isLiveMode && provider instanceof OpenAiProvider) {
      const rawKey = await this.repo.getRawApiKey(organizationId, targetProviderId);
      if (!rawKey) {
        throw new AiProviderError("API key not configured for live streaming.", {
          code: "AUTHENTICATION_FAILED",
          provider: targetProviderId,
          retryable: false,
          statusCode: 401,
        });
      }
      previousKey = provider.getApiKey();
      provider.setApiKey(rawKey);
    }

    try {
      const response = await provider.stream(
        {
          ...request,
          model: targetModel,
          metadata: { ...request.metadata, organizationId, correlationId },
        },
        streamingOptions,
      );

      this.recordSuccess(targetProviderId);

      await this.repo.insertLedgerEntry({
        organizationId,
        workspaceId: context?.workspaceId,
        agentId: context?.agentId,
        runId: context?.runId,
        providerId: targetProviderId,
        modelId: targetModel,
        operationType: "streaming_completion",
        promptTokens: response.usage.promptTokens,
        completionTokens: response.usage.completionTokens,
        totalTokens: response.usage.totalTokens,
        estimatedCostUsd: response.usage.estimatedCostUsd ?? 0,
        latencyMs: response.latencyMs,
        finishReason: response.finishReason,
        isLiveMode,
        correlationId,
      });

      return response;
    } catch (err: unknown) {
      this.recordFailure(targetProviderId, err);
      throw err;
    } finally {
      if (previousKey !== null && provider instanceof OpenAiProvider) {
        provider.setApiKey(previousKey);
      }
    }
  }

  // ==========================================
  // BUDGET & USAGE MANAGEMENT
  // ==========================================

  async getBudget(organizationId: string, workspaceId?: string) {
    return this.repo.getBudget(organizationId, workspaceId);
  }

  async updateBudget(
    organizationId: string,
    input: UpdateBudgetInput,
    userId: string,
    workspaceId?: string,
  ) {
    return this.repo.updateBudget(organizationId, input, userId, workspaceId);
  }

  async getUsageMetrics(organizationId: string, limit = 50) {
    return this.repo.getUsageMetrics(organizationId, limit);
  }
}
