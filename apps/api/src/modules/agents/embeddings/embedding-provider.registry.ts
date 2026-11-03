import type { EmbeddingProvider } from "./embedding-provider.types.js";
import { MockEmbeddingProvider } from "./mock-embedding-provider.js";
import { OpenAiEmbeddingProvider } from "./openai-embedding-provider.js";

export type EmbeddingSelectionOptions = {
  allowLive?: boolean;
  requestedProviderId?: string;
  organizationId?: string;
};

export class EmbeddingProviderRegistry {
  private static instance: EmbeddingProviderRegistry;
  private providers = new Map<string, EmbeddingProvider>();

  private constructor() {
    this.register(new MockEmbeddingProvider());
    this.register(new OpenAiEmbeddingProvider());
  }

  static getInstance(): EmbeddingProviderRegistry {
    if (!this.instance) {
      this.instance = new EmbeddingProviderRegistry();
    }
    return this.instance;
  }

  static resetInstance(): void {
    EmbeddingProviderRegistry.instance = new EmbeddingProviderRegistry();
  }

  register(provider: EmbeddingProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(id: string): EmbeddingProvider | undefined {
    return this.providers.get(id);
  }

  /**
   * Resolves the active embedding provider via explicit policy.
   * By default, live embeddings are disabled (policy fail-safe) and mock embeddings are used.
   * Real semantic embeddings are used only when explicitly enabled (allowLive === true).
   */
  async getActiveProvider(
    options?: EmbeddingSelectionOptions,
  ): Promise<{ provider: EmbeddingProvider; isRealSemantic: boolean }> {
    const requestedId = options?.requestedProviderId;
    const allowLive = options?.allowLive === true;

    if (requestedId) {
      const requested = this.providers.get(requestedId);
      if (requested) {
        if (!requested.isMock && !allowLive) {
          // Explicit policy prohibits unapproved live embedding activation
          const mock = this.providers.get("mock")!;
          return { provider: mock, isRealSemantic: false };
        }
        return { provider: requested, isRealSemantic: !requested.isMock };
      }
    }

    if (allowLive) {
      const openai = this.providers.get("openai");
      if (openai && (await openai.isAvailable())) {
        return { provider: openai, isRealSemantic: true };
      }
    }

    const mock = this.providers.get("mock")!;
    return { provider: mock, isRealSemantic: false };
  }
}
