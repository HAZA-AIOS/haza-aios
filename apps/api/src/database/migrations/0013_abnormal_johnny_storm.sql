CREATE TABLE `audit_logs` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36),
	`actor_type` varchar(40) NOT NULL DEFAULT 'user',
	`actor_user_id` char(36),
	`action` varchar(160) NOT NULL,
	`resource_type` varchar(120) NOT NULL,
	`resource_id` varchar(160),
	`operation` varchar(40) NOT NULL,
	`audit_result` enum('success','failure','denied') NOT NULL DEFAULT 'success',
	`source` varchar(120) NOT NULL DEFAULT 'api',
	`request_id` varchar(128),
	`correlation_id` varchar(128),
	`ip_address` varchar(80),
	`user_agent` varchar(500),
	`before_snapshot` json,
	`after_snapshot` json,
	`changed_fields` json,
	`metadata` json NOT NULL DEFAULT ('{}'),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `domain_events` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36),
	`event_type` varchar(160) NOT NULL,
	`aggregate_type` varchar(120) NOT NULL,
	`aggregate_id` varchar(160) NOT NULL,
	`actor_user_id` char(36),
	`schema_version` int NOT NULL DEFAULT 1,
	`payload` json NOT NULL DEFAULT ('{}'),
	`metadata` json NOT NULL DEFAULT ('{}'),
	`correlation_id` varchar(128),
	`causation_id` char(36),
	`idempotency_key` varchar(160),
	`occurred_at` timestamp(3) NOT NULL DEFAULT (now()),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `domain_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `domain_events_org_idempotency_unique` UNIQUE(`organization_id`,`idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `operational_events` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36),
	`operational_event_severity` enum('info','warning','error','critical') NOT NULL DEFAULT 'info',
	`component` varchar(120) NOT NULL,
	`event_type` varchar(160) NOT NULL,
	`status` varchar(40) NOT NULL,
	`resource_type` varchar(120),
	`resource_id` varchar(160),
	`workflow_run_id` char(36),
	`agent_run_id` char(36),
	`correlation_id` varchar(128),
	`summary` varchar(500) NOT NULL,
	`safe_error_code` varchar(120),
	`safe_error_message` varchar(1000),
	`metadata` json NOT NULL DEFAULT ('{}'),
	`occurred_at` timestamp(3) NOT NULL DEFAULT (now()),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `operational_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `communication_deliveries` ADD `attempt_number` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `communication_deliveries` ADD `provider_reference` varchar(255);--> statement-breakpoint
ALTER TABLE `communication_deliveries` ADD `safe_error_code` varchar(120);--> statement-breakpoint
ALTER TABLE `communication_deliveries` ADD `safe_error_message` varchar(1000);--> statement-breakpoint
ALTER TABLE `communication_deliveries` ADD `attempted_at` datetime(3);--> statement-breakpoint
ALTER TABLE `communication_deliveries` ADD `completed_at` datetime(3);--> statement-breakpoint
ALTER TABLE `sis_notifications` ADD `source_event_id` char(36);--> statement-breakpoint
ALTER TABLE `sis_notifications` ADD `read_at` datetime(3);--> statement-breakpoint
ALTER TABLE `sis_notifications` ADD `acknowledged_at` datetime(3);--> statement-breakpoint
ALTER TABLE `sis_notifications` ADD `dismissed_at` datetime(3);--> statement-breakpoint
ALTER TABLE `sis_notifications` ADD `expires_at` datetime(3);--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actor_user_id_users_id_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `domain_events` ADD CONSTRAINT `domain_events_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `domain_events` ADD CONSTRAINT `domain_events_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `domain_events` ADD CONSTRAINT `domain_events_actor_user_id_users_id_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `operational_events` ADD CONSTRAINT `operational_events_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `operational_events` ADD CONSTRAINT `operational_events_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `operational_events` ADD CONSTRAINT `operational_events_workflow_run_id_workflow_runs_id_fk` FOREIGN KEY (`workflow_run_id`) REFERENCES `workflow_runs`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `operational_events` ADD CONSTRAINT `operational_events_agent_run_id_ai_agent_runs_id_fk` FOREIGN KEY (`agent_run_id`) REFERENCES `ai_agent_runs`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX `audit_logs_org_created_idx` ON `audit_logs` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_logs_workspace_created_idx` ON `audit_logs` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_logs_actor_created_idx` ON `audit_logs` (`actor_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_logs_resource_created_idx` ON `audit_logs` (`organization_id`,`resource_type`,`resource_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_logs_action_result_idx` ON `audit_logs` (`organization_id`,`action`,`audit_result`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_logs_correlation_idx` ON `audit_logs` (`correlation_id`);--> statement-breakpoint
CREATE INDEX `domain_events_org_type_occurred_idx` ON `domain_events` (`organization_id`,`event_type`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `domain_events_workspace_occurred_idx` ON `domain_events` (`workspace_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `domain_events_aggregate_idx` ON `domain_events` (`organization_id`,`aggregate_type`,`aggregate_id`);--> statement-breakpoint
CREATE INDEX `domain_events_correlation_idx` ON `domain_events` (`correlation_id`);--> statement-breakpoint
CREATE INDEX `operational_events_org_severity_idx` ON `operational_events` (`organization_id`,`operational_event_severity`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `operational_events_workspace_status_idx` ON `operational_events` (`workspace_id`,`status`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `operational_events_component_type_idx` ON `operational_events` (`organization_id`,`component`,`event_type`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `operational_events_resource_idx` ON `operational_events` (`organization_id`,`resource_type`,`resource_id`);--> statement-breakpoint
CREATE INDEX `operational_events_workflow_run_idx` ON `operational_events` (`workflow_run_id`);--> statement-breakpoint
CREATE INDEX `operational_events_agent_run_idx` ON `operational_events` (`agent_run_id`);--> statement-breakpoint
CREATE INDEX `operational_events_correlation_idx` ON `operational_events` (`correlation_id`);--> statement-breakpoint
ALTER TABLE `sis_notifications` ADD CONSTRAINT `sis_notifications_source_event_id_domain_events_id_fk` FOREIGN KEY (`source_event_id`) REFERENCES `domain_events`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX `communication_deliveries_notification_attempt_idx` ON `communication_deliveries` (`notification_id`,`channel`,`attempt_number`);--> statement-breakpoint
CREATE INDEX `sis_notifications_user_unread_idx` ON `sis_notifications` (`workspace_id`,`recipient_user_id`,`is_read`,`created_at`);--> statement-breakpoint
CREATE INDEX `sis_notifications_source_event_idx` ON `sis_notifications` (`source_event_id`);
--> statement-breakpoint
INSERT IGNORE INTO `permissions` (`id`, `permission_key`, `description`)
VALUES
(UUID(), 'audit.read', 'Read organization audit records.'),
(UUID(), 'event.read', 'Read organization domain and operational events.'),
(UUID(), 'notification.read', 'Read and manage personal notifications.'),
(UUID(), 'notification.manage', 'Manage organization notification operations.');
--> statement-breakpoint
INSERT IGNORE INTO `role_permissions` (`id`, `role_id`, `permission_id`)
SELECT UUID(), `roles`.`id`, `permissions`.`id`
FROM `roles`
JOIN `permissions` ON `permissions`.`permission_key` IN ('audit.read', 'event.read', 'notification.read', 'notification.manage')
WHERE `roles`.`role_scope` = 'organization'
  AND `roles`.`name` IN ('Owner', 'Admin');
--> statement-breakpoint
INSERT IGNORE INTO `role_permissions` (`id`, `role_id`, `permission_id`)
SELECT UUID(), `roles`.`id`, `permissions`.`id`
FROM `roles`
JOIN `permissions` ON `permissions`.`permission_key` = 'notification.read'
WHERE `roles`.`role_scope` = 'organization'
  AND `roles`.`name` = 'Member';
