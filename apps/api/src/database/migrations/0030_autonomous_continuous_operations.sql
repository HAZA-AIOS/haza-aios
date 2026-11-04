CREATE TABLE `autonomous_task_policies` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`max_active_tasks` int NOT NULL DEFAULT 10,
	`max_global_concurrency` int NOT NULL DEFAULT 5,
	`default_autonomy_level` varchar(20) NOT NULL DEFAULT 'L1',
	`allowed_autonomy_levels` json NOT NULL,
	`emergency_stop_all` boolean NOT NULL DEFAULT false,
	`emergency_stopped_at` timestamp(3),
	`emergency_stopped_by` char(36),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `autonomous_task_policies_id` PRIMARY KEY(`id`),
	CONSTRAINT `auto_policies_org_ws_unique` UNIQUE(`organization_id`,`workspace_id`)
);
--> statement-breakpoint

CREATE TABLE `autonomous_task_definitions` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`name` varchar(180) NOT NULL,
	`description` varchar(1000) NOT NULL,
	`autonomy_level` varchar(20) NOT NULL DEFAULT 'L1',
	`target_type` varchar(40) NOT NULL,
	`workflow_definition_id` char(36),
	`agent_id` char(36),
	`status` varchar(40) NOT NULL DEFAULT 'active',
	`execution_policy` json NOT NULL,
	`approval_policy` json NOT NULL,
	`limits` json NOT NULL,
	`default_input` json NOT NULL DEFAULT ('{}'),
	`created_by` char(36),
	`emergency_stopped_at` timestamp(3),
	`emergency_stopped_by` char(36),
	`emergency_stop_reason` varchar(500),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `autonomous_task_definitions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint

CREATE TABLE `autonomous_task_triggers` (
	`id` char(36) NOT NULL,
	`task_definition_id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`name` varchar(180) NOT NULL,
	`trigger_type` varchar(40) NOT NULL,
	`schedule_type` varchar(40),
	`cron_expression` varchar(100),
	`timezone` varchar(80) NOT NULL DEFAULT 'UTC',
	`scheduled_at` timestamp(3),
	`next_run_at` timestamp(3),
	`last_run_at` timestamp(3),
	`event_pattern` varchar(255),
	`missed_schedule_policy` varchar(40) NOT NULL DEFAULT 'run_once',
	`is_enabled` boolean NOT NULL DEFAULT true,
	`configuration` json NOT NULL DEFAULT ('{}'),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `autonomous_task_triggers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint

CREATE TABLE `autonomous_task_runs` (
	`id` char(36) NOT NULL,
	`task_definition_id` char(36) NOT NULL,
	`trigger_id` char(36),
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`workflow_run_id` char(36),
	`agent_run_id` char(36),
	`status` varchar(40) NOT NULL DEFAULT 'queued',
	`idempotency_key` varchar(180) NOT NULL,
	`autonomy_level` varchar(20) NOT NULL DEFAULT 'L1',
	`worker_id` varchar(120),
	`leased_at` timestamp(3),
	`lease_expires_at` timestamp(3),
	`heartbeat_at` timestamp(3),
	`retry_count` int NOT NULL DEFAULT 0,
	`max_retries` int NOT NULL DEFAULT 3,
	`input_payload` json NOT NULL DEFAULT ('{}'),
	`output_payload` json,
	`error_details` json,
	`adaptation_history` json NOT NULL DEFAULT ('[]'),
	`current_plan_revision` int NOT NULL DEFAULT 0,
	`started_at` timestamp(3),
	`completed_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `autonomous_task_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `auto_runs_idempotency_unique` UNIQUE(`workspace_id`,`task_definition_id`,`idempotency_key`)
);
--> statement-breakpoint

CREATE TABLE `autonomous_task_checkpoints` (
	`id` char(36) NOT NULL,
	`task_run_id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`checkpoint_type` varchar(60) NOT NULL,
	`step_pointer` varchar(100),
	`state_snapshot` json NOT NULL,
	`metadata` json NOT NULL DEFAULT ('{}'),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `autonomous_task_checkpoints_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint

CREATE TABLE `autonomous_task_events` (
	`id` char(36) NOT NULL,
	`task_run_id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`event_type` varchar(80) NOT NULL,
	`payload` json NOT NULL DEFAULT ('{}'),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `autonomous_task_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint

ALTER TABLE `autonomous_task_policies` ADD CONSTRAINT `auto_policies_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE `autonomous_task_policies` ADD CONSTRAINT `auto_policies_ws_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE `autonomous_task_policies` ADD CONSTRAINT `auto_policies_user_fk` FOREIGN KEY (`emergency_stopped_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;
--> statement-breakpoint

