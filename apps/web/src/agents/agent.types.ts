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

export interface AgentInstance {
  id: string;
  organizationId: string;
  agentTemplateId: string;
  name: string;
  status: AgentLifecycleStatus;
  configuration: Record<string, any>;
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
