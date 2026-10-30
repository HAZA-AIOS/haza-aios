export type AgentLifecycleStatus =
  | "draft"
  | "available"
  | "configured"
  | "active"
  | "paused"
  | "disabled"
  | "archived"
  | "suspended";

export type JsonRecord = Record<string, unknown>;

export type AgentCapability = {
  key: string;
  name: string;
  description: string;
  requiresApproval?: boolean;
  riskLevel?: "low" | "medium" | "high";
};

export type HumanApprovalPolicy = {
  required: boolean;
  approverRoles: string[];
  escalationTimeoutHours?: number;
  fallbackAction?: "deny" | "escalate";
  sensitiveCapabilities?: string[];
};

export type AgentTemplateRecord = {
  id: string;
  slug: string;
  name: string;
  description: string;
  version: string;
  category: string;
  industry: string;
  status: AgentLifecycleStatus;
  icon: string;
  capabilities: AgentCapability[];
  requiredPermissions: string[];
  configurationSchema: JsonRecord;
  inputSchema: JsonRecord;
  outputSchema: JsonRecord;
  defaultApprovalPolicy?: HumanApprovalPolicy | null;
  metadata: JsonRecord;
  publisherType?: "platform" | "organization" | "developer";
  publisherOrganizationId?: string | null;
  publisherUserId?: string | null;
  visibility?: "platform" | "private_organization" | "approved_shared";
  publishingStatus?: "draft" | "submitted" | "under_review" | "approved" | "rejected" | "published" | "deprecated" | "withdrawn";
  summary?: string | null;
  latestVersion?: string;
  minPlatformVersion?: string | null;
  reviewNotes?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: Date | null;
  publishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AgentDefinitionRecord = {
  id: string;
  organizationId: string;
  workspaceId: string;
  templateId: string | null;
  agentKey: string;
  name: string;
  description: string;
  status: AgentLifecycleStatus;
  enabled: boolean;
  instructions: string | null;
  configuration: JsonRecord;
  modelProvider: string;
  modelSelection: string;
  humanApprovalPolicy?: HumanApprovalPolicy | null;
  createdBy: string;
  installedVersion?: string;
  templateVersionId?: string | null;
  installedFromMarketplace?: boolean;
  activeRevisionNumber?: number;
  activeRevisionId?: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AgentToolAssignmentRecord = {
  id: string;
  agentId: string;
  toolKey: string;
  status: string;
  configuration: JsonRecord | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AgentDefinitionWithTools = AgentDefinitionRecord & {
  tools: AgentToolAssignmentRecord[];
};

export type UpsertAgentTemplateInput = Omit<AgentTemplateRecord, "createdAt" | "updatedAt">;

export type CreateAgentInput = {
  organizationId: string;
  workspaceId: string;
  templateId: string;
  createdBy: string;
  name?: string;
  description?: string;
  instructions?: string;
  configuration?: JsonRecord;
  modelProvider?: string;
  modelSelection?: string;
  humanApprovalPolicy?: HumanApprovalPolicy;
};

export type UpdateAgentConfigurationInput = {
  organizationId: string;
  agentId: string;
  updatedBy: string;
  configuration: JsonRecord;
  instructions?: string;
  modelProvider?: string;
  modelSelection?: string;
  humanApprovalPolicy?: HumanApprovalPolicy;
};

export type UpdateAgentStatusInput = {
  organizationId: string;
  agentId: string;
  status: "active" | "configured" | "paused" | "disabled" | "archived" | "suspended";
  updatedBy?: string;
};

export type AgentAuditEvent = {
  id: string;
  organizationId: string;
  workspaceId: string | null;
  agentId: string;
  actorUserId: string | null;
  action: string;
  operation: string;
  result: "success" | "failure" | "denied";
  beforeSnapshot: JsonRecord | null;
  afterSnapshot: JsonRecord | null;
  changedFields: string[] | null;
  metadata: JsonRecord;
  createdAt: Date;
};

export type AgentRunStatus =
  | "queued"
  | "running"
  | "awaiting_approval"
  | "waiting"
  | "rejected"
  | "completed"
  | "failed"
  | "cancelled";

export const RUNTIME_STATE_TRANSITIONS: Record<AgentRunStatus, AgentRunStatus[]> = {
  queued: ["running", "waiting", "completed", "failed", "cancelled"],
  running: ["awaiting_approval", "waiting", "completed", "failed", "cancelled"],
  awaiting_approval: ["queued", "rejected", "cancelled"],
  waiting: ["queued", "running", "rejected", "completed", "failed", "cancelled"],
  rejected: [],
  completed: [],
  failed: ["queued"],
  cancelled: [],
};

export type AgentConversationStatus = "active" | "archived" | "deleted";
export type AgentMessageRole = "user" | "assistant" | "system" | "tool";

export type AgentConversationRecord = {
  id: string;
  organizationId: string;
  workspaceId: string;
  agentId: string;
  userId: string;
  title: string;
  status: AgentConversationStatus;
  lastMessageAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AgentRunRecord = {
  id: string;
  organizationId: string;
  workspaceId: string;
  agentId: string;
  conversationId: string | null;
  requestedBy: string;
  status: AgentRunStatus;
  executionMode: string;
  idempotencyKey: string | null;
  input: JsonRecord;
  output: JsonRecord | null;
  provider: string | null;
  model: string | null;
  errorCode: string | null;
  safeErrorMessage: string | null;
  metadata: JsonRecord;
  configurationRevisionId?: string | null;
  configurationSnapshot?: JsonRecord | null;
  attemptCount: number;
  maxAttempts: number;
  leaseToken?: string | null;
  leaseExpiresAt?: Date | null;
  workerId?: string | null;
  priority: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostMicros: number;
  cancelledBy?: string | null;
  cancelledAt?: Date | null;
  cancellationReason?: string | null;
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AgentMessageRecord = {
  id: string;
  organizationId: string;
  workspaceId: string;
  conversationId: string;
  agentRunId: string | null;
  role: AgentMessageRole;
  sequence: number;
  content: string;
  metadata: JsonRecord | null;
  createdAt: Date;
};

export type PaginationInput = {
  limit: number;
  offset: number;
};

export type CreateAgentRunInput = {
  organizationId: string;
  agentId: string;
  userId: string;
  conversationId?: string;
  input: unknown;
  executionMode: string;
  metadata: JsonRecord;
  idempotencyKey?: string;
};

export type UpdateAgentRunInput = {
  organizationId: string;
  runId: string;
  userId: string;
  status: AgentRunStatus;
  output?: unknown;
  error?: string;
  errorCode?: string;
  metadata?: JsonRecord;
  durationMs?: number;
};

export type CreateConversationInput = {
  organizationId: string;
  agentId: string;
  userId: string;
  title: string;
};

export type CreateMessageInput = {
  organizationId: string;
  conversationId: string;
  userId: string;
  role: AgentMessageRole;
  content: string;
  metadata: JsonRecord | null;
  agentRunId?: string;
};

export type AgentMemoryScope = "user" | "agent" | "conversation" | "workspace" | "organization";
export type AgentMemoryStatus = "active" | "archived" | "deleted";

export type AgentMemoryRecord = {
  id: string;
  organizationId: string;
  workspaceId: string;
  agentId: string;
  userId: string | null;
  scope: AgentMemoryScope;
  type: string;
  content: string;
  status: AgentMemoryStatus;
  source: string;
  sourceRunId: string | null;
  sourceConversationId: string | null;
  sourceMessageId: string | null;
  importance: number;
  metadata: JsonRecord;
  createdBy: string;
  updatedBy: string | null;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateAgentMemoryInput = {
  organizationId: string;
  agentId: string;
  userId: string;
  scope: AgentMemoryScope;
  type: string;
  content: string;
  source: string;
  sourceRunId?: string;
  sourceConversationId?: string;
  sourceMessageId?: string;
  importance: number;
  metadata: JsonRecord;
  expiresAt?: Date;
};

export type UpdateAgentMemoryInput = {
  organizationId: string;
  memoryId: string;
  userId: string;
  scope?: AgentMemoryScope;
  type?: string;
  content?: string;
  status?: AgentMemoryStatus;
  importance?: number;
  metadata?: JsonRecord;
  expiresAt?: Date | null;
};

export type AgentMemoryQuery = PaginationInput & {
  organizationId: string;
  agentId: string;
  userId: string;
  type?: string;
  scope?: AgentMemoryScope;
  status?: AgentMemoryStatus;
  conversationId?: string;
};

export type AgentRevisionStatus = "draft" | "published" | "archived";
export type AgentRevisionValidationStatus = "valid" | "invalid" | "warning";

export type AgentValidationError = {
  field: string;
  message: string;
  severity: "error" | "warning";
  section?: string;
};

export type AgentConfigurationRevisionRecord = {
  id: string;
  organizationId: string;
  workspaceId: string;
  agentId: string;
  revisionNumber: number;
  version: string;
  status: AgentRevisionStatus;
  configuration: JsonRecord;
  validationStatus: AgentRevisionValidationStatus;
  validationErrors?: AgentValidationError[] | null;
  changelog: string | null;
  createdBy: string;
  publishedBy: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AgentBuilderIdentity = {
  name: string;
  agentKey: string;
  description: string;
  category?: string;
  industry?: string;
  icon?: string;
  tags?: string[];
};

export type AgentBuilderModel = {
  provider: string;
  modelSelection: string;
  temperature: number;
  maxTokens: number;
  timeoutSeconds: number;
  contextWindow?: number;
  responseQuality?: "fast" | "balanced" | "high";
};

export type AgentBuilderInstructions = {
  role: string;
  objectives: string;
  boundaryConstraints: string;
  behavioralRules: string;
  outputFormat: string;
  prohibitedActions: string;
  escalationRequirements: string;
  systemInstructions: string;
};

export type AgentBuilderCapability = {
  key: string;
  name: string;
  description: string;
  riskLevel: "low" | "medium" | "high";
  requiresApproval: boolean;
};

export type AgentBuilderTool = {
  toolKey: string;
  name: string;
  description: string;
  category: string;
  riskLevel: "low" | "medium" | "high";
  requiresApproval: boolean;
  permissions: string[];
  configuration?: Record<string, unknown>;
};

export type AgentBuilderKnowledgeSource = {
  sourceId: string;
  name?: string;
  sourceType?: string;
  accessPolicy?: "read_only" | "search_only";
  enabled: boolean;
};

export type AgentBuilderHumanApproval = {
  policy: "never" | "always" | "risk_threshold";
  riskThreshold?: "low" | "medium" | "high";
  approverRoles: string[];
  escalationTimeoutHours: number;
  fallbackAction: "deny" | "escalate";
  sensitiveCapabilities: string[];
};

export type AgentBuilderFullConfig = {
  identity: AgentBuilderIdentity;
  model: AgentBuilderModel;
  instructions: AgentBuilderInstructions;
  capabilities: AgentBuilderCapability[];
  tools: AgentBuilderTool[];
  knowledge: AgentBuilderKnowledgeSource[];
  humanApproval: AgentBuilderHumanApproval;
};

export type AgentBuilderDraftInput = {
  organizationId: string;
  agentId: string;
  userId: string;
  configuration: AgentBuilderFullConfig;
  version?: string;
  changelog?: string;
};

export type AgentBuilderPublishInput = {
  organizationId: string;
  agentId: string;
  userId: string;
  version?: string;
  changelog?: string;
  revisionId?: string;
};

export type AgentBuilderDuplicateInput = {
  organizationId: string;
  workspaceId: string;
  sourceAgentId: string;
  userId: string;
  newName: string;
  newAgentKey: string;
};

export type AgentBuilderPreviewInput = {
  organizationId: string;
  agentId?: string;
  configuration: AgentBuilderFullConfig;
  testPrompt: string;
  userId: string;
};

export type AgentBuilderPreviewResult = {
  simulated: boolean;
  model: string;
  provider: string;
  content: string;
  finishReason: string;
  latencyMs: number;
  simulatedUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  simulatedToolCalls?: Array<{
    name: string;
    description: string;
    riskLevel: string;
    requiresApproval: boolean;
    arguments: Record<string, unknown>;
  }>;
  validationWarnings?: string[];
};

export type RevisionDiffItem = {
  field: string;
  path: string;
  before: unknown;
  after: unknown;
  action: "added" | "removed" | "modified";
};

// --- Epic 14 Runtime & Execution Engine Domain Models ---

export type AgentRunAttemptStatus =
  | "running"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "cancelled";

export type AgentRunAttemptRecord = {
  id: string;
  organizationId: string;
  workspaceId: string;
  runId: string;
  attemptNumber: number;
  status: AgentRunAttemptStatus;
  workerId: string;
  leaseToken: string;
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  errorDetails: JsonRecord | null;
  inputTokens: number;
  outputTokens: number;
  metadata: JsonRecord;
  createdAt: Date;
  updatedAt: Date;
};

export type AgentRunEventType =
  | "run_created"
  | "run_queued"
  | "worker_claimed"
  | "run_started"
  | "model_invoked"
  | "model_responded"
  | "tool_executed"
  | "approval_requested"
  | "approval_approved"
  | "approval_rejected"
  | "run_resumed"
  | "run_completed"
  | "run_failed"
  | "run_cancelled"
  | "retry_scheduled"
  | "lease_recovered"
  | "lesson_plan_draft_created"
  | "lesson_plan_parse_error";

export type AgentRunEventRecord = {
  id: string;
  organizationId: string;
  workspaceId: string;
  runId: string;
  attemptId: string | null;
  eventType: AgentRunEventType;
  payload: JsonRecord;
  createdAt: Date;
};

export type AgentApprovalStatus = "pending" | "approved" | "rejected" | "expired";

export type AgentApprovalRequestRecord = {
  id: string;
  organizationId: string;
  workspaceId: string;
  runId: string;
  attemptId: string | null;
  actionName: string;
  actionType: string;
  actionPayload: JsonRecord;
  riskLevel: "low" | "medium" | "high";
  policy: string;
  requiredRoles: string[];
  status: AgentApprovalStatus;
  requestedBy: string;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AgentApprovalDecisionRecord = {
  id: string;
  organizationId: string;
  workspaceId: string;
  approvalRequestId: string;
  decision: "approved" | "rejected";
  reason: string | null;
  decidedBy: string;
  decidedAt: Date;
  createdAt: Date;
};

export type AgentRuntimeUsageRecord = {
  id: string;
  organizationId: string;
  workspaceId: string;
  runId: string;
  agentId: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  durationMs: number;
  costMicros: number;
  createdAt: Date;
};

export type AgentExecutionContext = {
  organizationId: string;
  workspaceId: string;
  agentId: string;
  runId: string;
  attemptId: string;
  actorUserId: string;
  configurationRevisionId: string;
  configuration: AgentBuilderFullConfig;
  abortSignal: AbortSignal;
};

export type AgentRunInput = {
  organizationId: string;
  workspaceId: string;
  agentId: string;
  userId: string;
  conversationId?: string;
  input: JsonRecord;
  executionMode?: "manual" | "scheduled" | "api" | "workflow";
  idempotencyKey?: string;
  metadata?: JsonRecord;
  priority?: number;
};

export type AgentRunOutput = {
  status: "completed" | "failed" | "awaiting_approval" | "cancelled";
  output?: JsonRecord;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  approvalRequestId?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    durationMs: number;
    costMicros: number;
  };
};

export type AgentRuntimePolicy = {
  maxConcurrentRunsPerOrg: number;
  defaultLeaseDurationSeconds: number;
  heartbeatIntervalSeconds: number;
  maxAttempts: number;
  inputSizeLimitBytes: number;
  outputSizeLimitBytes: number;
  executionTimeoutSeconds: number;
};

export class AgentRuntimeError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly details?: unknown;

  constructor(code: string, message: string, retryable = false, details?: unknown) {
    super(message);
    this.name = "AgentRuntimeError";
    this.code = code;
    this.retryable = retryable;
    this.details = details;
  }
}

export type RuntimeMonitoringMetrics = {
  queueDepth: number;
  activeRunningRuns: number;
  awaitingApprovalCount: number;
  completedLast24h: number;
  failedLast24h: number;
  averageLatencyMs: number;
  totalTokensLast24h: number;
  totalCostMicrosLast24h: number;
  successRatePercentage: number;
};

