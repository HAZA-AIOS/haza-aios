import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { AiProviderRegistry } from "../src/modules/agents/providers/provider-registry.js";
import { MockAiProvider } from "../src/modules/agents/providers/mock-ai-provider.js";
import { OpenAiProvider } from "../src/modules/agents/providers/openai-provider.js";
import { UnifiedAiProviderGateway } from "../src/modules/agents/providers/ai-provider-gateway.js";
import { redactSecrets, maskApiKey, redactObject } from "../src/modules/agents/utils/secret-redactor.js";
import { AiProviderError } from "../src/modules/agents/providers/ai-provider.types.js";
import { HybridSearchService } from "../src/modules/agents/services/hybrid-search.service.js";
import { MockEmbeddingProvider } from "../src/modules/agents/embeddings/mock-embedding-provider.js";
import { EmbeddingProviderRegistry } from "../src/modules/agents/embeddings/embedding-provider.registry.js";
import type { DatabaseClient } from "../src/database/client.js";

describe("Epic 18: Live AI Provider Integration & Gateway Tests", () => {
  const TENANT_A = "00000000-0000-4801-a000-000000000001";
  const TENANT_B = "00000000-0000-4801-b000-000000000002";
  const USER_ID = "00000000-0000-4801-u000-000000000001";

  // In-memory data store for testing gateway repositories
  let configsStore: Map<string, any>;
  let budgetsStore: Map<string, any>;
  let ledgerStore: any[];
  let auditLogsStore: any[];
  let pricingStore: Map<string, any>;

  let mockDb: DatabaseClient;
  let gateway: UnifiedAiProviderGateway;

  beforeEach(() => {
    configsStore = new Map();
    budgetsStore = new Map();
    ledgerStore = [];
    auditLogsStore = [];
    pricingStore = new Map();

    // Mock Database Client with in-memory Drizzle-like chained queries
    mockDb = {
      db: {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => [],
            }),
            orderBy: () => ({
              limit: () => [],
            }),
          }),
        }),
        insert: () => ({
          values: () => Promise.resolve(),
        }),
        update: () => ({
          set: () => ({
            where: () => Promise.resolve(),
          }),
        }),
        delete: () => ({
          where: () => Promise.resolve(),
        }),
      },
    } as unknown as DatabaseClient;

    gateway = UnifiedAiProviderGateway.getInstance(mockDb);

    // Wire in-memory mock repository backing to gateway
    const repo = (gateway as any).repo;
    repo.getTenantConfig = async (orgId: string, providerId: string) => {
      const key = `${orgId}:${providerId}`;
      const config = configsStore.get(key);
      if (!config) return null;
      const { apiKeyEncrypted, ...safeConfig } = config;
      return safeConfig;
    };
    repo.listTenantConfigs = async (orgId: string) => {
      const results: any[] = [];
      for (const [k, v] of configsStore.entries()) {
        if (k.startsWith(`${orgId}:`)) {
          const { apiKeyEncrypted, ...safe } = v;
          results.push(safe);
        }
      }
      return results;
    };
    repo.upsertTenantConfig = async (orgId: string, input: any, userId: string) => {
      const key = `${orgId}:${input.providerId}`;
      const existing = configsStore.get(key) || {
        organizationId: orgId,
        providerId: input.providerId,
        liveModeEnabled: false,
        environmentMode: "mock",
        apiKeyMasked: null,
        apiKeyEncrypted: null,
        defaultModel: "gpt-4o-mini",
        allowedModels: ["gpt-4o-mini", "gpt-4o"],
        embeddingModel: "text-embedding-3-small",
        embeddingLiveEnabled: false,
        status: "inactive",
      };

      const { apiKey, ...cleanInput } = input;
      const updated = {
        ...existing,
        ...cleanInput,
        apiKeyMasked: apiKey ? maskApiKey(apiKey) : existing.apiKeyMasked,
        apiKeyEncrypted: apiKey ? Buffer.from(apiKey).toString("base64") : existing.apiKeyEncrypted,
        updatedAt: new Date(),
      };
      configsStore.set(key, updated);
      auditLogsStore.push({ organizationId: orgId, action: "config_updated", userId });
      const { apiKeyEncrypted, ...safeUpdated } = updated;
      return safeUpdated;
    };
    repo.getRawApiKey = async (orgId: string, providerId: string) => {
      const key = `${orgId}:${providerId}`;
      const config = configsStore.get(key);
      if (!config || !config.apiKeyEncrypted) return null;
      return Buffer.from(config.apiKeyEncrypted, "base64").toString("utf8");
    };
    repo.getBudget = async (orgId: string) => {
      return (
        budgetsStore.get(orgId) || {
          organizationId: orgId,
          dailyBudgetUsd: "50.00",
          monthlyBudgetUsd: "500.00",
          currentDaySpendUsd: "0.00",
          currentMonthSpendUsd: "0.00",
          enforceHardLimit: true,
          notifyThresholdPercent: 80,
        }
      );
    };
    repo.upsertBudget = async (orgId: string, input: any) => {
      const existing = await repo.getBudget(orgId);
      const updated = { ...existing, ...input };
      budgetsStore.set(orgId, updated);
      return updated;
    };
    repo.insertLedgerEntry = async (entry: any) => {
      ledgerStore.push({ ...entry, id: `ledger-${Date.now()}` });
    };
    repo.getModelPricing = async (providerId: string, modelId: string) => {
      return pricingStore.get(`${providerId}:${modelId}`) || null;
    };
  });

  afterEach(() => {
    UnifiedAiProviderGateway.resetInstance();
  });

  // =========================================================================
  // 1. PROVIDER REGISTRATION & MODEL CAPABILITIES
  // =========================================================================
  describe("1. Provider Registry & Capabilities Discovery", () => {
    it("registers default providers and discovers model metadata", async () => {
      const registry = AiProviderRegistry.getInstance();
      const mockProvider = registry.get("mock");
      const openaiProvider = registry.get("openai");

      expect(mockProvider).toBeDefined();
      expect(openaiProvider).toBeDefined();
      expect(mockProvider?.name).toContain("Mock");
      expect(openaiProvider?.name).toContain("OpenAI");

      const mockModels = await mockProvider!.listModels();
      expect(mockModels.length).toBeGreaterThan(0);
      expect(mockModels.some((m) => m.id === "mock-gpt-4o")).toBe(true);

      const openaiModels = await openaiProvider!.listModels();
      expect(openaiModels.some((m) => m.id === "gpt-4o-mini")).toBe(true);
      expect(openaiModels.some((m) => m.id === "gpt-4o")).toBe(true);
    });

    it("applies model pricing catalog overrides when available", async () => {
      pricingStore.set("openai:gpt-4o", {
        contextWindow: 128000,
        maxOutputTokens: 16384,
        promptPerThousandTokensUsd: "0.002",
        completionPerThousandTokensUsd: "0.008",
        embeddingPerThousandTokensUsd: "0.000",
      });

      const models = await gateway.listAvailableModels(TENANT_A, "openai");
      const gpt4o = models.find((m) => m.id === "gpt-4o");
      expect(gpt4o).toBeDefined();
      expect(gpt4o?.pricing?.promptPerThousandTokensUsd).toBe(0.002);
      expect(gpt4o?.pricing?.completionPerThousandTokensUsd).toBe(0.008);
    });
  });

  // =========================================================================
  // 2. SECRET REDACTION & CREDENTIAL PROTECTION
  // =========================================================================
  describe("2. Secret Redaction & Zero-Raw-Key Exposure", () => {
    it("masks API keys properly retaining only standard safe prefix and suffix", () => {
      const rawKey = "sk-proj-1234567890abcdef1234567890abcdef12";
      const masked = maskApiKey(rawKey);

      expect(masked).toContain("sk-");
      expect(masked).toContain("...ef12");
      expect(masked).not.toContain("1234567890abcdef1234");
    });

    it("redacts raw API keys from free text, error messages, and URLs", () => {
      const rawKey = "sk-abc1234567890abcdef1234567890";
      const errorMsg = `HTTP 401 Unauthorized for Authorization: Bearer ${rawKey} at https://api.openai.com/v1/chat/completions?key=${rawKey}`;
      const redacted = redactSecrets(errorMsg);

      expect(redacted).not.toContain(rawKey);
      expect(redacted).toContain("[REDACTED_API_KEY]");
    });

    it("deeply redacts sensitive keys from JSON objects", () => {
      const obj = {
        agentId: "agent-1",
        credentials: {
          apiKey: "sk-live-secret-key-12345",
          password: "my-secret-password",
        },
        metadata: {
          token: "secret-token-xyz",
          normalField: "public-value",
        },
      };

      const sanitized = redactObject(obj);
      expect(sanitized.credentials.apiKey).toContain("sk-");
      expect(sanitized.credentials.apiKey).not.toContain("12345");
      expect(sanitized.credentials.password).toBe("[REDACTED]");
      expect(sanitized.metadata.token).toContain("sec...");
      expect(sanitized.metadata.token).not.toContain("secret-token-xyz");
      expect(sanitized.metadata.normalField).toBe("public-value");
    });

    it("never returns raw API key in tenant config queries", async () => {
      await gateway.updateTenantConfig(
        TENANT_A,
        {
          providerId: "openai",
          apiKey: "sk-proj-test1234567890abcdefghij",
          liveModeEnabled: false,
        },
        USER_ID,
      );

      const config = await gateway.getTenantConfig(TENANT_A, "openai");
      expect((config as any).apiKey).toBeUndefined();
      expect((config as any).apiKeyEncrypted).toBeUndefined();
      expect(config.apiKeyMasked).toBeDefined();
      expect(config.apiKeyMasked).toContain("sk-");
      expect(config.apiKeyMasked).not.toContain("test1234567890");
    });
  });

  // =========================================================================
  // 3. LIVE MODE POLICY & DEFAULT MOCK ROUTING
  // =========================================================================
  describe("3. Live Mode Default Disabled & Safe Mock Routing", () => {
    it("routes to deterministic Mock provider when live mode is disabled", async () => {
      const response = await gateway.invoke(TENANT_A, {
        model: "gpt-4o",
        messages: [{ role: "user", content: "Create a 5-step lesson plan on photosynthesis." }],
        metadata: { providerId: "openai" },
      });

      expect(response).toBeDefined();
      expect(response.provider).toBe("mock");
      expect(response.model).toBe("mock-gpt-4o");
      expect(response.content.length).toBeGreaterThan(0);
    });

    it("embedding provider registry uses mock embeddings when live mode is disabled", async () => {
      const registry = EmbeddingProviderRegistry.getInstance();
      const { provider } = await registry.getActiveProvider({ allowLive: false });

      expect(provider.id).toBe("mock");
      expect(provider.isMock).toBe(true);
    });
  });

  // =========================================================================
  // 4. MODEL ALLOWLIST ENFORCEMENT
  // =========================================================================
  describe("4. Model Allowlist Enforcement", () => {
    it("rejects unapproved models when live mode is active (fail-closed 403)", async () => {
      // Enable live mode with limited allowlist
      await gateway.updateTenantConfig(
        TENANT_A,
        {
          providerId: "openai",
          apiKey: "sk-valid-key-for-tenant-a-12345",
          liveModeEnabled: true,
          environmentMode: "production",
          allowedModels: ["gpt-4o-mini"],
        },
        USER_ID,
      );

      // Attempt to invoke model not in allowlist
      await expect(
        gateway.invoke(TENANT_A, {
          model: "gpt-4o-unapproved-model",
          messages: [{ role: "user", content: "Hello" }],
          metadata: { providerId: "openai" },
        }),
      ).rejects.toThrowError(/not in tenant's allowed models list/);
    });
  });

  // =========================================================================
  // 5. STREAMING & ABORT SIGNAL CANCELLATION
  // =========================================================================
  describe("5. Streaming & Abort Signal Cancellation", () => {
    it("streams chunks smoothly from provider with finish chunk", async () => {
      const provider = new MockAiProvider();
      const chunks: string[] = [];

      const fullResponse = await provider.stream(
        {
          model: "mock-gpt-4o",
          messages: [{ role: "user", content: "Tell me a short science fact." }],
        },
        {
          onChunk: (chunk) => {
            if (chunk.delta) chunks.push(chunk.delta);
          },
        },
      );

      expect(fullResponse).toBeDefined();
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join("").length).toBeGreaterThan(0);
    });

    it("aborts streaming cleanly when AbortSignal triggers", async () => {
      const provider = new MockAiProvider();
      const controller = new AbortController();

      controller.abort(); // Pre-aborted signal

      await expect(async () => {
        await provider.stream(
          {
            model: "mock-gpt-4o",
            messages: [{ role: "user", content: "Generate lengthy response." }],
          },
          {
            signal: controller.signal,
            onChunk: () => {},
          },
        );
      }).rejects.toThrowError(/aborted/);
    });
  });

  // =========================================================================
  // 6. FAIL-CLOSED BUDGET ENFORCEMENT
  // =========================================================================
  describe("6. Fail-Closed Budget Enforcement", () => {
    it("halts execution immediately when daily budget is exhausted (HTTP 429)", async () => {
      await gateway.updateTenantConfig(
        TENANT_A,
        {
          providerId: "openai",
          apiKey: "sk-valid-key-budget-test",
          liveModeEnabled: true,
          environmentMode: "production",
          allowedModels: ["gpt-4o-mini"],
        },
        USER_ID,
      );

      // Set spend equal to daily budget
      budgetsStore.set(TENANT_A, {
        organizationId: TENANT_A,
        dailyBudgetUsd: "10.00",
        monthlyBudgetUsd: "100.00",
        currentDaySpendUsd: "10.05",
        currentMonthSpendUsd: "10.05",
        enforceHardLimit: true,
      });

      await expect(
        gateway.invoke(TENANT_A, {
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: "Run analysis" }],
          metadata: { providerId: "openai" },
        }),
      ).rejects.toThrowError(/Daily AI budget limit of \$10.00 USD exceeded/);
    });

    it("halts execution immediately when monthly budget is exhausted (HTTP 429)", async () => {
      await gateway.updateTenantConfig(
        TENANT_A,
        {
          providerId: "openai",
          apiKey: "sk-valid-key-budget-test-month",
          liveModeEnabled: true,
          environmentMode: "production",
          allowedModels: ["gpt-4o-mini"],
        },
        USER_ID,
      );

      budgetsStore.set(TENANT_A, {
        organizationId: TENANT_A,
        dailyBudgetUsd: "50.00",
        monthlyBudgetUsd: "100.00",
        currentDaySpendUsd: "5.00",
        currentMonthSpendUsd: "100.50",
        enforceHardLimit: true,
      });

      await expect(
        gateway.invoke(TENANT_A, {
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: "Run analysis" }],
          metadata: { providerId: "openai" },
        }),
      ).rejects.toThrowError(/Monthly AI budget limit of \$100.00 USD exceeded/);
    });
  });

  // =========================================================================
  // 7. CIRCUIT BREAKER RESILIENCE
  // =========================================================================
  describe("7. Circuit Breaker Behavior", () => {
    it("trips circuit breaker after 5 consecutive failures and fails fast with 503", async () => {
      const breakerState = (gateway as any).circuitBreakers;
      const providerId = "test-unstable-provider";

      // Register temporary unstable provider
      (gateway as any).providers.set(providerId, {
        id: providerId,
        name: "Unstable Provider",
        version: "1.0.0",
        invoke: async () => {
          throw new AiProviderError("Provider 500 error", {
            code: "PROVIDER_ERROR",
            provider: providerId,
            retryable: true,
            statusCode: 500,
          });
        },
        listModels: async () => [],
      });

      // Simulate 5 failures with 500 status code
      for (let i = 0; i < 5; i++) {
        (gateway as any).recordFailure(
          providerId,
          new AiProviderError("Provider 500 error", {
            code: "PROVIDER_ERROR",
            provider: providerId,
            retryable: true,
            statusCode: 500,
          }),
        );
      }

      const state = breakerState.get(providerId);
      expect(state.isOpen).toBe(true);
      expect(state.failures).toBe(5);

      // Next check must throw CIRCUIT_BREAKER_OPEN
      expect(() => (gateway as any).checkCircuitBreaker(providerId)).toThrowError(
        /Circuit breaker open for provider 'test-unstable-provider'/i,
      );
    });
  });

  // =========================================================================
  // 8. USAGE TELEMETRY & LEDGER RECORDING
  // =========================================================================
  describe("8. Usage Telemetry & Ledger Recording", () => {
    it("records token usage, duration, and estimated cost in usage ledger", async () => {
      const response = await gateway.invoke(
        TENANT_A,
        {
          model: "mock-gpt-4o",
          messages: [{ role: "user", content: "Short query" }],
        },
        {
          workspaceId: "ws-1",
          agentId: "agent-planner",
          runId: "run-xyz",
        },
      );

      expect(response).toBeDefined();
      expect(ledgerStore.length).toBeGreaterThan(0);

      const entry = ledgerStore[ledgerStore.length - 1];
      expect(entry.organizationId).toBe(TENANT_A);
      expect(entry.workspaceId).toBe("ws-1");
      expect(entry.agentId).toBe("agent-planner");
      expect(entry.runId).toBe("run-xyz");
      expect(entry.promptTokens).toBeGreaterThan(0);
      expect(entry.completionTokens).toBeGreaterThan(0);
      expect(entry.totalTokens).toBe(entry.promptTokens + entry.completionTokens);
      expect(entry.estimatedCostUsd).toBeDefined();
    });
  });

  // =========================================================================
  // 9. VECTOR DIMENSION MISMATCH REJECTION
  // =========================================================================
  describe("9. Vector Dimension Mismatch Rejection in Hybrid Search", () => {
    it("never compares query vectors against mismatching stored vector dimensions", async () => {
      const candidateRows = [
        {
          chunkId: "chunk-live-1536",
          sourceId: "src-1",
          documentTitle: "Advanced Biology",
          content: "Advanced biology genetics content",
          sectionHeading: "Genetics",
          pageNumber: 1,
        },
        {
          chunkId: "chunk-mock-64",
          sourceId: "src-2",
          documentTitle: "Elementary Science",
          content: "Elementary science content",
          sectionHeading: "Introduction",
          pageNumber: 1,
        },
      ];

      const embeddingRows = [
        {
          chunkId: "chunk-live-1536",
          embedding: Array(1536).fill(0.1),
          provider: "openai",
          model: "text-embedding-3-small",
          dimensions: 1536,
        },
        {
          chunkId: "chunk-mock-64",
          embedding: Array(64).fill(0.2),
          provider: "mock",
          model: "mock-text-embedding",
          dimensions: 64,
        },
      ];

      const mockDbClient: any = {
        db: {
          select: () => ({
            from: (table: any) => ({
              innerJoin: () => ({
                where: () => ({
                  limit: () => candidateRows,
                }),
              }),
              where: () => embeddingRows,
            }),
          }),
        },
      };

      const embeddingProvider = new MockEmbeddingProvider(64);
      const searchService = new HybridSearchService(mockDbClient, embeddingProvider);

      const { results } = await searchService.search(TENANT_A, {
        query: "genetics and cells",
        limit: 5,
      });

      // Query vector was 64-dim, so chunk with 1536-dim must be filtered out or ignored for vector score!
      const liveChunkResult = results.find((r) => r.chunkId === "chunk-live-1536");
      if (liveChunkResult) {
        expect(liveChunkResult.vectorScore ?? 0).toBe(0);
      }
    });
  });

  // =========================================================================
  // 10. MULTI-TENANT ISOLATION
  // =========================================================================
  describe("10. Multi-Tenant Isolation", () => {
    it("isolates tenant configs, budgets, and credentials across organizations", async () => {
      // Configure Tenant A
      await gateway.updateTenantConfig(
        TENANT_A,
        {
          providerId: "openai",
          apiKey: "sk-tenant-a-key-1234567890",
          liveModeEnabled: true,
          allowedModels: ["gpt-4o-mini"],
        },
        USER_ID,
      );

      // Configure Tenant B
      await gateway.updateTenantConfig(
        TENANT_B,
        {
          providerId: "openai",
          apiKey: "sk-tenant-b-key-0987654321",
          liveModeEnabled: false,
          allowedModels: ["gpt-4o"],
        },
        USER_ID,
      );

      const configA = await gateway.getTenantConfig(TENANT_A, "openai");
      const configB = await gateway.getTenantConfig(TENANT_B, "openai");

      expect(configA.liveModeEnabled).toBe(true);
      expect(configB.liveModeEnabled).toBe(false);
      expect(configA.allowedModels).toContain("gpt-4o-mini");
      expect(configB.allowedModels).toContain("gpt-4o");

      // Verify raw key isolation
      const keyA = await (gateway as any).repo.getRawApiKey(TENANT_A, "openai");
      const keyB = await (gateway as any).repo.getRawApiKey(TENANT_B, "openai");
      expect(keyA).toBe("sk-tenant-a-key-1234567890");
      expect(keyB).toBe("sk-tenant-b-key-0987654321");
      expect(keyA).not.toBe(keyB);
    });
  });
});
