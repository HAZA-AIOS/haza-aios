export interface EmbeddingRequest {
  texts: string[];
  dimensions?: number;
  timeoutMs?: number;
}

export interface EmbeddingResult {
  provider: string;
  model: string;
  dimensions: number;
  embeddings: number[][]; // float arrays
  usage: {
    totalTokens: number;
    estimatedCostUsd?: number;
  };
}

export interface EmbeddingProvider {
  readonly id: string;
  readonly name: string;
  readonly defaultModel: string;
  readonly dimensions: number;
  readonly isMock: boolean;
  isAvailable(): Promise<boolean>;
  embed(request: EmbeddingRequest): Promise<EmbeddingResult>;
}

