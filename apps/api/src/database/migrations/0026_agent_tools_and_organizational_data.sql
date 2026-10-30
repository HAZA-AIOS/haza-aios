CREATE TABLE `ai_agent_tools` (
	`id` char(36) NOT NULL,
	`tool_key` varchar(160) NOT NULL,
	`name` varchar(160) NOT NULL,
	`description` varchar(1000) NOT NULL,
	`category` varchar(80) NOT NULL,
	`industry` varchar(80) NOT NULL,
	`risk_level` varchar(20) NOT NULL DEFAULT 'low',
	`execution_mode` varchar(20) NOT NULL DEFAULT 'sync',
	`required_permissions` json NOT NULL,
	`approval_policy` varchar(40) NOT NULL DEFAULT 'none',
	`timeout_ms` int NOT NULL DEFAULT 15000,
	`max_attempts` int NOT NULL DEFAULT 3,
	`status` varchar(40) NOT NULL DEFAULT 'active',
	`created_at` timestamp(3) NOT NULL DEFAULT (now(3)),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now(3)) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `ai_agent_tools_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_agent_tools_key_unique` UNIQUE(`tool_key`)
);--> statement-breakpoint

CREATE TABLE `ai_agent_tool_versions` (
	`id` char(36) NOT NULL,
	`tool_id` char(36) NOT NULL,
	`version` varchar(40) NOT NULL,
	`input_schema` json NOT NULL,
	`output_schema` json NOT NULL,
	`deprecated` boolean NOT NULL DEFAULT false,
	`changelog` varchar(1000) NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now(3)),
	CONSTRAINT `ai_agent_tool_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_agent_tool_versions_tool_version_unique` UNIQUE(`tool_id`, `version`)
);--> statement-breakpoint

ALTER TABLE `ai_agent_tool_versions` ADD CONSTRAINT `ai_agent_tool_versions_tool_fk` FOREIGN KEY (`tool_id`) REFERENCES `ai_agent_tools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
CREATE INDEX `ai_agent_tool_versions_tool_idx` ON `ai_agent_tool_versions` (`tool_id`);--> statement-breakpoint

CREATE TABLE `ai_agent_tool_tenant_policies` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36) NULL,
	`tool_id` char(36) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`approval_policy_override` varchar(40) NULL,
	`custom_rate_limit_per_minute` int NULL,
	`allowed_agent_ids` json NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now(3)),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now(3)) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `ai_agent_tool_tenant_policies_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_agent_tool_tenant_policies_org_ws_tool_unique` UNIQUE(`organization_id`, `workspace_id`, `tool_id`)
);--> statement-breakpoint

ALTER TABLE `ai_agent_tool_tenant_policies` ADD CONSTRAINT `ai_agent_tool_policies_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `ai_agent_tool_tenant_policies` ADD CONSTRAINT `ai_agent_tool_policies_workspace_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `ai_agent_tool_tenant_policies` ADD CONSTRAINT `ai_agent_tool_policies_tool_fk` FOREIGN KEY (`tool_id`) REFERENCES `ai_agent_tools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
CREATE INDEX `ai_agent_tool_policies_org_idx` ON `ai_agent_tool_tenant_policies` (`organization_id`, `enabled`);--> statement-breakpoint

CREATE TABLE `ai_agent_tool_executions` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`run_id` char(36) NOT NULL,
	`attempt_id` char(36) NULL,
	`agent_id` char(36) NOT NULL,
	`configuration_revision_id` char(36) NULL,
	`tool_id` char(36) NOT NULL,
	`tool_version` varchar(40) NOT NULL,
	`tool_key` varchar(160) NOT NULL,
	`requested_by` char(36) NOT NULL,
	`input_digest` varchar(128) NOT NULL,
	`input_snapshot` json NULL,
	`output_snapshot` json NULL,
	`status` varchar(40) NOT NULL DEFAULT 'pending',
	`approval_request_id` char(36) NULL,
	`started_at` timestamp(3) NOT NULL DEFAULT (now(3)),
	`completed_at` timestamp(3) NULL,
	`duration_ms` int NULL,
	`error_category` varchar(60) NULL,
	`error_message` varchar(1000) NULL,
	`correlation_id` varchar(128) NULL,
	`idempotency_key` varchar(160) NULL,
	`metadata` json NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now(3)),
	CONSTRAINT `ai_agent_tool_executions_id` PRIMARY KEY(`id`)
);--> statement-breakpoint

ALTER TABLE `ai_agent_tool_executions` ADD CONSTRAINT `ai_agent_tool_exec_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `ai_agent_tool_executions` ADD CONSTRAINT `ai_agent_tool_exec_workspace_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `ai_agent_tool_executions` ADD CONSTRAINT `ai_agent_tool_exec_run_fk` FOREIGN KEY (`run_id`) REFERENCES `ai_agent_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `ai_agent_tool_executions` ADD CONSTRAINT `ai_agent_tool_exec_agent_fk` FOREIGN KEY (`agent_id`) REFERENCES `ai_agent_definitions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `ai_agent_tool_executions` ADD CONSTRAINT `ai_agent_tool_exec_config_fk` FOREIGN KEY (`configuration_revision_id`) REFERENCES `ai_agent_configuration_revisions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `ai_agent_tool_executions` ADD CONSTRAINT `ai_agent_tool_exec_tool_fk` FOREIGN KEY (`tool_id`) REFERENCES `ai_agent_tools`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `ai_agent_tool_executions` ADD CONSTRAINT `ai_agent_tool_exec_user_fk` FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `ai_agent_tool_executions` ADD CONSTRAINT `ai_agent_tool_exec_approval_fk` FOREIGN KEY (`approval_request_id`) REFERENCES `ai_agent_approval_requests`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint

CREATE INDEX `ai_agent_tool_exec_org_ws_idx` ON `ai_agent_tool_executions` (`organization_id`, `workspace_id`, `created_at`);--> statement-breakpoint
CREATE INDEX `ai_agent_tool_exec_run_idx` ON `ai_agent_tool_executions` (`run_id`);--> statement-breakpoint
CREATE INDEX `ai_agent_tool_exec_tool_idx` ON `ai_agent_tool_executions` (`tool_id`, `status`);--> statement-breakpoint
CREATE INDEX `ai_agent_tool_exec_org_key_idx` ON `ai_agent_tool_executions` (`organization_id`, `tool_key`, `created_at`);
