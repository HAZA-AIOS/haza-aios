CREATE TABLE `ai_provider_tenant_configs` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`provider_id` varchar(60) NOT NULL,
	`live_mode_enabled` boolean NOT NULL DEFAULT false,
	`environment_mode` varchar(30) NOT NULL DEFAULT 'mock',
	`api_key_encrypted` text,
	`api_key_masked` varchar(60),
	`default_model` varchar(120) NOT NULL DEFAULT 'gpt-4o-mini',
	`allowed_models` json NOT NULL,
	`embedding_model` varchar(120) NOT NULL DEFAULT 'text-embedding-3-small',
	`embedding_live_enabled` boolean NOT NULL DEFAULT false,
	`status` varchar(40) NOT NULL DEFAULT 'inactive',
	`status_message` varchar(500),
	`last_health_check_at` timestamp(3),
	`updated_by` char(36),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `ai_provider_tenant_configs_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_provider_tenant_configs_org_provider_unique` UNIQUE(`organization_id`,`provider_id`)
);
--> statement-breakpoint
ALTER TABLE `ai_provider_tenant_configs` ADD CONSTRAINT `ai_provider_tenant_configs_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE `ai_provider_tenant_configs` ADD CONSTRAINT `ai_provider_tenant_configs_user_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE cascade;
--> statement-breakpoint
CREATE INDEX `ai_provider_tenant_configs_org_idx` ON `ai_provider_tenant_configs` (`organization_id`);
--> statement-breakpoint
CREATE TABLE `ai_provider_audit_logs` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`provider_id` varchar(60) NOT NULL,
	`action` varchar(80) NOT NULL,
	`performed_by` char(36),
	`previous_state` json,
	`new_state` json,
	`ip_address` varchar(45),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `ai_provider_audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `ai_provider_audit_logs` ADD CONSTRAINT `ai_provider_audit_logs_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE `ai_provider_audit_logs` ADD CONSTRAINT `ai_provider_audit_logs_user_fk` FOREIGN KEY (`performed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE cascade;
--> statement-breakpoint
CREATE INDEX `ai_provider_audit_logs_org_provider_idx` ON `ai_provider_audit_logs` (`organization_id`,`provider_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `ai_provider_audit_logs_org_idx` ON `ai_provider_audit_logs` (`organization_id`);
--> statement-breakpoint
CREATE TABLE `ai_model_pricing_catalog` (
	`id` char(36) NOT NULL,
	`provider_id` varchar(60) NOT NULL,
	`model_id` varchar(120) NOT NULL,
	`prompt_per_thousand_tokens_usd` decimal(10,6) NOT NULL,
	`completion_per_thousand_tokens_usd` decimal(10,6) NOT NULL,
	`embedding_per_thousand_tokens_usd` decimal(10,6) NOT NULL DEFAULT '0.000000',
	`context_window` int NOT NULL DEFAULT 128000,
	`max_output_tokens` int NOT NULL DEFAULT 4096,
	`supports_streaming` boolean NOT NULL DEFAULT true,
	`supports_tools` boolean NOT NULL DEFAULT true,
	`supports_vision` boolean NOT NULL DEFAULT false,
	`supports_json_mode` boolean NOT NULL DEFAULT true,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `ai_model_pricing_catalog_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_model_pricing_catalog_provider_model_unique` UNIQUE(`provider_id`,`model_id`)
);
--> statement-breakpoint
CREATE INDEX `ai_model_pricing_catalog_provider_idx` ON `ai_model_pricing_catalog` (`provider_id`);
--> statement-breakpoint
CREATE TABLE `ai_usage_budgets` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36),
	`monthly_budget_usd` decimal(10,4) NOT NULL DEFAULT '50.0000',
	`daily_budget_usd` decimal(10,4) NOT NULL DEFAULT '10.0000',
	`per_request_max_cost_usd` decimal(10,4) NOT NULL DEFAULT '1.0000',
	`current_month_spend_usd` decimal(10,4) NOT NULL DEFAULT '0.0000',
	`current_day_spend_usd` decimal(10,4) NOT NULL DEFAULT '0.0000',
	`month_reset_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`day_reset_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`enforce_hard_limit` boolean NOT NULL DEFAULT true,
	`notify_threshold_percent` int NOT NULL DEFAULT 80,
	`status` varchar(40) NOT NULL DEFAULT 'active',
	`updated_by` char(36),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `ai_usage_budgets_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_usage_budgets_org_workspace_unique` UNIQUE(`organization_id`,`workspace_id`)
);
--> statement-breakpoint
ALTER TABLE `ai_usage_budgets` ADD CONSTRAINT `ai_usage_budgets_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE `ai_usage_budgets` ADD CONSTRAINT `ai_usage_budgets_ws_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE `ai_usage_budgets` ADD CONSTRAINT `ai_usage_budgets_user_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE cascade;
--> statement-breakpoint
CREATE INDEX `ai_usage_budgets_org_idx` ON `ai_usage_budgets` (`organization_id`);
--> statement-breakpoint
CREATE TABLE `ai_usage_ledger` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36),
	`agent_id` char(36),
	`run_id` char(36),
	`provider_id` varchar(60) NOT NULL,
	`model_id` varchar(120) NOT NULL,
	`operation_type` varchar(40) NOT NULL,
	`prompt_tokens` int NOT NULL DEFAULT 0,
	`completion_tokens` int NOT NULL DEFAULT 0,
	`total_tokens` int NOT NULL DEFAULT 0,
	`estimated_cost_usd` decimal(10,6) NOT NULL DEFAULT '0.000000',
	`actual_cost_usd` decimal(10,6),
	`latency_ms` int NOT NULL DEFAULT 0,
	`finish_reason` varchar(40),
	`is_live_mode` boolean NOT NULL DEFAULT false,
	`correlation_id` varchar(120),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `ai_usage_ledger_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `ai_usage_ledger` ADD CONSTRAINT `ai_usage_ledger_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE `ai_usage_ledger` ADD CONSTRAINT `ai_usage_ledger_ws_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE SET NULL ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE `ai_usage_ledger` ADD CONSTRAINT `ai_usage_ledger_agent_fk` FOREIGN KEY (`agent_id`) REFERENCES `ai_agent_definitions`(`id`) ON DELETE SET NULL ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE `ai_usage_ledger` ADD CONSTRAINT `ai_usage_ledger_run_fk` FOREIGN KEY (`run_id`) REFERENCES `ai_agent_runs`(`id`) ON DELETE SET NULL ON UPDATE cascade;
--> statement-breakpoint
CREATE INDEX `ai_usage_ledger_org_created_idx` ON `ai_usage_ledger` (`organization_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `ai_usage_ledger_run_idx` ON `ai_usage_ledger` (`run_id`);
--> statement-breakpoint
CREATE INDEX `ai_usage_ledger_correlation_idx` ON `ai_usage_ledger` (`correlation_id`);
