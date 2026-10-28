import { AiProvider, ModelMetadata } from "./ai-provider.types.js";
import { MockAiProvider } from "./mock-ai-provider.js";

export class AiProviderRegistry {
  private static instance: AiProviderRegistry | null = null;
  private providers = new Map<string, AiProvider>();
  private defaultProviderId = "mock";

  constructor() {
    // Automatically register MockAiProvider
    const mock = new MockAiProvider();
    this.register(mock);
  }

  static getInstance(): AiProviderRegistry {
    if (!AiProviderRegistry.instance) {
      AiProviderRegistry.instance = new AiProviderRegistry();
    }
    return AiProviderRegistry.instance;
  }

  static resetInstance(): void {
    AiProviderRegistry.instance = null;
  }

  register(provider: AiProvider): void {
    this.providers.set(provider.id, provider);
  }

  unregister(providerId: string): boolean {
    if (providerId === "mock") {
      // Mock provider cannot be unregistered in development/testing
      return false;
    }
    return this.providers.delete(providerId);
  }

  get(providerId: string): AiProvider | null {
    return this.providers.get(providerId) ?? null;
  }

  has(providerId: string): boolean {
    return this.providers.has(providerId);
  }

  list(): AiProvider[] {
    return Array.from(this.providers.values());
  }

  async listAllModels(): Promise<ModelMetadata[]> {
    const results: ModelMetadata[] = [];
    for (const provider of this.providers.values()) {
      const models = await provider.listModels();
      results.push(...models);
    }
    return results;
  }

  getDefault(): AiProvider {
    const def = this.providers.get(this.defaultProviderId);
    if (!def) {
      const first = this.providers.values().next().value;
      if (!first) throw new Error("No AI providers registered.");
      return first;
    }
    return def;
  }

  setDefaultProvider(providerId: string): void {
    if (!this.providers.has(providerId)) {
      throw new Error(`Cannot set default provider to '${providerId}': provider not registered.`);
    }
    this.defaultProviderId = providerId;
  }
}
