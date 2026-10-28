export type AgentCategory =
  | "Productivity"
  | "Content"
  | "Communication"
  | "Analytics"
  | "Operations"
  | "Education"
  | "Sales"
  | "Marketing"
  | "Support"
  | "Document"
  | "Workflow";

export interface KnowledgeSource {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  type: "text" | "document" | "structured";
  status: "active" | "inactive" | "archived";
  visibility: "public" | "private" | "internal";
  metadata?: Record<string, any>;
  content?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContextPackage {
  organization?: Record<string, any>;
  user?: Record<string, any>;
  agent?: Record<string, any>;
  task?: Record<string, any>;
  conversation?: Record<string, any>;
  knowledge?: Record<string, any>[]; // Array of retrieved knowledge items
  memory?: Record<string, any>[];
  recentMessages?: Record<string, any>[];
  toolResults?: Record<string, any>[];
  metadata?: Record<string, any>;
}

export type AgentLifecycleStatus =
  | "draft"
  | "available"
  | "configured"
  | "active"
  | "paused"
  | "disabled"
  | "archived"
  | "suspended";

export interface HumanApprovalPolicy {
  required: boolean;
  approverRoles: string[];
  escalationTimeoutHours?: number;
  fallbackAction?: "deny" | "escalate";
  sensitiveCapabilities?: string[];
}

export interface AgentAuditEvent {
  id: string;
  organizationId: string;
  workspaceId: string | null;
  agentId: string;
  actorUserId: string | null;
  action: string;
  operation: string;
  result: "success" | "failure" | "denied";
  beforeSnapshot: Record<string, unknown> | null;
  afterSnapshot: Record<string, unknown> | null;
  changedFields: string[] | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AiModelInfo {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  maxOutputTokens: number;
  capabilities: string[];
}

export interface AiProviderInfo {
  id: string;
  name: string;
  version: string;
  isDefault: boolean;
  models: AiModelInfo[];
}

export interface AgentPermission {
  key: string;
  description: string;
}

export interface AgentCapability {
  key:
    | "generate"
    | "summarize"
    | "classify"
    | "analyze"
    | "communicate"
    | "retrieve"
    | "transform"
    | "automate";
  name: string;
  description: string;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  category: string;
  inputSchema: Record<string, any>;
  outputSchema: Record<string, any>;
  permissions: string[];
  status: "active" | "inactive" | "deprecated";
}

export interface AgentTemplate {
  id: string;
  name: string;
  slug: string;
  description: string;
  summary?: string | null;
  version: string;
  latestVersion?: string;
  category: AgentCategory;
  industry: string; // e.g. "education", "healthcare", "general"
  status: AgentLifecycleStatus;
  icon: string;
  capabilities: AgentCapability[];
  requiredPermissions: string[];
  configurationSchema: Record<string, any>;
  inputSchema: Record<string, any>;
  outputSchema: Record<string, any>;
  defaultApprovalPolicy?: HumanApprovalPolicy | null;
  publisherType?: "platform" | "organization" | "developer";
  publisherOrganizationId?: string | null;
  visibility?: "platform" | "private_organization" | "approved_shared";
  publishingStatus?: "draft" | "submitted" | "under_review" | "approved" | "rejected" | "published" | "deprecated" | "withdrawn";
  reviewNotes?: string | null;
  publishedAt?: string | null;
  tools: Tool[];
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentInputDefinition {
  id: string;
  name: string;
  label: string;
  description: string;
  type: "Text" | "Number" | "Boolean" | "Date" | "Select" | "File" | "Object";
  required: boolean;
  defaultValue?: any;
  validation?: string;
  source?: string;
}

export interface AgentOutputDefinition {
  id: string;
  name: string;
  description: string;
  type: string;
  format: "Text" | "JSON" | "Table" | "File" | "Structured data";
  required: boolean;
  destinationFoundation?: string;
}

export interface AgentBehaviorConfig {
  tone: string;
  formality: string;
  creativity: number;
  responseLength: string;
  language: string;
  communicationStyle: string;
}

export interface AgentMemoryConfig {
  enabled: boolean;
  conversationContext: boolean;
  persistentMemory: boolean;
  organizationKnowledgeFoundation: boolean;
}

export interface AgentModelConfig {
  provider: string;
  modelSelection: string;
  responseQuality: string;
  temperature: number;
  tokenLimits: number;
}

export interface AgentNotificationConfig {
  inApp: boolean;
  email: boolean;
  onSuccess: boolean;
  onFailure: boolean;
  requireApproval: boolean;
}

export interface AgentAdvancedConfig {
  executionLimits: number;
  timeoutSeconds: number;
  retryCount: number;
  loggingLevel: string;
  debugMode: boolean;
}

export interface AgentConfiguration {
  version: string;
  general: {
    description: string;
  };
  instructions: {
    systemInstructions: string;
    objectives: string;
    constraints: string;
    responseStyle: string;
  };
  behavior: AgentBehaviorConfig;
  inputs: AgentInputDefinition[];
  outputs: AgentOutputDefinition[];
  tools: string[]; // List of authorized tool IDs
  knowledge: string[]; // List of authorized Knowledge Source IDs
  model: AgentModelConfig;
  memory: AgentMemoryConfig;
  notifications: AgentNotificationConfig;
  advanced: AgentAdvancedConfig;
  updatedBy?: string;
}

export interface AgentInstance {
  id: string;
  organizationId: string;
  workspaceId?: string;
  agentTemplateId: string;
  agentKey?: string;
  name: string;
  description?: string;
  status: AgentLifecycleStatus;
  configuration: AgentConfiguration;
  enabled: boolean;
  instructions?: string;
  modelProvider?: string;
  modelSelection?: string;
  humanApprovalPolicy?: HumanApprovalPolicy | null;
  installedVersion?: string;
  templateVersionId?: string | null;
  installedFromMarketplace?: boolean;
  latestTemplateVersion?: string;
  isUpgradeAvailable?: boolean;
  tools?: Array<{ id: string; toolKey: string; status: string }>;
  createdAt: string;
  updatedAt: string;
}

export type AgentExecutionMode = "manual" | "api" | "workflow" | "scheduled" | "event";

export interface AgentExecutionRequest {
  agentInstanceId: string;
  organizationId: string;
  conversationId?: string;
  input: any;
  context?: Record<string, any>;
  requestedBy: string;
  executionMode: AgentExecutionMode;
  metadata?: Record<string, any>;
}

export type AgentRunStatus =
  "queued" | "running" | "waiting" | "completed" | "failed" | "cancelled";

export interface AgentRun {
  id: string;
  organizationId: string;
  agentInstanceId: string;
  status: AgentRunStatus;
  input: any;
  output?: any;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  duration?: number; // in milliseconds
  requestedBy?: string;
  metadata?: Record<string, any>;
}

export type AgentRuntimeErrorCategory =
  | "AuthenticationError"
  | "AuthorizationError"
  | "AgentNotFoundError"
  | "AgentInactiveError"
  | "ConfigurationError"
  | "ToolPermissionError"
  | "ToolExecutionError"
  | "ModelProviderError"
  | "TimeoutError"
  | "ValidationError"
  | "RuntimeError";

export interface AgentRuntimeError {
  category: AgentRuntimeErrorCategory;
  message: string;
  code?: string;
  details?: any;
}

export interface MemoryContext {
  id: string;
  organizationId: string;
  agentInstanceId: string;
  type: "short_term" | "persistent";
  context: any;
  createdAt: string;
  updatedAt: string;
}

export interface EventTrigger {
  id: string;
  type: "manual" | "scheduled" | "event" | "webhook" | "workflow";
  config: Record<string, any>;
}

// --- EPIC 18: Conversation & Memory Models ---

export type ConversationStatus = "active" | "archived" | "deleted";

export interface Conversation {
  id: string;
  organizationId: string;
  userId: string;
  agentInstanceId: string;
  title: string;
  status: ConversationStatus;
  createdAt: string;
  updatedAt: string;
}

export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export type MemoryScope = "user" | "agent" | "conversation" | "workspace" | "organization";

export interface Memory {
  id: string;
  organizationId: string;
  userId?: string;
  agentInstanceId?: string;
  conversationId?: string;
  scope: MemoryScope;
  type: string;
  content: string;
  status: "active" | "inactive" | "expired" | "archived" | "deleted";
  source: string;
  sourceRunId?: string;
  sourceConversationId?: string;
  sourceMessageId?: string;
  metadata?: Record<string, unknown>;
  importance?: number;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

// --- Epic 12 Marketplace DTOs ---

export interface MarketplaceCatalogItem {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  description: string;
  latestVersion: string;
  category: string;
  industry: string;
  icon: string;
  publisherType: "platform" | "organization" | "developer";
  publisherOrganizationId: string | null;
  publisherOrganizationName: string | null;
  visibility: "platform" | "private_organization" | "approved_shared";
  publishingStatus: "draft" | "submitted" | "under_review" | "approved" | "rejected" | "published" | "deprecated" | "withdrawn";
  capabilities: Array<{ key?: string; name?: string; description?: string }>;
  publishedAt: string | null;
}

export interface AgentTemplateVersion {
  id: string;
  templateId: string;
  version: string;
  name: string;
  description: string;
  instructions: string | null;
  configurationSchema: Record<string, any>;
  inputSchema: Record<string, any>;
  outputSchema: Record<string, any>;
  capabilities: Array<{ key?: string; name?: string; description?: string }>;
  requiredPermissions: string[];
  defaultApprovalPolicy?: HumanApprovalPolicy | null;
  changelog: string | null;
  status: string;
  reviewNotes: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MarketplaceAgentProfile {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  description: string;
  category: string;
  industry: string;
  icon: string;
  publisherType: "platform" | "organization" | "developer";
  publisherOrganizationId: string | null;
  publisherOrganizationName: string | null;
  visibility: "platform" | "private_organization" | "approved_shared";
  publishingStatus: string;
  reviewNotes: string | null;
  publishedAt: string | null;
  versions: AgentTemplateVersion[];
  activeVersion: AgentTemplateVersion;
  installedInstance: {
    id: string;
    name: string;
    status: string;
    installedVersion: string;
    isUpgradeAvailable: boolean;
    latestVersion: string;
    installedAt: string;
  } | null;
}

export interface InstalledAgentItem {
  agentDefinitionId: string;
  agentName: string;
  agentKey: string;
  status: string;
  enabled: boolean;
  workspaceId: string;
  templateId: string;
  templateName: string;
  templateSlug: string;
  category: string;
  industry: string;
  icon: string;
  publisherType: string;
  installedVersion: string;
  latestTemplateVersion: string;
  isUpgradeAvailable: boolean;
  installedAt: string;
  installationId: string;
}

export interface MarketplaceAnalytics {
  publishedAgentsCount: number;
  totalInstallationsCount: number;
  activeInstallationsCount: number;
  pendingReviewsCount: number;
  agentsByIndustry: Record<string, number>;
  agentsByCategory: Record<string, number>;
  versionAdoptionCounts: Record<string, number>;
}

export interface MarketplaceReviewSubmission {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  description: string;
  category: string;
  industry: string;
  publisherType: string;
  publisherOrganizationId: string | null;
  publisherOrganizationName: string | null;
  publisherUserId: string | null;
  publisherUserEmail: string | null;
  publishingStatus: string;
  reviewNotes: string | null;
  updatedAt: string;
}

