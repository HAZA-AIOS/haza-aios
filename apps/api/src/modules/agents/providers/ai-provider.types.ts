export type ModelCapability =
  | "chat"
  | "completion"
  | "embeddings"
  | "tools"
  | "vision"
  | "json_mode";

export type ModelMetadata = {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  maxOutputTokens: number;
  capabilities: ModelCapability[];
  pricing?: {
    promptPerThousandTokensUsd: number;
    completionPerThousandTokensUsd: number;
  };
  metadata?: Record<string, unknown>;
};

export type MessageRole = "system" | "user" | "assistant" | "tool";

export type InvocationMessage = {
  role: MessageRole;
  content: string;
  name?: string;
  toolCallId?: string;
};

export type ToolDeclaration = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type ToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type ModelInvocationRequest = {
  model: string;
  messages: InvocationMessage[];
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDeclaration[];
  timeoutMs?: number;
  signal?: AbortSignal;
  metadata?: Record<string, unknown>;
};

export type UsageMetadata = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd?: number;
};

export type ModelInvocationResponse = {
  id: string;
  model: string;
  provider: string;
  content: string;
  finishReason: "stop" | "length" | "tool_calls" | "cancelled" | "error";
  toolCalls?: ToolCall[];
  usage: UsageMetadata;
  latencyMs: number;
  metadata?: Record<string, unknown>;
};

export type AiProviderErrorCode =
  | "INVALID_REQUEST"
  | "AUTHENTICATION_FAILED"
  | "RATE_LIMITED"
  | "MODEL_NOT_FOUND"
  | "TIMEOUT"
  | "CANCELLED"
  | "PROVIDER_ERROR";

export class AiProviderError extends Error {
  readonly code: AiProviderErrorCode;
  readonly provider: string;
  readonly retryable: boolean;
  readonly statusCode?: number;
  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    options: {
      code: AiProviderErrorCode;
      provider: string;
      retryable?: boolean;
      statusCode?: number;
      details?: Record<string, unknown>;
      cause?: unknown;
    },
  ) {
    super(message);
    this.name = "AiProviderError";
    this.code = options.code;
    this.provider = options.provider;
    this.retryable = options.retryable ?? false;
    this.statusCode = options.statusCode;
    this.details = options.details;
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

export interface AiProvider {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  listModels(): Promise<ModelMetadata[]>;
  getModel(modelId: string): Promise<ModelMetadata | null>;
  validateConfig(config: Record<string, unknown>): { valid: boolean; errors?: string[] };
  invoke(request: ModelInvocationRequest): Promise<ModelInvocationResponse>;
}
