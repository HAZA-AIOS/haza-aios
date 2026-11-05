import {
  bigint,
  boolean,
  char,
  datetime,
  decimal,
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
  "suspended",
]);
export const agentRunStatus = mysqlEnum("agent_run_status", [
  "queued",
  "running",
  "awaiting_approval",
  "waiting",
  "rejected",
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
export const lessonPlanStatus = mysqlEnum("status", [
  "draft",
  "reviewed",
  "approved",
  "published",
  "archived",
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
    defaultApprovalPolicy: json("default_approval_policy").$type<Record<string, unknown>>(),
    publisherType: varchar("publisher_type", { length: 40 }).notNull().default("platform"),
    publisherOrganizationId: char("publisher_organization_id", { length: 36 }).references(
      () => organizations.id,
      { onDelete: "set null", onUpdate: "cascade" },
    ),
    publisherUserId: char("publisher_user_id", { length: 36 }).references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    visibility: varchar("visibility", { length: 40 }).notNull().default("platform"),
    publishingStatus: varchar("publishing_status", { length: 40 }).notNull().default("published"),
    summary: varchar("summary", { length: 300 }),
    latestVersion: varchar("latest_version", { length: 80 }).notNull().default("1.0.0"),
    minPlatformVersion: varchar("min_platform_version", { length: 40 }),
    reviewNotes: text("review_notes"),
    reviewedBy: char("reviewed_by", { length: 36 }).references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    reviewedAt: timestamp("reviewed_at", { fsp: 3 }),
    publishedAt: timestamp("published_at", { fsp: 3 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("ai_agent_templates_slug_unique").on(table.slug),
    index("ai_agent_templates_status_idx").on(table.status),
    index("ai_agent_templates_industry_idx").on(table.industry),
    index("ai_agent_templates_category_idx").on(table.category),
    index("ai_agent_templates_publishing_status_idx").on(table.publishingStatus),
    index("ai_agent_templates_visibility_idx").on(table.visibility),
    index("ai_agent_templates_publisher_org_idx").on(table.publisherOrganizationId),
  ],
);

export const aiAgentTemplateVersions = mysqlTable(
  "ai_agent_template_versions",
  {
    id: char("id", { length: 36 }).primaryKey(),
    templateId: char("template_id", { length: 36 })
      .notNull()
      .references(() => aiAgentTemplates.id, { onDelete: "cascade", onUpdate: "cascade" }),
    version: varchar("version", { length: 80 }).notNull(),
    name: varchar("name", { length: 180 }).notNull(),
    description: varchar("description", { length: 1000 }).notNull(),
    instructions: text("instructions"),
    configurationSchema: json("configuration_schema").$type<Record<string, unknown>>().notNull(),
    inputSchema: json("input_schema").$type<Record<string, unknown>>().notNull(),
    outputSchema: json("output_schema").$type<Record<string, unknown>>().notNull(),
    capabilities: json("capabilities").$type<Array<Record<string, unknown>>>().notNull(),
    requiredPermissions: json("required_permissions").$type<string[]>().notNull(),
    defaultApprovalPolicy: json("default_approval_policy").$type<Record<string, unknown>>(),
    changelog: text("changelog"),
    status: varchar("status", { length: 40 }).notNull().default("published"),
    reviewNotes: text("review_notes"),
    reviewedBy: char("reviewed_by", { length: 36 }).references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    reviewedAt: timestamp("reviewed_at", { fsp: 3 }),
    publishedAt: timestamp("published_at", { fsp: 3 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("ai_agent_template_versions_template_version_unique").on(
      table.templateId,
      table.version,
    ),
    index("ai_agent_template_versions_template_idx").on(table.templateId),
    index("ai_agent_template_versions_status_idx").on(table.status),
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
    templateVersionId: char("template_version_id", { length: 36 }).references(
      () => aiAgentTemplateVersions.id,
      { onDelete: "set null", onUpdate: "cascade" },
    ),
    installedVersion: varchar("installed_version", { length: 80 }).notNull().default("1.0.0"),
    installedFromMarketplace: boolean("installed_from_marketplace").notNull().default(true),
    activeRevisionNumber: int("active_revision_number").notNull().default(1),
    activeRevisionId: char("active_revision_id", { length: 36 }),
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
    humanApprovalPolicy: json("human_approval_policy").$type<Record<string, unknown>>(),
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

export const aiAgentInstallations = mysqlTable(
  "ai_agent_installations",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade", onUpdate: "cascade" }),
    templateId: char("template_id", { length: 36 })
      .notNull()
      .references(() => aiAgentTemplates.id, { onDelete: "restrict", onUpdate: "cascade" }),
    templateVersionId: char("template_version_id", { length: 36 }).references(
      () => aiAgentTemplateVersions.id,
      { onDelete: "set null", onUpdate: "cascade" },
    ),
    installedVersion: varchar("installed_version", { length: 80 }).notNull(),
    agentDefinitionId: char("agent_definition_id", { length: 36 })
      .notNull()
      .references(() => aiAgentDefinitions.id, { onDelete: "cascade", onUpdate: "cascade" }),
    installedBy: char("installed_by", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict", onUpdate: "cascade" }),
    status: varchar("status", { length: 40 }).notNull().default("active"),
    installedAt: timestamp("installed_at", { fsp: 3 }).notNull().defaultNow(),
    uninstalledAt: timestamp("uninstalled_at", { fsp: 3 }),
    uninstalledBy: char("uninstalled_by", { length: 36 }).references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    metadata: json("metadata").$type<Record<string, unknown>>(),
  },
  (table) => [
    index("ai_agent_installations_org_status_idx").on(table.organizationId, table.status),
    index("ai_agent_installations_workspace_idx").on(table.workspaceId),
    index("ai_agent_installations_template_idx").on(table.templateId),
    index("ai_agent_installations_agent_idx").on(table.agentDefinitionId),
  ],
);

export const aiAgentConfigurationRevisions = mysqlTable(
  "ai_agent_configuration_revisions",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade", onUpdate: "cascade" }),
    agentId: char("agent_id", { length: 36 })
      .notNull()
      .references(() => aiAgentDefinitions.id, { onDelete: "cascade", onUpdate: "cascade" }),
    revisionNumber: int("revision_number").notNull(),
    version: varchar("version", { length: 80 }).notNull().default("1.0.0"),
    status: varchar("status", { length: 40 }).notNull().default("draft"),
    configuration: json("configuration").$type<Record<string, unknown>>().notNull(),
    validationStatus: varchar("validation_status", { length: 40 }).notNull().default("valid"),
    validationErrors: json("validation_errors").$type<Array<Record<string, unknown>>>(),
    changelog: text("changelog"),
    createdBy: char("created_by", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict", onUpdate: "cascade" }),
    publishedBy: char("published_by", { length: 36 }).references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    publishedAt: timestamp("published_at", { fsp: 3 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("ai_agent_config_revisions_agent_revision_unique").on(
      table.agentId,
      table.revisionNumber,
    ),
    index("ai_agent_config_revisions_org_agent_status_idx").on(
      table.organizationId,
      table.agentId,
      table.status,
    ),
    index("ai_agent_config_revisions_agent_idx").on(table.agentId),
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

export const aiAgentTools = mysqlTable(
  "ai_agent_tools",
  {
    id: char("id", { length: 36 }).primaryKey(),
    toolKey: varchar("tool_key", { length: 160 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    description: varchar("description", { length: 1000 }).notNull(),
    category: varchar("category", { length: 80 }).notNull(),
    industry: varchar("industry", { length: 80 }).notNull(),
    riskLevel: varchar("risk_level", { length: 20 }).notNull().default("low"),
    executionMode: varchar("execution_mode", { length: 20 }).notNull().default("sync"),
    requiredPermissions: json("required_permissions").$type<string[]>().notNull(),
    approvalPolicy: varchar("approval_policy", { length: 40 }).notNull().default("none"),
    timeoutMs: int("timeout_ms").notNull().default(15000),
    maxAttempts: int("max_attempts").notNull().default(3),
    status: varchar("status", { length: 40 }).notNull().default("active"),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("ai_agent_tools_key_unique").on(table.toolKey),
    index("ai_agent_tools_category_idx").on(table.category),
    index("ai_agent_tools_industry_idx").on(table.industry),
  ],
);

export const aiAgentToolVersions = mysqlTable(
  "ai_agent_tool_versions",
  {
    id: char("id", { length: 36 }).primaryKey(),
    toolId: char("tool_id", { length: 36 })
      .notNull()
      .references(() => aiAgentTools.id, { onDelete: "cascade", onUpdate: "cascade" }),
    version: varchar("version", { length: 40 }).notNull(),
    inputSchema: json("input_schema").$type<Record<string, unknown>>().notNull(),
    outputSchema: json("output_schema").$type<Record<string, unknown>>().notNull(),
    deprecated: boolean("deprecated").notNull().default(false),
    changelog: varchar("changelog", { length: 1000 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("ai_agent_tool_versions_tool_version_unique").on(table.toolId, table.version),
    index("ai_agent_tool_versions_tool_idx").on(table.toolId),
  ],
);

export const aiAgentToolTenantPolicies = mysqlTable(
  "ai_agent_tool_tenant_policies",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 }).references(() => workspaces.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    toolId: char("tool_id", { length: 36 })
      .notNull()
      .references(() => aiAgentTools.id, { onDelete: "cascade", onUpdate: "cascade" }),
    enabled: boolean("enabled").notNull().default(true),
    approvalPolicyOverride: varchar("approval_policy_override", { length: 40 }),
    customRateLimitPerMinute: int("custom_rate_limit_per_minute"),
    allowedAgentIds: json("allowed_agent_ids").$type<string[]>(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("ai_agent_tool_tenant_policies_org_ws_tool_unique").on(
      table.organizationId,
      table.workspaceId,
      table.toolId,
    ),
    index("ai_agent_tool_policies_org_idx").on(table.organizationId, table.enabled),
  ],
);

export const aiAgentToolExecutions = mysqlTable(
  "ai_agent_tool_executions",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade", onUpdate: "cascade" }),
    runId: char("run_id", { length: 36 })
      .notNull()
      .references(() => aiAgentRuns.id, { onDelete: "cascade", onUpdate: "cascade" }),
    attemptId: char("attempt_id", { length: 36 }),
    agentId: char("agent_id", { length: 36 })
      .notNull()
      .references(() => aiAgentDefinitions.id, { onDelete: "cascade", onUpdate: "cascade" }),
    configurationRevisionId: char("configuration_revision_id", { length: 36 }).references(
      () => aiAgentConfigurationRevisions.id,
      { onDelete: "set null", onUpdate: "cascade" },
    ),
    toolId: char("tool_id", { length: 36 })
      .notNull()
      .references(() => aiAgentTools.id, { onDelete: "restrict", onUpdate: "cascade" }),
    toolVersion: varchar("tool_version", { length: 40 }).notNull(),
    toolKey: varchar("tool_key", { length: 160 }).notNull(),
    requestedBy: char("requested_by", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict", onUpdate: "cascade" }),
    inputDigest: varchar("input_digest", { length: 128 }).notNull(),
    inputSnapshot: json("input_snapshot").$type<Record<string, unknown>>(),
    outputSnapshot: json("output_snapshot").$type<Record<string, unknown>>(),
    status: varchar("status", { length: 40 }).notNull().default("pending"),
    approvalRequestId: char("approval_request_id", { length: 36 }).references(
      () => aiAgentApprovalRequests.id,
      { onDelete: "set null", onUpdate: "cascade" },
    ),
    startedAt: timestamp("started_at", { fsp: 3 }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { fsp: 3 }),
    durationMs: int("duration_ms"),
    errorCategory: varchar("error_category", { length: 60 }),
    errorMessage: varchar("error_message", { length: 1000 }),
    correlationId: varchar("correlation_id", { length: 128 }),
    idempotencyKey: varchar("idempotency_key", { length: 160 }),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("ai_agent_tool_exec_org_ws_idx").on(
      table.organizationId,
      table.workspaceId,
      table.createdAt,
    ),
    index("ai_agent_tool_exec_run_idx").on(table.runId),
    index("ai_agent_tool_exec_tool_idx").on(table.toolId, table.status),
    index("ai_agent_tool_exec_org_key_idx").on(
      table.organizationId,
      table.toolKey,
      table.createdAt,
    ),
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
    configurationRevisionId: char("configuration_revision_id", { length: 36 }).references(
      () => aiAgentConfigurationRevisions.id,
      { onDelete: "set null", onUpdate: "cascade" },
    ),
    configurationSnapshot: json("configuration_snapshot").$type<Record<string, unknown>>(),
    conversationId: char("conversation_id", { length: 36 }).references(
      () => aiAgentConversations.id,
      { onDelete: "restrict", onUpdate: "cascade" },
    ),
    requestedBy: char("requested_by", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict", onUpdate: "cascade" }),
    status: agentRunStatus.notNull().default("queued"),
    executionMode: varchar("execution_mode", { length: 40 }).notNull().default("manual"),
    attemptCount: int("attempt_count").notNull().default(0),
    maxAttempts: int("max_attempts").notNull().default(3),
    leaseToken: varchar("lease_token", { length: 80 }),
    leaseExpiresAt: timestamp("lease_expires_at", { fsp: 3 }),
    workerId: varchar("worker_id", { length: 120 }),
    priority: int("priority").notNull().default(0),
    idempotencyKey: varchar("idempotency_key", { length: 160 }),
    input: json("input").$type<Record<string, unknown>>().notNull(),
    output: json("output").$type<Record<string, unknown>>(),
    provider: varchar("provider", { length: 120 }),
    model: varchar("model", { length: 160 }),
    totalInputTokens: int("total_input_tokens").notNull().default(0),
    totalOutputTokens: int("total_output_tokens").notNull().default(0),
    totalCostMicros: bigint("total_cost_micros", { mode: "number" }).notNull().default(0),
    errorCode: varchar("error_code", { length: 120 }),
    safeErrorMessage: varchar("safe_error_message", { length: 1000 }),
    cancelledBy: char("cancelled_by", { length: 36 }).references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    cancelledAt: timestamp("cancelled_at", { fsp: 3 }),
    cancellationReason: varchar("cancellation_reason", { length: 500 }),
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
    index("ai_agent_runs_status_priority_idx").on(table.status, table.priority, table.createdAt),
    index("ai_agent_runs_lease_idx").on(table.status, table.leaseExpiresAt),
    index("ai_agent_runs_config_rev_idx").on(table.configurationRevisionId),
  ],
);

export const aiAgentRunAttempts = mysqlTable(
  "ai_agent_run_attempts",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade", onUpdate: "cascade" }),
    runId: char("run_id", { length: 36 })
      .notNull()
      .references(() => aiAgentRuns.id, { onDelete: "cascade", onUpdate: "cascade" }),
    attemptNumber: int("attempt_number").notNull(),
    status: varchar("status", { length: 40 }).notNull().default("running"),
    workerId: varchar("worker_id", { length: 120 }).notNull(),
    leaseToken: varchar("lease_token", { length: 80 }).notNull(),
    startedAt: timestamp("started_at", { fsp: 3 }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { fsp: 3 }),
    durationMs: int("duration_ms"),
    errorCode: varchar("error_code", { length: 120 }),
    errorMessage: varchar("error_message", { length: 1000 }),
    errorDetails: json("error_details").$type<Record<string, unknown>>(),
    inputTokens: int("input_tokens").notNull().default(0),
    outputTokens: int("output_tokens").notNull().default(0),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("ai_agent_run_attempts_run_attempt_unique").on(table.runId, table.attemptNumber),
    index("ai_agent_run_attempts_org_run_idx").on(table.organizationId, table.runId),
  ],
);

export const aiAgentRunEvents = mysqlTable(
  "ai_agent_run_events",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade", onUpdate: "cascade" }),
    runId: char("run_id", { length: 36 })
      .notNull()
      .references(() => aiAgentRuns.id, { onDelete: "cascade", onUpdate: "cascade" }),
    attemptId: char("attempt_id", { length: 36 }),
    eventType: varchar("event_type", { length: 60 }).notNull(),
    payload: json("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("ai_agent_run_events_run_created_idx").on(table.runId, table.createdAt),
  ],
);

export const aiAgentApprovalRequests = mysqlTable(
  "ai_agent_approval_requests",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade", onUpdate: "cascade" }),
    runId: char("run_id", { length: 36 })
      .notNull()
      .references(() => aiAgentRuns.id, { onDelete: "cascade", onUpdate: "cascade" }),
    attemptId: char("attempt_id", { length: 36 }),
    actionName: varchar("action_name", { length: 120 }).notNull(),
    actionType: varchar("action_type", { length: 60 }).notNull(),
    actionPayload: json("action_payload").$type<Record<string, unknown>>().notNull(),
    riskLevel: varchar("risk_level", { length: 20 }).notNull().default("medium"),
    policy: varchar("policy", { length: 40 }).notNull().default("risk_threshold"),
    requiredRoles: json("required_roles").$type<string[]>().notNull(),
    status: varchar("status", { length: 40 }).notNull().default("pending"),
    requestedBy: char("requested_by", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict", onUpdate: "cascade" }),
    expiresAt: timestamp("expires_at", { fsp: 3 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index("ai_agent_approval_requests_org_status_idx").on(table.organizationId, table.status),
    index("ai_agent_approval_requests_run_idx").on(table.runId),
  ],
);

export const aiAgentApprovalDecisions = mysqlTable(
  "ai_agent_approval_decisions",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade", onUpdate: "cascade" }),
    approvalRequestId: char("approval_request_id", { length: 36 })
      .notNull()
      .references(() => aiAgentApprovalRequests.id, { onDelete: "cascade", onUpdate: "cascade" }),
    decision: varchar("decision", { length: 40 }).notNull(),
    reason: varchar("reason", { length: 1000 }),
    decidedBy: char("decided_by", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict", onUpdate: "cascade" }),
    decidedAt: timestamp("decided_at", { fsp: 3 }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("ai_agent_approval_decisions_request_idx").on(table.approvalRequestId),
  ],
);

export const aiAgentRuntimeUsage = mysqlTable(
  "ai_agent_runtime_usage",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade", onUpdate: "cascade" }),
    runId: char("run_id", { length: 36 })
      .notNull()
      .references(() => aiAgentRuns.id, { onDelete: "cascade", onUpdate: "cascade" }),
    agentId: char("agent_id", { length: 36 })
      .notNull()
      .references(() => aiAgentDefinitions.id, { onDelete: "cascade", onUpdate: "cascade" }),
    provider: varchar("provider", { length: 120 }).notNull(),
    model: varchar("model", { length: 160 }).notNull(),
    inputTokens: int("input_tokens").notNull().default(0),
    outputTokens: int("output_tokens").notNull().default(0),
    totalTokens: int("total_tokens").notNull().default(0),
    durationMs: int("duration_ms").notNull().default(0),
    costMicros: bigint("cost_micros", { mode: "number" }).notNull().default(0),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("ai_agent_runtime_usage_org_agent_created_idx").on(
      table.organizationId,
      table.agentId,
      table.createdAt,
    ),
    index("ai_agent_runtime_usage_run_idx").on(table.runId),
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

export const academicLessonPlans = mysqlTable(
  "academic_lesson_plans",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade", onUpdate: "cascade" }),
    agentRunId: char("agent_run_id", { length: 36 }).references(() => aiAgentRuns.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    title: varchar("title", { length: 255 }).notNull(),
    grade: varchar("grade", { length: 50 }).notNull(),
    subject: varchar("subject", { length: 100 }).notNull(),
    topic: varchar("topic", { length: 255 }).notNull(),
    durationMinutes: int("duration_minutes").notNull(),
    learningObjectives: json("learning_objectives").$type<Array<{
      type: "cognitive" | "skill" | "affective";
      description: string;
      bloomTaxonomyLevel?: string;
    }>>().notNull(),
    content: json("content").$type<Record<string, unknown>>().notNull(),
    status: lessonPlanStatus.notNull().default("draft"),
    curriculumReference: varchar("curriculum_reference", { length: 255 }),
    curriculumVerified: boolean("curriculum_verified").notNull().default(false),
    createdBy: char("created_by", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict", onUpdate: "cascade" }),
    approvedBy: char("approved_by", { length: 36 }).references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    approvedAt: timestamp("approved_at", { fsp: 3 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index("academic_lesson_plans_org_ws_idx").on(table.organizationId, table.workspaceId),
    index("academic_lesson_plans_org_status_idx").on(table.organizationId, table.status),
    index("academic_lesson_plans_creator_idx").on(table.createdBy),
    index("academic_lesson_plans_run_idx").on(table.agentRunId),
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

export const financeLateFeePolicies = mysqlTable(
  "finance_late_fee_policies",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    academicYearId: char("academic_year_id", { length: 36 })
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict", onUpdate: "cascade" }),
    code: varchar("code", { length: 80 }).notNull(),
    name: varchar("name", { length: 180 }).notNull(),
    gracePeriodDays: int("grace_period_days").notNull().default(5),
    feeType: varchar("fee_type", { length: 40 }).notNull().default("fixed"),
    amountCents: int("amount_cents").notNull().default(0),
    percentageRate: int("percentage_rate").notNull().default(0),
    maxCapCents: int("max_cap_cents").notNull().default(0),
    status: varchar("status", { length: 40 }).notNull().default("active"),
    applyAutomatically: boolean("apply_automatically").notNull().default(false),
    payload: json("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("finance_late_fee_policies_workspace_code_unique").on(table.workspaceId, table.code),
    index("finance_late_fee_policies_workspace_status_idx").on(table.workspaceId, table.status),
  ],
);

export const financeExpenseCategories = mysqlTable(
  "finance_expense_categories",
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
    uniqueIndex("finance_expense_categories_workspace_code_unique").on(table.workspaceId, table.code),
    index("finance_expense_categories_workspace_status_idx").on(table.workspaceId, table.status),
  ],
);

export const financeExpenses = mysqlTable(
  "finance_expenses",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    categoryId: char("category_id", { length: 36 })
      .notNull()
      .references(() => financeExpenseCategories.id, { onDelete: "restrict", onUpdate: "cascade" }),
    expenseNumber: varchar("expense_number", { length: 80 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    amountCents: int("amount_cents").notNull(),
    expenseDate: varchar("expense_date", { length: 20 }).notNull(),
    payee: varchar("payee", { length: 180 }).notNull(),
    paymentMethod: varchar("payment_method", { length: 40 }).notNull().default("bank_transfer"),
    status: varchar("status", { length: 40 }).notNull().default("draft"),
    payload: json("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("finance_expenses_workspace_number_unique").on(table.workspaceId, table.expenseNumber),
    index("finance_expenses_workspace_status_idx").on(table.workspaceId, table.status),
    index("finance_expenses_workspace_date_idx").on(table.workspaceId, table.expenseDate),
  ],
);

export const financeIncomes = mysqlTable(
  "finance_incomes",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    incomeNumber: varchar("income_number", { length: 80 }).notNull(),
    source: varchar("source", { length: 160 }).notNull(),
    category: varchar("category", { length: 80 }).notNull(),
    amountCents: int("amount_cents").notNull(),
    receivedDate: varchar("received_date", { length: 20 }).notNull(),
    paymentMethod: varchar("payment_method", { length: 40 }).notNull().default("cash"),
    status: varchar("status", { length: 40 }).notNull().default("received"),
    payload: json("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("finance_incomes_workspace_number_unique").on(table.workspaceId, table.incomeNumber),
    index("finance_incomes_workspace_date_idx").on(table.workspaceId, table.receivedDate),
  ],
);

export const financeAccounts = mysqlTable(
  "finance_accounts",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
    accountNumber: varchar("account_number", { length: 80 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    accountType: varchar("account_type", { length: 40 }).notNull().default("bank"),
    balanceCents: int("balance_cents").notNull().default(0),
    status: varchar("status", { length: 40 }).notNull().default("active"),
    payload: json("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("finance_accounts_workspace_number_unique").on(table.workspaceId, table.accountNumber),
    index("finance_accounts_workspace_status_idx").on(table.workspaceId, table.status),
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
    referenceNumber: varchar("reference_number", { length: 80 }),
    applicationNumber: varchar("application_number", { length: 80 }),
    payload: json("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("portal_requests_workspace_ref_num_unique").on(
      table.workspaceId,
      table.referenceNumber,
    ),
    uniqueIndex("portal_requests_workspace_app_num_unique").on(
      table.workspaceId,
      table.applicationNumber,
    ),
    index("portal_requests_user_idx").on(
      table.workspaceId,
      table.requesterUserId,
      table.requesterRole,
    ),
    index("portal_requests_student_idx").on(table.workspaceId, table.studentId),
  ],
);

export const knowledgeCollections = mysqlTable(
  "knowledge_collections",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade", onUpdate: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 200 }).notNull(),
    description: text("description"),
    industry: varchar("industry", { length: 60 }).notNull().default("education"),
    visibility: varchar("visibility", { length: 20 }).notNull().default("workspace"),
    accessPolicy: json("access_policy").$type<Record<string, unknown>>(),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    createdBy: char("created_by", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict", onUpdate: "cascade" }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index("knowledge_collections_org_ws_status_idx").on(
      table.organizationId,
      table.workspaceId,
      table.status,
    ),
    uniqueIndex("knowledge_collections_org_slug_idx").on(table.organizationId, table.slug),
  ],
);

export const knowledgeSources = mysqlTable(
  "knowledge_sources",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id),
    workspaceId: char("workspace_id", { length: 36 }).references(() => workspaces.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    collectionId: char("collection_id", { length: 36 }).references(() => knowledgeCollections.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description").notNull(),
    type: mysqlEnum("type", ["text", "document", "structured"]).notNull(),
    visibility: mysqlEnum("visibility", ["internal", "private"]).notNull(),
    status: mysqlEnum("status", ["active", "archived"]).notNull().default("active"),
    content: text("content").notNull(),
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    ingestionStatus: varchar("ingestion_status", { length: 40 }).notNull().default("ready"),
    fileName: varchar("file_name", { length: 255 }),
    fileType: varchar("file_type", { length: 50 }),
    fileSizeBytes: bigint("file_size_bytes", { mode: "number" }),
    mimeType: varchar("mime_type", { length: 120 }),
    storageUri: varchar("storage_uri", { length: 500 }),
    storageBackend: varchar("storage_backend", { length: 40 }).notNull().default("database_durable"),
    currentVersion: int("current_version").notNull().default(1),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdBy: char("created_by", { length: 36 })
      .notNull()
      .references(() => users.id),
    createdAt: datetime("created_at").notNull(),
    updatedAt: datetime("updated_at").notNull(),
  },
  (table) => [
    index("knowledge_sources_tenant_idx").on(table.organizationId, table.status),
    index("knowledge_sources_collection_idx").on(table.collectionId),
    index("knowledge_sources_ws_idx").on(table.workspaceId),
  ],
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
    workspaceId: char("workspace_id", { length: 36 }).references(() => workspaces.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    ordinal: int("ordinal").notNull(),
    sectionHeading: varchar("section_heading", { length: 255 }),
    pageNumber: int("page_number"),
    tokenCount: int("token_count").notNull().default(0),
    contentHash: varchar("content_hash", { length: 64 }),
    content: text("content").notNull(),
  },
  (table) => [
    uniqueIndex("knowledge_chunks_source_ordinal_idx").on(table.sourceId, table.ordinal),
    index("knowledge_chunks_tenant_idx").on(table.organizationId),
  ],
);

export const aiAgentKnowledgeDocuments = mysqlTable(
  "ai_agent_knowledge_documents",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade", onUpdate: "cascade" }),
    sourceId: char("source_id", { length: 36 })
      .notNull()
      .references(() => knowledgeSources.id, { onDelete: "cascade", onUpdate: "cascade" }),
    version: int("version").notNull().default(1),
    contentType: varchar("content_type", { length: 120 }).notNull(),
    rawContent: text("raw_content"),
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    checksum: varchar("checksum", { length: 128 }).notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("ai_agent_knowledge_docs_source_ver_idx").on(table.sourceId, table.version),
    index("ai_agent_knowledge_docs_org_ws_idx").on(table.organizationId, table.workspaceId),
  ],
);

export const aiAgentKnowledgeEmbeddings = mysqlTable(
  "ai_agent_knowledge_embeddings",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade", onUpdate: "cascade" }),
    sourceId: char("source_id", { length: 36 })
      .notNull()
      .references(() => knowledgeSources.id, { onDelete: "cascade", onUpdate: "cascade" }),
    chunkId: char("chunk_id", { length: 36 })
      .notNull()
      .references(() => knowledgeChunks.id, { onDelete: "cascade", onUpdate: "cascade" }),
    provider: varchar("provider", { length: 60 }).notNull().default("mock"),
    model: varchar("model", { length: 120 }).notNull().default("mock-text-embedding"),
    dimensions: int("dimensions").notNull().default(1536),
    embedding: json("embedding").$type<number[]>().notNull(),
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("ai_agent_knowledge_embeddings_chunk_unique").on(table.chunkId),
    index("ai_agent_knowledge_embeddings_source_idx").on(table.sourceId),
    index("ai_agent_knowledge_embeddings_org_ws_idx").on(table.organizationId, table.workspaceId),
  ],
);

export const aiAgentKnowledgeRetrievals = mysqlTable(
  "ai_agent_knowledge_retrievals",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade", onUpdate: "cascade" }),
    agentId: char("agent_id", { length: 36 }),
    runId: char("run_id", { length: 36 }),
    query: varchar("query", { length: 1000 }).notNull(),
    retrievalMode: varchar("retrieval_mode", { length: 40 }).notNull().default("hybrid"),
    matchedChunkIds: json("matched_chunk_ids").$type<string[]>().notNull(),
    scores: json("scores").$type<Record<string, number>>().notNull(),
    latencyMs: int("latency_ms").notNull().default(0),
    requestedBy: char("requested_by", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict", onUpdate: "cascade" }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("ai_agent_knowledge_ret_org_created_idx").on(table.organizationId, table.createdAt),
    index("ai_agent_knowledge_ret_run_idx").on(table.runId),
  ],
);

export const aiProviderTenantConfigs = mysqlTable(
  "ai_provider_tenant_configs",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    providerId: varchar("provider_id", { length: 60 }).notNull(),
    liveModeEnabled: boolean("live_mode_enabled").notNull().default(false),
    environmentMode: varchar("environment_mode", { length: 30 }).notNull().default("mock"),
    apiKeyEncrypted: text("api_key_encrypted"),
    apiKeyMasked: varchar("api_key_masked", { length: 60 }),
    defaultModel: varchar("default_model", { length: 120 }).notNull().default("gpt-4o-mini"),
    allowedModels: json("allowed_models").$type<string[]>().notNull().default(["gpt-4o-mini", "gpt-4o"]),
    embeddingModel: varchar("embedding_model", { length: 120 }).notNull().default("text-embedding-3-small"),
    embeddingLiveEnabled: boolean("embedding_live_enabled").notNull().default(false),
    status: varchar("status", { length: 40 }).notNull().default("inactive"),
    statusMessage: varchar("status_message", { length: 500 }),
    lastHealthCheckAt: timestamp("last_health_check_at", { fsp: 3 }),
    updatedBy: char("updated_by", { length: 36 }).references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("ai_provider_tenant_configs_org_provider_unique").on(
      table.organizationId,
      table.providerId,
    ),
    index("ai_provider_tenant_configs_org_idx").on(table.organizationId),
  ],
);

export const aiProviderAuditLogs = mysqlTable(
  "ai_provider_audit_logs",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    providerId: varchar("provider_id", { length: 60 }).notNull(),
    action: varchar("action", { length: 80 }).notNull(),
    performedBy: char("performed_by", { length: 36 }).references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    previousState: json("previous_state").$type<Record<string, unknown>>(),
    newState: json("new_state").$type<Record<string, unknown>>(),
    ipAddress: varchar("ip_address", { length: 45 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("ai_provider_audit_logs_org_provider_idx").on(
      table.organizationId,
      table.providerId,
      table.createdAt,
    ),
    index("ai_provider_audit_logs_org_idx").on(table.organizationId),
  ],
);

export const aiModelPricingCatalog = mysqlTable(
  "ai_model_pricing_catalog",
  {
    id: char("id", { length: 36 }).primaryKey(),
    providerId: varchar("provider_id", { length: 60 }).notNull(),
    modelId: varchar("model_id", { length: 120 }).notNull(),
    promptPerThousandTokensUsd: decimal("prompt_per_thousand_tokens_usd", {
      precision: 10,
      scale: 6,
    }).notNull(),
    completionPerThousandTokensUsd: decimal("completion_per_thousand_tokens_usd", {
      precision: 10,
      scale: 6,
    }).notNull(),
    embeddingPerThousandTokensUsd: decimal("embedding_per_thousand_tokens_usd", {
      precision: 10,
      scale: 6,
    })
      .notNull()
      .default("0.000000"),
    contextWindow: int("context_window").notNull().default(128000),
    maxOutputTokens: int("max_output_tokens").notNull().default(4096),
    supportsStreaming: boolean("supports_streaming").notNull().default(true),
    supportsTools: boolean("supports_tools").notNull().default(true),
    supportsVision: boolean("supports_vision").notNull().default(false),
    supportsJsonMode: boolean("supports_json_mode").notNull().default(true),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("ai_model_pricing_catalog_provider_model_unique").on(
      table.providerId,
      table.modelId,
    ),
    index("ai_model_pricing_catalog_provider_idx").on(table.providerId),
  ],
);

export const aiUsageBudgets = mysqlTable(
  "ai_usage_budgets",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 }).references(() => workspaces.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    monthlyBudgetUsd: decimal("monthly_budget_usd", { precision: 10, scale: 4 })
      .notNull()
      .default("50.0000"),
    dailyBudgetUsd: decimal("daily_budget_usd", { precision: 10, scale: 4 })
      .notNull()
      .default("10.0000"),
    perRequestMaxCostUsd: decimal("per_request_max_cost_usd", { precision: 10, scale: 4 })
      .notNull()
      .default("1.0000"),
    currentMonthSpendUsd: decimal("current_month_spend_usd", { precision: 10, scale: 4 })
      .notNull()
      .default("0.0000"),
    currentDaySpendUsd: decimal("current_day_spend_usd", { precision: 10, scale: 4 })
      .notNull()
      .default("0.0000"),
    monthResetAt: timestamp("month_reset_at", { fsp: 3 }).notNull().defaultNow(),
    dayResetAt: timestamp("day_reset_at", { fsp: 3 }).notNull().defaultNow(),
    enforceHardLimit: boolean("enforce_hard_limit").notNull().default(true),
    notifyThresholdPercent: int("notify_threshold_percent").notNull().default(80),
    status: varchar("status", { length: 40 }).notNull().default("active"),
    updatedBy: char("updated_by", { length: 36 }).references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("ai_usage_budgets_org_workspace_unique").on(
      table.organizationId,
      table.workspaceId,
    ),
    index("ai_usage_budgets_org_idx").on(table.organizationId),
  ],
);

export const aiUsageLedger = mysqlTable(
  "ai_usage_ledger",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 }).references(() => workspaces.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    agentId: char("agent_id", { length: 36 }).references(() => aiAgentDefinitions.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    runId: char("run_id", { length: 36 }).references(() => aiAgentRuns.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    providerId: varchar("provider_id", { length: 60 }).notNull(),
    modelId: varchar("model_id", { length: 120 }).notNull(),
    operationType: varchar("operation_type", { length: 40 }).notNull(),
    promptTokens: int("prompt_tokens").notNull().default(0),
    completionTokens: int("completion_tokens").notNull().default(0),
    totalTokens: int("total_tokens").notNull().default(0),
    estimatedCostUsd: decimal("estimated_cost_usd", { precision: 10, scale: 6 })
      .notNull()
      .default("0.000000"),
    actualCostUsd: decimal("actual_cost_usd", { precision: 10, scale: 6 }),
    latencyMs: int("latency_ms").notNull().default(0),
    finishReason: varchar("finish_reason", { length: 40 }),
    isLiveMode: boolean("is_live_mode").notNull().default(false),
    correlationId: varchar("correlation_id", { length: 120 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("ai_usage_ledger_org_created_idx").on(table.organizationId, table.createdAt),
    index("ai_usage_ledger_run_idx").on(table.runId),
    index("ai_usage_ledger_correlation_idx").on(table.correlationId),
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


// ============================================================================
// Epic 19 — Multi-Agent Collaboration & Orchestration Schema
// ============================================================================

export const agentTeams = mysqlTable(
  "agent_teams",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade", onUpdate: "cascade" }),
    name: varchar("name", { length: 180 }).notNull(),
    description: varchar("description", { length: 1000 }).notNull(),
    status: varchar("status", { length: 40 }).notNull().default("active"),
    createdBy: char("created_by", { length: 36 }).references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index("agent_teams_org_idx").on(table.organizationId),
    index("agent_teams_workspace_idx").on(table.workspaceId),
  ],
);

export const agentTeamMembers = mysqlTable(
  "agent_team_members",
  {
    id: char("id", { length: 36 }).primaryKey(),
    teamId: char("team_id", { length: 36 })
      .notNull()
      .references(() => agentTeams.id, { onDelete: "cascade", onUpdate: "cascade" }),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    agentId: char("agent_id", { length: 36 })
      .notNull()
      .references(() => aiAgentDefinitions.id, { onDelete: "cascade", onUpdate: "cascade" }),
    role: varchar("role", { length: 60 }).notNull(),
    capabilities: json("capabilities").$type<string[]>().notNull(),
    priority: int("priority").notNull().default(0),
    status: varchar("status", { length: 40 }).notNull().default("active"),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("agent_team_members_team_agent_unique").on(table.teamId, table.agentId),
    index("agent_team_members_team_idx").on(table.teamId),
    index("agent_team_members_agent_idx").on(table.agentId),
    index("agent_team_members_org_idx").on(table.organizationId),
  ],
);

export const agentWorkflowDefinitions = mysqlTable(
  "agent_workflow_definitions",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade", onUpdate: "cascade" }),
    teamId: char("team_id", { length: 36 }).references(() => agentTeams.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    name: varchar("name", { length: 180 }).notNull(),
    description: varchar("description", { length: 1000 }).notNull(),
    pattern: varchar("pattern", { length: 60 }).notNull().default("sequential"),
    status: varchar("status", { length: 40 }).notNull().default("draft"),
    version: varchar("version", { length: 40 }).notNull().default("1.0.0"),
    revision: int("revision").notNull().default(1),
    inputSchema: json("input_schema").$type<Record<string, unknown>>().notNull(),
    outputSchema: json("output_schema").$type<Record<string, unknown>>(),
    configuration: json("configuration").$type<Record<string, unknown>>().notNull(),
    createdBy: char("created_by", { length: 36 }).references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index("agent_wf_defs_org_status_idx").on(table.organizationId, table.status),
    index("agent_wf_defs_workspace_idx").on(table.workspaceId),
    index("agent_wf_defs_team_idx").on(table.teamId),
  ],
);

export const agentWorkflowSteps = mysqlTable(
  "agent_workflow_steps",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workflowDefinitionId: char("workflow_definition_id", { length: 36 })
      .notNull()
      .references(() => agentWorkflowDefinitions.id, { onDelete: "cascade", onUpdate: "cascade" }),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    stepKey: varchar("step_key", { length: 80 }).notNull(),
    name: varchar("name", { length: 180 }).notNull(),
    description: varchar("description", { length: 1000 }).notNull(),
    stepOrder: int("step_order").notNull().default(0),
    assignedRole: varchar("assigned_role", { length: 60 }).notNull(),
    assignedAgentId: char("assigned_agent_id", { length: 36 }).references(
      () => aiAgentDefinitions.id,
      { onDelete: "set null", onUpdate: "cascade" },
    ),
    dependsOnStepKeys: json("depends_on_step_keys").$type<string[]>().notNull(),
    requiresApproval: boolean("requires_approval").notNull().default(false),
    approvalRoles: json("approval_roles").$type<string[]>(),
    inputMapping: json("input_mapping").$type<Record<string, unknown>>().notNull(),
    outputKey: varchar("output_key", { length: 80 }).notNull(),
    maxRetries: int("max_retries").notNull().default(2),
    timeoutSeconds: int("timeout_seconds").notNull().default(300),
    configuration: json("configuration").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("agent_wf_steps_def_key_unique").on(table.workflowDefinitionId, table.stepKey),
    index("agent_wf_steps_def_idx").on(table.workflowDefinitionId),
    index("agent_wf_steps_org_idx").on(table.organizationId),
    index("agent_wf_steps_agent_idx").on(table.assignedAgentId),
  ],
);

export const agentWorkflowRuns = mysqlTable(
  "agent_workflow_runs",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade", onUpdate: "cascade" }),
    workflowDefinitionId: char("workflow_definition_id", { length: 36 })
      .notNull()
      .references(() => agentWorkflowDefinitions.id, { onDelete: "restrict", onUpdate: "cascade" }),
    teamId: char("team_id", { length: 36 }).references(() => agentTeams.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    workflowRevision: int("workflow_revision").notNull().default(1),
    initiatorUserId: char("initiator_user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict", onUpdate: "cascade" }),
    status: varchar("status", { length: 40 }).notNull().default("queued"),
    idempotencyKey: varchar("idempotency_key", { length: 160 }),
    initialInput: json("initial_input").$type<Record<string, unknown>>().notNull(),
    finalOutput: json("final_output").$type<Record<string, unknown>>(),
    sharedContext: json("shared_context").$type<Record<string, unknown>>().notNull(),
    currentStepKey: varchar("current_step_key", { length: 80 }),
    totalDurationMs: int("total_duration_ms").notNull().default(0),
    totalEstimatedCostUsd: decimal("total_estimated_cost_usd", { precision: 10, scale: 6 })
      .notNull()
      .default("0.000000"),
    totalPromptTokens: int("total_prompt_tokens").notNull().default(0),
    totalCompletionTokens: int("total_completion_tokens").notNull().default(0),
    safeErrorMessage: varchar("safe_error_message", { length: 1000 }),
    startedAt: timestamp("started_at", { fsp: 3 }),
    completedAt: timestamp("completed_at", { fsp: 3 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("agent_wf_runs_idempotency_unique").on(
      table.workspaceId,
      table.workflowDefinitionId,
      table.idempotencyKey,
    ),
    index("agent_wf_runs_org_status_idx").on(table.organizationId, table.status),
    index("agent_wf_runs_workspace_status_idx").on(table.workspaceId, table.status),
    index("agent_wf_runs_wf_def_idx").on(table.workflowDefinitionId),
    index("agent_wf_runs_initiator_idx").on(table.initiatorUserId),
  ],
);

export const agentWorkflowStepRuns = mysqlTable(
  "agent_workflow_step_runs",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workflowRunId: char("workflow_run_id", { length: 36 })
      .notNull()
      .references(() => agentWorkflowRuns.id, { onDelete: "cascade", onUpdate: "cascade" }),
    stepId: char("step_id", { length: 36 })
      .notNull()
      .references(() => agentWorkflowSteps.id, { onDelete: "restrict", onUpdate: "cascade" }),
    stepKey: varchar("step_key", { length: 80 }).notNull(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    assignedAgentId: char("assigned_agent_id", { length: 36 }).references(
      () => aiAgentDefinitions.id,
      { onDelete: "set null", onUpdate: "cascade" },
    ),
    agentRunId: char("agent_run_id", { length: 36 }).references(() => aiAgentRuns.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    status: varchar("status", { length: 40 }).notNull().default("pending"),
    attempt: int("attempt").notNull().default(1),
    inputPayload: json("input_payload").$type<Record<string, unknown>>().notNull(),
    outputPayload: json("output_payload").$type<Record<string, unknown>>(),
    stepArtifacts: json("step_artifacts").$type<Array<Record<string, unknown>>>(),
    safeErrorMessage: varchar("safe_error_message", { length: 1000 }),
    durationMs: int("duration_ms").notNull().default(0),
    startedAt: timestamp("started_at", { fsp: 3 }),
    completedAt: timestamp("completed_at", { fsp: 3 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("agent_wf_step_runs_run_step_attempt_unique").on(
      table.workflowRunId,
      table.stepKey,
      table.attempt,
    ),
    index("agent_wf_step_runs_run_idx").on(table.workflowRunId),
    index("agent_wf_step_runs_step_idx").on(table.stepId),
    index("agent_wf_step_runs_agent_run_idx").on(table.agentRunId),
    index("agent_wf_step_runs_org_status_idx").on(table.organizationId, table.status),
  ],
);

export const agentWorkflowArtifacts = mysqlTable(
  "agent_workflow_artifacts",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workflowRunId: char("workflow_run_id", { length: 36 })
      .notNull()
      .references(() => agentWorkflowRuns.id, { onDelete: "cascade", onUpdate: "cascade" }),
    stepRunId: char("step_run_id", { length: 36 }).references(() => agentWorkflowStepRuns.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade", onUpdate: "cascade" }),
    artifactType: varchar("artifact_type", { length: 60 }).notNull(),
    name: varchar("name", { length: 180 }).notNull(),
    content: json("content").$type<Record<string, unknown>>().notNull(),
    provenance: json("provenance").$type<Record<string, unknown>>().notNull(),
    citations: json("citations").$type<Array<Record<string, unknown>>>(),
    visibility: varchar("visibility", { length: 40 }).notNull().default("workspace"),
    createdBy: char("created_by", { length: 36 }).references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index("agent_wf_artifacts_run_idx").on(table.workflowRunId),
    index("agent_wf_artifacts_step_idx").on(table.stepRunId),
    index("agent_wf_artifacts_org_idx").on(table.organizationId),
    index("agent_wf_artifacts_workspace_idx").on(table.workspaceId),
  ],
);

export const agentWorkflowEvents = mysqlTable(
  "agent_workflow_events",
  {
    id: char("id", { length: 36 }).primaryKey(),
    workflowRunId: char("workflow_run_id", { length: 36 })
      .notNull()
      .references(() => agentWorkflowRuns.id, { onDelete: "cascade", onUpdate: "cascade" }),
    stepRunId: char("step_run_id", { length: 36 }).references(() => agentWorkflowStepRuns.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    eventType: varchar("event_type", { length: 80 }).notNull(),
    payload: json("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("agent_wf_events_run_created_idx").on(table.workflowRunId, table.createdAt),
    index("agent_wf_events_org_idx").on(table.organizationId),
  ],
);


export const autonomousTaskPolicies = mysqlTable(
  "autonomous_task_policies",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade", onUpdate: "cascade" }),
    maxActiveTasks: int("max_active_tasks").notNull().default(10),
    maxGlobalConcurrency: int("max_global_concurrency").notNull().default(5),
    defaultAutonomyLevel: varchar("default_autonomy_level", { length: 20 }).notNull().default("L1"),
    allowedAutonomyLevels: json("allowed_autonomy_levels").$type<string[]>().notNull(),
    emergencyStopAll: boolean("emergency_stop_all").notNull().default(false),
    emergencyStoppedAt: timestamp("emergency_stopped_at", { fsp: 3 }),
    emergencyStoppedBy: char("emergency_stopped_by", { length: 36 }).references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("auto_policies_org_ws_unique").on(table.organizationId, table.workspaceId),
  ],
);

export const autonomousTaskDefinitions = mysqlTable(
  "autonomous_task_definitions",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade", onUpdate: "cascade" }),
    name: varchar("name", { length: 180 }).notNull(),
    description: varchar("description", { length: 1000 }).notNull(),
    autonomyLevel: varchar("autonomy_level", { length: 20 }).notNull().default("L1"),
    targetType: varchar("target_type", { length: 40 }).notNull(),
    workflowDefinitionId: char("workflow_definition_id", { length: 36 }).references(
      () => agentWorkflowDefinitions.id,
      { onDelete: "set null", onUpdate: "cascade" },
    ),
    agentId: char("agent_id", { length: 36 }).references(() => aiAgentDefinitions.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    status: varchar("status", { length: 40 }).notNull().default("active"),
    executionPolicy: json("execution_policy").$type<{
      maxRuntimeSeconds: number;
      maxRetries: number;
      timeoutSeconds: number;
      maxConcurrency: number;
      retryDelaySeconds: number;
    }>().notNull(),
    approvalPolicy: json("approval_policy").$type<{
      requireApprovalForMutations: boolean;
      requireApprovalOnReplanning: boolean;
      allowedApproverRoles: string[];
    }>().notNull(),
    limits: json("limits").$type<{
      maxDailyRuns: number;
      maxTokensPerRun: number;
      maxCostUsdPerRun: number;
    }>().notNull(),
    defaultInput: json("default_input").$type<Record<string, unknown>>().notNull().default({}),
    createdBy: char("created_by", { length: 36 }).references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    emergencyStoppedAt: timestamp("emergency_stopped_at", { fsp: 3 }),
    emergencyStoppedBy: char("emergency_stopped_by", { length: 36 }).references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    emergencyStopReason: varchar("emergency_stop_reason", { length: 500 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index("auto_tasks_org_status_idx").on(table.organizationId, table.status),
    index("auto_tasks_workspace_idx").on(table.workspaceId),
    index("auto_tasks_wf_idx").on(table.workflowDefinitionId),
    index("auto_tasks_agent_idx").on(table.agentId),
  ],
);

export const autonomousTaskTriggers = mysqlTable(
  "autonomous_task_triggers",
  {
    id: char("id", { length: 36 }).primaryKey(),
    taskDefinitionId: char("task_definition_id", { length: 36 })
      .notNull()
      .references(() => autonomousTaskDefinitions.id, { onDelete: "cascade", onUpdate: "cascade" }),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade", onUpdate: "cascade" }),
    name: varchar("name", { length: 180 }).notNull(),
    triggerType: varchar("trigger_type", { length: 40 }).notNull(),
    scheduleType: varchar("schedule_type", { length: 40 }),
    cronExpression: varchar("cron_expression", { length: 100 }),
    timezone: varchar("timezone", { length: 80 }).notNull().default("UTC"),
    scheduledAt: timestamp("scheduled_at", { fsp: 3 }),
    nextRunAt: timestamp("next_run_at", { fsp: 3 }),
    lastRunAt: timestamp("last_run_at", { fsp: 3 }),
    eventPattern: varchar("event_pattern", { length: 255 }),
    missedSchedulePolicy: varchar("missed_schedule_policy", { length: 40 })
      .notNull()
      .default("run_once"),
    isEnabled: boolean("is_enabled").notNull().default(true),
    configuration: json("configuration").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index("auto_triggers_task_idx").on(table.taskDefinitionId),
    index("auto_triggers_next_run_idx").on(table.isEnabled, table.nextRunAt),
    index("auto_triggers_event_idx").on(table.isEnabled, table.eventPattern),
    index("auto_triggers_org_idx").on(table.organizationId),
  ],
);

export const autonomousTaskRuns = mysqlTable(
  "autonomous_task_runs",
  {
    id: char("id", { length: 36 }).primaryKey(),
    taskDefinitionId: char("task_definition_id", { length: 36 })
      .notNull()
      .references(() => autonomousTaskDefinitions.id, { onDelete: "cascade", onUpdate: "cascade" }),
    triggerId: char("trigger_id", { length: 36 }).references(() => autonomousTaskTriggers.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade", onUpdate: "cascade" }),
    workflowRunId: char("workflow_run_id", { length: 36 }).references(
      () => agentWorkflowRuns.id,
      { onDelete: "set null", onUpdate: "cascade" },
    ),
    agentRunId: char("agent_run_id", { length: 36 }).references(() => aiAgentRuns.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    status: varchar("status", { length: 40 }).notNull().default("queued"),
    idempotencyKey: varchar("idempotency_key", { length: 180 }).notNull(),
    autonomyLevel: varchar("autonomy_level", { length: 20 }).notNull().default("L1"),
    workerId: varchar("worker_id", { length: 120 }),
    leasedAt: timestamp("leased_at", { fsp: 3 }),
    leaseExpiresAt: timestamp("lease_expires_at", { fsp: 3 }),
    heartbeatAt: timestamp("heartbeat_at", { fsp: 3 }),
    retryCount: int("retry_count").notNull().default(0),
    maxRetries: int("max_retries").notNull().default(3),
    inputPayload: json("input_payload").$type<Record<string, unknown>>().notNull().default({}),
    outputPayload: json("output_payload").$type<Record<string, unknown>>(),
    errorDetails: json("error_details").$type<Record<string, unknown>>(),
    adaptationHistory: json("adaptation_history")
      .$type<Array<Record<string, unknown>>>()
      .notNull()
      .default([]),
    currentPlanRevision: int("current_plan_revision").notNull().default(0),
    startedAt: timestamp("started_at", { fsp: 3 }),
    completedAt: timestamp("completed_at", { fsp: 3 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("auto_runs_idempotency_unique").on(
      table.workspaceId,
      table.taskDefinitionId,
      table.idempotencyKey,
    ),
    index("auto_runs_status_lease_idx").on(table.status, table.leaseExpiresAt),
    index("auto_runs_org_status_idx").on(table.organizationId, table.status),
    index("auto_runs_task_idx").on(table.taskDefinitionId),
    index("auto_runs_worker_idx").on(table.workerId),
  ],
);

export const autonomousTaskCheckpoints = mysqlTable(
  "autonomous_task_checkpoints",
  {
    id: char("id", { length: 36 }).primaryKey(),
    taskRunId: char("task_run_id", { length: 36 })
      .notNull()
      .references(() => autonomousTaskRuns.id, { onDelete: "cascade", onUpdate: "cascade" }),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    checkpointType: varchar("checkpoint_type", { length: 60 }).notNull(),
    stepPointer: varchar("step_pointer", { length: 100 }),
    stateSnapshot: json("state_snapshot").$type<Record<string, unknown>>().notNull(),
    metadata: json("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("auto_chkpt_run_idx").on(table.taskRunId),
    index("auto_chkpt_org_idx").on(table.organizationId),
  ],
);

export const autonomousTaskEvents = mysqlTable(
  "autonomous_task_events",
  {
    id: char("id", { length: 36 }).primaryKey(),
    taskRunId: char("task_run_id", { length: 36 })
      .notNull()
      .references(() => autonomousTaskRuns.id, { onDelete: "cascade", onUpdate: "cascade" }),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    eventType: varchar("event_type", { length: 80 }).notNull(),
    payload: json("payload").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("auto_events_run_created_idx").on(table.taskRunId, table.createdAt),
    index("auto_events_org_idx").on(table.organizationId),
  ],
);


export const agentTraceSpans = mysqlTable(
  "agent_trace_spans",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 }).references(() => workspaces.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    traceId: varchar("trace_id", { length: 64 }).notNull(),
    spanId: varchar("span_id", { length: 64 }).notNull(),
    parentSpanId: varchar("parent_span_id", { length: 64 }),
    name: varchar("name", { length: 120 }).notNull(),
    kind: varchar("kind", { length: 30 }).notNull().default("internal"),
    status: varchar("status", { length: 20 }).notNull().default("ok"),
    statusCode: int("status_code").notNull().default(0),
    statusMessage: text("status_message"),
    durationMs: int("duration_ms").notNull().default(0),
    startTime: timestamp("start_time", { fsp: 3 }).notNull(),
    endTime: timestamp("end_time", { fsp: 3 }),
    serviceName: varchar("service_name", { length: 60 }).notNull().default("haza-aios-agent"),
    attributes: json("attributes").$type<Record<string, unknown>>().notNull().default({}),
    events: json("events").$type<Array<Record<string, unknown>>>().notNull().default([]),
    agentId: char("agent_id", { length: 36 }).references(() => aiAgentDefinitions.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    agentRunId: char("agent_run_id", { length: 36 }).references(() => aiAgentRuns.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    workflowRunId: char("workflow_run_id", { length: 36 }).references(() => agentWorkflowRuns.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    autonomousRunId: char("autonomous_run_id", { length: 36 }).references(() => autonomousTaskRuns.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("trace_spans_trace_idx").on(table.traceId),
    index("trace_spans_org_time_idx").on(table.organizationId, table.startTime),
    index("trace_spans_parent_idx").on(table.parentSpanId),
    index("trace_spans_agent_run_idx").on(table.agentRunId),
    index("trace_spans_wf_run_idx").on(table.workflowRunId),
  ],
);

export const agentEvaluationDatasets = mysqlTable(
  "agent_evaluation_datasets",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 }).references(() => workspaces.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    targetType: varchar("target_type", { length: 40 }).notNull().default("agent"),
    targetId: char("target_id", { length: 36 }),
    version: varchar("version", { length: 30 }).notNull().default("1.0.0"),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    metadata: json("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdBy: char("created_by", { length: 36 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("eval_ds_org_target_idx").on(table.organizationId, table.targetType),
  ],
);

export const agentEvaluationCases = mysqlTable(
  "agent_evaluation_cases",
  {
    id: char("id", { length: 36 }).primaryKey(),
    datasetId: char("dataset_id", { length: 36 })
      .notNull()
      .references(() => agentEvaluationDatasets.id, { onDelete: "cascade", onUpdate: "cascade" }),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    name: varchar("name", { length: 150 }).notNull(),
    description: text("description"),
    inputPrompt: text("input_prompt").notNull(),
    inputContext: json("input_context").$type<Record<string, unknown>>().notNull().default({}),
    expectedOutput: text("expected_output"),
    expectedOutputSchema: json("expected_output_schema").$type<Record<string, unknown>>(),
    expectedTools: json("expected_tools").$type<string[]>().notNull().default([]),
    requiredCitations: json("required_citations").$type<string[]>().notNull().default([]),
    gradingCriteria: json("grading_criteria").$type<Record<string, unknown>>().notNull().default({}),
    orderIndex: int("order_index").notNull().default(0),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("eval_cases_ds_idx").on(table.datasetId, table.orderIndex),
    index("eval_cases_org_idx").on(table.organizationId),
  ],
);

export const agentEvaluationRuns = mysqlTable(
  "agent_evaluation_runs",
  {
    id: char("id", { length: 36 }).primaryKey(),
    datasetId: char("dataset_id", { length: 36 })
      .notNull()
      .references(() => agentEvaluationDatasets.id, { onDelete: "cascade", onUpdate: "cascade" }),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 }).references(() => workspaces.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    targetType: varchar("target_type", { length: 40 }).notNull().default("agent"),
    targetId: char("target_id", { length: 36 }),
    status: varchar("status", { length: 30 }).notNull().default("running"),
    totalCases: int("total_cases").notNull().default(0),
    passedCases: int("passed_cases").notNull().default(0),
    failedCases: int("failed_cases").notNull().default(0),
    overallScore: decimal("overall_score", { precision: 5, scale: 2 }).notNull().default("0.00"),
    groundingScore: decimal("grounding_score", { precision: 5, scale: 2 }).notNull().default("0.00"),
    toolAccuracyScore: decimal("tool_accuracy_score", { precision: 5, scale: 2 }).notNull().default("0.00"),
    formatComplianceScore: decimal("format_compliance_score", { precision: 5, scale: 2 }).notNull().default("0.00"),
    isBaseline: boolean("is_baseline").notNull().default(false),
    comparedToRunId: char("compared_to_run_id", { length: 36 }),
    scoreDelta: decimal("score_delta", { precision: 5, scale: 2 }).notNull().default("0.00"),
    summaryResults: json("summary_results").$type<Array<Record<string, unknown>>>().notNull().default([]),
    evaluatedBy: char("evaluated_by", { length: 36 }),
    durationMs: int("duration_ms").notNull().default(0),
    startedAt: timestamp("started_at", { fsp: 3 }),
    completedAt: timestamp("completed_at", { fsp: 3 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("eval_runs_org_ds_created_idx").on(table.organizationId, table.datasetId, table.createdAt),
  ],
);

export const agentSloDefinitions = mysqlTable(
  "agent_slo_definitions",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 }).references(() => workspaces.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    metricType: varchar("metric_type", { length: 60 }).notNull(),
    targetType: varchar("target_type", { length: 40 }).notNull().default("all"),
    targetId: char("target_id", { length: 36 }),
    targetValue: decimal("target_value", { precision: 10, scale: 4 }).notNull(),
    comparisonOperator: varchar("comparison_operator", { length: 10 }).notNull().default("gte"),
    windowDurationMinutes: int("window_duration_minutes").notNull().default(1440),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("slo_defs_org_metric_idx").on(table.organizationId, table.metricType),
  ],
);

export const agentReliabilityMetrics = mysqlTable(
  "agent_reliability_metrics",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 }).references(() => workspaces.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    windowStart: timestamp("window_start", { fsp: 3 }).notNull(),
    windowEnd: timestamp("window_end", { fsp: 3 }).notNull(),
    totalRuns: int("total_runs").notNull().default(0),
    successfulRuns: int("successful_runs").notNull().default(0),
    failedRuns: int("failed_runs").notNull().default(0),
    successRate: decimal("success_rate", { precision: 5, scale: 2 }).notNull().default("100.00"),
    p50LatencyMs: int("p50_latency_ms").notNull().default(0),
    p95LatencyMs: int("p95_latency_ms").notNull().default(0),
    p99LatencyMs: int("p99_latency_ms").notNull().default(0),
    activeWorkerCount: int("active_worker_count").notNull().default(1),
    queueBacklog: int("queue_backlog").notNull().default(0),
    staleLeasesReclaimed: int("stale_leases_reclaimed").notNull().default(0),
    circuitBreakerTrips: int("circuit_breaker_trips").notNull().default(0),
    rateLimitHits: int("rate_limit_hits").notNull().default(0),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("rel_metrics_org_window_idx").on(table.organizationId, table.windowStart),
  ],
);

export const agentAlertRules = mysqlTable(
  "agent_alert_rules",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 }).references(() => workspaces.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    metricName: varchar("metric_name", { length: 60 }).notNull(),
    conditionOperator: varchar("condition_operator", { length: 10 }).notNull().default("gt"),
    thresholdValue: decimal("threshold_value", { precision: 10, scale: 4 }).notNull(),
    evaluationWindowMinutes: int("evaluation_window_minutes").notNull().default(15),
    severity: varchar("severity", { length: 20 }).notNull().default("warning"),
    isEnabled: boolean("is_enabled").notNull().default(true),
    channels: json("channels").$type<string[]>().notNull().default(["in_app"]),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("alert_rules_org_enabled_idx").on(table.organizationId, table.isEnabled),
  ],
);

export const agentIncidents = mysqlTable(
  "agent_incidents",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 }).references(() => workspaces.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    alertRuleId: char("alert_rule_id", { length: 36 }).references(() => agentAlertRules.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    title: varchar("title", { length: 180 }).notNull(),
    summary: text("summary").notNull(),
    severity: varchar("severity", { length: 20 }).notNull().default("warning"),
    status: varchar("status", { length: 20 }).notNull().default("open"),
    impactedService: varchar("impacted_service", { length: 80 }).notNull().default("agent-runtime"),
    impactedAgentId: char("impacted_agent_id", { length: 36 }),
    rootCause: text("root_cause"),
    mitigationSteps: text("mitigation_steps"),
    acknowledgedBy: char("acknowledged_by", { length: 36 }),
    acknowledgedAt: timestamp("acknowledged_at", { fsp: 3 }),
    resolvedBy: char("resolved_by", { length: 36 }),
    resolvedAt: timestamp("resolved_at", { fsp: 3 }),
    occurrenceCount: int("occurrence_count").notNull().default(1),
    metadata: json("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("incidents_org_status_idx").on(table.organizationId, table.status),
    index("incidents_org_created_idx").on(table.organizationId, table.createdAt),
  ],
);


export const agentGovernanceProfiles = mysqlTable(
  "agent_governance_profiles",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 }).references(() => workspaces.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    agentId: char("agent_id", { length: 36 })
      .notNull()
      .references(() => aiAgentDefinitions.id, { onDelete: "cascade", onUpdate: "cascade" }),
    securityClassification: varchar("security_classification", { length: 40 }).notNull().default("internal"),
    riskTier: varchar("risk_tier", { length: 40 }).notNull().default("medium"),
    complianceFrameworks: json("compliance_frameworks").$type<string[]>().notNull().default([]),
    maxAutonomyLevel: varchar("max_autonomy_level", { length: 20 }).notNull().default("L2"),
    approvalPolicy: varchar("approval_policy", { length: 40 }).notNull().default("standard"),
    auditFrequency: varchar("audit_frequency", { length: 40 }).notNull().default("quarterly"),
    strictTelemetry: boolean("strict_telemetry").notNull().default(true),
    reviewCadenceDays: int("review_cadence_days").notNull().default(90),
    lastReviewedAt: timestamp("last_reviewed_at", { fsp: 3 }),
    nextReviewDueAt: timestamp("next_review_due_at", { fsp: 3 }),
    complianceStatus: varchar("compliance_status", { length: 40 }).notNull().default("compliant"),
    notes: text("notes"),
    createdBy: char("created_by", { length: 36 }).notNull(),
    updatedBy: char("updated_by", { length: 36 }).notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("gov_profiles_org_agent_unique").on(table.organizationId, table.agentId),
    index("gov_profiles_org_status_idx").on(table.organizationId, table.complianceStatus),
    index("gov_profiles_org_tier_idx").on(table.organizationId, table.riskTier),
  ],
);

export const agentOwnershipAssignments = mysqlTable(
  "agent_ownership_assignments",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 }).references(() => workspaces.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    agentId: char("agent_id", { length: 36 })
      .notNull()
      .references(() => aiAgentDefinitions.id, { onDelete: "cascade", onUpdate: "cascade" }),
    primaryOwnerId: char("primary_owner_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict", onUpdate: "cascade" }),
    technicalOwnerId: char("technical_owner_id", { length: 36 }).references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    businessOwnerId: char("business_owner_id", { length: 36 }).references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    escalationContact: varchar("escalation_contact", { length: 255 }).notNull(),
    reviewCadence: varchar("review_cadence", { length: 40 }).notNull().default("quarterly"),
    accountabilityStatus: varchar("accountability_status", { length: 40 }).notNull().default("active"),
    delegatedApproverIds: json("delegated_approver_ids").$type<string[]>().notNull().default([]),
    assignedBy: char("assigned_by", { length: 36 }).notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("gov_ownership_org_agent_unique").on(table.organizationId, table.agentId),
    index("gov_ownership_org_primary_idx").on(table.organizationId, table.primaryOwnerId),
  ],
);

export const agentGovernancePolicies = mysqlTable(
  "agent_governance_policies",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 }).references(() => workspaces.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    name: varchar("name", { length: 180 }).notNull(),
    policyKey: varchar("policy_key", { length: 120 }).notNull(),
    policyType: varchar("policy_type", { length: 60 }).notNull(),
    scopeType: varchar("scope_type", { length: 40 }).notNull().default("organization"),
    targetAgentIds: json("target_agent_ids").$type<string[]>().notNull().default([]),
    severity: varchar("severity", { length: 20 }).notNull().default("medium"),
    enforcementAction: varchar("enforcement_action", { length: 40 }).notNull().default("log"),
    lifecycleState: varchar("lifecycle_state", { length: 40 }).notNull().default("draft"),
    currentVersion: int("current_version").notNull().default(1),
    description: text("description"),
    rules: json("rules").$type<Record<string, unknown>>().notNull().default({}),
    metadata: json("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdBy: char("created_by", { length: 36 }).notNull(),
    updatedBy: char("updated_by", { length: 36 }).notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("gov_policies_org_key_unique").on(table.organizationId, table.policyKey),
    index("gov_policies_org_type_idx").on(table.organizationId, table.policyType),
    index("gov_policies_org_state_idx").on(table.organizationId, table.lifecycleState),
  ],
);

export const agentGovernancePolicyVersions = mysqlTable(
  "agent_governance_policy_versions",
  {
    id: char("id", { length: 36 }).primaryKey(),
    policyId: char("policy_id", { length: 36 })
      .notNull()
      .references(() => agentGovernancePolicies.id, { onDelete: "cascade", onUpdate: "cascade" }),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    version: int("version").notNull(),
    lifecycleState: varchar("lifecycle_state", { length: 40 }).notNull().default("draft"),
    changeSummary: text("change_summary").notNull(),
    rules: json("rules").$type<Record<string, unknown>>().notNull().default({}),
    createdBy: char("created_by", { length: 36 }).notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("gov_policy_versions_unique").on(table.policyId, table.version),
    index("gov_policy_versions_org_idx").on(table.organizationId, table.policyId),
  ],
);

export const agentGovernanceAuditLogs = mysqlTable(
  "agent_governance_audit_logs",
  {
    id: char("id", { length: 36 }).primaryKey(),
    organizationId: char("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    workspaceId: char("workspace_id", { length: 36 }).references(() => workspaces.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    actorId: char("actor_id", { length: 36 }).notNull(),
    action: varchar("action", { length: 120 }).notNull(),
    targetType: varchar("target_type", { length: 80 }).notNull(),
    targetId: char("target_id", { length: 36 }).notNull(),
    beforeState: json("before_state").$type<Record<string, unknown>>(),
    afterState: json("after_state").$type<Record<string, unknown>>(),
    metadata: json("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("gov_audit_org_created_idx").on(table.organizationId, table.createdAt),
    index("gov_audit_org_target_idx").on(table.organizationId, table.targetType, table.targetId),
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
  aiAgentConfigurationRevisions,
  aiAgentTemplates,
  aiAgentTemplateVersions,
  aiAgentInstallations,
  aiAgentMemories,
  aiAgentMessages,
  aiAgentRuns,
  aiAgentRunAttempts,
  aiAgentRunEvents,
  aiAgentApprovalRequests,
  aiAgentApprovalDecisions,
  aiAgentRuntimeUsage,
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
  financeLateFeePolicies,
  financeExpenseCategories,
  financeExpenses,
  financeIncomes,
  financeAccounts,
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
  academicLessonPlans,
  lessonPlanStatus,
  aiAgentTools,
  aiAgentToolVersions,
  aiAgentToolTenantPolicies,
  aiAgentToolExecutions,
  knowledgeCollections,
  aiAgentKnowledgeDocuments,
  aiAgentKnowledgeEmbeddings,
  aiAgentKnowledgeRetrievals,
  aiProviderTenantConfigs,
  aiProviderAuditLogs,
  aiModelPricingCatalog,
  aiUsageBudgets,
  aiUsageLedger,
  agentTeams,
  agentTeamMembers,
  agentWorkflowDefinitions,
  agentWorkflowSteps,
  agentWorkflowRuns,
  agentWorkflowStepRuns,
  agentWorkflowArtifacts,
  agentWorkflowEvents,
  autonomousTaskPolicies,
  autonomousTaskDefinitions,
  autonomousTaskTriggers,
  autonomousTaskRuns,
  autonomousTaskCheckpoints,
  autonomousTaskEvents,
  agentTraceSpans,
  agentEvaluationDatasets,
  agentEvaluationCases,
  agentEvaluationRuns,
  agentSloDefinitions,
  agentReliabilityMetrics,
  agentAlertRules,
  agentIncidents,
  agentGovernanceProfiles,
  agentOwnershipAssignments,
  agentGovernancePolicies,
  agentGovernancePolicyVersions,
  agentGovernanceAuditLogs,
  workspaces,
};

export type DatabaseSchema = typeof schema;
