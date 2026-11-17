CREATE TABLE IF NOT EXISTS `agent_approval_requests` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36),
	`agent_id` char(36) NOT NULL,
	`execution_id` varchar(120),
	`correlation_id` varchar(120),
	`trace_id` varchar(120),
	`span_id` varchar(120),
	`action_type` varchar(80) NOT NULL,
	`action_target` varchar(180) NOT NULL,
	`resource_id` varchar(180),
	`requesting_actor_id` char(36) NOT NULL,
	`requesting_actor_type` varchar(40) NOT NULL DEFAULT 'user',
	`canonical_payload_fingerprint` char(64) NOT NULL,
	`payload` json NOT NULL DEFAULT ('{}'),
	`matched_policy_id` char(36),
	`matched_policy_version` int,
	`approval_reason` text NOT NULL,
	`risk_classification` varchar(40) NOT NULL DEFAULT 'medium',
	`security_classification` varchar(40) NOT NULL DEFAULT 'internal',
	`assigned_reviewer_id` char(36),
	`assigned_role` varchar(80),
	`status` varchar(40) NOT NULL DEFAULT 'pending',
	`decision_id` char(36),
	`consumed_at` timestamp(3),
	`consumed_by` char(36),
	`idempotency_key` varchar(120) NOT NULL,
	`expires_at` timestamp(3) NOT NULL,
	`metadata` json NOT NULL DEFAULT ('{}'),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_approval_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `gov_approval_requests_org_idemp_unique` UNIQUE(`organization_id`,`idempotency_key`),
	CONSTRAINT `gov_approval_requests_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE cascade,
	CONSTRAINT `gov_approval_requests_ws_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE set null ON UPDATE cascade,
	CONSTRAINT `gov_approval_requests_agent_fk` FOREIGN KEY (`agent_id`) REFERENCES `ai_agent_definitions`(`id`) ON DELETE cascade ON UPDATE cascade,
	CONSTRAINT `gov_approval_requests_policy_fk` FOREIGN KEY (`matched_policy_id`) REFERENCES `agent_governance_policies`(`id`) ON DELETE set null ON UPDATE cascade,
	CONSTRAINT `gov_approval_requests_reviewer_fk` FOREIGN KEY (`assigned_reviewer_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade
);
--> statement-breakpoint
CREATE INDEX `gov_approval_requests_org_status_idx` ON `agent_approval_requests` (`organization_id`,`status`);
--> statement-breakpoint
CREATE INDEX `gov_approval_requests_org_agent_idx` ON `agent_approval_requests` (`organization_id`,`agent_id`);
--> statement-breakpoint
CREATE INDEX `gov_approval_requests_org_reviewer_idx` ON `agent_approval_requests` (`organization_id`,`assigned_reviewer_id`,`status`);
--> statement-breakpoint
CREATE INDEX `gov_approval_requests_expires_idx` ON `agent_approval_requests` (`organization_id`,`expires_at`,`status`);
--> statement-breakpoint
CREATE INDEX `gov_approval_requests_fingerprint_idx` ON `agent_approval_requests` (`organization_id`,`agent_id`,`canonical_payload_fingerprint`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `agent_approval_decisions` (
	`id` char(36) NOT NULL,
	`approval_request_id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`decision` varchar(40) NOT NULL,
	`decided_by_actor_id` char(36) NOT NULL,
	`decided_by_actor_type` varchar(40) NOT NULL DEFAULT 'user',
	`reason` text,
	`justification` text,
	`policy_snapshot` json NOT NULL DEFAULT ('{}'),
	`metadata` json NOT NULL DEFAULT ('{}'),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_approval_decisions_id` PRIMARY KEY(`id`),
	CONSTRAINT `gov_approval_decisions_request_fk` FOREIGN KEY (`approval_request_id`) REFERENCES `agent_approval_requests`(`id`) ON DELETE cascade ON UPDATE cascade,
	CONSTRAINT `gov_approval_decisions_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE cascade,
	CONSTRAINT `gov_approval_decisions_user_fk` FOREIGN KEY (`decided_by_actor_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE cascade
);
--> statement-breakpoint
CREATE INDEX `gov_approval_decisions_request_idx` ON `agent_approval_decisions` (`approval_request_id`);
--> statement-breakpoint
CREATE INDEX `gov_approval_decisions_org_decision_idx` ON `agent_approval_decisions` (`organization_id`,`decision`,`created_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `agent_approval_escalations` (
	`id` char(36) NOT NULL,
	`approval_request_id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`escalated_by_actor_id` char(36) NOT NULL,
	`previous_reviewer_id` char(36),
	`escalated_to_reviewer_id` char(36),
	`escalation_contact` varchar(255),
	`reason` text NOT NULL,
	`status` varchar(40) NOT NULL DEFAULT 'escalated',
	`metadata` json NOT NULL DEFAULT ('{}'),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_approval_escalations_id` PRIMARY KEY(`id`),
	CONSTRAINT `gov_approval_escalations_request_fk` FOREIGN KEY (`approval_request_id`) REFERENCES `agent_approval_requests`(`id`) ON DELETE cascade ON UPDATE cascade,
	CONSTRAINT `gov_approval_escalations_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE cascade,
	CONSTRAINT `gov_approval_escalations_prev_fk` FOREIGN KEY (`previous_reviewer_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade,
	CONSTRAINT `gov_approval_escalations_next_fk` FOREIGN KEY (`escalated_to_reviewer_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade
);
--> statement-breakpoint
CREATE INDEX `gov_approval_escalations_request_idx` ON `agent_approval_escalations` (`approval_request_id`);
--> statement-breakpoint
CREATE INDEX `gov_approval_escalations_org_created_idx` ON `agent_approval_escalations` (`organization_id`,`created_at`);