ALTER TABLE `autonomous_task_definitions` ADD CONSTRAINT `auto_tasks_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE `autonomous_task_definitions` ADD CONSTRAINT `auto_tasks_ws_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE `autonomous_task_definitions` ADD CONSTRAINT `auto_tasks_wf_fk` FOREIGN KEY (`workflow_definition_id`) REFERENCES `agent_workflow_definitions`(`id`) ON DELETE set null ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE `autonomous_task_definitions` ADD CONSTRAINT `auto_tasks_agent_fk` FOREIGN KEY (`agent_id`) REFERENCES `ai_agent_definitions`(`id`) ON DELETE set null ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE `autonomous_task_definitions` ADD CONSTRAINT `auto_tasks_user_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE `autonomous_task_definitions` ADD CONSTRAINT `auto_tasks_stop_user_fk` FOREIGN KEY (`emergency_stopped_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;
--> statement-breakpoint

ALTER TABLE `autonomous_task_triggers` ADD CONSTRAINT `auto_triggers_task_fk` FOREIGN KEY (`task_definition_id`) REFERENCES `autonomous_task_definitions`(`id`) ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE `autonomous_task_triggers` ADD CONSTRAINT `auto_triggers_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE `autonomous_task_triggers` ADD CONSTRAINT `auto_triggers_ws_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint

ALTER TABLE `autonomous_task_runs` ADD CONSTRAINT `auto_runs_task_fk` FOREIGN KEY (`task_definition_id`) REFERENCES `autonomous_task_definitions`(`id`) ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE `autonomous_task_runs` ADD CONSTRAINT `auto_runs_trigger_fk` FOREIGN KEY (`trigger_id`) REFERENCES `autonomous_task_triggers`(`id`) ON DELETE set null ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE `autonomous_task_runs` ADD CONSTRAINT `auto_runs_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE `autonomous_task_runs` ADD CONSTRAINT `auto_runs_ws_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE `autonomous_task_runs` ADD CONSTRAINT `auto_runs_wf_run_fk` FOREIGN KEY (`workflow_run_id`) REFERENCES `agent_workflow_runs`(`id`) ON DELETE set null ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE `autonomous_task_runs` ADD CONSTRAINT `auto_runs_agent_run_fk` FOREIGN KEY (`agent_run_id`) REFERENCES `ai_agent_runs`(`id`) ON DELETE set null ON UPDATE cascade;
--> statement-breakpoint

ALTER TABLE `autonomous_task_checkpoints` ADD CONSTRAINT `auto_chkpt_run_fk` FOREIGN KEY (`task_run_id`) REFERENCES `autonomous_task_runs`(`id`) ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE `autonomous_task_checkpoints` ADD CONSTRAINT `auto_chkpt_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint

ALTER TABLE `autonomous_task_events` ADD CONSTRAINT `auto_events_run_fk` FOREIGN KEY (`task_run_id`) REFERENCES `autonomous_task_runs`(`id`) ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE `autonomous_task_events` ADD CONSTRAINT `auto_events_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint

CREATE INDEX `auto_tasks_org_status_idx` ON `autonomous_task_definitions` (`organization_id`,`status`);
--> statement-breakpoint
CREATE INDEX `auto_tasks_workspace_idx` ON `autonomous_task_definitions` (`workspace_id`);
--> statement-breakpoint
CREATE INDEX `auto_tasks_wf_idx` ON `autonomous_task_definitions` (`workflow_definition_id`);
--> statement-breakpoint
CREATE INDEX `auto_tasks_agent_idx` ON `autonomous_task_definitions` (`agent_id`);
--> statement-breakpoint

CREATE INDEX `auto_triggers_task_idx` ON `autonomous_task_triggers` (`task_definition_id`);
--> statement-breakpoint
CREATE INDEX `auto_triggers_next_run_idx` ON `autonomous_task_triggers` (`is_enabled`,`next_run_at`);
--> statement-breakpoint
CREATE INDEX `auto_triggers_event_idx` ON `autonomous_task_triggers` (`is_enabled`,`event_pattern`);
--> statement-breakpoint
CREATE INDEX `auto_triggers_org_idx` ON `autonomous_task_triggers` (`organization_id`);
--> statement-breakpoint

CREATE INDEX `auto_runs_status_lease_idx` ON `autonomous_task_runs` (`status`,`lease_expires_at`);
--> statement-breakpoint
CREATE INDEX `auto_runs_org_status_idx` ON `autonomous_task_runs` (`organization_id`,`status`);
--> statement-breakpoint
CREATE INDEX `auto_runs_task_idx` ON `autonomous_task_runs` (`task_definition_id`);
--> statement-breakpoint
CREATE INDEX `auto_runs_worker_idx` ON `autonomous_task_runs` (`worker_id`);
--> statement-breakpoint

CREATE INDEX `auto_chkpt_run_idx` ON `autonomous_task_checkpoints` (`task_run_id`);
--> statement-breakpoint
CREATE INDEX `auto_chkpt_org_idx` ON `autonomous_task_checkpoints` (`organization_id`);
--> statement-breakpoint

CREATE INDEX `auto_events_run_created_idx` ON `autonomous_task_events` (`task_run_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `auto_events_org_idx` ON `autonomous_task_events` (`organization_id`);
