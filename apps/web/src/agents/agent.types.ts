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

export type AgentRunStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface AgentRun {
  id: string;
  organizationId: string;
  agentInstanceId: string;
  status: AgentRunStatus;
  input: any;
  output?: any;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  metadata?: Record<string, any>;
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
