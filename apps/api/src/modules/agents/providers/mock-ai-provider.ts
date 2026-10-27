import { randomUUID } from "node:crypto";
import {
  AiProvider,
  AiProviderError,
  ModelInvocationRequest,
  ModelInvocationResponse,
  ModelMetadata,
  ToolCall,
} from "./ai-provider.types.js";

const DEFAULT_MOCK_MODELS: ModelMetadata[] = [
  {
    id: "mock-gpt-4o",
    name: "Mock GPT-4o",
    provider: "mock",
    contextWindow: 128_000,
    maxOutputTokens: 4096,
    capabilities: ["chat", "completion", "tools", "json_mode"],
    pricing: {
      promptPerThousandTokensUsd: 0.005,
      completionPerThousandTokensUsd: 0.015,
    },
  },
  {
    id: "mock-claude-3-5-sonnet",
    name: "Mock Claude 3.5 Sonnet",
    provider: "mock",
    contextWindow: 200_000,
    maxOutputTokens: 8192,
    capabilities: ["chat", "completion", "tools", "vision"],
    pricing: {
      promptPerThousandTokensUsd: 0.003,
      completionPerThousandTokensUsd: 0.015,
    },
  },
  {
    id: "mock-gemini-1-5-pro",
    name: "Mock Gemini 1.5 Pro",
    provider: "mock",
    contextWindow: 1_000_000,
    maxOutputTokens: 8192,
    capabilities: ["chat", "completion", "tools", "vision", "json_mode"],
    pricing: {
      promptPerThousandTokensUsd: 0.00125,
      completionPerThousandTokensUsd: 0.005,
    },
  },
];

export class MockAiProvider implements AiProvider {
  readonly id = "mock";
  readonly name = "HAZA Mock AI Provider";
  readonly version = "1.0.0";

  private models: Map<string, ModelMetadata>;
  private simulatedLatencyMs = 0;
  private simulatedError: AiProviderError | null = null;
  private cannedResponse: string | null = null;
  private cannedToolCalls: ToolCall[] | null = null;

  constructor(customModels?: ModelMetadata[]) {
    this.models = new Map();
    const source = customModels ?? DEFAULT_MOCK_MODELS;
    for (const m of source) {
      this.models.set(m.id, m);
    }
  }

  setSimulatedLatency(ms: number): void {
    this.simulatedLatencyMs = Math.max(0, ms);
  }

  setSimulatedError(error: AiProviderError | null): void {
    this.simulatedError = error;
  }

  setCannedResponse(response: string | null): void {
    this.cannedResponse = response;
  }

  setCannedToolCalls(calls: ToolCall[] | null): void {
    this.cannedToolCalls = calls;
  }

  reset(): void {
    this.simulatedLatencyMs = 0;
    this.simulatedError = null;
    this.cannedResponse = null;
    this.cannedToolCalls = null;
  }

  async listModels(): Promise<ModelMetadata[]> {
    return Array.from(this.models.values());
  }

  async getModel(modelId: string): Promise<ModelMetadata | null> {
    return this.models.get(modelId) ?? null;
  }

  validateConfig(config: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];
    if (config.apiKey !== undefined && typeof config.apiKey !== "string") {
      errors.push("apiKey must be a string");
    }
    if (config.timeoutMs !== undefined) {
      if (typeof config.timeoutMs !== "number" || config.timeoutMs < 0) {
        errors.push("timeoutMs must be a non-negative number");
      }
    }
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async invoke(request: ModelInvocationRequest): Promise<ModelInvocationResponse> {
    const startTime = Date.now();

    // 1. Check signal cancellation prior to starting
    if (request.signal?.aborted) {
      throw new AiProviderError("Model invocation was aborted by client.", {
        code: "CANCELLED",
        provider: this.id,
        retryable: false,
      });
    }

    // 2. Validate model
    const model = await this.getModel(request.model);
    if (!model) {
      throw new AiProviderError(`Requested model '${request.model}' is not registered with ${this.name}.`, {
        code: "MODEL_NOT_FOUND",
        provider: this.id,
        retryable: false,
        statusCode: 404,
      });
    }

    // 3. Check for timeout or simulated error
    if (this.simulatedError) {
      throw this.simulatedError;
    }

    // 4. Handle simulated latency and timeout
    const latency = this.simulatedLatencyMs;
    const timeout = request.timeoutMs;

    if (timeout !== undefined && timeout > 0 && latency > timeout) {
      // Simulate timeout
      await this.sleep(timeout, request.signal);
      throw new AiProviderError(`Model invocation timed out after ${timeout}ms.`, {
        code: "TIMEOUT",
        provider: this.id,
        retryable: true,
        statusCode: 504,
      });
    }

    if (latency > 0) {
      await this.sleep(latency, request.signal);
    }

    // Check cancellation after delay
    if (request.signal?.aborted) {
      throw new AiProviderError("Model invocation was aborted by client.", {
        code: "CANCELLED",
        provider: this.id,
        retryable: false,
      });
    }

    // 5. Build response content
    const lastUserMessage = [...request.messages].reverse().find((m) => m.role === "user");
    const userPrompt = lastUserMessage?.content ?? "No prompt provided";

    let content: string;
    let toolCalls: ToolCall[] | undefined = undefined;
    let finishReason: ModelInvocationResponse["finishReason"] = "stop";

    if (this.cannedToolCalls && this.cannedToolCalls.length > 0) {
      toolCalls = this.cannedToolCalls;
      content = this.cannedResponse ?? "";
      finishReason = "tool_calls";
    } else if (this.cannedResponse !== null) {
      content = this.cannedResponse;
    } else {
      content = `[Mock Response from ${model.name}] Processed request: "${userPrompt.slice(0, 100)}"`;
    }

    // 6. Calculate token usage deterministically (~4 characters per token)
    const promptChars = request.messages.reduce((sum, m) => sum + m.content.length, 0);
    const promptTokens = Math.max(1, Math.ceil(promptChars / 4));
    const completionTokens = Math.max(1, Math.ceil(content.length / 4));
    const totalTokens = promptTokens + completionTokens;

    const pricing = model.pricing;
    const estimatedCostUsd = pricing
      ? (promptTokens / 1000) * pricing.promptPerThousandTokensUsd +
        (completionTokens / 1000) * pricing.completionPerThousandTokensUsd
      : undefined;

    const duration = Date.now() - startTime;

    return {
      id: `mock-inv-${randomUUID()}`,
      model: model.id,
      provider: this.id,
      content,
      finishReason,
      toolCalls,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCostUsd: estimatedCostUsd !== undefined ? Number(estimatedCostUsd.toFixed(6)) : undefined,
      },
      latencyMs: duration,
      metadata: {
        ...request.metadata,
        simulated: true,
      },
    };
  }

  private sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        resolve();
      }, ms);

      const onAbort = () => {
        cleanup();
        reject(
          new AiProviderError("Model invocation was aborted by client.", {
            code: "CANCELLED",
            provider: this.id,
            retryable: false,
          }),
        );
      };

      const cleanup = () => {
        clearTimeout(timer);
        if (signal) {
          signal.removeEventListener("abort", onAbort);
        }
      };

      if (signal) {
        if (signal.aborted) {
          onAbort();
          return;
        }
        signal.addEventListener("abort", onAbort);
      }
    });
  }
}
