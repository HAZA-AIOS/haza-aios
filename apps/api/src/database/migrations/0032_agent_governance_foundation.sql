CREATE TABLE IF NOT EXISTS `agent_governance_profiles` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36),
	`agent_id` char(36) NOT NULL,
	`security_classification` varchar(40) NOT NULL DEFAULT 'internal',
	`risk_tier` varchar(40) NOT NULL DEFAULT 'medium',
	`compliance_frameworks` json NOT NULL DEFAULT ('[]'),
	`max_autonomy_level` varchar(20) NOT NULL DEFAULT 'L2',
	`approval_policy` varchar(40) NOT NULL DEFAULT 'standard',
	`audit_frequency` varchar(40) NOT NULL DEFAULT 'quarterly',
	`strict_telemetry` boolean NOT NULL DEFAULT true,
	`review_cadence_days` int NOT NULL DEFAULT 90,
	`last_reviewed_at` timestamp(3),
	`next_review_due_at` timestamp(3),
	`compliance_status` varchar(40) NOT NULL DEFAULT 'compliant',
	`notes` text,
	`created_by` char(36) NOT NULL,
	`updated_by` char(36) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_governance_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `gov_profiles_org_agent_unique` UNIQUE(`organization_id`,`agent_id`),
	CONSTRAINT `gov_profiles_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE cascade,
	CONSTRAINT `gov_profiles_ws_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE set null ON UPDATE cascade,
	CONSTRAINT `gov_profiles_agent_fk` FOREIGN KEY (`agent_id`) REFERENCES `ai_agent_definitions`(`id`) ON DELETE cascade ON UPDATE cascade
);
--> statement-breakpoint
CREATE INDEX `gov_profiles_org_status_idx` ON `agent_governance_profiles` (`organization_id`,`compliance_status`);
--> statement-breakpoint
CREATE INDEX `gov_profiles_org_tier_idx` ON `agent_governance_profiles` (`organization_id`,`risk_tier`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `agent_ownership_assignments` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36),
	`agent_id` char(36) NOT NULL,
	`primary_owner_id` char(36) NOT NULL,
	`technical_owner_id` char(36),
	`business_owner_id` char(36),
	`escalation_contact` varchar(255) NOT NULL,
	`review_cadence` varchar(40) NOT NULL DEFAULT 'quarterly',
	`accountability_status` varchar(40) NOT NULL DEFAULT 'active',
	`delegated_approver_ids` json NOT NULL DEFAULT ('[]'),
	`assigned_by` char(36) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_ownership_assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `gov_ownership_org_agent_unique` UNIQUE(`organization_id`,`agent_id`),
	CONSTRAINT `gov_ownership_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE cascade,
	CONSTRAINT `gov_ownership_ws_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE set null ON UPDATE cascade,
	CONSTRAINT `gov_ownership_agent_fk` FOREIGN KEY (`agent_id`) REFERENCES `ai_agent_definitions`(`id`) ON DELETE cascade ON UPDATE cascade,
	CONSTRAINT `gov_ownership_primary_owner_fk` FOREIGN KEY (`primary_owner_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE cascade,
	CONSTRAINT `gov_ownership_tech_owner_fk` FOREIGN KEY (`technical_owner_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade,
	CONSTRAINT `gov_ownership_biz_owner_fk` FOREIGN KEY (`business_owner_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade
);
--> statement-breakpoint
CREATE INDEX `gov_ownership_org_primary_idx` ON `agent_ownership_assignments` (`organization_id`,`primary_owner_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `agent_governance_policies` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36),
	`name` varchar(180) NOT NULL,
	`policy_key` varchar(120) NOT NULL,
	`policy_type` varchar(60) NOT NULL,
	`scope_type` varchar(40) NOT NULL DEFAULT 'organization',
	`target_agent_ids` json NOT NULL DEFAULT ('[]'),
	`severity` varchar(20) NOT NULL DEFAULT 'medium',
	`enforcement_action` varchar(40) NOT NULL DEFAULT 'log',
	`lifecycle_state` varchar(40) NOT NULL DEFAULT 'draft',
	`current_version` int NOT NULL DEFAULT 1,
	`description` text,
	`rules` json NOT NULL DEFAULT ('{}'),
	`metadata` json NOT NULL DEFAULT ('{}'),
	`created_by` char(36) NOT NULL,
	`updated_by` char(36) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_governance_policies_id` PRIMARY KEY(`id`),
	CONSTRAINT `gov_policies_org_key_unique` UNIQUE(`organization_id`,`policy_key`),
	CONSTRAINT `gov_policies_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE cascade,
	CONSTRAINT `gov_policies_ws_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE set null ON UPDATE cascade
);
--> statement-breakpoint
CREATE INDEX `gov_policies_org_type_idx` ON `agent_governance_policies` (`organization_id`,`policy_type`);
--> statement-breakpoint
CREATE INDEX `gov_policies_org_state_idx` ON `agent_governance_policies` (`organization_id`,`lifecycle_state`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `agent_governance_policy_versions` (
	`id` char(36) NOT NULL,
	`policy_id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`version` int NOT NULL,
	`lifecycle_state` varchar(40) NOT NULL DEFAULT 'draft',
	`change_summary` text NOT NULL,
	`rules` json NOT NULL DEFAULT ('{}'),
	`created_by` char(36) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_governance_policy_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `gov_policy_versions_unique` UNIQUE(`policy_id`,`version`),
	CONSTRAINT `gov_policy_versions_policy_fk` FOREIGN KEY (`policy_id`) REFERENCES `agent_governance_policies`(`id`) ON DELETE cascade ON UPDATE cascade,
	CONSTRAINT `gov_policy_versions_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE cascade
);
--> statement-breakpoint
CREATE INDEX `gov_policy_versions_org_idx` ON `agent_governance_policy_versions` (`organization_id`,`policy_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `agent_governance_audit_logs` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36),
	`actor_id` char(36) NOT NULL,
	`action` varchar(120) NOT NULL,
	`target_type` varchar(80) NOT NULL,
	`target_id` char(36) NOT NULL,
	`before_state` json,
	`after_state` json,
	`metadata` json NOT NULL DEFAULT ('{}'),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_governance_audit_logs_id` PRIMARY KEY(`id`),
	CONSTRAINT `gov_audit_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE cascade,
	CONSTRAINT `gov_audit_ws_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE set null ON UPDATE cascade
);
--> statement-breakpoint
CREATE INDEX `gov_audit_org_created_idx` ON `agent_governance_audit_logs` (`organization_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `gov_audit_org_target_idx` ON `agent_governance_audit_logs` (`organization_id`,`target_type`,`target_id`);
