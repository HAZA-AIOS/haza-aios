CREATE TABLE IF NOT EXISTS `agent_security_profiles` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36),
	`agent_id` char(36) NOT NULL,
	`resource_classification` varchar(40) NOT NULL DEFAULT 'internal',
	`network_access_mode` varchar(40) NOT NULL DEFAULT 'blocked',
	`allowed_network_domains` json NOT NULL DEFAULT ('[]'),
	`disallowed_network_domains` json NOT NULL DEFAULT ('[]'),
	`storage_access_mode` varchar(40) NOT NULL DEFAULT 'blocked',
	`allowed_storage_paths` json NOT NULL DEFAULT ('[]'),
	`disallowed_storage_paths` json NOT NULL DEFAULT ('[]'),
	`database_operations` json NOT NULL DEFAULT ('["read"]'),
	`max_execution_duration_ms` int NOT NULL DEFAULT 30000,
	`max_tool_invocations` int NOT NULL DEFAULT 10,
	`max_memory_bytes` bigint NOT NULL DEFAULT 536870912,
	`max_autonomy_level` varchar(20) NOT NULL DEFAULT 'L1',
	`allow_autonomous_execution` boolean NOT NULL DEFAULT false,
	`delegation_attenuation` boolean NOT NULL DEFAULT true,
	`allowed_tool_keys` json NOT NULL DEFAULT ('[]'),
	`disallowed_tool_keys` json NOT NULL DEFAULT ('[]'),
	`allowed_secret_reference_ids` json NOT NULL DEFAULT ('[]'),
	`is_suspended` boolean NOT NULL DEFAULT false,
	`suspended_at` timestamp(3),
	`suspended_by` char(36),
	`suspension_reason` text,
	`metadata` json NOT NULL DEFAULT ('{}'),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_security_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `gov_sec_profiles_org_agent_unique` UNIQUE(`organization_id`,`agent_id`),
	CONSTRAINT `gov_sec_profiles_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE cascade,
	CONSTRAINT `gov_sec_profiles_ws_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE set null ON UPDATE cascade,
	CONSTRAINT `gov_sec_profiles_agent_fk` FOREIGN KEY (`agent_id`) REFERENCES `ai_agent_definitions`(`id`) ON DELETE cascade ON UPDATE cascade,
	CONSTRAINT `gov_sec_profiles_suspended_by_fk` FOREIGN KEY (`suspended_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade
);
--> statement-breakpoint
CREATE INDEX `gov_sec_profiles_org_suspended_idx` ON `agent_security_profiles` (`organization_id`,`is_suspended`);
--> statement-breakpoint
CREATE INDEX `gov_sec_profiles_org_agent_idx` ON `agent_security_profiles` (`organization_id`,`agent_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `agent_secret_references` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36),
	`secret_identifier` varchar(120) NOT NULL,
	`name` varchar(160) NOT NULL,
	`description` text,
	`allowed_agent_ids` json NOT NULL DEFAULT ('[]'),
	`allowed_tool_keys` json NOT NULL DEFAULT ('[]'),
	`status` varchar(40) NOT NULL DEFAULT 'active',
	`version` int NOT NULL DEFAULT 1,
	`last_rotated_at` timestamp(3),
	`created_by` char(36),
	`metadata` json NOT NULL DEFAULT ('{}'),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_secret_references_id` PRIMARY KEY(`id`),
	CONSTRAINT `gov_secret_ref_org_ident_unique` UNIQUE(`organization_id`,`secret_identifier`),
	CONSTRAINT `gov_secret_ref_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE cascade,
	CONSTRAINT `gov_secret_ref_ws_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE set null ON UPDATE cascade,
	CONSTRAINT `gov_secret_ref_creator_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade
);
--> statement-breakpoint
CREATE INDEX `gov_secret_ref_org_status_idx` ON `agent_secret_references` (`organization_id`,`status`);
--> statement-breakpoint
CREATE INDEX `gov_secret_ref_org_ident_idx` ON `agent_secret_references` (`organization_id`,`secret_identifier`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `agent_security_events` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36),
	`agent_id` char(36),
	`actor_id` char(36),
	`event_type` varchar(80) NOT NULL,
	`severity` varchar(40) NOT NULL DEFAULT 'medium',
	`target_type` varchar(80) NOT NULL,
	`target_id` varchar(180) NOT NULL,
	`details` json NOT NULL DEFAULT ('{}'),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_security_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `gov_sec_events_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE cascade,
	CONSTRAINT `gov_sec_events_ws_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE set null ON UPDATE cascade,
	CONSTRAINT `gov_sec_events_agent_fk` FOREIGN KEY (`agent_id`) REFERENCES `ai_agent_definitions`(`id`) ON DELETE set null ON UPDATE cascade,
	CONSTRAINT `gov_sec_events_actor_fk` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade
);
--> statement-breakpoint
CREATE INDEX `gov_sec_events_org_type_idx` ON `agent_security_events` (`organization_id`,`event_type`,`created_at`);
--> statement-breakpoint
CREATE INDEX `gov_sec_events_org_severity_idx` ON `agent_security_events` (`organization_id`,`severity`,`created_at`);
--> statement-breakpoint
CREATE INDEX `gov_sec_events_agent_idx` ON `agent_security_events` (`agent_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `agent_continuation_records` (
	`id` char(36) NOT NULL,
	`approval_request_id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`status` varchar(40) NOT NULL DEFAULT 'claimed',
	`reconciliation_status` varchar(40) NOT NULL DEFAULT 'pending_execution',
	`canonical_payload_fingerprint` char(64) NOT NULL,
	`execution_id` varchar(120),
	`actor_id` char(36) NOT NULL,
	`attempts` int NOT NULL DEFAULT 1,
	`error_details` text,
	`started_at` timestamp(3) NOT NULL DEFAULT (now()),
	`completed_at` timestamp(3),
	`metadata` json NOT NULL DEFAULT ('{}'),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_continuation_records_id` PRIMARY KEY(`id`),
	CONSTRAINT `gov_continuation_records_req_unique` UNIQUE(`approval_request_id`),
	CONSTRAINT `gov_continuation_records_req_fk` FOREIGN KEY (`approval_request_id`) REFERENCES `agent_approval_requests`(`id`) ON DELETE cascade ON UPDATE cascade,
	CONSTRAINT `gov_continuation_records_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE cascade
);
--> statement-breakpoint
CREATE INDEX `gov_continuation_records_org_status_idx` ON `agent_continuation_records` (`organization_id`,`status`);
--> statement-breakpoint
CREATE INDEX `gov_continuation_records_reconcile_idx` ON `agent_continuation_records` (`organization_id`,`reconciliation_status`);

