import { randomUUID } from "node:crypto";
import {
  AiProvider,
  AiProviderError,
  ModelInvocationRequest,
  ModelInvocationResponse,
  ModelMetadata,
} from "./ai-provider.types.js";

const DEFAULT_OPENAI_MODELS: ModelMetadata[] = [
  {
    id: "gpt-4o",
    name: "OpenAI GPT-4o",
    provider: "openai",
    contextWindow: 128_000,
    maxOutputTokens: 4096,
    capabilities: ["chat", "completion", "tools", "json_mode", "vision"],
    pricing: {
      promptPerThousandTokensUsd: 0.005,
      completionPerThousandTokensUsd: 0.015,
    },
  },
  {
    id: "gpt-4o-mini",
    name: "OpenAI GPT-4o Mini",
    provider: "openai",
    contextWindow: 128_000,
    maxOutputTokens: 16384,
    capabilities: ["chat", "completion", "tools", "json_mode"],
    pricing: {
      promptPerThousandTokensUsd: 0.00015,
      completionPerThousandTokensUsd: 0.0006,
    },
  },
  {
    id: "gpt-4-turbo",
    name: "OpenAI GPT-4 Turbo",
    provider: "openai",
    contextWindow: 128_000,
    maxOutputTokens: 4096,
    capabilities: ["chat", "completion", "tools", "json_mode"],
    pricing: {
      promptPerThousandTokensUsd: 0.01,
      completionPerThousandTokensUsd: 0.03,
    },
  },
];

export class OpenAiProvider implements AiProvider {
  readonly id = "openai";
  readonly name = "OpenAI Production Provider";
  readonly version = "1.0.0";

  private models: Map<string, ModelMetadata>;
  private apiKey: string | null = null;
  private baseUrl: string;

  constructor(options?: { apiKey?: string; baseUrl?: string; customModels?: ModelMetadata[] }) {
    this.apiKey = options?.apiKey ?? process.env.OPENAI_API_KEY?.trim() ?? null;
    this.baseUrl = options?.baseUrl ?? process.env.OPENAI_BASE_URL?.trim() ?? "https://api.openai.com/v1";

    this.models = new Map();
    const source = options?.customModels ?? DEFAULT_OPENAI_MODELS;
    for (const m of source) {
      this.models.set(m.id, m);
    }
  }

  isConfigured(): boolean {
    const key = this.apiKey ?? process.env.OPENAI_API_KEY?.trim();
    return Boolean(key && key.length > 5);
  }

  getApiKey(): string | null {
    return this.apiKey ?? process.env.OPENAI_API_KEY?.trim() ?? null;
  }

  setApiKey(key: string | null): void {
    this.apiKey = key ? key.trim() : null;
  }

  async listModels(): Promise<ModelMetadata[]> {
    return Array.from(this.models.values());
  }

  async getModel(modelId: string): Promise<ModelMetadata | null> {
    return this.models.get(modelId) ?? null;
  }

  validateConfig(config: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];
    if (config.apiKey !== undefined && (typeof config.apiKey !== "string" || config.apiKey.trim().length === 0)) {
      errors.push("apiKey must be a non-empty string");
    }
    if (config.timeoutMs !== undefined) {
      if (typeof config.timeoutMs !== "number" || config.timeoutMs <= 0) {
        errors.push("timeoutMs must be a positive number");
      }
    }
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async invoke(request: ModelInvocationRequest): Promise<ModelInvocationResponse> {
    const startTime = Date.now();
    const correlationId = (request.metadata?.requestId as string) || randomUUID();

    // 1. Verify Client Cancellation
    if (request.signal?.aborted) {
      throw new AiProviderError("Model invocation was aborted by caller.", {
        code: "CANCELLED",
        provider: this.id,
        retryable: false,
      });
    }

    // 2. Verify Credentials
    const key = this.getApiKey();
    if (!key) {
      throw new AiProviderError(
        "OpenAI API key is not configured. Live inference cannot be executed.",
        {
          code: "AUTHENTICATION_FAILED",
          provider: this.id,
          retryable: false,
          statusCode: 401,
          details: { correlationId, providerConfigured: false },
        },
      );
    }

    // 3. Resolve Target Model
    const targetModel = (await this.getModel(request.model)) ?? {
      id: request.model,
      name: request.model,
      provider: "openai",
      contextWindow: 128_000,
      maxOutputTokens: 4096,
      capabilities: ["chat", "completion", "json_mode"],
    };

    // 4. Setup Timeout & Abort Signal
    const timeoutMs = request.timeoutMs ?? 60_000;
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    // Link caller signal if provided
    if (request.signal) {
      request.signal.addEventListener("abort", () => controller.abort());
    }

    const payload: Record<string, unknown> = {
      model: targetModel.id,
      messages: request.messages.map((m) => ({
        role: m.role,
        content: m.content,
        name: m.name,
      })),
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 3000,
      response_format: { type: "json_object" },
    };

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          "X-Request-ID": correlationId,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutHandle);
      const latencyMs = Math.max(1, Date.now() - startTime);

