import type { EmbeddingProvider } from "./embedding-provider.types.js";
import { MockEmbeddingProvider } from "./mock-embedding-provider.js";
import { OpenAiEmbeddingProvider } from "./openai-embedding-provider.js";

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

  register(provider: EmbeddingProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(id: string): EmbeddingProvider | undefined {
    return this.providers.get(id);
  }

  async getActiveProvider(): Promise<{ provider: EmbeddingProvider; isRealSemantic: boolean }> {
    const openai = this.providers.get("openai");
    if (openai && await openai.isAvailable()) {
      return { provider: openai, isRealSemantic: true };
    }

    const mock = this.providers.get("mock")!;
    return { provider: mock, isRealSemantic: false };
  }
}

