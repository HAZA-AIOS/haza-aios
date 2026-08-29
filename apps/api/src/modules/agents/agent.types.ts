export type AgentLifecycleStatus = "draft" | "available" | "configured" | "active" | "paused" | "disabled" | "archived";

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
