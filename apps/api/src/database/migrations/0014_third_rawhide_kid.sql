CREATE TABLE `billing_accounts` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`billing_email` varchar(255) NOT NULL,
	`currency` char(3) NOT NULL,
	`billing_account_status` enum('pending','active','suspended') NOT NULL DEFAULT 'pending',
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `billing_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `billing_accounts_org_unique` UNIQUE(`organization_id`)
);
--> statement-breakpoint
CREATE TABLE `billing_statements` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`subscription_id` char(36) NOT NULL,
	`billing_statement_status` enum('draft','finalized','void') NOT NULL DEFAULT 'draft',
	`currency` char(3) NOT NULL,
	`amount_cents` int NOT NULL DEFAULT 0,
	`period_start` datetime(3) NOT NULL,
	`period_end` datetime(3) NOT NULL,
	`usage_snapshot` json NOT NULL DEFAULT ('{}'),
	`finalized_at` datetime(3),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `billing_statements_id` PRIMARY KEY(`id`),
	CONSTRAINT `billing_statements_subscription_period_unique` UNIQUE(`subscription_id`,`period_start`,`period_end`)
);
--> statement-breakpoint
CREATE TABLE `organization_subscriptions` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`billing_account_id` char(36) NOT NULL,
	`plan_id` char(36) NOT NULL,
	`saas_subscription_status` enum('pending','trialing','active','past_due','cancelled') NOT NULL DEFAULT 'pending',
	`period_start` datetime(3) NOT NULL,
	`period_end` datetime(3) NOT NULL,
	`cancelled_at` datetime(3),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organization_subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `saas_plans` (
	`id` char(36) NOT NULL,
	`code` varchar(80) NOT NULL,
	`name` varchar(160) NOT NULL,
	`saas_plan_status` enum('draft','active','retired') NOT NULL DEFAULT 'draft',
	`currency` char(3) NOT NULL,
	`saas_plan_interval` enum('monthly','annual') NOT NULL,
	`price_cents` int NOT NULL,
	`included_units` json NOT NULL DEFAULT ('{}'),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `saas_plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `saas_plans_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `usage_meter_events` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`meter_key` varchar(120) NOT NULL,
	`quantity` int NOT NULL,
	`source_type` varchar(80) NOT NULL,
	`source_id` char(36) NOT NULL,
	`idempotency_key` varchar(180) NOT NULL,
	`metadata` json NOT NULL DEFAULT ('{}'),
	`occurred_at` timestamp(3) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `usage_meter_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `usage_meter_events_org_key_unique` UNIQUE(`organization_id`,`idempotency_key`)
);
--> statement-breakpoint
ALTER TABLE `billing_accounts` ADD CONSTRAINT `billing_accounts_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_statements` ADD CONSTRAINT `billing_statements_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_statements` ADD CONSTRAINT `billing_stmt_subscription_fk` FOREIGN KEY (`subscription_id`) REFERENCES `organization_subscriptions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `organization_subscriptions` ADD CONSTRAINT `organization_subscriptions_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `organization_subscriptions` ADD CONSTRAINT `org_sub_billing_account_fk` FOREIGN KEY (`billing_account_id`) REFERENCES `billing_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `organization_subscriptions` ADD CONSTRAINT `organization_subscriptions_plan_id_saas_plans_id_fk` FOREIGN KEY (`plan_id`) REFERENCES `saas_plans`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `usage_meter_events` ADD CONSTRAINT `usage_meter_events_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `usage_meter_events` ADD CONSTRAINT `usage_meter_events_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `billing_statements_org_created_idx` ON `billing_statements` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `organization_subscriptions_org_period_idx` ON `organization_subscriptions` (`organization_id`,`period_start`,`period_end`);--> statement-breakpoint
CREATE INDEX `organization_subscriptions_account_idx` ON `organization_subscriptions` (`billing_account_id`);--> statement-breakpoint
CREATE INDEX `usage_meter_events_org_meter_time_idx` ON `usage_meter_events` (`organization_id`,`meter_key`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `usage_meter_events_workspace_time_idx` ON `usage_meter_events` (`workspace_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `usage_meter_events_source_idx` ON `usage_meter_events` (`organization_id`,`source_type`,`source_id`);
--> statement-breakpoint
INSERT IGNORE INTO `permissions` (`id`, `permission_key`, `description`)
VALUES
(UUID(), 'usage.read', 'Read organization usage and metering records.'),
(UUID(), 'billing.read', 'Read organization SaaS billing records.');
--> statement-breakpoint
INSERT IGNORE INTO `role_permissions` (`id`, `role_id`, `permission_id`)
SELECT UUID(), `roles`.`id`, `permissions`.`id`
FROM `roles`
JOIN `permissions` ON `permissions`.`permission_key` IN ('usage.read', 'billing.read')
WHERE `roles`.`role_scope` = 'organization'
  AND `roles`.`name` IN ('Owner', 'Admin');
