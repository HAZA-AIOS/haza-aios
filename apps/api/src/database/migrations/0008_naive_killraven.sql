CREATE TABLE `ai_agent_definitions` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`template_id` char(36),
	`agent_key` varchar(160) NOT NULL,
	`name` varchar(180) NOT NULL,
	`description` varchar(1000) NOT NULL,
	`agent_lifecycle_status` enum('draft','available','configured','active','paused','disabled','archived') NOT NULL DEFAULT 'active',
	`enabled` boolean NOT NULL DEFAULT true,
	`instructions` text,
	`configuration` json NOT NULL,
	`model_provider` varchar(120) NOT NULL,
	`model_selection` varchar(160) NOT NULL,
	`created_by` char(36) NOT NULL,
	`archived_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_agent_definitions_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_agent_definitions_workspace_key_unique` UNIQUE(`workspace_id`,`agent_key`),
	CONSTRAINT `ai_agent_definitions_workspace_template_unique` UNIQUE(`workspace_id`,`template_id`)
);
--> statement-breakpoint
CREATE TABLE `ai_agent_templates` (
	`id` char(36) NOT NULL,
	`slug` varchar(140) NOT NULL,
	`name` varchar(180) NOT NULL,
	`description` varchar(1000) NOT NULL,
	`version` varchar(80) NOT NULL,
	`category` varchar(80) NOT NULL,
	`industry` varchar(80) NOT NULL,
	`agent_lifecycle_status` enum('draft','available','configured','active','paused','disabled','archived') NOT NULL DEFAULT 'available',
	`icon` varchar(80) NOT NULL,
	`capabilities` json NOT NULL,
	`required_permissions` json NOT NULL,
	`configuration_schema` json NOT NULL,
	`input_schema` json NOT NULL,
	`output_schema` json NOT NULL,
	`metadata` json NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_agent_templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_agent_templates_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `ai_agent_tool_assignments` (
	`id` char(36) NOT NULL,
	`agent_id` char(36) NOT NULL,
	`tool_key` varchar(160) NOT NULL,
	`status` varchar(40) NOT NULL DEFAULT 'active',
	`configuration` json,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_agent_tool_assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_agent_tool_assignments_agent_tool_unique` UNIQUE(`agent_id`,`tool_key`)
);
--> statement-breakpoint
ALTER TABLE `ai_agent_definitions` ADD CONSTRAINT `ai_agent_definitions_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `ai_agent_definitions` ADD CONSTRAINT `ai_agent_definitions_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `ai_agent_definitions` ADD CONSTRAINT `ai_agent_definitions_template_id_ai_agent_templates_id_fk` FOREIGN KEY (`template_id`) REFERENCES `ai_agent_templates`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `ai_agent_definitions` ADD CONSTRAINT `ai_agent_definitions_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `ai_agent_tool_assignments` ADD CONSTRAINT `ai_agent_tool_assignments_agent_id_ai_agent_definitions_id_fk` FOREIGN KEY (`agent_id`) REFERENCES `ai_agent_definitions`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX `ai_agent_definitions_org_status_idx` ON `ai_agent_definitions` (`organization_id`,`agent_lifecycle_status`);--> statement-breakpoint
CREATE INDEX `ai_agent_definitions_workspace_status_idx` ON `ai_agent_definitions` (`workspace_id`,`agent_lifecycle_status`);--> statement-breakpoint
CREATE INDEX `ai_agent_definitions_template_idx` ON `ai_agent_definitions` (`template_id`);--> statement-breakpoint
CREATE INDEX `ai_agent_templates_status_idx` ON `ai_agent_templates` (`agent_lifecycle_status`);--> statement-breakpoint
CREATE INDEX `ai_agent_templates_industry_idx` ON `ai_agent_templates` (`industry`);--> statement-breakpoint
CREATE INDEX `ai_agent_templates_category_idx` ON `ai_agent_templates` (`category`);--> statement-breakpoint
CREATE INDEX `ai_agent_tool_assignments_agent_status_idx` ON `ai_agent_tool_assignments` (`agent_id`,`status`);--> statement-breakpoint
INSERT IGNORE INTO `ai_agent_templates`
(`id`, `slug`, `name`, `description`, `version`, `category`, `industry`, `agent_lifecycle_status`, `icon`, `capabilities`, `required_permissions`, `configuration_schema`, `input_schema`, `output_schema`, `metadata`)
VALUES
('00000000-0000-4100-8000-000000000101', 'worksheet-creator', 'Worksheet Creator', 'Automatically generates customized student worksheets and quizzes based on subject and difficulty.', '1.0.0', 'Education', 'Education', 'available', '📝',
 JSON_ARRAY(JSON_OBJECT('key', 'generate', 'name', 'Educational content generation', 'description', 'Generates educational materials'), JSON_OBJECT('key', 'transform', 'name', 'Worksheet structuring', 'description', 'Structures content into a worksheet format'), JSON_OBJECT('key', 'analyze', 'name', 'Difficulty control', 'description', 'Adjusts content based on grade and difficulty')),
 JSON_ARRAY('module.education.view'), JSON_OBJECT(), JSON_OBJECT(), JSON_OBJECT(), JSON_OBJECT('source', 'db11-system-template')),
('00000000-0000-4100-8000-000000000102', 'sales-analyzer', 'Sales Analyzer', 'Analyzes quarterly sales data and predicts future revenue trends.', '1.0.0', 'Analytics', 'corporate', 'available', '📈',
 JSON_ARRAY(JSON_OBJECT('key', 'analyze', 'name', 'Data Analysis', 'description', 'Analyzes structured data')),
 JSON_ARRAY('module.sales.view'), JSON_OBJECT(), JSON_OBJECT(), JSON_OBJECT(), JSON_OBJECT('source', 'db11-system-template'));--> statement-breakpoint
INSERT IGNORE INTO `permissions` (`id`, `permission_key`, `description`)
VALUES
(UUID(), 'agent.read', 'Read organization AI agent registry and configuration.'),
(UUID(), 'agent.manage', 'Manage organization AI agent definitions and configuration.');--> statement-breakpoint
INSERT IGNORE INTO `role_permissions` (`id`, `role_id`, `permission_id`)
SELECT UUID(), `roles`.`id`, `permissions`.`id`
FROM `roles`
JOIN `permissions` ON `permissions`.`permission_key` IN ('agent.read', 'agent.manage')
WHERE `roles`.`role_scope` = 'organization'
  AND `roles`.`name` IN ('Owner', 'Admin');--> statement-breakpoint
INSERT IGNORE INTO `role_permissions` (`id`, `role_id`, `permission_id`)
SELECT UUID(), `roles`.`id`, `permissions`.`id`
FROM `roles`
JOIN `permissions` ON `permissions`.`permission_key` = 'agent.read'
WHERE `roles`.`role_scope` = 'organization'
  AND `roles`.`name` = 'Member';
