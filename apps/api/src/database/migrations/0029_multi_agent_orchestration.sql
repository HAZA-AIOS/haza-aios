
CREATE TABLE `agent_team_members` (
	`id` char(36) NOT NULL,
	`team_id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`agent_id` char(36) NOT NULL,
	`role` varchar(60) NOT NULL,
	`capabilities` json NOT NULL,
	`priority` int NOT NULL DEFAULT 0,
	`status` varchar(40) NOT NULL DEFAULT 'active',
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `agent_team_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `agent_team_members_team_agent_unique` UNIQUE(`team_id`,`agent_id`)
);
--> statement-breakpoint

CREATE TABLE `agent_teams` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`name` varchar(180) NOT NULL,
	`description` varchar(1000) NOT NULL,
	`status` varchar(40) NOT NULL DEFAULT 'active',
	`created_by` char(36),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `agent_teams_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint

CREATE TABLE `agent_workflow_artifacts` (
	`id` char(36) NOT NULL,
	`workflow_run_id` char(36) NOT NULL,
	`step_run_id` char(36),
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`artifact_type` varchar(60) NOT NULL,
	`name` varchar(180) NOT NULL,
	`content` json NOT NULL,
	`provenance` json NOT NULL,
	`citations` json,
	`visibility` varchar(40) NOT NULL DEFAULT 'workspace',
	`created_by` char(36),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `agent_workflow_artifacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint

CREATE TABLE `agent_workflow_definitions` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`team_id` char(36),
	`name` varchar(180) NOT NULL,
	`description` varchar(1000) NOT NULL,
	`pattern` varchar(60) NOT NULL DEFAULT 'sequential',
	`status` varchar(40) NOT NULL DEFAULT 'draft',
	`version` varchar(40) NOT NULL DEFAULT '1.0.0',
	`revision` int NOT NULL DEFAULT 1,
	`input_schema` json NOT NULL,
	`output_schema` json,
	`configuration` json NOT NULL,
	`created_by` char(36),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `agent_workflow_definitions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint

CREATE TABLE `agent_workflow_events` (
	`id` char(36) NOT NULL,
	`workflow_run_id` char(36) NOT NULL,
	`step_run_id` char(36),
	`organization_id` char(36) NOT NULL,
	`event_type` varchar(80) NOT NULL,
	`payload` json NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `agent_workflow_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint

CREATE TABLE `agent_workflow_runs` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`workflow_definition_id` char(36) NOT NULL,
	`team_id` char(36),
	`workflow_revision` int NOT NULL DEFAULT 1,
	`initiator_user_id` char(36) NOT NULL,
	`status` varchar(40) NOT NULL DEFAULT 'queued',
	`idempotency_key` varchar(160),
	`initial_input` json NOT NULL,
	`final_output` json,
	`shared_context` json NOT NULL,
	`current_step_key` varchar(80),
	`total_duration_ms` int NOT NULL DEFAULT 0,
	`total_estimated_cost_usd` decimal(10,6) NOT NULL DEFAULT '0.000000',
	`total_prompt_tokens` int NOT NULL DEFAULT 0,
	`total_completion_tokens` int NOT NULL DEFAULT 0,
	`safe_error_message` varchar(1000),
	`started_at` timestamp(3),
	`completed_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `agent_workflow_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `agent_wf_runs_idempotency_unique` UNIQUE(`workspace_id`,`workflow_definition_id`,`idempotency_key`)
);
--> statement-breakpoint

CREATE TABLE `agent_workflow_step_runs` (
	`id` char(36) NOT NULL,
	`workflow_run_id` char(36) NOT NULL,
	`step_id` char(36) NOT NULL,
	`step_key` varchar(80) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`assigned_agent_id` char(36),
	`agent_run_id` char(36),
	`status` varchar(40) NOT NULL DEFAULT 'pending',
	`attempt` int NOT NULL DEFAULT 1,
	`input_payload` json NOT NULL,
	`output_payload` json,
	`step_artifacts` json,
	`safe_error_message` varchar(1000),
	`duration_ms` int NOT NULL DEFAULT 0,
	`started_at` timestamp(3),
	`completed_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `agent_workflow_step_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `agent_wf_step_runs_run_step_attempt_unique` UNIQUE(`workflow_run_id`,`step_key`,`attempt`)
);
--> statement-breakpoint

