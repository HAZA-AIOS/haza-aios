import { randomUUID } from "node:crypto";
import {
  AiProvider,
  AiProviderError,
  ModelInvocationRequest,
  ModelInvocationResponse,
  ModelMetadata,
  StreamingOptions,
  ToolCall,
} from "./ai-provider.types.js";
import { redactSecrets } from "../utils/secret-redactor.js";

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

  setBaseUrl(url: string): void {
    this.baseUrl = url.trim();
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

  /**
   * Health check validates configuration and reachability without making paid inference calls.
   * Uses OpenAI's GET /models endpoint which lists models with zero token charges.
   */
  async healthCheck(): Promise<{ status: "healthy" | "degraded" | "error"; message?: string; latencyMs?: number }> {
    const key = this.getApiKey();
    if (!key) {
      return {
        status: "degraded",
        message: "OpenAI API key not configured. Provider is inactive (Live mode disabled).",
        latencyMs: 0,
      };
    }
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(`${this.baseUrl}/models`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${key}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timer);
      const latencyMs = Math.max(1, Date.now() - startTime);

      if (res.ok) {
        return {
          status: "healthy",
          message: "OpenAI API reachable and authenticated (Zero token cost).",
          latencyMs,
        };
      }
      if (res.status === 401 || res.status === 403) {
        return {
          status: "error",
          message: "OpenAI authentication failed: invalid API key.",
          latencyMs,
        };
      }
      return {
        status: "degraded",
        message: `OpenAI returned status ${res.status}`,
        latencyMs,
      };
    } catch (err: unknown) {
      const latencyMs = Math.max(1, Date.now() - startTime);
      const msg = err instanceof Error ? err.message : String(err);
      return {
        status: "degraded",
        message: redactSecrets(msg),
        latencyMs,
      };
    }
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

    if (request.signal) {
      request.signal.addEventListener("abort", () => controller.abort());
    }

    const hasTools = Boolean(request.tools && request.tools.length > 0);

    const payload: Record<string, unknown> = {
      model: targetModel.id,
      messages: request.messages.map((m) => {
        if (m.role === "tool") {
          return {
            role: "tool",
            tool_call_id: m.toolCallId || "call_default",
            content: m.content,
          };
        }
        return {
          role: m.role,
          content: m.content,
          name: m.name,
        };
      }),
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 3000,
    };

    if (hasTools) {
      payload.tools = request.tools!.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    } else {
      payload.response_format = { type: "json_object" };
    }

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
      let finishReason: ModelInvocationResponse["finishReason"] = "stop";
      let toolCalls: ToolCall[] | undefined = undefined;

      if (choice?.finish_reason === "tool_calls" || (choice?.message?.tool_calls && choice.message.tool_calls.length > 0)) {
        finishReason = "tool_calls";
        toolCalls = (choice.message.tool_calls as any[]).map((tc) => {
          let args: Record<string, unknown>;
          try {
            args = JSON.parse(tc.function?.arguments || "{}");
          } catch {
            args = {};
          }
          return {
            id: tc.id || `call_${randomUUID()}`,
            name: tc.function?.name || "",
            arguments: args,
          };
        });
      } else if (choice?.finish_reason === "length") {
        finishReason = "length";
      }

      const promptTokens = data.usage?.prompt_tokens ?? Math.ceil(JSON.stringify(payload).length / 4);
      const completionTokens = data.usage?.completion_tokens ?? Math.ceil(content.length / 4);
      const totalTokens = data.usage?.total_tokens ?? promptTokens + completionTokens;

      const pricing = targetModel.pricing;
      const estimatedCostUsd = pricing
        ? (promptTokens / 1000) * pricing.promptPerThousandTokensUsd +
          (completionTokens / 1000) * pricing.completionPerThousandTokensUsd
        : undefined;

      return {
        id: data.id || `chatcmpl-${randomUUID()}`,
        model: data.model || targetModel.id,
        provider: this.id,
        content,
        finishReason,
        toolCalls,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens,
          estimatedCostUsd,
        },
        latencyMs,
        metadata: {
          correlationId,
          created: data.created,
          systemFingerprint: data.system_fingerprint,
        },
      };
    } catch (err: unknown) {
      clearTimeout(timeoutHandle);
      if (err instanceof AiProviderError) {
        throw err;
      }

      const latencyMs = Math.max(1, Date.now() - startTime);
      const errName = err && typeof err === "object" && "name" in err ? String((err as any).name) : "";
      const errMsg = err instanceof Error ? err.message : String(err);

      if (controller.signal.aborted || errName === "AbortError") {
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

      throw new AiProviderError(`OpenAI network connection failure: ${redactSecrets(errMsg)}`, {
        code: "PROVIDER_ERROR",
        provider: this.id,
        retryable: true,
        details: { correlationId, latencyMs },
        cause: err,
      });
    }
  }

  /**
   * Streaming model invocation via Server-Sent Events (SSE).
   */
  async stream(
    request: ModelInvocationRequest,
    options: StreamingOptions,
  ): Promise<ModelInvocationResponse> {
    const startTime = Date.now();
    const correlationId = (request.metadata?.requestId as string) || randomUUID();

    if (request.signal?.aborted) {
      throw new AiProviderError("Model invocation was aborted by caller.", {
        code: "CANCELLED",
        provider: this.id,
        retryable: false,
      });
    }

    const key = this.getApiKey();
    if (!key) {
      throw new AiProviderError(
        "OpenAI API key is not configured. Live streaming cannot be executed.",
        {
          code: "AUTHENTICATION_FAILED",
          provider: this.id,
          retryable: false,
          statusCode: 401,
          details: { correlationId },
        },
      );
    }

    const targetModel = (await this.getModel(request.model)) ?? {
      id: request.model,
      name: request.model,
      provider: "openai",
      contextWindow: 128_000,
      maxOutputTokens: 4096,
      capabilities: ["chat", "completion"],
    };

    const timeoutMs = request.timeoutMs ?? 60_000;
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    if (request.signal) {
      request.signal.addEventListener("abort", () => controller.abort());
    }

    const hasTools = Boolean(request.tools && request.tools.length > 0);

    const payload: Record<string, unknown> = {
      model: targetModel.id,
      messages: request.messages.map((m) => {
        if (m.role === "tool") {
          return {
            role: "tool",
            tool_call_id: m.toolCallId || "call_default",
            content: m.content,
          };
        }
        return {
          role: m.role,
          content: m.content,
          name: m.name,
        };
      }),
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 3000,
      stream: true,
    };

    if (hasTools) {
      payload.tools = request.tools!.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    }

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

      if (!response.ok) {
        clearTimeout(timeoutHandle);
        const errorText = await response.text();
        const safeError = redactSecrets(errorText);
        throw new AiProviderError(`OpenAI stream rejected (${response.status}): ${safeError}`, {
          code: response.status === 429 ? "RATE_LIMITED" : "PROVIDER_ERROR",
          provider: this.id,
          retryable: response.status >= 500 || response.status === 429,
          statusCode: response.status,
        });
      }

      if (!response.body) {
        throw new AiProviderError("OpenAI returned empty response body for streaming.", {
          code: "PROVIDER_ERROR",
          provider: this.id,
          retryable: true,
        });
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let fullContent = "";
      let responseId = `chatcmpl-${randomUUID()}`;
      let buffer = "";
      let finishReason: ModelInvocationResponse["finishReason"] = "stop";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(":")) continue;
          if (trimmed === "data: [DONE]") {
            break;
          }
          if (trimmed.startsWith("data: ")) {
            try {
              const parsed = JSON.parse(trimmed.slice(6));
              if (parsed.id) responseId = parsed.id;
              const choice = parsed.choices?.[0];
              const deltaContent = choice?.delta?.content ?? "";
              if (choice?.finish_reason) {
                finishReason = choice.finish_reason === "tool_calls" ? "tool_calls" : "stop";
              }

              if (deltaContent) {
                fullContent += deltaContent;
                await options.onChunk({
                  id: responseId,
                  model: targetModel.id,
                  delta: deltaContent,
                  finishReason: null,
                });
              }
            } catch {
              // Ignore partial JSON parse errors on stream split
            }
          }
        }
      }

      clearTimeout(timeoutHandle);
      const latencyMs = Math.max(1, Date.now() - startTime);
      const promptTokens = Math.ceil(JSON.stringify(payload).length / 4);
      const completionTokens = Math.ceil(fullContent.length / 4);
      const totalTokens = promptTokens + completionTokens;

      const pricing = targetModel.pricing;
      const estimatedCostUsd = pricing
        ? (promptTokens / 1000) * pricing.promptPerThousandTokensUsd +
          (completionTokens / 1000) * pricing.completionPerThousandTokensUsd
        : undefined;

      const finalResponse: ModelInvocationResponse = {
        id: responseId,
        model: targetModel.id,
        provider: this.id,
        content: fullContent,
        finishReason,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens,
          estimatedCostUsd,
        },
        latencyMs,
        metadata: { correlationId, streamed: true },
      };

      await options.onChunk({
        id: responseId,
        model: targetModel.id,
        delta: "",
        finishReason,
        usage: finalResponse.usage,
      });

      return finalResponse;
    } catch (err: unknown) {
      clearTimeout(timeoutHandle);
      if (err instanceof AiProviderError) {
        throw err;
      }
      const latencyMs = Math.max(1, Date.now() - startTime);
      const errName = err && typeof err === "object" && "name" in err ? String((err as any).name) : "";
      const errMsg = err instanceof Error ? err.message : String(err);

      if (controller.signal.aborted || errName === "AbortError") {
        const isTimeout = !request.signal?.aborted;
        throw new AiProviderError(
          isTimeout
            ? `OpenAI streaming request timed out after ${timeoutMs}ms.`
            : "OpenAI streaming request was aborted by caller.",
          {
            code: isTimeout ? "TIMEOUT" : "CANCELLED",
            provider: this.id,
            retryable: isTimeout,
            statusCode: isTimeout ? 504 : 499,
          },
        );
      }

      throw new AiProviderError(`OpenAI stream error: ${redactSecrets(errMsg)}`, {
        code: "PROVIDER_ERROR",
        provider: this.id,
        retryable: true,
        details: { correlationId, latencyMs },
      });
    }
  }
}
