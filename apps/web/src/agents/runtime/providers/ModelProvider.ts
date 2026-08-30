import type { AgentInstance } from "../../agent.types";

export interface ModelGenerationRequest {
  systemPrompt: string;
  userPrompt: string;
  context?: any;
  tools?: any[];
  maxTokens?: number;
  temperature?: number;
}

export interface ModelGenerationResponse {
  text: string;
  toolCalls?: any[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ModelProvider {
  id: string;
  name: string;
  
  /**
   * Generates a single response from the model
   */
  generate(request: ModelGenerationRequest, instance: AgentInstance): Promise<ModelGenerationResponse>;
  
  /**
   * Foundation for streaming responses
   */
  stream?(request: ModelGenerationRequest, instance: AgentInstance): AsyncIterableIterator<string>;
  
  /**
   * Retrieves capabilities of the provider
   */
  getCapabilities(): Promise<string[]>;
}