CREATE TABLE `agent_workflow_steps` (
	`id` char(36) NOT NULL,
	`workflow_definition_id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`step_key` varchar(80) NOT NULL,
	`name` varchar(180) NOT NULL,
	`description` varchar(1000) NOT NULL,
	`step_order` int NOT NULL DEFAULT 0,
	`assigned_role` varchar(60) NOT NULL,
	`assigned_agent_id` char(36),
	`depends_on_step_keys` json NOT NULL,
	`requires_approval` boolean NOT NULL DEFAULT false,
	`approval_roles` json,
	`input_mapping` json NOT NULL,
	`output_key` varchar(80) NOT NULL,
	`max_retries` int NOT NULL DEFAULT 2,
	`timeout_seconds` int NOT NULL DEFAULT 300,
	`configuration` json NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `agent_workflow_steps_id` PRIMARY KEY(`id`),
	CONSTRAINT `agent_wf_steps_def_key_unique` UNIQUE(`workflow_definition_id`,`step_key`)
);
--> statement-breakpoint

ALTER TABLE `agent_team_members` ADD CONSTRAINT `agent_team_members_team_id_agent_teams_id_fk` FOREIGN KEY (`team_id`) REFERENCES `agent_teams`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint

ALTER TABLE `agent_team_members` ADD CONSTRAINT `agent_team_members_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint

ALTER TABLE `agent_team_members` ADD CONSTRAINT `agent_team_members_agent_id_ai_agent_definitions_id_fk` FOREIGN KEY (`agent_id`) REFERENCES `ai_agent_definitions`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint

ALTER TABLE `agent_teams` ADD CONSTRAINT `agent_teams_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint

ALTER TABLE `agent_teams` ADD CONSTRAINT `agent_teams_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint

ALTER TABLE `agent_teams` ADD CONSTRAINT `agent_teams_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint

ALTER TABLE `agent_workflow_artifacts` ADD CONSTRAINT `agent_wf_artifacts_run_id_wf_runs_id_fk` FOREIGN KEY (`workflow_run_id`) REFERENCES `agent_workflow_runs`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint

ALTER TABLE `agent_workflow_artifacts` ADD CONSTRAINT `agent_wf_artifacts_step_run_id_step_runs_id_fk` FOREIGN KEY (`step_run_id`) REFERENCES `agent_workflow_step_runs`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint

ALTER TABLE `agent_workflow_artifacts` ADD CONSTRAINT `agent_workflow_artifacts_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint

ALTER TABLE `agent_workflow_artifacts` ADD CONSTRAINT `agent_workflow_artifacts_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint

ALTER TABLE `agent_workflow_artifacts` ADD CONSTRAINT `agent_workflow_artifacts_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint

ALTER TABLE `agent_workflow_definitions` ADD CONSTRAINT `agent_workflow_definitions_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint

ALTER TABLE `agent_workflow_definitions` ADD CONSTRAINT `agent_workflow_definitions_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint

ALTER TABLE `agent_workflow_definitions` ADD CONSTRAINT `agent_workflow_definitions_team_id_agent_teams_id_fk` FOREIGN KEY (`team_id`) REFERENCES `agent_teams`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint

ALTER TABLE `agent_workflow_definitions` ADD CONSTRAINT `agent_workflow_definitions_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint

ALTER TABLE `agent_workflow_events` ADD CONSTRAINT `agent_workflow_events_workflow_run_id_agent_workflow_runs_id_fk` FOREIGN KEY (`workflow_run_id`) REFERENCES `agent_workflow_runs`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint

ALTER TABLE `agent_workflow_events` ADD CONSTRAINT `agent_workflow_events_step_run_id_agent_workflow_step_runs_id_fk` FOREIGN KEY (`step_run_id`) REFERENCES `agent_workflow_step_runs`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint

ALTER TABLE `agent_workflow_events` ADD CONSTRAINT `agent_workflow_events_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint

ALTER TABLE `agent_workflow_runs` ADD CONSTRAINT `agent_workflow_runs_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint

ALTER TABLE `agent_workflow_runs` ADD CONSTRAINT `agent_workflow_runs_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint

ALTER TABLE `agent_workflow_runs` ADD CONSTRAINT `agent_wf_runs_wf_def_id_wf_defs_id_fk` FOREIGN KEY (`workflow_definition_id`) REFERENCES `agent_workflow_definitions`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint

ALTER TABLE `agent_workflow_runs` ADD CONSTRAINT `agent_workflow_runs_team_id_agent_teams_id_fk` FOREIGN KEY (`team_id`) REFERENCES `agent_teams`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint

ALTER TABLE `agent_workflow_runs` ADD CONSTRAINT `agent_workflow_runs_initiator_user_id_users_id_fk` FOREIGN KEY (`initiator_user_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint

ALTER TABLE `agent_workflow_step_runs` ADD CONSTRAINT `agent_wf_step_runs_run_id_wf_runs_id_fk` FOREIGN KEY (`workflow_run_id`) REFERENCES `agent_workflow_runs`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint

ALTER TABLE `agent_workflow_step_runs` ADD CONSTRAINT `agent_workflow_step_runs_step_id_agent_workflow_steps_id_fk` FOREIGN KEY (`step_id`) REFERENCES `agent_workflow_steps`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint

ALTER TABLE `agent_workflow_step_runs` ADD CONSTRAINT `agent_workflow_step_runs_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint

ALTER TABLE `agent_workflow_step_runs` ADD CONSTRAINT `agent_wf_step_runs_agent_id_agent_defs_id_fk` FOREIGN KEY (`assigned_agent_id`) REFERENCES `ai_agent_definitions`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint

ALTER TABLE `agent_workflow_step_runs` ADD CONSTRAINT `agent_workflow_step_runs_agent_run_id_ai_agent_runs_id_fk` FOREIGN KEY (`agent_run_id`) REFERENCES `ai_agent_runs`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint

ALTER TABLE `agent_workflow_steps` ADD CONSTRAINT `agent_wf_steps_wf_def_id_wf_defs_id_fk` FOREIGN KEY (`workflow_definition_id`) REFERENCES `agent_workflow_definitions`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint

ALTER TABLE `agent_workflow_steps` ADD CONSTRAINT `agent_workflow_steps_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint

ALTER TABLE `agent_workflow_steps` ADD CONSTRAINT `agent_wf_steps_agent_id_agent_defs_id_fk` FOREIGN KEY (`assigned_agent_id`) REFERENCES `ai_agent_definitions`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint

CREATE INDEX `agent_team_members_team_idx` ON `agent_team_members` (`team_id`);--> statement-breakpoint

CREATE INDEX `agent_team_members_agent_idx` ON `agent_team_members` (`agent_id`);--> statement-breakpoint

CREATE INDEX `agent_team_members_org_idx` ON `agent_team_members` (`organization_id`);--> statement-breakpoint

CREATE INDEX `agent_teams_org_idx` ON `agent_teams` (`organization_id`);--> statement-breakpoint

CREATE INDEX `agent_teams_workspace_idx` ON `agent_teams` (`workspace_id`);--> statement-breakpoint

CREATE INDEX `agent_wf_artifacts_run_idx` ON `agent_workflow_artifacts` (`workflow_run_id`);--> statement-breakpoint

CREATE INDEX `agent_wf_artifacts_step_idx` ON `agent_workflow_artifacts` (`step_run_id`);--> statement-breakpoint

CREATE INDEX `agent_wf_artifacts_org_idx` ON `agent_workflow_artifacts` (`organization_id`);--> statement-breakpoint

CREATE INDEX `agent_wf_artifacts_workspace_idx` ON `agent_workflow_artifacts` (`workspace_id`);--> statement-breakpoint

CREATE INDEX `agent_wf_defs_org_status_idx` ON `agent_workflow_definitions` (`organization_id`,`status`);--> statement-breakpoint

CREATE INDEX `agent_wf_defs_workspace_idx` ON `agent_workflow_definitions` (`workspace_id`);--> statement-breakpoint

CREATE INDEX `agent_wf_defs_team_idx` ON `agent_workflow_definitions` (`team_id`);--> statement-breakpoint

CREATE INDEX `agent_wf_events_run_created_idx` ON `agent_workflow_events` (`workflow_run_id`,`created_at`);--> statement-breakpoint

CREATE INDEX `agent_wf_events_org_idx` ON `agent_workflow_events` (`organization_id`);--> statement-breakpoint

CREATE INDEX `agent_wf_runs_org_status_idx` ON `agent_workflow_runs` (`organization_id`,`status`);--> statement-breakpoint

CREATE INDEX `agent_wf_runs_workspace_status_idx` ON `agent_workflow_runs` (`workspace_id`,`status`);--> statement-breakpoint

CREATE INDEX `agent_wf_runs_wf_def_idx` ON `agent_workflow_runs` (`workflow_definition_id`);--> statement-breakpoint

CREATE INDEX `agent_wf_runs_initiator_idx` ON `agent_workflow_runs` (`initiator_user_id`);--> statement-breakpoint

CREATE INDEX `agent_wf_step_runs_run_idx` ON `agent_workflow_step_runs` (`workflow_run_id`);--> statement-breakpoint

CREATE INDEX `agent_wf_step_runs_step_idx` ON `agent_workflow_step_runs` (`step_id`);--> statement-breakpoint

CREATE INDEX `agent_wf_step_runs_agent_run_idx` ON `agent_workflow_step_runs` (`agent_run_id`);--> statement-breakpoint

CREATE INDEX `agent_wf_step_runs_org_status_idx` ON `agent_workflow_step_runs` (`organization_id`,`status`);--> statement-breakpoint

CREATE INDEX `agent_wf_steps_def_idx` ON `agent_workflow_steps` (`workflow_definition_id`);--> statement-breakpoint

CREATE INDEX `agent_wf_steps_org_idx` ON `agent_workflow_steps` (`organization_id`);--> statement-breakpoint

CREATE INDEX `agent_wf_steps_agent_idx` ON `agent_workflow_steps` (`assigned_agent_id`);