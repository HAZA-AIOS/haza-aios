ALTER TABLE `ai_agent_runs` MODIFY COLUMN `agent_run_status` enum('queued','running','awaiting_approval','waiting','rejected','completed','failed','cancelled') NOT NULL DEFAULT 'queued';--> statement-breakpoint
ALTER TABLE `ai_agent_runs` ADD `configuration_revision_id` char(36) NULL;--> statement-breakpoint
ALTER TABLE `ai_agent_runs` ADD `configuration_snapshot` json NULL;--> statement-breakpoint
ALTER TABLE `ai_agent_runs` ADD `attempt_count` int NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `ai_agent_runs` ADD `max_attempts` int NOT NULL DEFAULT 3;--> statement-breakpoint
ALTER TABLE `ai_agent_runs` ADD `lease_token` varchar(80) NULL;--> statement-breakpoint
ALTER TABLE `ai_agent_runs` ADD `lease_expires_at` timestamp(3) NULL;--> statement-breakpoint
ALTER TABLE `ai_agent_runs` ADD `worker_id` varchar(120) NULL;--> statement-breakpoint
ALTER TABLE `ai_agent_runs` ADD `priority` int NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `ai_agent_runs` ADD `total_input_tokens` int NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `ai_agent_runs` ADD `total_output_tokens` int NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `ai_agent_runs` ADD `total_cost_micros` bigint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `ai_agent_runs` ADD `cancelled_by` char(36) NULL;--> statement-breakpoint
ALTER TABLE `ai_agent_runs` ADD `cancelled_at` timestamp(3) NULL;--> statement-breakpoint
ALTER TABLE `ai_agent_runs` ADD `cancellation_reason` varchar(500) NULL;--> statement-breakpoint

ALTER TABLE `ai_agent_runs` ADD CONSTRAINT `ai_agent_runs_config_rev_fk` FOREIGN KEY (`configuration_revision_id`) REFERENCES `ai_agent_configuration_revisions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `ai_agent_runs` ADD CONSTRAINT `ai_agent_runs_cancelled_by_fk` FOREIGN KEY (`cancelled_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint

CREATE INDEX `ai_agent_runs_status_priority_idx` ON `ai_agent_runs` (`agent_run_status`, `priority`, `created_at`);--> statement-breakpoint
CREATE INDEX `ai_agent_runs_lease_idx` ON `ai_agent_runs` (`agent_run_status`, `lease_expires_at`);--> statement-breakpoint
CREATE INDEX `ai_agent_runs_config_rev_idx` ON `ai_agent_runs` (`configuration_revision_id`);--> statement-breakpoint

CREATE TABLE `ai_agent_run_attempts` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`run_id` char(36) NOT NULL,
	`attempt_number` int NOT NULL,
	`status` varchar(40) NOT NULL DEFAULT 'running',
	`worker_id` varchar(120) NOT NULL,
	`lease_token` varchar(80) NOT NULL,
	`started_at` timestamp(3) NOT NULL DEFAULT (now(3)),
	`completed_at` timestamp(3) NULL,
	`duration_ms` int NULL,
	`error_code` varchar(120) NULL,
	`error_message` varchar(1000) NULL,
	`error_details` json NULL,
	`input_tokens` int NOT NULL DEFAULT 0,
	`output_tokens` int NOT NULL DEFAULT 0,
	`metadata` json NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now(3)),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now(3)) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `ai_agent_run_attempts_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_agent_run_attempts_run_attempt_unique` UNIQUE(`run_id`, `attempt_number`)
);--> statement-breakpoint

ALTER TABLE `ai_agent_run_attempts` ADD CONSTRAINT `ai_agent_run_attempts_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `ai_agent_run_attempts` ADD CONSTRAINT `ai_agent_run_attempts_workspace_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `ai_agent_run_attempts` ADD CONSTRAINT `ai_agent_run_attempts_run_fk` FOREIGN KEY (`run_id`) REFERENCES `ai_agent_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint

CREATE INDEX `ai_agent_run_attempts_org_run_idx` ON `ai_agent_run_attempts` (`organization_id`, `run_id`);--> statement-breakpoint

CREATE TABLE `ai_agent_run_events` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`run_id` char(36) NOT NULL,
	`attempt_id` char(36) NULL,
	`event_type` varchar(60) NOT NULL,
	`payload` json NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now(3)),
	CONSTRAINT `ai_agent_run_events_id` PRIMARY KEY(`id`)
);--> statement-breakpoint

ALTER TABLE `ai_agent_run_events` ADD CONSTRAINT `ai_agent_run_events_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `ai_agent_run_events` ADD CONSTRAINT `ai_agent_run_events_workspace_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `ai_agent_run_events` ADD CONSTRAINT `ai_agent_run_events_run_fk` FOREIGN KEY (`run_id`) REFERENCES `ai_agent_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint

CREATE INDEX `ai_agent_run_events_run_created_idx` ON `ai_agent_run_events` (`run_id`, `created_at`);--> statement-breakpoint

