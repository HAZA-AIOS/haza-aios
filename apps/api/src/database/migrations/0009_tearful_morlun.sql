CREATE TABLE `ai_agent_conversations` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`agent_id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`title` varchar(220) NOT NULL,
	`agent_conversation_status` enum('active','archived','deleted') NOT NULL DEFAULT 'active',
	`last_message_at` datetime(3),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_agent_conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_agent_messages` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`conversation_id` char(36) NOT NULL,
	`agent_run_id` char(36),
	`agent_message_role` enum('user','assistant','system','tool') NOT NULL,
	`sequence` int NOT NULL,
	`content` text NOT NULL,
	`metadata` json,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_agent_messages_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_agent_messages_conversation_sequence_unique` UNIQUE(`conversation_id`,`sequence`)
);
--> statement-breakpoint
CREATE TABLE `ai_agent_runs` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`agent_id` char(36) NOT NULL,
	`conversation_id` char(36),
	`requested_by` char(36) NOT NULL,
	`agent_run_status` enum('queued','running','waiting','completed','failed','cancelled') NOT NULL DEFAULT 'queued',
	`execution_mode` varchar(40) NOT NULL DEFAULT 'manual',
	`idempotency_key` varchar(160),
	`input` json NOT NULL,
	`output` json,
	`provider` varchar(120),
	`model` varchar(160),
	`error_code` varchar(120),
	`safe_error_message` varchar(1000),
	`metadata` json NOT NULL,
	`started_at` timestamp(3) NOT NULL,
	`completed_at` datetime(3),
	`duration_ms` int,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_agent_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_agent_runs_idempotency_unique` UNIQUE(`workspace_id`,`agent_id`,`idempotency_key`)
);
--> statement-breakpoint
ALTER TABLE `ai_agent_conversations` ADD CONSTRAINT `ai_agent_conversations_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `ai_agent_conversations` ADD CONSTRAINT `ai_agent_conversations_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `ai_agent_conversations` ADD CONSTRAINT `ai_agent_conversations_agent_id_ai_agent_definitions_id_fk` FOREIGN KEY (`agent_id`) REFERENCES `ai_agent_definitions`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `ai_agent_conversations` ADD CONSTRAINT `ai_agent_conversations_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `ai_agent_messages` ADD CONSTRAINT `ai_agent_messages_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `ai_agent_messages` ADD CONSTRAINT `ai_agent_messages_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `ai_agent_messages` ADD CONSTRAINT `ai_agent_messages_conversation_id_ai_agent_conversations_id_fk` FOREIGN KEY (`conversation_id`) REFERENCES `ai_agent_conversations`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `ai_agent_messages` ADD CONSTRAINT `ai_agent_messages_agent_run_id_ai_agent_runs_id_fk` FOREIGN KEY (`agent_run_id`) REFERENCES `ai_agent_runs`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `ai_agent_runs` ADD CONSTRAINT `ai_agent_runs_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `ai_agent_runs` ADD CONSTRAINT `ai_agent_runs_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `ai_agent_runs` ADD CONSTRAINT `ai_agent_runs_agent_id_ai_agent_definitions_id_fk` FOREIGN KEY (`agent_id`) REFERENCES `ai_agent_definitions`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `ai_agent_runs` ADD CONSTRAINT `ai_agent_runs_conversation_id_ai_agent_conversations_id_fk` FOREIGN KEY (`conversation_id`) REFERENCES `ai_agent_conversations`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `ai_agent_runs` ADD CONSTRAINT `ai_agent_runs_requested_by_users_id_fk` FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX `ai_agent_conversations_org_user_idx` ON `ai_agent_conversations` (`organization_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `ai_agent_conversations_workspace_agent_status_idx` ON `ai_agent_conversations` (`workspace_id`,`agent_id`,`agent_conversation_status`);--> statement-breakpoint
CREATE INDEX `ai_agent_conversations_last_message_idx` ON `ai_agent_conversations` (`workspace_id`,`last_message_at`);--> statement-breakpoint
CREATE INDEX `ai_agent_messages_workspace_conversation_idx` ON `ai_agent_messages` (`workspace_id`,`conversation_id`);--> statement-breakpoint
CREATE INDEX `ai_agent_messages_run_idx` ON `ai_agent_messages` (`agent_run_id`);--> statement-breakpoint
CREATE INDEX `ai_agent_messages_role_idx` ON `ai_agent_messages` (`conversation_id`,`agent_message_role`);--> statement-breakpoint
CREATE INDEX `ai_agent_runs_org_status_idx` ON `ai_agent_runs` (`organization_id`,`agent_run_status`);--> statement-breakpoint
CREATE INDEX `ai_agent_runs_workspace_agent_status_idx` ON `ai_agent_runs` (`workspace_id`,`agent_id`,`agent_run_status`);--> statement-breakpoint
CREATE INDEX `ai_agent_runs_conversation_idx` ON `ai_agent_runs` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `ai_agent_runs_requested_by_idx` ON `ai_agent_runs` (`requested_by`);