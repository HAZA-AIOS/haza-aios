import { describe, expect, it, beforeEach } from "vitest";
import {
  AiProviderError,
  MockAiProvider,
  AiProviderRegistry,
} from "../src/modules/agents/providers/index.js";

describe("AI Provider Abstraction - MockAiProvider", () => {
  let provider: MockAiProvider;

  beforeEach(() => {
    provider = new MockAiProvider();
  });

  it("registers default models with appropriate capabilities", async () => {
    const models = await provider.listModels();
    expect(models.length).toBeGreaterThanOrEqual(3);

    const gpt = models.find((m) => m.id === "mock-gpt-4o");
    expect(gpt).toBeDefined();
    expect(gpt?.capabilities).toContain("chat");
    expect(gpt?.capabilities).toContain("tools");
    expect(gpt?.contextWindow).toBe(128_000);

    const claude = await provider.getModel("mock-claude-3-5-sonnet");
    expect(claude).toBeDefined();
    expect(claude?.capabilities).toContain("vision");
  });

  it("validates configuration correctly", () => {
    const valid = provider.validateConfig({ apiKey: "mock-key", timeoutMs: 5000 });
    expect(valid.valid).toBe(true);

    const invalid = provider.validateConfig({ apiKey: 12345 as any, timeoutMs: -10 });
    expect(invalid.valid).toBe(false);
    expect(invalid.errors?.length).toBe(2);
  });

  it("invokes mock model and returns deterministic response and usage metadata", async () => {
    const response = await provider.invoke({
      model: "mock-gpt-4o",
      messages: [
        { role: "system", content: "You are a helpful educational tutor." },
        { role: "user", content: "Generate a quiz for 5th grade science." },
      ],
      temperature: 0.5,
    });

    expect(response.id).toMatch(/^mock-inv-/);
    expect(response.model).toBe("mock-gpt-4o");
    expect(response.provider).toBe("mock");
    expect(response.finishReason).toBe("stop");
    expect(response.content).toContain("Generate a quiz for 5th grade science.");
    expect(response.usage.promptTokens).toBeGreaterThan(0);
    expect(response.usage.completionTokens).toBeGreaterThan(0);
    expect(response.usage.totalTokens).toBe(
      response.usage.promptTokens + response.usage.completionTokens,
    );
    expect(response.usage.estimatedCostUsd).toBeDefined();
    expect(response.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("supports canned responses and tool call responses", async () => {
    provider.setCannedResponse("Custom educational curriculum output");
    const canned = await provider.invoke({
      model: "mock-gpt-4o",
      messages: [{ role: "user", content: "Hi" }],
    });
    expect(canned.content).toBe("Custom educational curriculum output");
    expect(canned.finishReason).toBe("stop");

    provider.setCannedToolCalls([
      {
        id: "call_1",
        name: "generate_worksheet",
        arguments: { subject: "Science", grade: 5 },
      },
    ]);
    const toolRes = await provider.invoke({
      model: "mock-gpt-4o",
      messages: [{ role: "user", content: "Run tool" }],
    });
    expect(toolRes.finishReason).toBe("tool_calls");
    expect(toolRes.toolCalls?.length).toBe(1);
    expect(toolRes.toolCalls?.[0].name).toBe("generate_worksheet");
  });

  it("throws MODEL_NOT_FOUND when requesting an unregistered model", async () => {
    await expect(
      provider.invoke({
        model: "non-existent-model",
        messages: [{ role: "user", content: "Test" }],
      }),
    ).rejects.toThrowError(AiProviderError);

    try {
      await provider.invoke({
        model: "non-existent-model",
        messages: [{ role: "user", content: "Test" }],
      });
    } catch (err: any) {
      expect(err.code).toBe("MODEL_NOT_FOUND");
      expect(err.statusCode).toBe(404);
    }
  });

  it("handles cancellation via AbortSignal", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      provider.invoke({
        model: "mock-gpt-4o",
        messages: [{ role: "user", content: "Test" }],
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({
      code: "CANCELLED",
      provider: "mock",
    });
  });

  it("handles timeout enforcement when simulated latency exceeds timeoutMs", async () => {
    provider.setSimulatedLatency(50);

    await expect(
      provider.invoke({
        model: "mock-gpt-4o",
        messages: [{ role: "user", content: "Test" }],
        timeoutMs: 10,
      }),
    ).rejects.toMatchObject({
      code: "TIMEOUT",
      provider: "mock",
      statusCode: 504,
      retryable: true,
    });
  });

  it("handles simulated provider error injection", async () => {
    provider.setSimulatedError(
      new AiProviderError("Rate limit exceeded on provider.", {
        code: "RATE_LIMITED",
        provider: "mock",
        statusCode: 429,
        retryable: true,
      }),
    );

    await expect(
      provider.invoke({
        model: "mock-gpt-4o",
        messages: [{ role: "user", content: "Test" }],
      }),
    ).rejects.toMatchObject({
      code: "RATE_LIMITED",
      statusCode: 429,
      retryable: true,
    });
  });
});

describe("AI Provider Abstraction - AiProviderRegistry", () => {
  beforeEach(() => {
    AiProviderRegistry.resetInstance();
  });

  it("maintains a singleton with MockAiProvider registered by default", async () => {
    const registry = AiProviderRegistry.getInstance();
    expect(registry.has("mock")).toBe(true);

    const defaultProvider = registry.getDefault();
    expect(defaultProvider.id).toBe("mock");

    const allModels = await registry.listAllModels();
    expect(allModels.length).toBeGreaterThanOrEqual(3);
  });

  it("supports registration and model catalog lookup across providers", async () => {
    const registry = AiProviderRegistry.getInstance();

    const customProvider = new MockAiProvider([
      {
        id: "custom-specialist-1",
        name: "Custom Specialist 1",
        provider: "custom",
        contextWindow: 64000,
        maxOutputTokens: 2048,
        capabilities: ["chat", "tools"],
      },
    ]);
    (customProvider as any).id = "custom";

    registry.register(customProvider);
    expect(registry.has("custom")).toBe(true);
    expect(registry.get("custom")).toBe(customProvider);

    const allModels = await registry.listAllModels();
    expect(allModels.some((m) => m.id === "custom-specialist-1")).toBe(true);

    registry.unregister("custom");
    expect(registry.has("custom")).toBe(false);
  });
});
