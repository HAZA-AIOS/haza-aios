import {
  boolean,
  char,
  datetime,
  foreignKey,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const organizationStatus = mysqlEnum("organization_status", [
  "active",
  "suspended",
  "archived",
]);
export const workspaceStatus = mysqlEnum("workspace_status", ["active", "archived"]);
export const workspaceType = mysqlEnum("workspace_type", ["primary", "general", "industry"]);
export const moduleStatus = mysqlEnum("organization_module_status", ["activated", "deactivated"]);
export const agentLifecycleStatus = mysqlEnum("agent_lifecycle_status", [
  "draft",
  "available",
  "configured",
  "active",
  "paused",
  "disabled",
  "archived",
]);
export const agentRunStatus = mysqlEnum("agent_run_status", [
  "queued",
  "running",
  "waiting",
  "completed",
  "failed",
  "cancelled",
]);
export const agentConversationStatus = mysqlEnum("agent_conversation_status", [
  "active",
  "archived",
  "deleted",
]);
export const agentMessageRole = mysqlEnum("agent_message_role", [
  "user",
  "assistant",
  "system",
  "tool",
]);
export const agentMemoryScope = mysqlEnum("agent_memory_scope", [
  "user",
  "agent",
  "conversation",
  "workspace",
  "organization",
]);
export const agentMemoryStatus = mysqlEnum("agent_memory_status", [
  "active",
  "archived",
  "deleted",
]);
export const workflowStatus = mysqlEnum("workflow_status", ["draft", "active", "archived"]);
export const workflowRunStatus = mysqlEnum("workflow_run_status", [
  "pending",
  "running",
  "waiting",
  "completed",
  "failed",
  "cancelled",
]);
export const workflowStepRunStatus = mysqlEnum("workflow_step_run_status", [
  "pending",
  "running",
  "completed",
  "failed",
  "skipped",
]);
export const workflowTaskStatus = mysqlEnum("workflow_task_status", [
  "pending",
  "assigned",
  "in_progress",
  "blocked",
  "waiting",
  "completed",
  "cancelled",
  "failed",
]);
export const membershipRole = mysqlEnum("organization_membership_role", [
  "Owner",
  "Admin",
  "Member",
]);
export const membershipStatus = mysqlEnum("organization_membership_status", [
  "active",
  "pending",
  "suspended",
]);
export const userStatus = mysqlEnum("user_status", [
  "active",
  "inactive",
  "suspended",
  "pending",
  "archived",
]);
export const roleScope = mysqlEnum("role_scope", ["platform", "organization"]);
export const sessionStatus = mysqlEnum("auth_session_status", ["active", "revoked", "expired"]);
export const securityEventSeverity = mysqlEnum("security_event_severity", [
  "info",
  "warning",
  "critical",
]);
export const auditResult = mysqlEnum("audit_result", ["success", "failure", "denied"]);
export const operationalEventSeverity = mysqlEnum("operational_event_severity", [
  "info",
  "warning",
  "error",
  "critical",
]);

export const internalDatabaseChecks = mysqlTable("internal_database_checks", {
  id: char("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
});

export const platformModules = mysqlTable(
  "platform_modules",
  {
    id: char("id", { length: 36 }).primaryKey(),
    key: varchar("module_key", { length: 120 }).notNull(),
    name: varchar("name", { length: 180 }).notNull(),
    description: varchar("description", { length: 1000 }).notNull(),
    category: varchar("category", { length: 80 }).notNull(),
    industry: varchar("industry", { length: 80 }).notNull(),
    version: varchar("version", { length: 80 }).notNull(),
    status: varchar("status", { length: 40 }).notNull().default("available"),
    isCore: boolean("is_core").notNull().default(false),
    metadata: json("metadata").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("platform_modules_key_unique").on(table.key),
    index("platform_modules_status_idx").on(table.status),
    index("platform_modules_industry_idx").on(table.industry),
  ],
);

export const aiAgentTemplates = mysqlTable(
  "ai_agent_templates",
  {
    id: char("id", { length: 36 }).primaryKey(),
    slug: varchar("slug", { length: 140 }).notNull(),
    name: varchar("name", { length: 180 }).notNull(),
    description: varchar("description", { length: 1000 }).notNull(),
    version: varchar("version", { length: 80 }).notNull(),
    category: varchar("category", { length: 80 }).notNull(),
    industry: varchar("industry", { length: 80 }).notNull(),
    status: agentLifecycleStatus.notNull().default("available"),
    icon: varchar("icon", { length: 80 }).notNull(),
    capabilities: json("capabilities").$type<Array<Record<string, unknown>>>().notNull(),
    requiredPermissions: json("required_permissions").$type<string[]>().notNull(),
    configurationSchema: json("configuration_schema").$type<Record<string, unknown>>().notNull(),
    inputSchema: json("input_schema").$type<Record<string, unknown>>().notNull(),
    outputSchema: json("output_schema").$type<Record<string, unknown>>().notNull(),
    metadata: json("metadata").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("ai_agent_templates_slug_unique").on(table.slug),
    index("ai_agent_templates_status_idx").on(table.status),
    index("ai_agent_templates_industry_idx").on(table.industry),
    index("ai_agent_templates_category_idx").on(table.category),
  ],
);

export const aiAgentDefinitions = mysqlTable(
  "ai_agent_definitions",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    templateId: char("template_id", { length: 36 }).references(() => aiAgentTemplates.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    agentKey: varchar("agent_key", { length: 160 }).notNull(),
    name: varchar("name", { length: 180 }).notNull(),
    description: varchar("description", { length: 1000 }).notNull(),
    status: agentLifecycleStatus.notNull().default("active"),
    enabled: boolean("enabled").notNull().default(true),
    instructions: text("instructions"),
    configuration: json("configuration").$type<Record<string, unknown>>().notNull(),
    modelProvider: varchar("model_provider", { length: 120 }).notNull(),
    modelSelection: varchar("model_selection", { length: 160 }).notNull(),
    createdBy: char("created_by", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict", onUpdate: "cascade" }),
    archivedAt: timestamp("archived_at", { fsp: 3 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("ai_agent_definitions_workspace_key_unique").on(table.workspaceId, table.agentKey),
    uniqueIndex("ai_agent_definitions_workspace_template_unique").on(
      table.workspaceId,
      table.templateId,
    ),
    index("ai_agent_definitions_org_status_idx").on(table.organizationId, table.status),
    index("ai_agent_definitions_workspace_status_idx").on(table.workspaceId, table.status),
    index("ai_agent_definitions_template_idx").on(table.templateId),
  ],
);

export const aiAgentToolAssignments = mysqlTable(
  "ai_agent_tool_assignments",
  {
    id: char("id", { length: 36 }).primaryKey(),
    agentId: char("agent_id", { length: 36 })
      .notNull()
      .references(() => aiAgentDefinitions.id, { onDelete: "restrict", onUpdate: "cascade" }),
    toolKey: varchar("tool_key", { length: 160 }).notNull(),
    status: varchar("status", { length: 40 }).notNull().default("active"),
    configuration: json("configuration").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("ai_agent_tool_assignments_agent_tool_unique").on(table.agentId, table.toolKey),
    index("ai_agent_tool_assignments_agent_status_idx").on(table.agentId, table.status),
  ],
);

export const aiAgentConversations = mysqlTable(
  "ai_agent_conversations",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    agentId: char("agent_id", { length: 36 })
      .notNull()
      .references(() => aiAgentDefinitions.id, { onDelete: "restrict", onUpdate: "cascade" }),
    userId: char("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict", onUpdate: "cascade" }),
    title: varchar("title", { length: 220 }).notNull(),
    status: agentConversationStatus.notNull().default("active"),
    lastMessageAt: datetime("last_message_at", { fsp: 3 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index("ai_agent_conversations_org_user_idx").on(table.organizationId, table.userId),
    index("ai_agent_conversations_workspace_agent_status_idx").on(
      table.workspaceId,
      table.agentId,
      table.status,
    ),
    index("ai_agent_conversations_last_message_idx").on(table.workspaceId, table.lastMessageAt),
  ],
);

export const aiAgentRuns = mysqlTable(
  "ai_agent_runs",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    agentId: char("agent_id", { length: 36 })
      .notNull()
      .references(() => aiAgentDefinitions.id, { onDelete: "restrict", onUpdate: "cascade" }),
    conversationId: char("conversation_id", { length: 36 }).references(
      () => aiAgentConversations.id,
      { onDelete: "restrict", onUpdate: "cascade" },
    ),
    requestedBy: char("requested_by", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict", onUpdate: "cascade" }),
    status: agentRunStatus.notNull().default("queued"),
    executionMode: varchar("execution_mode", { length: 40 }).notNull().default("manual"),
    idempotencyKey: varchar("idempotency_key", { length: 160 }),
    input: json("input").$type<Record<string, unknown>>().notNull(),
    output: json("output").$type<Record<string, unknown>>(),
    provider: varchar("provider", { length: 120 }),
    model: varchar("model", { length: 160 }),
    errorCode: varchar("error_code", { length: 120 }),
    safeErrorMessage: varchar("safe_error_message", { length: 1000 }),
    metadata: json("metadata").$type<Record<string, unknown>>().notNull(),
    startedAt: timestamp("started_at", { fsp: 3 }).notNull(),
    completedAt: datetime("completed_at", { fsp: 3 }),
    durationMs: int("duration_ms"),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("ai_agent_runs_idempotency_unique").on(
      table.workspaceId,
      table.agentId,
      table.idempotencyKey,
    ),
    index("ai_agent_runs_org_status_idx").on(table.organizationId, table.status),
    index("ai_agent_runs_workspace_agent_status_idx").on(
      table.workspaceId,
      table.agentId,
      table.status,
    ),
    index("ai_agent_runs_conversation_idx").on(table.conversationId),
    index("ai_agent_runs_requested_by_idx").on(table.requestedBy),
  ],
);

export const aiAgentMessages = mysqlTable(
  "ai_agent_messages",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    conversationId: char("conversation_id", { length: 36 })
      .notNull()
      .references(() => aiAgentConversations.id, { onDelete: "restrict", onUpdate: "cascade" }),
    agentRunId: char("agent_run_id", { length: 36 }).references(() => aiAgentRuns.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    role: agentMessageRole.notNull(),
    sequence: int("sequence").notNull(),
    content: text("content").notNull(),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("ai_agent_messages_conversation_sequence_unique").on(
      table.conversationId,
      table.sequence,
    ),
    index("ai_agent_messages_workspace_conversation_idx").on(
      table.workspaceId,
      table.conversationId,
    ),
    index("ai_agent_messages_run_idx").on(table.agentRunId),
    index("ai_agent_messages_role_idx").on(table.conversationId, table.role),
  ],
);

export const aiAgentMemories = mysqlTable(
  "ai_agent_memories",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    agentId: char("agent_id", { length: 36 })
      .notNull()
      .references(() => aiAgentDefinitions.id, { onDelete: "restrict", onUpdate: "cascade" }),
    userId: char("user_id", { length: 36 }).references(() => users.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    scope: agentMemoryScope.notNull().default("user"),
    type: varchar("type", { length: 80 }).notNull(),
    content: text("content").notNull(),
    status: agentMemoryStatus.notNull().default("active"),
    source: varchar("source", { length: 120 }).notNull().default("manual"),
    sourceRunId: char("source_run_id", { length: 36 }).references(() => aiAgentRuns.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    sourceConversationId: char("source_conversation_id", { length: 36 }).references(
      () => aiAgentConversations.id,
      { onDelete: "restrict", onUpdate: "cascade" },
    ),
    sourceMessageId: char("source_message_id", { length: 36 }).references(
      () => aiAgentMessages.id,
      { onDelete: "restrict", onUpdate: "cascade" },
    ),
    importance: int("importance").notNull().default(5),
    metadata: json("metadata").$type<Record<string, unknown>>().notNull(),
    createdBy: char("created_by", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict", onUpdate: "cascade" }),
    updatedBy: char("updated_by", { length: 36 }).references(() => users.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    expiresAt: datetime("expires_at", { fsp: 3 }),
    lastUsedAt: datetime("last_used_at", { fsp: 3 }),
    usageCount: int("usage_count").notNull().default(0),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index("ai_agent_memories_org_status_idx").on(table.organizationId, table.status),
    index("ai_agent_memories_workspace_scope_status_idx").on(
      table.workspaceId,
      table.scope,
      table.status,
    ),
    index("ai_agent_memories_agent_scope_status_idx").on(table.agentId, table.scope, table.status),
    index("ai_agent_memories_user_status_idx").on(table.userId, table.status),
    index("ai_agent_memories_source_run_idx").on(table.sourceRunId),
    index("ai_agent_memories_source_conversation_idx").on(table.sourceConversationId),
    index("ai_agent_memories_source_message_idx").on(table.sourceMessageId),
  ],
);

export const workflowDefinitions = mysqlTable(
  "workflow_definitions",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    agentId: char("agent_id", { length: 36 }).references(() => aiAgentDefinitions.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    name: varchar("name", { length: 180 }).notNull(),
    description: varchar("description", { length: 1000 }).notNull(),
    status: workflowStatus.notNull().default("draft"),
    version: varchar("version", { length: 40 }).notNull().default("1.0.0"),
    revision: int("revision").notNull().default(1),
    configuration: json("configuration").$type<Record<string, unknown>>().notNull(),
    createdBy: char("created_by", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict", onUpdate: "cascade" }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index("workflow_definitions_org_status_idx").on(table.organizationId, table.status),
    index("workflow_definitions_workspace_status_idx").on(table.workspaceId, table.status),
    index("workflow_definitions_agent_idx").on(table.agentId),
  ],
);

export const workflowSteps = mysqlTable(
  "workflow_steps",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict", onUpdate: "cascade" }),
    workflowId: char("workflow_id", { length: 36 })
      .notNull()
      .references(() => workflowDefinitions.id, { onDelete: "cascade", onUpdate: "cascade" }),
    name: varchar("name", { length: 180 }).notNull(),
    type: mysqlEnum("type", [
      "agent",
      "tool",
      "knowledge",
      "condition",
      "save",
      "notification",
    ]).notNull(),
    stepOrder: int("step_order").notNull(),
    revision: int("revision").notNull(),
    configuration: json("configuration").$type<Record<string, unknown>>().notNull(),
    timeoutSeconds: int("timeout_seconds"),
    maxAttempts: int("max_attempts").notNull().default(1),
    retryDelayMs: int("retry_delay_ms").notNull().default(1000),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("workflow_steps_workflow_revision_order_unique").on(
      table.workflowId,
      table.revision,
      table.stepOrder,
    ),
    index("workflow_steps_org_workflow_revision_idx").on(
      table.organizationId,
      table.workflowId,
      table.revision,
    ),
  ],
);

export const workflowRuns = mysqlTable(
  "workflow_runs",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    workflowId: char("workflow_id", { length: 36 })
      .notNull()
      .references(() => workflowDefinitions.id, { onDelete: "restrict", onUpdate: "cascade" }),
    workflowRevision: int("workflow_revision").notNull(),
    agentRunId: char("agent_run_id", { length: 36 }).references(() => aiAgentRuns.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    requestedBy: char("requested_by", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict", onUpdate: "cascade" }),
    status: workflowRunStatus.notNull().default("pending"),
    idempotencyKey: varchar("idempotency_key", { length: 160 }),
    input: json("input").$type<Record<string, unknown>>().notNull(),
    output: json("output").$type<Record<string, unknown>>(),
    executionContext: json("execution_context").$type<Record<string, unknown>>().notNull(),
    definitionSnapshot: json("definition_snapshot").$type<Record<string, unknown>>().notNull(),
    stepsSnapshot: json("steps_snapshot").$type<Array<Record<string, unknown>>>().notNull(),
    executionAuthority: varchar("execution_authority", { length: 40 })
      .notNull()
      .default("client_reported"),
    currentStepId: char("current_step_id", { length: 36 }).references(() => workflowSteps.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    safeErrorMessage: varchar("safe_error_message", { length: 1000 }),
    startedAt: datetime("started_at", { fsp: 3 }),
    completedAt: datetime("completed_at", { fsp: 3 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("workflow_runs_idempotency_unique").on(
      table.workspaceId,
      table.workflowId,
      table.idempotencyKey,
    ),
    index("workflow_runs_org_status_idx").on(table.organizationId, table.status),
    index("workflow_runs_workspace_workflow_status_idx").on(
      table.workspaceId,
      table.workflowId,
      table.status,
    ),
    index("workflow_runs_requested_by_idx").on(table.requestedBy),
    index("workflow_runs_agent_run_idx").on(table.agentRunId),
  ],
);

export const workflowStepRuns = mysqlTable(
  "workflow_step_runs",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict", onUpdate: "cascade" }),
    workflowRunId: char("workflow_run_id", { length: 36 })
      .notNull()
      .references(() => workflowRuns.id, { onDelete: "cascade", onUpdate: "cascade" }),
    workflowStepId: char("workflow_step_id", { length: 36 })
      .notNull()
      .references(() => workflowSteps.id, { onDelete: "restrict", onUpdate: "cascade" }),
    status: workflowStepRunStatus.notNull().default("pending"),
    attempt: int("attempt").notNull().default(1),
    input: json("input").$type<Record<string, unknown>>().notNull(),
    output: json("output").$type<Record<string, unknown>>(),
    metadata: json("metadata").$type<Record<string, unknown>>().notNull(),
    safeErrorMessage: varchar("safe_error_message", { length: 1000 }),
    reportedBy: char("reported_by", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict", onUpdate: "cascade" }),
    startedAt: datetime("started_at", { fsp: 3 }),
    completedAt: datetime("completed_at", { fsp: 3 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("workflow_step_runs_run_step_attempt_unique").on(
      table.workflowRunId,
      table.workflowStepId,
      table.attempt,
    ),
    index("workflow_step_runs_org_status_idx").on(table.organizationId, table.status),
  ],
);

export const workflowTasks = mysqlTable(
  "workflow_tasks",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    workflowRunId: char("workflow_run_id", { length: 36 })
      .notNull()
      .references(() => workflowRuns.id, { onDelete: "cascade", onUpdate: "cascade" }),
    workflowStepId: char("workflow_step_id", { length: 36 })
      .notNull()
      .references(() => workflowSteps.id, { onDelete: "restrict", onUpdate: "cascade" }),
    title: varchar("title", { length: 220 }).notNull(),
    description: varchar("description", { length: 1000 }).notNull(),
    type: varchar("type", { length: 80 }).notNull().default("manual"),
    priority: varchar("priority", { length: 40 }).notNull().default("normal"),
    status: workflowTaskStatus.notNull().default("pending"),
    assignedUserId: char("assigned_user_id", { length: 36 }).references(() => users.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    assignedRole: varchar("assigned_role", { length: 120 }),
    assignedAgentId: char("assigned_agent_id", { length: 36 }).references(
      () => aiAgentDefinitions.id,
      {
        onDelete: "restrict",
        onUpdate: "cascade",
      },
    ),
    input: json("input").$type<Record<string, unknown>>().notNull(),
    output: json("output").$type<Record<string, unknown>>(),
    metadata: json("metadata").$type<Record<string, unknown>>().notNull(),
    dueAt: datetime("due_at", { fsp: 3 }),
    startedAt: datetime("started_at", { fsp: 3 }),
    completedAt: datetime("completed_at", { fsp: 3 }),
    createdBy: char("created_by", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict", onUpdate: "cascade" }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index("workflow_tasks_org_status_idx").on(table.organizationId, table.status),
    index("workflow_tasks_workspace_assignee_idx").on(
      table.workspaceId,
      table.assignedUserId,
      table.status,
    ),
    index("workflow_tasks_run_step_idx").on(table.workflowRunId, table.workflowStepId),
    index("workflow_tasks_agent_idx").on(table.assignedAgentId),
  ],
);
export const organizations = mysqlTable(
  "organizations",
  {
    id: char("id", { length: 36 }).primaryKey(),
    name: varchar("name", { length: 180 }).notNull(),
    legalName: varchar("legal_name", { length: 220 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    description: varchar("description", { length: 1000 }),
    industry: varchar("industry", { length: 80 }).notNull(),
    organizationType: varchar("organization_type", { length: 80 }).notNull(),
    website: varchar("website", { length: 255 }),
    email: varchar("email", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 80 }),
    country: varchar("country", { length: 120 }).notNull(),
    timezone: varchar("timezone", { length: 80 }).notNull().default("UTC"),
    currency: char("currency", { length: 3 }).notNull().default("USD"),
    status: organizationStatus.notNull().default("active"),
    ownerId: varchar("owner_id", { length: 120 }).notNull(),
    archivedAt: timestamp("archived_at", { fsp: 3 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("organizations_slug_unique").on(table.slug),
    index("organizations_status_idx").on(table.status),
  ],
);

export const users = mysqlTable(
  "users",
  {
    id: char("id", { length: 36 }).primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    normalizedEmail: varchar("normalized_email", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    firstName: varchar("first_name", { length: 120 }).notNull(),
    lastName: varchar("last_name", { length: 120 }).notNull(),
    displayName: varchar("display_name", { length: 240 }).notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    status: userStatus.notNull().default("active"),
    lastLoginAt: datetime("last_login_at", { fsp: 3 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("users_normalized_email_unique").on(table.normalizedEmail),
    index("users_status_idx").on(table.status),
  ],
);

export const tenantDomainStatus = mysqlEnum("tenant_domain_status", [
  "pending_verification",
  "verified",
  "provisioning",
  "active",
  "failed",
  "disabled",
]);

export const tenantDomains = mysqlTable(
  "tenant_domains",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict", onUpdate: "cascade" }),
    domain: varchar("domain", { length: 255 }).notNull(),
    verificationToken: varchar("verification_token", { length: 128 }),
    status: tenantDomainStatus.notNull().default("pending_verification"),
    verifiedAt: timestamp("verified_at", { fsp: 3 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("tenant_domains_domain_unique").on(table.domain),
    index("tenant_domains_org_idx").on(table.organizationId),
  ],
);

export const workspaces = mysqlTable(
  "workspaces",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict", onUpdate: "cascade" }),
    name: varchar("name", { length: 180 }).notNull(),
    code: varchar("code", { length: 80 }).notNull(),
    type: workspaceType.notNull().default("primary"),
    status: workspaceStatus.notNull().default("active"),
    archivedAt: timestamp("archived_at", { fsp: 3 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("workspaces_org_code_unique").on(table.organizationId, table.code),
    index("workspaces_org_status_idx").on(table.organizationId, table.status),
  ],
);

export const organizationSettings = mysqlTable(
  "organization_settings",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict", onUpdate: "cascade" }),
    timezone: varchar("timezone", { length: 80 }).notNull().default("UTC"),
    locale: varchar("locale", { length: 20 }).notNull().default("en"),
    currency: char("currency", { length: 3 }).notNull().default("USD"),
    preferences: json("preferences").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [uniqueIndex("organization_settings_org_unique").on(table.organizationId)],
);

export const organizationModules = mysqlTable(
  "organization_modules",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict", onUpdate: "cascade" }),
    moduleKey: varchar("module_key", { length: 120 })
      .notNull()
      .references(() => platformModules.key, { onDelete: "restrict", onUpdate: "cascade" }),
    status: moduleStatus.notNull().default("activated"),
    enabled: boolean("enabled").notNull().default(true),
    settings: json("settings").$type<Record<string, unknown>>(),
    activatedAt: timestamp("activated_at", { fsp: 3 }).notNull().defaultNow(),
    activatedBy: varchar("activated_by", { length: 120 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("organization_modules_org_key_unique").on(table.organizationId, table.moduleKey),
    index("organization_modules_org_status_idx").on(table.organizationId, table.status),
  ],
);

export const organizationMemberships = mysqlTable(
  "organization_memberships",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict", onUpdate: "cascade" }),
    userId: varchar("user_id", { length: 120 }).notNull(),
    role: membershipRole.notNull().default("Owner"),
    status: membershipStatus.notNull().default("active"),
    joinedAt: timestamp("joined_at", { fsp: 3 }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("organization_memberships_org_user_unique").on(table.organizationId, table.userId),
    index("organization_memberships_user_status_idx").on(table.userId, table.status),
  ],
);

export const permissions = mysqlTable(
  "permissions",
  {
    id: char("id", { length: 36 }).primaryKey(),
    key: varchar("permission_key", { length: 120 }).notNull(),
    description: varchar("description", { length: 500 }).notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [uniqueIndex("permissions_key_unique").on(table.key)],
);

export const roles = mysqlTable(
  "roles",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 }).references(() => organizations.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    name: varchar("name", { length: 120 }).notNull(),
    scope: roleScope.notNull().default("organization"),
    systemKey: varchar("system_key", { length: 120 }),
    description: varchar("description", { length: 500 }).notNull(),
    isSystem: boolean("is_system").notNull().default(false),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("roles_org_name_unique").on(table.organizationId, table.name),
    uniqueIndex("roles_system_key_unique").on(table.systemKey),
    index("roles_scope_idx").on(table.scope),
  ],
);

export const rolePermissions = mysqlTable(
  "role_permissions",
  {
    id: char("id", { length: 36 }).primaryKey(),
    roleId: char("role_id", { length: 36 })
      .notNull()
      .references(() => roles.id, { onDelete: "restrict", onUpdate: "cascade" }),
    permissionId: char("permission_id", { length: 36 })
      .notNull()
      .references(() => permissions.id, { onDelete: "restrict", onUpdate: "cascade" }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("role_permissions_role_permission_unique").on(table.roleId, table.permissionId),
  ],
);

export const membershipRoles = mysqlTable(
  "membership_roles",
  {
    id: char("id", { length: 36 }).primaryKey(),
    membershipId: char("membership_id", { length: 36 })
      .notNull()
      .references(() => organizationMemberships.id, { onDelete: "restrict", onUpdate: "cascade" }),
    roleId: char("role_id", { length: 36 })
      .notNull()
      .references(() => roles.id, { onDelete: "restrict", onUpdate: "cascade" }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("membership_roles_membership_role_unique").on(table.membershipId, table.roleId),
  ],
);

export const workspaceMemberships = mysqlTable(
  "workspace_memberships",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    organizationMembershipId: char("organization_membership_id", { length: 36 })
      .notNull()
      .references(() => organizationMemberships.id, { onDelete: "restrict", onUpdate: "cascade" }),
    status: membershipStatus.notNull().default("active"),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("workspace_memberships_workspace_membership_unique").on(
      table.workspaceId,
      table.organizationMembershipId,
    ),
  ],
);

export const authSessions = mysqlTable(
  "auth_sessions",
  {
    id: char("id", { length: 36 }).primaryKey(),
    userId: char("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict", onUpdate: "cascade" }),
    tokenHash: char("token_hash", { length: 64 }).notNull(),
    status: sessionStatus.notNull().default("active"),
    rememberMe: boolean("remember_me").notNull().default(false),
    expiresAt: datetime("expires_at", { fsp: 3 }).notNull(),
    revokedAt: datetime("revoked_at", { fsp: 3 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("auth_sessions_token_hash_unique").on(table.tokenHash),
    index("auth_sessions_user_status_idx").on(table.userId, table.status),
  ],
);

export const securityEvents = mysqlTable(
  "security_events",
  {
    id: char("id", { length: 36 }).primaryKey(),
    userId: char("user_id", { length: 36 }),
    organizationId: char("organization_id", { length: 36 }),
    eventType: varchar("event_type", { length: 120 }).notNull(),
    severity: securityEventSeverity.notNull().default("info"),
    ipAddress: varchar("ip_address", { length: 80 }),
    userAgent: text("user_agent"),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("security_events_user_idx").on(table.userId),
    index("security_events_org_idx").on(table.organizationId),
    index("security_events_type_idx").on(table.eventType),
  ],
);

export const passwordResetTokens = mysqlTable(
  "password_reset_tokens",
  {
    id: char("id", { length: 36 }).primaryKey(),
    userId: char("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    tokenHash: char("token_hash", { length: 64 }).notNull(),
    expiresAt: datetime("expires_at", { fsp: 3 }).notNull(),
    usedAt: datetime("used_at", { fsp: 3 }),
    ipAddress: varchar("ip_address", { length: 80 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("password_reset_tokens_hash_unique").on(table.tokenHash),
    index("password_reset_tokens_user_idx").on(table.userId),
  ],
);

export const auditLogs = mysqlTable(
  "audit_logs",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 }).references(() => workspaces.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    actorType: varchar("actor_type", { length: 40 }).notNull().default("user"),
    actorUserId: char("actor_user_id", { length: 36 }).references(() => users.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    action: varchar("action", { length: 160 }).notNull(),
    resourceType: varchar("resource_type", { length: 120 }).notNull(),
    resourceId: varchar("resource_id", { length: 160 }),
    operation: varchar("operation", { length: 40 }).notNull(),
    result: auditResult.notNull().default("success"),
    source: varchar("source", { length: 120 }).notNull().default("api"),
    requestId: varchar("request_id", { length: 128 }),
    correlationId: varchar("correlation_id", { length: 128 }),
    ipAddress: varchar("ip_address", { length: 80 }),
    userAgent: varchar("user_agent", { length: 500 }),
    beforeSnapshot: json("before_snapshot").$type<Record<string, unknown>>(),
    afterSnapshot: json("after_snapshot").$type<Record<string, unknown>>(),
    changedFields: json("changed_fields").$type<string[]>(),
    metadata: json("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_logs_org_created_idx").on(table.organizationId, table.createdAt),
    index("audit_logs_workspace_created_idx").on(table.workspaceId, table.createdAt),
    index("audit_logs_actor_created_idx").on(table.actorUserId, table.createdAt),
    index("audit_logs_resource_created_idx").on(
      table.organizationId,
      table.resourceType,
      table.resourceId,
      table.createdAt,
    ),
    index("audit_logs_action_result_idx").on(
      table.organizationId,
      table.action,
      table.result,
      table.createdAt,
    ),
    index("audit_logs_correlation_idx").on(table.correlationId),
  ],
);

export const domainEvents = mysqlTable(
  "domain_events",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 }).references(() => workspaces.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    eventType: varchar("event_type", { length: 160 }).notNull(),
    aggregateType: varchar("aggregate_type", { length: 120 }).notNull(),
    aggregateId: varchar("aggregate_id", { length: 160 }).notNull(),
    actorUserId: char("actor_user_id", { length: 36 }).references(() => users.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    schemaVersion: int("schema_version").notNull().default(1),
    payload: json("payload").$type<Record<string, unknown>>().notNull().default({}),
    metadata: json("metadata").$type<Record<string, unknown>>().notNull().default({}),
    correlationId: varchar("correlation_id", { length: 128 }),
    causationId: char("causation_id", { length: 36 }),
    idempotencyKey: varchar("idempotency_key", { length: 160 }),
    occurredAt: timestamp("occurred_at", { fsp: 3 }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("domain_events_org_idempotency_unique").on(
      table.organizationId,
      table.idempotencyKey,
    ),
    index("domain_events_org_type_occurred_idx").on(
      table.organizationId,
      table.eventType,
      table.occurredAt,
    ),
    index("domain_events_workspace_occurred_idx").on(table.workspaceId, table.occurredAt),
    index("domain_events_aggregate_idx").on(
      table.organizationId,
      table.aggregateType,
      table.aggregateId,
    ),
    index("domain_events_correlation_idx").on(table.correlationId),
  ],
);

export const operationalEvents = mysqlTable(
  "operational_events",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 }).references(() => workspaces.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    severity: operationalEventSeverity.notNull().default("info"),
    component: varchar("component", { length: 120 }).notNull(),
    eventType: varchar("event_type", { length: 160 }).notNull(),
    status: varchar("status", { length: 40 }).notNull(),
    resourceType: varchar("resource_type", { length: 120 }),
    resourceId: varchar("resource_id", { length: 160 }),
    workflowRunId: char("workflow_run_id", { length: 36 }).references(() => workflowRuns.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    agentRunId: char("agent_run_id", { length: 36 }).references(() => aiAgentRuns.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    correlationId: varchar("correlation_id", { length: 128 }),
    summary: varchar("summary", { length: 500 }).notNull(),
    safeErrorCode: varchar("safe_error_code", { length: 120 }),
    safeErrorMessage: varchar("safe_error_message", { length: 1000 }),
    metadata: json("metadata").$type<Record<string, unknown>>().notNull().default({}),
    occurredAt: timestamp("occurred_at", { fsp: 3 }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("operational_events_org_severity_idx").on(
      table.organizationId,
      table.severity,
      table.occurredAt,
    ),
    index("operational_events_workspace_status_idx").on(
      table.workspaceId,
      table.status,
      table.occurredAt,
    ),
    index("operational_events_component_type_idx").on(
      table.organizationId,
      table.component,
      table.eventType,
      table.occurredAt,
    ),
    index("operational_events_resource_idx").on(
      table.organizationId,
      table.resourceType,
      table.resourceId,
    ),
    index("operational_events_workflow_run_idx").on(table.workflowRunId),
    index("operational_events_agent_run_idx").on(table.agentRunId),
    index("operational_events_correlation_idx").on(table.correlationId),
  ],
);

export const academicYearStatus = mysqlEnum("academic_year_status", [
  "planned",
  "active",
  "completed",
  "archived",
]);
export const academicTermStatus = mysqlEnum("academic_term_status", [
  "planned",
  "active",
  "completed",
]);
export const academicEntityStatus = mysqlEnum("academic_entity_status", ["active", "inactive"]);
export const studentStatus = mysqlEnum("student_status", [
  "applicant",
  "active",
  "inactive",
  "withdrawn",
  "graduated",
  "transferred",
  "archived",
]);
export const gender = mysqlEnum("gender", ["male", "female", "other", "prefer_not_to_say"]);
export const guardianRelationship = mysqlEnum("guardian_relationship", [
  "father",
  "mother",
  "guardian",
  "other",
]);
export const enrollmentStatus = mysqlEnum("enrollment_status", [
  "active",
  "completed",
  "dropped",
  "transferred",
]);
export const staffType = mysqlEnum("staff_type", [
  "teacher",
  "administrator",
  "coordinator",
  "accountant",
  "counselor",
  "librarian",
  "it_staff",
  "support_staff",
  "other",
]);
export const staffStatus = mysqlEnum("staff_status", [
  "active",
  "inactive",
  "on_leave",
  "suspended",
  "resigned",
  "terminated",
  "archived",
]);
export const employmentStatus = mysqlEnum("employment_status", [
  "full_time",
  "part_time",
  "contract",
  "temporary",
  "volunteer",
]);
export const attendanceStatus = mysqlEnum("attendance_status", [
  "present",
  "absent",
  "late",
  "excused",
]);
export const attendanceSessionType = mysqlEnum("attendance_session_type", [
  "daily",
  "period",
  "subject",
]);
export const attendanceSessionStatus = mysqlEnum("attendance_session_status", [
  "draft",
  "completed",
]);
export const periodType = mysqlEnum("period_type", ["teaching", "break", "activity"]);
export const examinationType = mysqlEnum("examination_type", [
  "monthly_test",
  "mid_term",
  "final_term",
  "annual",
  "entry_assessment",
  "other",
]);
export const examinationStatus = mysqlEnum("examination_status", [
  "draft",
  "scheduled",
  "in_progress",
  "completed",
  "published",
  "archived",
]);
export const assessmentType = mysqlEnum("assessment_type", [
  "class_test",
  "assignment",
  "quiz",
  "project",
  "practical",
  "oral",
  "other",
]);
export const assessmentStatus = mysqlEnum("assessment_status", [
  "draft",
  "assigned",
  "in_progress",
  "completed",
  "published",
  "archived",
]);
export const examSubjectStatus = mysqlEnum("exam_subject_status", [
  "draft",
  "scheduled",
  "completed",
  "cancelled",
]);
export const markSourceType = mysqlEnum("mark_source_type", ["examination", "assessment"]);
export const resultStatus = mysqlEnum("result_status", [
  "draft",
  "in_progress",
  "completed",
  "published",
  "archived",
]);

export const academicYears = mysqlTable(
  "academic_years",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    startDate: varchar("start_date", { length: 20 }).notNull(),
    endDate: varchar("end_date", { length: 20 }).notNull(),
    status: academicYearStatus.notNull().default("planned"),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("academic_years_workspace_name_unique").on(table.workspaceId, table.name),
    index("academic_years_workspace_status_idx").on(table.workspaceId, table.status),
  ],
);

export const academicTerms = mysqlTable(
  "academic_terms",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    academicYearId: char("academic_year_id", { length: 36 })
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict", onUpdate: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    startDate: varchar("start_date", { length: 20 }).notNull(),
    endDate: varchar("end_date", { length: 20 }).notNull(),
    status: academicTermStatus.notNull().default("planned"),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("academic_terms_year_name_unique").on(table.academicYearId, table.name),
    index("academic_terms_workspace_year_idx").on(table.workspaceId, table.academicYearId),
  ],
);

export const gradeLevels = mysqlTable(
  "grade_levels",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    level: int("level").notNull(),
    order: int("display_order").notNull(),
    status: academicEntityStatus.notNull().default("active"),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("grade_levels_workspace_name_unique").on(table.workspaceId, table.name),
    index("grade_levels_workspace_order_idx").on(table.workspaceId, table.order),
  ],
);

export const sections = mysqlTable(
  "sections",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    gradeId: char("grade_id", { length: 36 })
      .notNull()
      .references(() => gradeLevels.id, { onDelete: "restrict", onUpdate: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    capacity: int("capacity"),
    status: academicEntityStatus.notNull().default("active"),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("sections_grade_name_unique").on(table.gradeId, table.name),
    index("sections_workspace_grade_idx").on(table.workspaceId, table.gradeId),
  ],
);

export const subjects = mysqlTable(
  "subjects",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    code: varchar("code", { length: 60 }).notNull(),
    description: varchar("description", { length: 1000 }),
    status: academicEntityStatus.notNull().default("active"),
    displayOrder: int("display_order").notNull().default(0),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("subjects_workspace_code_unique").on(table.workspaceId, table.code),
    index("subjects_workspace_order_idx").on(table.workspaceId, table.displayOrder),
  ],
);

export const classSubjects = mysqlTable(
  "class_subjects",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    gradeId: char("grade_id", { length: 36 })
      .notNull()
      .references(() => gradeLevels.id, { onDelete: "restrict", onUpdate: "cascade" }),
    subjectId: char("subject_id", { length: 36 })
      .notNull()
      .references(() => subjects.id, { onDelete: "restrict", onUpdate: "cascade" }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("class_subjects_grade_subject_unique").on(table.gradeId, table.subjectId),
    index("class_subjects_workspace_grade_idx").on(table.workspaceId, table.gradeId),
  ],
);

export const staffDepartments = mysqlTable(
  "staff_departments",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    description: varchar("description", { length: 1000 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("staff_departments_workspace_name_unique").on(table.workspaceId, table.name),
  ],
);

export const staffMembers = mysqlTable(
  "staff_members",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    employeeNumber: varchar("employee_number", { length: 80 }).notNull(),
    userId: char("user_id", { length: 36 }).references(() => users.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    firstName: varchar("first_name", { length: 120 }).notNull(),
    middleName: varchar("middle_name", { length: 120 }),
    lastName: varchar("last_name", { length: 120 }).notNull(),
    preferredName: varchar("preferred_name", { length: 120 }),
    dateOfBirth: varchar("date_of_birth", { length: 20 }),
    gender: gender,
    phone: varchar("phone", { length: 80 }),
    email: varchar("email", { length: 255 }),
    address: varchar("address", { length: 1000 }),
    photoUrl: varchar("photo_url", { length: 1000 }),
    hireDate: varchar("hire_date", { length: 20 }).notNull(),
    staffType: staffType.notNull().default("teacher"),
    employmentStatus: employmentStatus.notNull().default("full_time"),
    status: staffStatus.notNull().default("active"),
    departmentId: char("department_id", { length: 36 }).references(() => staffDepartments.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    qualifications: text("qualifications"),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("staff_members_workspace_employee_unique").on(
      table.workspaceId,
      table.employeeNumber,
    ),
    index("staff_members_workspace_status_idx").on(table.workspaceId, table.status),
  ],
);

export const teachingAssignments = mysqlTable(
  "teaching_assignments",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    staffId: char("staff_id", { length: 36 })
      .notNull()
      .references(() => staffMembers.id, { onDelete: "restrict", onUpdate: "cascade" }),
    academicYear: varchar("academic_year", { length: 120 }).notNull(),
    gradeId: char("grade_id", { length: 36 })
      .notNull()
      .references(() => gradeLevels.id, { onDelete: "restrict", onUpdate: "cascade" }),
    sectionId: char("section_id", { length: 36 }).references(() => sections.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    subjectId: char("subject_id", { length: 36 })
      .notNull()
      .references(() => subjects.id, { onDelete: "restrict", onUpdate: "cascade" }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("teaching_assignments_unique").on(
      table.workspaceId,
      table.staffId,
      table.academicYear,
      table.gradeId,
      table.sectionId,
      table.subjectId,
    ),
    index("teaching_assignments_workspace_staff_idx").on(table.workspaceId, table.staffId),
  ],
);

export const students = mysqlTable(
  "students",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    userId: char("user_id", { length: 36 }).references(() => users.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    admissionNumber: varchar("admission_number", { length: 80 }).notNull(),
    studentNumber: varchar("student_number", { length: 80 }),
    firstName: varchar("first_name", { length: 120 }).notNull(),
    middleName: varchar("middle_name", { length: 120 }),
    lastName: varchar("last_name", { length: 120 }).notNull(),
    preferredName: varchar("preferred_name", { length: 120 }),
    dateOfBirth: varchar("date_of_birth", { length: 20 }).notNull(),
    gender: gender.notNull(),
    nationality: varchar("nationality", { length: 120 }),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 80 }),
    address: varchar("address", { length: 1000 }),
    photoUrl: varchar("photo_url", { length: 1000 }),
    admissionDate: varchar("admission_date", { length: 20 }).notNull(),
    status: studentStatus.notNull().default("applicant"),
    portalAccessEnabled: boolean("portal_access_enabled").notNull().default(false),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("students_workspace_admission_unique").on(table.workspaceId, table.admissionNumber),
    index("students_workspace_status_idx").on(table.workspaceId, table.status),
  ],
);

export const guardians = mysqlTable(
  "guardians",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    userId: char("user_id", { length: 36 }).references(() => users.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    firstName: varchar("first_name", { length: 120 }).notNull(),
    lastName: varchar("last_name", { length: 120 }).notNull(),
    relationship: guardianRelationship.notNull().default("guardian"),
    email: varchar("email", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 80 }).notNull(),
    address: varchar("address", { length: 1000 }),
    occupation: varchar("occupation", { length: 255 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [index("guardians_workspace_email_idx").on(table.workspaceId, table.email)],
);

export const studentGuardians = mysqlTable(
  "student_guardians",
  {
    id: char("id", { length: 36 }).primaryKey(),
    studentId: char("student_id", { length: 36 })
      .notNull()
      .references(() => students.id, { onDelete: "restrict", onUpdate: "cascade" }),
    guardianId: char("guardian_id", { length: 36 })
      .notNull()
      .references(() => guardians.id, { onDelete: "restrict", onUpdate: "cascade" }),
    isEmergencyContact: boolean("is_emergency_contact").notNull().default(false),
    isPrimaryContact: boolean("is_primary_contact").notNull().default(false),
    portalAccessEnabled: boolean("portal_access_enabled").notNull().default(false),
    authorizedForPortal: boolean("authorized_for_portal").notNull().default(false),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("student_guardians_student_guardian_unique").on(table.studentId, table.guardianId),
  ],
);

export const enrollments = mysqlTable(
  "enrollments",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    studentId: char("student_id", { length: 36 })
      .notNull()
      .references(() => students.id, { onDelete: "restrict", onUpdate: "cascade" }),
    academicYear: varchar("academic_year", { length: 120 }).notNull(),
    gradeId: char("grade_id", { length: 36 })
      .notNull()
      .references(() => gradeLevels.id, { onDelete: "restrict", onUpdate: "cascade" }),
    sectionId: char("section_id", { length: 36 })
      .notNull()
      .references(() => sections.id, { onDelete: "restrict", onUpdate: "cascade" }),
    enrollmentDate: varchar("enrollment_date", { length: 40 }).notNull(),
    status: enrollmentStatus.notNull().default("active"),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("enrollments_student_year_active_guard").on(
      table.studentId,
      table.academicYear,
      table.status,
    ),
    index("enrollments_workspace_student_idx").on(table.workspaceId, table.studentId),
    index("enrollments_workspace_class_idx").on(table.workspaceId, table.gradeId, table.sectionId),
  ],
);

export const attendanceSessions = mysqlTable(
  "attendance_sessions",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    academicYearId: char("academic_year_id", { length: 36 })
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict", onUpdate: "cascade" }),
    attendanceDate: varchar("attendance_date", { length: 20 }).notNull(),
    gradeId: char("grade_id", { length: 36 })
      .notNull()
      .references(() => gradeLevels.id, { onDelete: "restrict", onUpdate: "cascade" }),
    sectionId: char("section_id", { length: 36 })
      .notNull()
      .references(() => sections.id, { onDelete: "restrict", onUpdate: "cascade" }),
    subjectId: char("subject_id", { length: 36 }).references(() => subjects.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    teacherId: char("teacher_id", { length: 36 }).references(() => staffMembers.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    sessionType: attendanceSessionType.notNull().default("daily"),
    status: attendanceSessionStatus.notNull().default("draft"),
    markedBy: varchar("marked_by", { length: 120 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("attendance_sessions_scope_unique").on(
      table.workspaceId,
      table.academicYearId,
      table.attendanceDate,
      table.gradeId,
      table.sectionId,
      table.sessionType,
      table.subjectId,
    ),
    index("attendance_sessions_workspace_date_idx").on(table.workspaceId, table.attendanceDate),
    index("attendance_sessions_class_idx").on(
      table.workspaceId,
      table.academicYearId,
      table.gradeId,
      table.sectionId,
    ),
  ],
);

export const attendanceRecords = mysqlTable(
  "attendance_records",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    sessionId: char("session_id", { length: 36 })
      .notNull()
      .references(() => attendanceSessions.id, { onDelete: "restrict", onUpdate: "cascade" }),
    enrollmentId: char("enrollment_id", { length: 36 })
      .notNull()
      .references(() => enrollments.id, { onDelete: "restrict", onUpdate: "cascade" }),
    studentId: char("student_id", { length: 36 })
      .notNull()
      .references(() => students.id, { onDelete: "restrict", onUpdate: "cascade" }),
    status: attendanceStatus.notNull().default("present"),
    note: varchar("note", { length: 1000 }),
    markedAt: timestamp("marked_at", { fsp: 3 }).notNull().defaultNow(),
    markedBy: varchar("marked_by", { length: 120 }).notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("attendance_records_session_enrollment_unique").on(
      table.sessionId,
      table.enrollmentId,
    ),
    index("attendance_records_workspace_student_idx").on(table.workspaceId, table.studentId),
    index("attendance_records_session_idx").on(table.sessionId),
  ],
);

export const schoolSchedules = mysqlTable(
  "school_schedules",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    academicYearId: char("academic_year_id", { length: 36 })
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict", onUpdate: "cascade" }),
    workingDays: json("working_days").$type<number[]>().notNull(),
    scheduleStartTime: varchar("schedule_start_time", { length: 10 }).notNull(),
    scheduleEndTime: varchar("schedule_end_time", { length: 10 }).notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("school_schedules_workspace_year_unique").on(
      table.workspaceId,
      table.academicYearId,
    ),
  ],
);

export const timePeriods = mysqlTable(
  "time_periods",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    startTime: varchar("start_time", { length: 10 }).notNull(),
    endTime: varchar("end_time", { length: 10 }).notNull(),
    type: periodType.notNull().default("teaching"),
    displayOrder: int("display_order").notNull().default(0),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("time_periods_workspace_name_unique").on(table.workspaceId, table.name),
    index("time_periods_workspace_order_idx").on(table.workspaceId, table.displayOrder),
  ],
);

export const timetableEntries = mysqlTable(
  "timetable_entries",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    academicYearId: char("academic_year_id", { length: 36 })
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict", onUpdate: "cascade" }),
    termId: char("term_id", { length: 36 }).references(() => academicTerms.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    gradeId: char("grade_id", { length: 36 })
      .notNull()
      .references(() => gradeLevels.id, { onDelete: "restrict", onUpdate: "cascade" }),
    sectionId: char("section_id", { length: 36 })
      .notNull()
      .references(() => sections.id, { onDelete: "restrict", onUpdate: "cascade" }),
    subjectId: char("subject_id", { length: 36 })
      .notNull()
      .references(() => subjects.id, { onDelete: "restrict", onUpdate: "cascade" }),
    teacherId: char("teacher_id", { length: 36 })
      .notNull()
      .references(() => staffMembers.id, { onDelete: "restrict", onUpdate: "cascade" }),
    periodId: char("period_id", { length: 36 })
      .notNull()
      .references(() => timePeriods.id, { onDelete: "restrict", onUpdate: "cascade" }),
    roomId: varchar("room_id", { length: 120 }),
    dayOfWeek: int("day_of_week").notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("timetable_entries_class_slot_unique").on(
      table.workspaceId,
      table.academicYearId,
      table.gradeId,
      table.sectionId,
      table.dayOfWeek,
      table.periodId,
    ),
    uniqueIndex("timetable_entries_teacher_slot_unique").on(
      table.workspaceId,
      table.academicYearId,
      table.teacherId,
      table.dayOfWeek,
      table.periodId,
    ),
    uniqueIndex("timetable_entries_room_slot_unique").on(
      table.workspaceId,
      table.academicYearId,
      table.roomId,
      table.dayOfWeek,
      table.periodId,
    ),
    index("timetable_entries_workspace_teacher_idx").on(table.workspaceId, table.teacherId),
    index("timetable_entries_workspace_class_idx").on(
      table.workspaceId,
      table.gradeId,
      table.sectionId,
    ),
  ],
);

export const examinations = mysqlTable(
  "examinations",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    name: varchar("name", { length: 180 }).notNull(),
    academicYearId: char("academic_year_id", { length: 36 })
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict", onUpdate: "cascade" }),
    termId: char("term_id", { length: 36 }).references(() => academicTerms.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    type: examinationType.notNull().default("other"),
    startDate: varchar("start_date", { length: 20 }).notNull(),
    endDate: varchar("end_date", { length: 20 }).notNull(),
    status: examinationStatus.notNull().default("draft"),
    description: varchar("description", { length: 1000 }),
    publishedAt: varchar("published_at", { length: 40 }),
    publishedBy: varchar("published_by", { length: 120 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("examinations_workspace_name_year_unique").on(
      table.workspaceId,
      table.name,
      table.academicYearId,
    ),
    index("examinations_workspace_year_idx").on(table.workspaceId, table.academicYearId),
    index("examinations_workspace_status_idx").on(table.workspaceId, table.status),
  ],
);

export const examinationSubjects = mysqlTable(
  "examination_subjects",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    examinationId: char("examination_id", { length: 36 })
      .notNull()
      .references(() => examinations.id, { onDelete: "restrict", onUpdate: "cascade" }),
    gradeId: char("grade_id", { length: 36 })
      .notNull()
      .references(() => gradeLevels.id, { onDelete: "restrict", onUpdate: "cascade" }),
    sectionId: char("section_id", { length: 36 }).references(() => sections.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    subjectId: char("subject_id", { length: 36 })
      .notNull()
      .references(() => subjects.id, { onDelete: "restrict", onUpdate: "cascade" }),
    maximumMarks: int("maximum_marks").notNull(),
    passingMarks: int("passing_marks").notNull(),
    weightage: int("weightage"),
    examDate: varchar("exam_date", { length: 20 }),
    status: examSubjectStatus.notNull().default("draft"),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("exam_subjects_scope_unique").on(
      table.workspaceId,
      table.examinationId,
      table.gradeId,
      table.sectionId,
      table.subjectId,
    ),
    index("exam_subjects_workspace_exam_idx").on(table.workspaceId, table.examinationId),
    index("exam_subjects_class_idx").on(table.workspaceId, table.gradeId, table.sectionId),
  ],
);

export const assessments = mysqlTable(
  "assessments",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    title: varchar("title", { length: 180 }).notNull(),
    academicYearId: char("academic_year_id", { length: 36 })
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict", onUpdate: "cascade" }),
    termId: char("term_id", { length: 36 }).references(() => academicTerms.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    gradeId: char("grade_id", { length: 36 })
      .notNull()
      .references(() => gradeLevels.id, { onDelete: "restrict", onUpdate: "cascade" }),
    sectionId: char("section_id", { length: 36 })
      .notNull()
      .references(() => sections.id, { onDelete: "restrict", onUpdate: "cascade" }),
    subjectId: char("subject_id", { length: 36 })
      .notNull()
      .references(() => subjects.id, { onDelete: "restrict", onUpdate: "cascade" }),
    teacherId: char("teacher_id", { length: 36 })
      .notNull()
      .references(() => staffMembers.id, { onDelete: "restrict", onUpdate: "cascade" }),
    type: assessmentType.notNull().default("other"),
    maximumMarks: int("maximum_marks").notNull(),
    passingMarks: int("passing_marks").notNull(),
    weightage: int("weightage"),
    assessmentDate: varchar("assessment_date", { length: 20 }).notNull(),
    status: assessmentStatus.notNull().default("draft"),
    description: varchar("description", { length: 1000 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index("assessments_workspace_date_idx").on(table.workspaceId, table.assessmentDate),
    index("assessments_class_idx").on(table.workspaceId, table.gradeId, table.sectionId),
    index("assessments_teacher_idx").on(table.workspaceId, table.teacherId),
  ],
);

export const gradingRules = mysqlTable(
  "grading_rules",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    grade: varchar("grade", { length: 20 }).notNull(),
    minPercentageBasisPoints: int("min_percentage_basis_points").notNull(),
    maxPercentageBasisPoints: int("max_percentage_basis_points").notNull(),
    gradePointBasisPoints: int("grade_point_basis_points"),
    description: varchar("description", { length: 500 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("grading_rules_workspace_grade_unique").on(table.workspaceId, table.grade),
    index("grading_rules_workspace_min_idx").on(table.workspaceId, table.minPercentageBasisPoints),
  ],
);

export const markRecords = mysqlTable(
  "mark_records",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    sourceType: markSourceType.notNull(),
    sourceId: char("source_id", { length: 36 }).notNull(),
    examinationSubjectId: char("examination_subject_id", { length: 36 }).references(
      () => examinationSubjects.id,
      { onDelete: "restrict", onUpdate: "cascade" },
    ),
    academicYearId: char("academic_year_id", { length: 36 })
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict", onUpdate: "cascade" }),
    termId: char("term_id", { length: 36 }).references(() => academicTerms.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    gradeId: char("grade_id", { length: 36 })
      .notNull()
      .references(() => gradeLevels.id, { onDelete: "restrict", onUpdate: "cascade" }),
    sectionId: char("section_id", { length: 36 })
      .notNull()
      .references(() => sections.id, { onDelete: "restrict", onUpdate: "cascade" }),
    subjectId: char("subject_id", { length: 36 })
      .notNull()
      .references(() => subjects.id, { onDelete: "restrict", onUpdate: "cascade" }),
    studentId: char("student_id", { length: 36 })
      .notNull()
      .references(() => students.id, { onDelete: "restrict", onUpdate: "cascade" }),
    maximumMarks: int("maximum_marks").notNull(),
    obtainedMarks: int("obtained_marks").notNull(),
    percentageBasisPoints: int("percentage_basis_points").notNull(),
    grade: varchar("grade", { length: 20 }),
    gradePointBasisPoints: int("grade_point_basis_points"),
    remarks: varchar("remarks", { length: 1000 }),
    enteredBy: varchar("entered_by", { length: 120 }).notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("mark_records_source_student_subject_unique").on(
      table.workspaceId,
      table.sourceType,
      table.sourceId,
      table.studentId,
      table.subjectId,
    ),
    index("mark_records_workspace_student_idx").on(table.workspaceId, table.studentId),
    index("mark_records_source_idx").on(table.workspaceId, table.sourceType, table.sourceId),
  ],
);

export const resultPublications = mysqlTable(
  "result_publications",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    examinationId: char("examination_id", { length: 36 })
      .notNull()
      .references(() => examinations.id, { onDelete: "restrict", onUpdate: "cascade" }),
    academicYearId: char("academic_year_id", { length: 36 })
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict", onUpdate: "cascade" }),
    termId: char("term_id", { length: 36 }).references(() => academicTerms.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    gradeId: char("grade_id", { length: 36 })
      .notNull()
      .references(() => gradeLevels.id, { onDelete: "restrict", onUpdate: "cascade" }),
    sectionId: char("section_id", { length: 36 })
      .notNull()
      .references(() => sections.id, { onDelete: "restrict", onUpdate: "cascade" }),
    status: resultStatus.notNull().default("draft"),
    results: json("results").$type<Array<Record<string, unknown>>>().notNull(),
    publishedAt: varchar("published_at", { length: 40 }),
    publishedBy: varchar("published_by", { length: 120 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("result_publications_scope_unique").on(
      table.workspaceId,
      table.examinationId,
      table.gradeId,
      table.sectionId,
    ),
    index("result_publications_workspace_exam_idx").on(table.workspaceId, table.examinationId),
  ],
);

export const financeFeeCategories = mysqlTable(
  "finance_fee_categories",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    code: varchar("code", { length: 80 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    status: varchar("status", { length: 40 }).notNull().default("active"),
    displayOrder: int("display_order").notNull().default(0),
    payload: json("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("finance_fee_categories_workspace_code_unique").on(table.workspaceId, table.code),
    index("finance_fee_categories_workspace_status_idx").on(table.workspaceId, table.status),
  ],
);

export const financeFeeStructures = mysqlTable(
  "finance_fee_structures",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    academicYearId: char("academic_year_id", { length: 36 })
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict", onUpdate: "cascade" }),
    gradeId: char("grade_id", { length: 36 })
      .notNull()
      .references(() => gradeLevels.id, { onDelete: "restrict", onUpdate: "cascade" }),
    feeCategoryId: char("fee_category_id", { length: 36 })
      .notNull()
      .references(() => financeFeeCategories.id, { onDelete: "restrict", onUpdate: "cascade" }),
    name: varchar("name", { length: 180 }).notNull(),
    amountCents: int("amount_cents").notNull(),
    status: varchar("status", { length: 40 }).notNull().default("active"),
    payload: json("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index("finance_fee_structures_workspace_year_idx").on(table.workspaceId, table.academicYearId),
    index("finance_fee_structures_class_idx").on(table.workspaceId, table.gradeId),
  ],
);

export const financeStudentFeeAssignments = mysqlTable(
  "finance_student_fee_assignments",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    studentId: char("student_id", { length: 36 })
      .notNull()
      .references(() => students.id, { onDelete: "restrict", onUpdate: "cascade" }),
    enrollmentId: char("enrollment_id", { length: 36 })
      .notNull()
      .references(() => enrollments.id, { onDelete: "restrict", onUpdate: "cascade" }),
    feeStructureId: char("fee_structure_id", { length: 36 })
      .notNull()
      .references(() => financeFeeStructures.id, { onDelete: "restrict", onUpdate: "cascade" }),
    status: varchar("status", { length: 40 }).notNull().default("active"),
    amountCents: int("amount_cents").notNull(),
    payload: json("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("finance_assignments_student_structure_unique").on(
      table.workspaceId,
      table.studentId,
      table.enrollmentId,
      table.feeStructureId,
    ),
    index("finance_assignments_student_idx").on(table.workspaceId, table.studentId),
  ],
);

export const financeDiscounts = mysqlTable(
  "finance_discounts",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    studentId: char("student_id", { length: 36 }).references(() => students.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    feeCategoryId: char("fee_category_id", { length: 36 }).references(
      () => financeFeeCategories.id,
      { onDelete: "restrict", onUpdate: "cascade" },
    ),
    name: varchar("name", { length: 180 }).notNull(),
    discountType: varchar("discount_type", { length: 40 }).notNull(),
    status: varchar("status", { length: 40 }).notNull().default("active"),
    payload: json("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index("finance_discounts_student_idx").on(table.workspaceId, table.studentId),
    index("finance_discounts_category_idx").on(table.workspaceId, table.feeCategoryId),
  ],
);

export const financeInvoices = mysqlTable(
  "finance_invoices",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    studentId: char("student_id", { length: 36 })
      .notNull()
      .references(() => students.id, { onDelete: "restrict", onUpdate: "cascade" }),
    enrollmentId: char("enrollment_id", { length: 36 })
      .notNull()
      .references(() => enrollments.id, { onDelete: "restrict", onUpdate: "cascade" }),
    academicYearId: char("academic_year_id", { length: 36 })
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict", onUpdate: "cascade" }),
    invoiceNumber: varchar("invoice_number", { length: 80 }).notNull(),
    issueDate: varchar("issue_date", { length: 20 }).notNull(),
    dueDate: varchar("due_date", { length: 20 }).notNull(),
    status: varchar("status", { length: 40 }).notNull().default("draft"),
    totalCents: int("total_cents").notNull().default(0),
    paidAmountCents: int("paid_amount_cents").notNull().default(0),
    balanceCents: int("balance_cents").notNull().default(0),
    payload: json("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("finance_invoices_workspace_number_unique").on(
      table.workspaceId,
      table.invoiceNumber,
    ),
    index("finance_invoices_student_idx").on(table.workspaceId, table.studentId),
    index("finance_invoices_status_idx").on(table.workspaceId, table.status),
  ],
);

export const financePayments = mysqlTable(
  "finance_payments",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    invoiceId: char("invoice_id", { length: 36 })
      .notNull()
      .references(() => financeInvoices.id, { onDelete: "restrict", onUpdate: "cascade" }),
    studentId: char("student_id", { length: 36 })
      .notNull()
      .references(() => students.id, { onDelete: "restrict", onUpdate: "cascade" }),
    amountCents: int("amount_cents").notNull(),
    paymentDate: varchar("payment_date", { length: 20 }).notNull(),
    paymentMethod: varchar("payment_method", { length: 40 }).notNull(),
    referenceNumber: varchar("reference_number", { length: 120 }),
    status: varchar("status", { length: 40 }).notNull().default("recorded"),
    payload: json("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index("finance_payments_invoice_idx").on(table.workspaceId, table.invoiceId),
    index("finance_payments_student_idx").on(table.workspaceId, table.studentId),
    index("finance_payments_reference_idx").on(table.workspaceId, table.referenceNumber),
  ],
);

export const financeReceipts = mysqlTable(
  "finance_receipts",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    invoiceId: char("invoice_id", { length: 36 })
      .notNull()
      .references(() => financeInvoices.id, { onDelete: "restrict", onUpdate: "cascade" }),
    paymentId: char("payment_id", { length: 36 })
      .notNull()
      .references(() => financePayments.id, { onDelete: "restrict", onUpdate: "cascade" }),
    studentId: char("student_id", { length: 36 })
      .notNull()
      .references(() => students.id, { onDelete: "restrict", onUpdate: "cascade" }),
    receiptNumber: varchar("receipt_number", { length: 80 }).notNull(),
    amountCents: int("amount_cents").notNull(),
    receiptDate: varchar("receipt_date", { length: 20 }).notNull(),
    payload: json("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("finance_receipts_workspace_number_unique").on(
      table.workspaceId,
      table.receiptNumber,
    ),
    index("finance_receipts_student_idx").on(table.workspaceId, table.studentId),
  ],
);

export const communicationTemplates = mysqlTable(
  "communication_templates",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    name: varchar("name", { length: 180 }).notNull(),
    category: varchar("category", { length: 80 }).notNull(),
    status: varchar("status", { length: 40 }).notNull().default("active"),
    payload: json("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [index("communication_templates_workspace_idx").on(table.workspaceId, table.status)],
);

export const announcements = mysqlTable(
  "announcements",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    title: varchar("title", { length: 220 }).notNull(),
    status: varchar("status", { length: 40 }).notNull().default("draft"),
    priority: varchar("priority", { length: 40 }).notNull().default("normal"),
    payload: json("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [index("announcements_workspace_status_idx").on(table.workspaceId, table.status)],
);

export const communicationMessages = mysqlTable(
  "communication_messages",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    subject: varchar("subject", { length: 220 }).notNull(),
    status: varchar("status", { length: 40 }).notNull().default("sent"),
    priority: varchar("priority", { length: 40 }).notNull().default("normal"),
    idempotencyKey: varchar("idempotency_key", { length: 160 }),
    payload: json("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("communication_messages_idempotency_unique").on(
      table.workspaceId,
      table.idempotencyKey,
    ),
    index("communication_messages_workspace_status_idx").on(table.workspaceId, table.status),
  ],
);

export const sisNotifications = mysqlTable(
  "sis_notifications",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    recipientKind: varchar("recipient_kind", { length: 40 }).notNull(),
    recipientId: varchar("recipient_id", { length: 120 }).notNull(),
    recipientUserId: char("recipient_user_id", { length: 36 }),
    notificationType: varchar("notification_type", { length: 120 }).notNull(),
    sourceEventId: char("source_event_id", { length: 36 }).references(() => domainEvents.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    isRead: boolean("is_read").notNull().default(false),
    readAt: datetime("read_at", { fsp: 3 }),
    acknowledgedAt: datetime("acknowledged_at", { fsp: 3 }),
    dismissedAt: datetime("dismissed_at", { fsp: 3 }),
    expiresAt: datetime("expires_at", { fsp: 3 }),
    payload: json("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index("sis_notifications_recipient_idx").on(
      table.workspaceId,
      table.recipientKind,
      table.recipientId,
      table.isRead,
    ),
    index("sis_notifications_user_idx").on(table.workspaceId, table.recipientUserId),
    index("sis_notifications_user_unread_idx").on(
      table.workspaceId,
      table.recipientUserId,
      table.isRead,
      table.createdAt,
    ),
    index("sis_notifications_source_event_idx").on(table.sourceEventId),
  ],
);

export const communicationDeliveries = mysqlTable(
  "communication_deliveries",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    communicationId: char("communication_id", { length: 36 }).references(
      () => communicationMessages.id,
      { onDelete: "restrict", onUpdate: "cascade" },
    ),
    announcementId: char("announcement_id", { length: 36 }).references(() => announcements.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    notificationId: char("notification_id", { length: 36 }).references(() => sisNotifications.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    recipientId: varchar("recipient_id", { length: 120 }).notNull(),
    recipientKind: varchar("recipient_kind", { length: 40 }).notNull(),
    channel: varchar("channel", { length: 40 }).notNull(),
    status: varchar("status", { length: 40 }).notNull(),
    attemptNumber: int("attempt_number").notNull().default(1),
    providerReference: varchar("provider_reference", { length: 255 }),
    safeErrorCode: varchar("safe_error_code", { length: 120 }),
    safeErrorMessage: varchar("safe_error_message", { length: 1000 }),
    attemptedAt: datetime("attempted_at", { fsp: 3 }),
    completedAt: datetime("completed_at", { fsp: 3 }),
    payload: json("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index("communication_deliveries_workspace_idx").on(table.workspaceId, table.status),
    index("communication_deliveries_notification_attempt_idx").on(
      table.notificationId,
      table.channel,
      table.attemptNumber,
    ),
  ],
);

export const notificationPreferences = mysqlTable(
  "notification_preferences",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    recipientKind: varchar("recipient_kind", { length: 40 }).notNull(),
    recipientId: varchar("recipient_id", { length: 120 }).notNull(),
    payload: json("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("notification_preferences_recipient_unique").on(
      table.workspaceId,
      table.recipientKind,
      table.recipientId,
    ),
  ],
);

export const portalPolicies = mysqlTable(
  "portal_policies",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    payload: json("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [uniqueIndex("portal_policies_workspace_unique").on(table.workspaceId)],
);

export const portalUpdateRequests = mysqlTable(
  "portal_update_requests",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    requesterUserId: char("requester_user_id", { length: 36 }).notNull(),
    requesterRole: varchar("requester_role", { length: 40 }).notNull(),
    studentId: char("student_id", { length: 36 }).references(() => students.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    requestType: varchar("request_type", { length: 80 }).notNull(),
    status: varchar("status", { length: 40 }).notNull().default("submitted"),
    payload: json("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index("portal_requests_user_idx").on(
      table.workspaceId,
      table.requesterUserId,
      table.requesterRole,
    ),
    index("portal_requests_student_idx").on(table.workspaceId, table.studentId),
  ],
);

export const knowledgeSources = mysqlTable(
  "knowledge_sources",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description").notNull(),
    type: mysqlEnum("type", ["text", "document", "structured"]).notNull(),
    visibility: mysqlEnum("visibility", ["internal", "private"]).notNull(),
    status: mysqlEnum("status", ["active", "archived"]).notNull().default("active"),
    content: text("content").notNull(),
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    ingestionStatus: mysqlEnum("ingestion_status", ["ready"]).notNull().default("ready"),
    createdBy: char("created_by", { length: 36 })
      .notNull()
      .references(() => users.id),
    createdAt: datetime("created_at").notNull(),
    updatedAt: datetime("updated_at").notNull(),
  },
  (table) => [index("knowledge_sources_tenant_idx").on(table.organizationId, table.status)],
);

export const knowledgeChunks = mysqlTable(
  "knowledge_chunks",
  {
    id: char("id", { length: 36 }).primaryKey(),
    sourceId: char("source_id", { length: 36 })
      .notNull()
      .references(() => knowledgeSources.id, { onDelete: "cascade" }),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id),
    ordinal: int("ordinal").notNull(),
    content: text("content").notNull(),
  },
  (table) => [
    uniqueIndex("knowledge_chunks_source_ordinal_idx").on(table.sourceId, table.ordinal),
    index("knowledge_chunks_tenant_idx").on(table.organizationId),
  ],
);

export const usageMeterEvents = mysqlTable(
  "usage_meter_events",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id),
    meterKey: varchar("meter_key", { length: 120 }).notNull(),
    quantity: int("quantity").notNull(),
    sourceType: varchar("source_type", { length: 80 }).notNull(),
    sourceId: char("source_id", { length: 36 }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 180 }).notNull(),
    metadata: json("metadata").$type<Record<string, unknown>>().notNull().default({}),
    occurredAt: timestamp("occurred_at", { fsp: 3 }).notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("usage_meter_events_org_key_unique").on(table.organizationId, table.idempotencyKey),
    index("usage_meter_events_org_meter_time_idx").on(
      table.organizationId,
      table.meterKey,
      table.occurredAt,
    ),
    index("usage_meter_events_workspace_time_idx").on(table.workspaceId, table.occurredAt),
    index("usage_meter_events_source_idx").on(
      table.organizationId,
      table.sourceType,
      table.sourceId,
    ),
  ],
);

export const saasPlans = mysqlTable(
  "saas_plans",
  {
    id: char("id", { length: 36 }).primaryKey(),
    code: varchar("code", { length: 80 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    status: mysqlEnum("saas_plan_status", ["draft", "active", "retired"])
      .notNull()
      .default("draft"),
    currency: char("currency", { length: 3 }).notNull(),
    interval: mysqlEnum("saas_plan_interval", ["monthly", "annual"]).notNull(),
    priceCents: int("price_cents").notNull(),
    includedUnits: json("included_units").$type<Record<string, number>>().notNull().default({}),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [uniqueIndex("saas_plans_code_unique").on(table.code)],
);

export const billingAccounts = mysqlTable(
  "billing_accounts",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id),
    billingEmail: varchar("billing_email", { length: 255 }).notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    status: mysqlEnum("billing_account_status", ["pending", "active", "suspended"])
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [uniqueIndex("billing_accounts_org_unique").on(table.organizationId)],
);

export const organizationSubscriptions = mysqlTable(
  "organization_subscriptions",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id),
    billingAccountId: char("billing_account_id", { length: 36 }).notNull(),
    planId: char("plan_id", { length: 36 })
      .notNull()
      .references(() => saasPlans.id),
    status: mysqlEnum("saas_subscription_status", [
      "pending",
      "trialing",
      "active",
      "past_due",
      "cancelled",
    ])
      .notNull()
      .default("pending"),
    periodStart: datetime("period_start", { fsp: 3 }).notNull(),
    periodEnd: datetime("period_end", { fsp: 3 }).notNull(),
    cancelledAt: datetime("cancelled_at", { fsp: 3 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index("organization_subscriptions_org_period_idx").on(
      table.organizationId,
      table.periodStart,
      table.periodEnd,
    ),
    index("organization_subscriptions_account_idx").on(table.billingAccountId),
    foreignKey({
      columns: [table.billingAccountId],
      foreignColumns: [billingAccounts.id],
      name: "org_sub_billing_account_fk",
    }),
  ],
);

export const billingStatements = mysqlTable(
  "billing_statements",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id),
    subscriptionId: char("subscription_id", { length: 36 }).notNull(),
    status: mysqlEnum("billing_statement_status", ["draft", "finalized", "void"])
      .notNull()
      .default("draft"),
    currency: char("currency", { length: 3 }).notNull(),
    amountCents: int("amount_cents").notNull().default(0),
    periodStart: datetime("period_start", { fsp: 3 }).notNull(),
    periodEnd: datetime("period_end", { fsp: 3 }).notNull(),
    usageSnapshot: json("usage_snapshot").$type<Record<string, number>>().notNull().default({}),
    finalizedAt: datetime("finalized_at", { fsp: 3 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("billing_statements_subscription_period_unique").on(
      table.subscriptionId,
      table.periodStart,
      table.periodEnd,
    ),
    index("billing_statements_org_created_idx").on(table.organizationId, table.createdAt),
    foreignKey({
      columns: [table.subscriptionId],
      foreignColumns: [organizationSubscriptions.id],
      name: "billing_stmt_subscription_fk",
    }),
  ],
);

export const schema = {
  usageMeterEvents,
  saasPlans,
  billingAccounts,
  organizationSubscriptions,
  billingStatements,
  auditLogs,
  domainEvents,
  operationalEvents,
  workflowDefinitions,
  workflowSteps,
  workflowRuns,
  workflowStepRuns,
  workflowTasks,
  knowledgeSources,
  knowledgeChunks,
  academicTerms,
  aiAgentConversations,
  aiAgentDefinitions,
  aiAgentMemories,
  aiAgentMessages,
  aiAgentRuns,
  aiAgentTemplates,
  aiAgentToolAssignments,
  attendanceRecords,
  attendanceSessions,
  academicYears,
  assessments,
  classSubjects,
  enrollments,
  examinationSubjects,
  examinations,
  gradeLevels,
  gradingRules,
  guardians,
  authSessions,
  announcements,
  communicationDeliveries,
  communicationMessages,
  communicationTemplates,
  financeDiscounts,
  financeFeeCategories,
  financeFeeStructures,
  financeInvoices,
  financePayments,
  financeReceipts,
  financeStudentFeeAssignments,
  internalDatabaseChecks,
  markRecords,
  membershipRoles,
  organizationMemberships,
  organizationModules,
  platformModules,
  organizationSettings,
  organizations,
  permissions,
  notificationPreferences,
  portalPolicies,
  portalUpdateRequests,
  resultPublications,
  rolePermissions,
  roles,
  sections,
  securityEvents,
  schoolSchedules,
  staffDepartments,
  staffMembers,
  studentGuardians,
  students,
  subjects,
  teachingAssignments,
  timePeriods,
  timetableEntries,
  users,
  workspaceMemberships,
  workspaces,
};

export type DatabaseSchema = typeof schema;
