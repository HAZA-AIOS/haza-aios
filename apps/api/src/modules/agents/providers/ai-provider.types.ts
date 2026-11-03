export type ModelCapability =
  | "chat"
  | "completion"
  | "embeddings"
  | "tools"
  | "vision"
  | "json_mode";

export type ModelPricing = {
  promptPerThousandTokensUsd: number;
  completionPerThousandTokensUsd: number;
  embeddingPerThousandTokensUsd?: number;
};

export type ModelMetadata = {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  maxOutputTokens: number;
  capabilities: ModelCapability[];
  pricing?: ModelPricing;
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
  responseFormat?: { type: "text" | "json_object" | "json_schema"; schema?: Record<string, unknown> };
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

export type ModelStreamingChunk = {
  id: string;
  model: string;
  delta: string;
  finishReason?: "stop" | "length" | "tool_calls" | "cancelled" | "error" | null;
  toolCallDeltas?: {
    index: number;
    id?: string;
    name?: string;
    argumentsDelta?: string;
  }[];
  usage?: UsageMetadata;
};

export type StreamingOptions = {
  onChunk: (chunk: ModelStreamingChunk) => void | Promise<void>;
  signal?: AbortSignal;
};

export type AiProviderErrorCode =
  | "INVALID_REQUEST"
  | "AUTHENTICATION_FAILED"
  | "RATE_LIMITED"
  | "MODEL_NOT_FOUND"
  | "TIMEOUT"
  | "CANCELLED"
  | "PROVIDER_ERROR"
  | "BUDGET_EXCEEDED"
  | "MODEL_FORBIDDEN"
  | "CIRCUIT_BREAKER_OPEN"
  | "LIVE_MODE_DISABLED";

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

export type EnvironmentMode = "mock" | "staging" | "production";

export type TenantProviderConfig = {
  id: string;
  organizationId: string;
  providerId: string;
  liveModeEnabled: boolean;
  environmentMode: EnvironmentMode;
  apiKeyMasked?: string | null;
  defaultModel: string;
  allowedModels: string[];
  embeddingModel: string;
  embeddingLiveEnabled: boolean;
  status: "inactive" | "configured" | "active" | "degraded" | "error";
  statusMessage?: string | null;
  lastHealthCheckAt?: Date | null;
  updatedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface AiProvider {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  listModels(): Promise<ModelMetadata[]>;
  getModel(modelId: string): Promise<ModelMetadata | null>;
  validateConfig(config: Record<string, unknown>): { valid: boolean; errors?: string[] };
  invoke(request: ModelInvocationRequest): Promise<ModelInvocationResponse>;
  stream?(
    request: ModelInvocationRequest,
    options: StreamingOptions,
  ): Promise<ModelInvocationResponse>;
  healthCheck?(): Promise<{ status: "healthy" | "degraded" | "error"; message?: string; latencyMs?: number }>;
}
