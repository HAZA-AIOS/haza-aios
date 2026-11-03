import { ApiError } from "../../../common/errors/api-error.js";
import { redactSecrets } from "../utils/secret-redactor.js";
import type {
  EmbeddingProvider,
  EmbeddingRequest,
  EmbeddingResult,
} from "./embedding-provider.types.js";

export class OpenAiEmbeddingProvider implements EmbeddingProvider {
  readonly id = "openai";
  readonly name = "OpenAI Text Embeddings";
  readonly defaultModel = "text-embedding-3-small";
  readonly dimensions = 1536;
  readonly isMock = false;

  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || "";
    this.baseUrl = baseUrl || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  }

  setApiKey(key: string): void {
    this.apiKey = key.trim();
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey && this.apiKey.trim().length > 10);
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    if (!await this.isAvailable()) {
      throw new ApiError(
        503,
        "BAD_REQUEST",
        "OpenAI embedding provider is not configured with an active API key.",
      );
    }

    const model = this.defaultModel;
    const dimensions = request.dimensions ?? this.dimensions;
    const timeoutMs = request.timeoutMs ?? 20000;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          input: request.texts,
          dimensions,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        const safeError = redactSecrets(errorText);
        throw new ApiError(
          response.status,
          "INTERNAL_SERVER_ERROR",
          `OpenAI embeddings API responded with HTTP ${response.status}: ${safeError}`,
        );
      }

      const data = (await response.json()) as any;
      const embeddings = data.data.map((item: any) => item.embedding);
      const totalTokens = data.usage?.total_tokens ?? 0;
      const estimatedCostUsd = (totalTokens / 1_000_000) * 0.02; // $0.02 per 1M tokens

      return {
        provider: this.id,
        model,
        dimensions,
        embeddings,
        usage: {
          totalTokens,
          estimatedCostUsd,
        },
      };
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        throw err;
      }
      const errName = err && typeof err === "object" && "name" in err ? String((err as any).name) : "";
      const errMsg = err instanceof Error ? err.message : String(err);

      if (errName === "AbortError") {
        throw new ApiError(504, "INTERNAL_SERVER_ERROR", `OpenAI embeddings call timed out after ${timeoutMs}ms.`);
      }
      throw new ApiError(500, "INTERNAL_SERVER_ERROR", `OpenAI embeddings call failed: ${redactSecrets(errMsg)}`);
    } finally {
      clearTimeout(timer);
    }
  }
}
