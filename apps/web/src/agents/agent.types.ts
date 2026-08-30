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
  | "archived";

export interface AgentPermission {
  key: string;
  description: string;
}

export interface AgentCapability {
  key: "generate" | "summarize" | "classify" | "analyze" | "communicate" | "retrieve" | "transform" | "automate";
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
  version: string;
  category: AgentCategory;
  industry: string; // e.g. "education", "healthcare", "general"
  status: AgentLifecycleStatus;
  icon: string;
  capabilities: AgentCapability[];
  requiredPermissions: string[];
  configurationSchema: Record<string, any>;
  inputSchema: Record<string, any>;
  outputSchema: Record<string, any>;
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
  agentTemplateId: string;
  name: string;
  status: AgentLifecycleStatus;
  configuration: AgentConfiguration;
  enabled: boolean;
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

export type AgentRunStatus = "queued" | "running" | "waiting" | "completed" | "failed" | "cancelled";

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

export type MemoryScope = "user" | "agent" | "conversation" | "organization";

export interface Memory {
  id: string;
  organizationId: string;
  userId?: string;
  agentInstanceId?: string;
  conversationId?: string;
  scope: MemoryScope;
  type: string;
  content: string;
  status: "active" | "inactive" | "expired" | "deleted";
  source: string;
  importance?: number;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}
