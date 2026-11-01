import { createHash } from "node:crypto";
import type {
  EmbeddingProvider,
  EmbeddingRequest,
  EmbeddingResult,
} from "./embedding-provider.types.js";

export class MockEmbeddingProvider implements EmbeddingProvider {
  readonly id = "mock";
  readonly name = "HAZA Deterministic Mock Embedding Provider";
  readonly defaultModel = "mock-text-embedding-3-small";
  readonly dimensions = 1536;
  readonly isMock = true;

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    const dimensions = request.dimensions ?? this.dimensions;
    const embeddings: number[][] = [];
    let totalTokens = 0;

    for (const text of request.texts) {
      totalTokens += Math.max(1, Math.ceil(text.length / 4));
      embeddings.push(this.generateDeterministicVector(text, dimensions));
    }

    return {
      provider: this.id,
      model: this.defaultModel,
      dimensions,
      embeddings,
      usage: {
        totalTokens,
        estimatedCostUsd: 0,
      },
    };
  }

  private generateDeterministicVector(text: string, dimensions: number): number[] {
    const vector = new Array<number>(dimensions).fill(0);
    const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? ["empty"];

    // Project each word deterministically across coordinates
    for (const word of words) {
      const hash = createHash("sha256").update(word).digest();
      for (let i = 0; i < 16; i++) {
        const val = hash.readInt16LE(i * 2);
        const index = Math.abs(val) % dimensions;
        vector[index] += val / 32768.0;
      }
    }

    // L2 Normalize so that dot-product == cosine similarity
    let normSq = 0;
    for (let i = 0; i < dimensions; i++) {
      normSq += vector[i] * vector[i];
    }

    const norm = Math.sqrt(normSq) || 1.0;
    for (let i = 0; i < dimensions; i++) {
      vector[i] = Number((vector[i] / norm).toFixed(6));
    }

    return vector;
  }
}

