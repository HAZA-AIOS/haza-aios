CREATE TABLE IF NOT EXISTS `agent_trace_spans` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36),
	`trace_id` varchar(64) NOT NULL,
	`span_id` varchar(64) NOT NULL,
	`parent_span_id` varchar(64),
	`name` varchar(120) NOT NULL,
	`kind` varchar(30) NOT NULL DEFAULT 'internal',
	`status` varchar(20) NOT NULL DEFAULT 'ok',
	`status_code` int NOT NULL DEFAULT 0,
	`status_message` text,
	`duration_ms` int NOT NULL DEFAULT 0,
	`start_time` timestamp(3) NOT NULL,
	`end_time` timestamp(3),
	`service_name` varchar(60) NOT NULL DEFAULT 'haza-aios-agent',
	`attributes` json NOT NULL DEFAULT ('{}'),
	`events` json NOT NULL DEFAULT ('[]'),
	`agent_id` char(36),
	`agent_run_id` char(36),
	`workflow_run_id` char(36),
	`autonomous_run_id` char(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_trace_spans_id` PRIMARY KEY(`id`),
	CONSTRAINT `trace_spans_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE cascade,
	CONSTRAINT `trace_spans_ws_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE set null ON UPDATE cascade,
	CONSTRAINT `trace_spans_agent_fk` FOREIGN KEY (`agent_id`) REFERENCES `ai_agent_definitions`(`id`) ON DELETE set null ON UPDATE cascade,
	CONSTRAINT `trace_spans_run_fk` FOREIGN KEY (`agent_run_id`) REFERENCES `ai_agent_runs`(`id`) ON DELETE set null ON UPDATE cascade,
	CONSTRAINT `trace_spans_wfrun_fk` FOREIGN KEY (`workflow_run_id`) REFERENCES `agent_workflow_runs`(`id`) ON DELETE set null ON UPDATE cascade,
	CONSTRAINT `trace_spans_autorun_fk` FOREIGN KEY (`autonomous_run_id`) REFERENCES `autonomous_task_runs`(`id`) ON DELETE set null ON UPDATE cascade
);
--> statement-breakpoint
CREATE INDEX `trace_spans_trace_idx` ON `agent_trace_spans` (`trace_id`);
--> statement-breakpoint
CREATE INDEX `trace_spans_org_time_idx` ON `agent_trace_spans` (`organization_id`,`start_time`);
--> statement-breakpoint
CREATE INDEX `trace_spans_parent_idx` ON `agent_trace_spans` (`parent_span_id`);
--> statement-breakpoint
CREATE INDEX `trace_spans_agent_run_idx` ON `agent_trace_spans` (`agent_run_id`);
--> statement-breakpoint
CREATE INDEX `trace_spans_wf_run_idx` ON `agent_trace_spans` (`workflow_run_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `agent_evaluation_datasets` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36),
	`name` varchar(120) NOT NULL,
	`description` text,
	`target_type` varchar(40) NOT NULL DEFAULT 'agent',
	`target_id` char(36),
	`version` varchar(30) NOT NULL DEFAULT '1.0.0',
	`status` varchar(20) NOT NULL DEFAULT 'active',
	`metadata` json NOT NULL DEFAULT ('{}'),
	`created_by` char(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_evaluation_datasets_id` PRIMARY KEY(`id`),
	CONSTRAINT `eval_ds_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE cascade,
	CONSTRAINT `eval_ds_ws_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE set null ON UPDATE cascade
);
--> statement-breakpoint
CREATE INDEX `eval_ds_org_target_idx` ON `agent_evaluation_datasets` (`organization_id`,`target_type`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `agent_evaluation_cases` (
	`id` char(36) NOT NULL,
	`dataset_id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`name` varchar(150) NOT NULL,
	`description` text,
	`input_prompt` text NOT NULL,
	`input_context` json NOT NULL DEFAULT ('{}'),
	`expected_output` text,
	`expected_output_schema` json,
	`expected_tools` json NOT NULL DEFAULT ('[]'),
	`required_citations` json NOT NULL DEFAULT ('[]'),
	`grading_criteria` json NOT NULL DEFAULT ('{}'),
	`order_index` int NOT NULL DEFAULT 0,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_evaluation_cases_id` PRIMARY KEY(`id`),
	CONSTRAINT `eval_cases_ds_fk` FOREIGN KEY (`dataset_id`) REFERENCES `agent_evaluation_datasets`(`id`) ON DELETE cascade ON UPDATE cascade,
	CONSTRAINT `eval_cases_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE cascade
);
--> statement-breakpoint
CREATE INDEX `eval_cases_ds_idx` ON `agent_evaluation_cases` (`dataset_id`,`order_index`);
--> statement-breakpoint
CREATE INDEX `eval_cases_org_idx` ON `agent_evaluation_cases` (`organization_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `agent_evaluation_runs` (
	`id` char(36) NOT NULL,
	`dataset_id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36),
	`target_type` varchar(40) NOT NULL DEFAULT 'agent',
	`target_id` char(36),
	`status` varchar(30) NOT NULL DEFAULT 'running',
	`total_cases` int NOT NULL DEFAULT 0,
	`passed_cases` int NOT NULL DEFAULT 0,
	`failed_cases` int NOT NULL DEFAULT 0,
	`overall_score` decimal(5,2) NOT NULL DEFAULT '0.00',
	`grounding_score` decimal(5,2) NOT NULL DEFAULT '0.00',
	`tool_accuracy_score` decimal(5,2) NOT NULL DEFAULT '0.00',
	`format_compliance_score` decimal(5,2) NOT NULL DEFAULT '0.00',
	`is_baseline` boolean NOT NULL DEFAULT false,
	`compared_to_run_id` char(36),
	`score_delta` decimal(5,2) DEFAULT '0.00',
	`summary_results` json NOT NULL DEFAULT ('[]'),
	`evaluated_by` char(36),
	`duration_ms` int NOT NULL DEFAULT 0,
	`started_at` timestamp(3),
	`completed_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_evaluation_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `eval_runs_ds_fk` FOREIGN KEY (`dataset_id`) REFERENCES `agent_evaluation_datasets`(`id`) ON DELETE cascade ON UPDATE cascade,
	CONSTRAINT `eval_runs_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE cascade,
	CONSTRAINT `eval_runs_ws_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE set null ON UPDATE cascade
);
--> statement-breakpoint
CREATE INDEX `eval_runs_org_ds_created_idx` ON `agent_evaluation_runs` (`organization_id`,`dataset_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `agent_slo_definitions` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36),
	`name` varchar(120) NOT NULL,
	`description` text,
	`metric_type` varchar(60) NOT NULL,
	`target_type` varchar(40) NOT NULL DEFAULT 'all',
	`target_id` char(36),
	`target_value` decimal(10,4) NOT NULL,
	`comparison_operator` varchar(10) NOT NULL DEFAULT 'gte',
	`window_duration_minutes` int NOT NULL DEFAULT 1440,
	`status` varchar(20) NOT NULL DEFAULT 'active',
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_slo_definitions_id` PRIMARY KEY(`id`),
	CONSTRAINT `slo_defs_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE cascade,
	CONSTRAINT `slo_defs_ws_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE set null ON UPDATE cascade
);
--> statement-breakpoint
CREATE INDEX `slo_defs_org_metric_idx` ON `agent_slo_definitions` (`organization_id`,`metric_type`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `agent_reliability_metrics` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36),
	`window_start` timestamp(3) NOT NULL,
	`window_end` timestamp(3) NOT NULL,
	`total_runs` int NOT NULL DEFAULT 0,
	`successful_runs` int NOT NULL DEFAULT 0,
	`failed_runs` int NOT NULL DEFAULT 0,
	`success_rate` decimal(5,2) NOT NULL DEFAULT '100.00',
	`p50_latency_ms` int NOT NULL DEFAULT 0,
	`p95_latency_ms` int NOT NULL DEFAULT 0,
	`p99_latency_ms` int NOT NULL DEFAULT 0,
	`active_worker_count` int NOT NULL DEFAULT 1,
	`queue_backlog` int NOT NULL DEFAULT 0,
	`stale_leases_reclaimed` int NOT NULL DEFAULT 0,
	`circuit_breaker_trips` int NOT NULL DEFAULT 0,
	`rate_limit_hits` int NOT NULL DEFAULT 0,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_reliability_metrics_id` PRIMARY KEY(`id`),
	CONSTRAINT `rel_metrics_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE cascade,
	CONSTRAINT `rel_metrics_ws_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE set null ON UPDATE cascade
);
--> statement-breakpoint
CREATE INDEX `rel_metrics_org_window_idx` ON `agent_reliability_metrics` (`organization_id`,`window_start`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `agent_alert_rules` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36),
	`name` varchar(120) NOT NULL,
	`description` text,
	`metric_name` varchar(60) NOT NULL,
	`condition_operator` varchar(10) NOT NULL DEFAULT 'gt',
	`threshold_value` decimal(10,4) NOT NULL,
	`evaluation_window_minutes` int NOT NULL DEFAULT 15,
	`severity` varchar(20) NOT NULL DEFAULT 'warning',
	`is_enabled` boolean NOT NULL DEFAULT true,
	`channels` json NOT NULL DEFAULT ('["in_app"]'),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_alert_rules_id` PRIMARY KEY(`id`),
	CONSTRAINT `alert_rules_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE cascade,
	CONSTRAINT `alert_rules_ws_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE set null ON UPDATE cascade
);
--> statement-breakpoint
CREATE INDEX `alert_rules_org_enabled_idx` ON `agent_alert_rules` (`organization_id`,`is_enabled`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `agent_incidents` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36),
	`alert_rule_id` char(36),
	`title` varchar(180) NOT NULL,
	`summary` text NOT NULL,
	`severity` varchar(20) NOT NULL DEFAULT 'warning',
	`status` varchar(20) NOT NULL DEFAULT 'open',
	`impacted_service` varchar(80) NOT NULL DEFAULT 'agent-runtime',
	`impacted_agent_id` char(36),
	`root_cause` text,
	`mitigation_steps` text,
	`acknowledged_by` char(36),
	`acknowledged_at` timestamp(3),
	`resolved_by` char(36),
	`resolved_at` timestamp(3),
	`occurrence_count` int NOT NULL DEFAULT 1,
	`metadata` json NOT NULL DEFAULT ('{}'),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_incidents_id` PRIMARY KEY(`id`),
	CONSTRAINT `incidents_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE cascade,
	CONSTRAINT `incidents_ws_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE set null ON UPDATE cascade,
	CONSTRAINT `incidents_rule_fk` FOREIGN KEY (`alert_rule_id`) REFERENCES `agent_alert_rules`(`id`) ON DELETE set null ON UPDATE cascade
);
--> statement-breakpoint
CREATE INDEX `incidents_org_status_idx` ON `agent_incidents` (`organization_id`,`status`);
--> statement-breakpoint
CREATE INDEX `incidents_org_created_idx` ON `agent_incidents` (`organization_id`,`created_at`);

