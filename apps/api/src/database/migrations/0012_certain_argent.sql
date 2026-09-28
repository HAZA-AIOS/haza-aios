CREATE TABLE `workflow_definitions` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`agent_id` char(36),
	`name` varchar(180) NOT NULL,
	`description` varchar(1000) NOT NULL,
	`workflow_status` enum('draft','active','archived') NOT NULL DEFAULT 'draft',
	`version` varchar(40) NOT NULL DEFAULT '1.0.0',
	`revision` int NOT NULL DEFAULT 1,
	`configuration` json NOT NULL,
	`created_by` char(36) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `workflow_definitions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflow_runs` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`workflow_id` char(36) NOT NULL,
	`workflow_revision` int NOT NULL,
	`agent_run_id` char(36),
	`requested_by` char(36) NOT NULL,
	`workflow_run_status` enum('pending','running','waiting','completed','failed','cancelled') NOT NULL DEFAULT 'pending',
	`idempotency_key` varchar(160),
	`input` json NOT NULL,
	`output` json,
	`execution_context` json NOT NULL,
	`definition_snapshot` json NOT NULL,
	`steps_snapshot` json NOT NULL,
	`execution_authority` varchar(40) NOT NULL DEFAULT 'client_reported',
	`current_step_id` char(36),
	`safe_error_message` varchar(1000),
	`started_at` datetime(3),
	`completed_at` datetime(3),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `workflow_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `workflow_runs_idempotency_unique` UNIQUE(`workspace_id`,`workflow_id`,`idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `workflow_step_runs` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workflow_run_id` char(36) NOT NULL,
	`workflow_step_id` char(36) NOT NULL,
	`workflow_step_run_status` enum('pending','running','completed','failed','skipped') NOT NULL DEFAULT 'pending',
	`attempt` int NOT NULL DEFAULT 1,
	`input` json NOT NULL,
	`output` json,
	`metadata` json NOT NULL,
	`safe_error_message` varchar(1000),
	`reported_by` char(36) NOT NULL,
	`started_at` datetime(3),
	`completed_at` datetime(3),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `workflow_step_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `workflow_step_runs_run_step_attempt_unique` UNIQUE(`workflow_run_id`,`workflow_step_id`,`attempt`)
);
--> statement-breakpoint
CREATE TABLE `workflow_steps` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workflow_id` char(36) NOT NULL,
	`name` varchar(180) NOT NULL,
	`type` enum('agent','tool','knowledge','condition','save','notification') NOT NULL,
	`step_order` int NOT NULL,
	`revision` int NOT NULL,
	`configuration` json NOT NULL,
	`timeout_seconds` int,
	`max_attempts` int NOT NULL DEFAULT 1,
	`retry_delay_ms` int NOT NULL DEFAULT 1000,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `workflow_steps_id` PRIMARY KEY(`id`),
	CONSTRAINT `workflow_steps_workflow_revision_order_unique` UNIQUE(`workflow_id`,`revision`,`step_order`)
);
--> statement-breakpoint
CREATE TABLE `workflow_tasks` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`workflow_run_id` char(36) NOT NULL,
	`workflow_step_id` char(36) NOT NULL,
	`title` varchar(220) NOT NULL,
	`description` varchar(1000) NOT NULL,
	`type` varchar(80) NOT NULL DEFAULT 'manual',
	`priority` varchar(40) NOT NULL DEFAULT 'normal',
	`workflow_task_status` enum('pending','assigned','in_progress','blocked','waiting','completed','cancelled','failed') NOT NULL DEFAULT 'pending',
	`assigned_user_id` char(36),
	`assigned_role` varchar(120),
	`assigned_agent_id` char(36),
	`input` json NOT NULL,
	`output` json,
	`metadata` json NOT NULL,
	`due_at` datetime(3),
	`started_at` datetime(3),
	`completed_at` datetime(3),
	`created_by` char(36) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `workflow_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `workflow_definitions` ADD CONSTRAINT `workflow_definitions_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `workflow_definitions` ADD CONSTRAINT `workflow_definitions_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `workflow_definitions` ADD CONSTRAINT `workflow_definitions_agent_id_ai_agent_definitions_id_fk` FOREIGN KEY (`agent_id`) REFERENCES `ai_agent_definitions`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `workflow_definitions` ADD CONSTRAINT `workflow_definitions_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `workflow_runs` ADD CONSTRAINT `workflow_runs_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `workflow_runs` ADD CONSTRAINT `workflow_runs_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `workflow_runs` ADD CONSTRAINT `workflow_runs_workflow_id_workflow_definitions_id_fk` FOREIGN KEY (`workflow_id`) REFERENCES `workflow_definitions`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `workflow_runs` ADD CONSTRAINT `workflow_runs_agent_run_id_ai_agent_runs_id_fk` FOREIGN KEY (`agent_run_id`) REFERENCES `ai_agent_runs`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `workflow_runs` ADD CONSTRAINT `workflow_runs_requested_by_users_id_fk` FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `workflow_runs` ADD CONSTRAINT `workflow_runs_current_step_id_workflow_steps_id_fk` FOREIGN KEY (`current_step_id`) REFERENCES `workflow_steps`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `workflow_step_runs` ADD CONSTRAINT `workflow_step_runs_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `workflow_step_runs` ADD CONSTRAINT `workflow_step_runs_workflow_run_id_workflow_runs_id_fk` FOREIGN KEY (`workflow_run_id`) REFERENCES `workflow_runs`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `workflow_step_runs` ADD CONSTRAINT `workflow_step_runs_workflow_step_id_workflow_steps_id_fk` FOREIGN KEY (`workflow_step_id`) REFERENCES `workflow_steps`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `workflow_step_runs` ADD CONSTRAINT `workflow_step_runs_reported_by_users_id_fk` FOREIGN KEY (`reported_by`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `workflow_steps` ADD CONSTRAINT `workflow_steps_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `workflow_steps` ADD CONSTRAINT `workflow_steps_workflow_id_workflow_definitions_id_fk` FOREIGN KEY (`workflow_id`) REFERENCES `workflow_definitions`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `workflow_tasks` ADD CONSTRAINT `workflow_tasks_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `workflow_tasks` ADD CONSTRAINT `workflow_tasks_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `workflow_tasks` ADD CONSTRAINT `workflow_tasks_workflow_run_id_workflow_runs_id_fk` FOREIGN KEY (`workflow_run_id`) REFERENCES `workflow_runs`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `workflow_tasks` ADD CONSTRAINT `workflow_tasks_workflow_step_id_workflow_steps_id_fk` FOREIGN KEY (`workflow_step_id`) REFERENCES `workflow_steps`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `workflow_tasks` ADD CONSTRAINT `workflow_tasks_assigned_user_id_users_id_fk` FOREIGN KEY (`assigned_user_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `workflow_tasks` ADD CONSTRAINT `workflow_tasks_assigned_agent_id_ai_agent_definitions_id_fk` FOREIGN KEY (`assigned_agent_id`) REFERENCES `ai_agent_definitions`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `workflow_tasks` ADD CONSTRAINT `workflow_tasks_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX `workflow_definitions_org_status_idx` ON `workflow_definitions` (`organization_id`,`workflow_status`);--> statement-breakpoint
CREATE INDEX `workflow_definitions_workspace_status_idx` ON `workflow_definitions` (`workspace_id`,`workflow_status`);--> statement-breakpoint
CREATE INDEX `workflow_definitions_agent_idx` ON `workflow_definitions` (`agent_id`);--> statement-breakpoint
CREATE INDEX `workflow_runs_org_status_idx` ON `workflow_runs` (`organization_id`,`workflow_run_status`);--> statement-breakpoint
CREATE INDEX `workflow_runs_workspace_workflow_status_idx` ON `workflow_runs` (`workspace_id`,`workflow_id`,`workflow_run_status`);--> statement-breakpoint
CREATE INDEX `workflow_runs_requested_by_idx` ON `workflow_runs` (`requested_by`);--> statement-breakpoint
CREATE INDEX `workflow_runs_agent_run_idx` ON `workflow_runs` (`agent_run_id`);--> statement-breakpoint
CREATE INDEX `workflow_step_runs_org_status_idx` ON `workflow_step_runs` (`organization_id`,`workflow_step_run_status`);--> statement-breakpoint
CREATE INDEX `workflow_steps_org_workflow_revision_idx` ON `workflow_steps` (`organization_id`,`workflow_id`,`revision`);--> statement-breakpoint
CREATE INDEX `workflow_tasks_org_status_idx` ON `workflow_tasks` (`organization_id`,`workflow_task_status`);--> statement-breakpoint
CREATE INDEX `workflow_tasks_workspace_assignee_idx` ON `workflow_tasks` (`workspace_id`,`assigned_user_id`,`workflow_task_status`);--> statement-breakpoint
CREATE INDEX `workflow_tasks_run_step_idx` ON `workflow_tasks` (`workflow_run_id`,`workflow_step_id`);--> statement-breakpoint
CREATE INDEX `workflow_tasks_agent_idx` ON `workflow_tasks` (`assigned_agent_id`);--> statement-breakpoint
INSERT IGNORE INTO `permissions` (`id`, `permission_key`, `description`)
VALUES
(UUID(), 'workflow.read', 'Read organization workflows, runs, and tasks.'),
(UUID(), 'workflow.manage', 'Manage organization workflow definitions and tasks.'),
(UUID(), 'workflow.run', 'Execute organization workflows and report run progress.');--> statement-breakpoint
INSERT IGNORE INTO `role_permissions` (`id`, `role_id`, `permission_id`)
SELECT UUID(), `roles`.`id`, `permissions`.`id`
FROM `roles`
JOIN `permissions` ON `permissions`.`permission_key` IN ('workflow.read', 'workflow.manage', 'workflow.run')
WHERE `roles`.`role_scope` = 'organization'
  AND `roles`.`name` IN ('Owner', 'Admin');--> statement-breakpoint
INSERT IGNORE INTO `role_permissions` (`id`, `role_id`, `permission_id`)
SELECT UUID(), `roles`.`id`, `permissions`.`id`
FROM `roles`
JOIN `permissions` ON `permissions`.`permission_key` IN ('workflow.read', 'workflow.run')
WHERE `roles`.`role_scope` = 'organization'
  AND `roles`.`name` = 'Member';
