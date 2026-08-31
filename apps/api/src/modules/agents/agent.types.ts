export type AgentLifecycleStatus =
  "draft" | "available" | "configured" | "active" | "paused" | "disabled" | "archived";

export type JsonRecord = Record<string, unknown>;

export type AgentCapability = {
  key: string;
  name: string;
  description: string;
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
  metadata: JsonRecord;
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
  createdBy: string;
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
};

export type UpdateAgentConfigurationInput = {
  organizationId: string;
  agentId: string;
  updatedBy: string;
  configuration: JsonRecord;
};

export type UpdateAgentStatusInput = {
  organizationId: string;
  agentId: string;
  status: "active" | "configured" | "paused" | "disabled" | "archived";
};

export type AgentRunStatus =
  "queued" | "running" | "waiting" | "completed" | "failed" | "cancelled";
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