CREATE TABLE `ai_agent_approval_requests` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`run_id` char(36) NOT NULL,
	`attempt_id` char(36) NULL,
	`action_name` varchar(120) NOT NULL,
	`action_type` varchar(60) NOT NULL,
	`action_payload` json NOT NULL,
	`risk_level` varchar(20) NOT NULL DEFAULT 'medium',
	`policy` varchar(40) NOT NULL DEFAULT 'risk_threshold',
	`required_roles` json NOT NULL,
	`status` varchar(40) NOT NULL DEFAULT 'pending',
	`requested_by` char(36) NOT NULL,
	`expires_at` timestamp(3) NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now(3)),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now(3)) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `ai_agent_approval_requests_id` PRIMARY KEY(`id`)
);--> statement-breakpoint

ALTER TABLE `ai_agent_approval_requests` ADD CONSTRAINT `ai_agent_approval_requests_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `ai_agent_approval_requests` ADD CONSTRAINT `ai_agent_approval_requests_workspace_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `ai_agent_approval_requests` ADD CONSTRAINT `ai_agent_approval_requests_run_fk` FOREIGN KEY (`run_id`) REFERENCES `ai_agent_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `ai_agent_approval_requests` ADD CONSTRAINT `ai_agent_approval_requests_requester_fk` FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint

CREATE INDEX `ai_agent_approval_requests_org_status_idx` ON `ai_agent_approval_requests` (`organization_id`, `status`);--> statement-breakpoint
CREATE INDEX `ai_agent_approval_requests_run_idx` ON `ai_agent_approval_requests` (`run_id`);--> statement-breakpoint

CREATE TABLE `ai_agent_approval_decisions` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`approval_request_id` char(36) NOT NULL,
	`decision` varchar(40) NOT NULL,
	`reason` varchar(1000) NULL,
	`decided_by` char(36) NOT NULL,
	`decided_at` timestamp(3) NOT NULL DEFAULT (now(3)),
	`created_at` timestamp(3) NOT NULL DEFAULT (now(3)),
	CONSTRAINT `ai_agent_approval_decisions_id` PRIMARY KEY(`id`)
);--> statement-breakpoint

ALTER TABLE `ai_agent_approval_decisions` ADD CONSTRAINT `ai_agent_approval_decisions_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `ai_agent_approval_decisions` ADD CONSTRAINT `ai_agent_approval_decisions_workspace_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `ai_agent_approval_decisions` ADD CONSTRAINT `ai_agent_approval_decisions_request_fk` FOREIGN KEY (`approval_request_id`) REFERENCES `ai_agent_approval_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `ai_agent_approval_decisions` ADD CONSTRAINT `ai_agent_approval_decisions_decided_by_fk` FOREIGN KEY (`decided_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint

CREATE INDEX `ai_agent_approval_decisions_request_idx` ON `ai_agent_approval_decisions` (`approval_request_id`);--> statement-breakpoint

CREATE TABLE `ai_agent_runtime_usage` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`run_id` char(36) NOT NULL,
	`agent_id` char(36) NOT NULL,
	`provider` varchar(120) NOT NULL,
	`model` varchar(160) NOT NULL,
	`input_tokens` int NOT NULL DEFAULT 0,
	`output_tokens` int NOT NULL DEFAULT 0,
	`total_tokens` int NOT NULL DEFAULT 0,
	`duration_ms` int NOT NULL DEFAULT 0,
	`cost_micros` bigint NOT NULL DEFAULT 0,
	`created_at` timestamp(3) NOT NULL DEFAULT (now(3)),
	CONSTRAINT `ai_agent_runtime_usage_id` PRIMARY KEY(`id`)
);--> statement-breakpoint

ALTER TABLE `ai_agent_runtime_usage` ADD CONSTRAINT `ai_agent_runtime_usage_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `ai_agent_runtime_usage` ADD CONSTRAINT `ai_agent_runtime_usage_workspace_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `ai_agent_runtime_usage` ADD CONSTRAINT `ai_agent_runtime_usage_run_fk` FOREIGN KEY (`run_id`) REFERENCES `ai_agent_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `ai_agent_runtime_usage` ADD CONSTRAINT `ai_agent_runtime_usage_agent_fk` FOREIGN KEY (`agent_id`) REFERENCES `ai_agent_definitions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint

CREATE INDEX `ai_agent_runtime_usage_org_agent_created_idx` ON `ai_agent_runtime_usage` (`organization_id`, `agent_id`, `created_at`);--> statement-breakpoint
CREATE INDEX `ai_agent_runtime_usage_run_idx` ON `ai_agent_runtime_usage` (`run_id`);--> statement-breakpoint

UPDATE `ai_agent_runs` r
JOIN `ai_agent_definitions` d ON r.agent_id = d.id
SET r.configuration_revision_id = d.active_revision_id
WHERE r.configuration_revision_id IS NULL AND d.active_revision_id IS NOT NULL;