      if (!response.ok) {
        const errorText = await response.text();
        const safeError = redactSecrets(errorText);

        if (response.status === 429) {
          throw new AiProviderError(`OpenAI rate limit exceeded: ${safeError}`, {
            code: "RATE_LIMITED",
            provider: this.id,
            retryable: true,
            statusCode: 429,
            details: { correlationId, latencyMs },
          });
        }

        if (response.status === 401 || response.status === 403) {
          throw new AiProviderError(`OpenAI authentication failed: ${safeError}`, {
            code: "AUTHENTICATION_FAILED",
            provider: this.id,
            retryable: false,
            statusCode: response.status,
            details: { correlationId, latencyMs },
          });
        }

        if (response.status >= 500) {
          throw new AiProviderError(`OpenAI service error (${response.status}): ${safeError}`, {
            code: "PROVIDER_ERROR",
            provider: this.id,
            retryable: true,
            statusCode: response.status,
            details: { correlationId, latencyMs },
          });
        }

        throw new AiProviderError(`OpenAI API request rejected (${response.status}): ${safeError}`, {
          code: "INVALID_REQUEST",
          provider: this.id,
          retryable: false,
          statusCode: response.status,
          details: { correlationId, latencyMs },
        });
      }

      const data = (await response.json()) as any;
      const choice = data.choices?.[0];
      const content = choice?.message?.content ?? "";
      const finishReason = choice?.finish_reason === "length" ? "length" : "stop";

      const promptTokens = data.usage?.prompt_tokens ?? Math.ceil(JSON.stringify(payload).length / 4);
      const completionTokens = data.usage?.completion_tokens ?? Math.ceil(content.length / 4);
      const totalTokens = data.usage?.total_tokens ?? promptTokens + completionTokens;

      const pricing = targetModel.pricing;
      const estimatedCostUsd = pricing
        ? (promptTokens / 1000) * pricing.promptPerThousandTokensUsd +
          (completionTokens / 1000) * pricing.completionPerThousandTokensUsd
        : undefined;

      return {
        id: data.id ?? `openai-${randomUUID()}`,
        model: targetModel.id,
        provider: this.id,
        content,
        finishReason,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens,
          estimatedCostUsd,
        },
        latencyMs,
        metadata: {
          correlationId,
          liveInference: true,
          systemFingerprint: data.system_fingerprint,
        },
      };
    } catch (err: any) {
      clearTimeout(timeoutHandle);
      if (err instanceof AiProviderError) {
        throw err;
      }

      const latencyMs = Math.max(1, Date.now() - startTime);
      if (controller.signal.aborted || err.name === "AbortError") {
        const isTimeout = !request.signal?.aborted;
        throw new AiProviderError(
          isTimeout
            ? `OpenAI request timed out after ${timeoutMs}ms.`
            : "OpenAI request was aborted by caller.",
          {
            code: isTimeout ? "TIMEOUT" : "CANCELLED",
            provider: this.id,
            retryable: isTimeout,
            statusCode: isTimeout ? 504 : 499,
            details: { correlationId, latencyMs },
          },
        );
      }

      throw new AiProviderError(`OpenAI network connection failure: ${redactSecrets(err.message)}`, {
        code: "PROVIDER_ERROR",
        provider: this.id,
        retryable: true,
        details: { correlationId, latencyMs },
        cause: err,
      });
    }
  }
}

function redactSecrets(input: string): string {
  return input
    .replace(/sk-[a-zA-Z0-9_-]{20,}/g, "[REDACTED_API_KEY]")
    .replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, "Bearer [REDACTED]");
}
