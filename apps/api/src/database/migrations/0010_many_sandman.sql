CREATE TABLE `ai_agent_memories` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`agent_id` char(36) NOT NULL,
	`user_id` char(36),
	`agent_memory_scope` enum('user','agent','conversation','workspace','organization') NOT NULL DEFAULT 'user',
	`type` varchar(80) NOT NULL,
	`content` text NOT NULL,
	`agent_memory_status` enum('active','archived','deleted') NOT NULL DEFAULT 'active',
	`source` varchar(120) NOT NULL DEFAULT 'manual',
	`source_run_id` char(36),
	`source_conversation_id` char(36),
	`source_message_id` char(36),
	`importance` int NOT NULL DEFAULT 5,
	`metadata` json NOT NULL,
	`created_by` char(36) NOT NULL,
	`updated_by` char(36),
	`expires_at` datetime(3),
	`last_used_at` datetime(3),
	`usage_count` int NOT NULL DEFAULT 0,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_agent_memories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `ai_agent_memories` ADD CONSTRAINT `ai_agent_memories_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `ai_agent_memories` ADD CONSTRAINT `ai_agent_memories_workspace_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `ai_agent_memories` ADD CONSTRAINT `ai_agent_memories_agent_fk` FOREIGN KEY (`agent_id`) REFERENCES `ai_agent_definitions`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `ai_agent_memories` ADD CONSTRAINT `ai_agent_memories_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `ai_agent_memories` ADD CONSTRAINT `ai_agent_memories_source_run_fk` FOREIGN KEY (`source_run_id`) REFERENCES `ai_agent_runs`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `ai_agent_memories` ADD CONSTRAINT `ai_agent_memories_source_conversation_fk` FOREIGN KEY (`source_conversation_id`) REFERENCES `ai_agent_conversations`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `ai_agent_memories` ADD CONSTRAINT `ai_agent_memories_source_message_fk` FOREIGN KEY (`source_message_id`) REFERENCES `ai_agent_messages`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `ai_agent_memories` ADD CONSTRAINT `ai_agent_memories_created_by_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `ai_agent_memories` ADD CONSTRAINT `ai_agent_memories_updated_by_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX `ai_agent_memories_org_status_idx` ON `ai_agent_memories` (`organization_id`,`agent_memory_status`);--> statement-breakpoint
CREATE INDEX `ai_agent_memories_workspace_scope_status_idx` ON `ai_agent_memories` (`workspace_id`,`agent_memory_scope`,`agent_memory_status`);--> statement-breakpoint
CREATE INDEX `ai_agent_memories_agent_scope_status_idx` ON `ai_agent_memories` (`agent_id`,`agent_memory_scope`,`agent_memory_status`);--> statement-breakpoint
CREATE INDEX `ai_agent_memories_user_status_idx` ON `ai_agent_memories` (`user_id`,`agent_memory_status`);--> statement-breakpoint
CREATE INDEX `ai_agent_memories_source_run_idx` ON `ai_agent_memories` (`source_run_id`);--> statement-breakpoint
CREATE INDEX `ai_agent_memories_source_conversation_idx` ON `ai_agent_memories` (`source_conversation_id`);--> statement-breakpoint
CREATE INDEX `ai_agent_memories_source_message_idx` ON `ai_agent_memories` (`source_message_id`);
