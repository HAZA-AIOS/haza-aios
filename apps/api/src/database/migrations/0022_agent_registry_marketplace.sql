ALTER TABLE `ai_agent_templates` ADD `publisher_type` varchar(40) NOT NULL DEFAULT 'platform';--> statement-breakpoint
ALTER TABLE `ai_agent_templates` ADD `publisher_organization_id` char(36) NULL;--> statement-breakpoint
ALTER TABLE `ai_agent_templates` ADD `publisher_user_id` char(36) NULL;--> statement-breakpoint
ALTER TABLE `ai_agent_templates` ADD `visibility` varchar(40) NOT NULL DEFAULT 'platform';--> statement-breakpoint
ALTER TABLE `ai_agent_templates` ADD `publishing_status` varchar(40) NOT NULL DEFAULT 'published';--> statement-breakpoint
ALTER TABLE `ai_agent_templates` ADD `summary` varchar(300) NULL;--> statement-breakpoint
ALTER TABLE `ai_agent_templates` ADD `latest_version` varchar(80) NOT NULL DEFAULT '1.0.0';--> statement-breakpoint
ALTER TABLE `ai_agent_templates` ADD `min_platform_version` varchar(40) NULL;--> statement-breakpoint
ALTER TABLE `ai_agent_templates` ADD `review_notes` text NULL;--> statement-breakpoint
ALTER TABLE `ai_agent_templates` ADD `reviewed_by` char(36) NULL;--> statement-breakpoint
ALTER TABLE `ai_agent_templates` ADD `reviewed_at` timestamp(3) NULL;--> statement-breakpoint
ALTER TABLE `ai_agent_templates` ADD `published_at` timestamp(3) NULL;--> statement-breakpoint
ALTER TABLE `ai_agent_templates` ADD CONSTRAINT `ai_agent_templates_publisher_org_fk` FOREIGN KEY (`publisher_organization_id`) REFERENCES `organizations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `ai_agent_templates` ADD CONSTRAINT `ai_agent_templates_publisher_user_fk` FOREIGN KEY (`publisher_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `ai_agent_templates` ADD CONSTRAINT `ai_agent_templates_reviewed_by_fk` FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
CREATE INDEX `ai_agent_templates_publishing_status_idx` ON `ai_agent_templates` (`publishing_status`);--> statement-breakpoint
CREATE INDEX `ai_agent_templates_visibility_idx` ON `ai_agent_templates` (`visibility`);--> statement-breakpoint
CREATE INDEX `ai_agent_templates_publisher_org_idx` ON `ai_agent_templates` (`publisher_organization_id`);--> statement-breakpoint

CREATE TABLE `ai_agent_template_versions` (
	`id` char(36) NOT NULL,
	`template_id` char(36) NOT NULL,
	`version` varchar(80) NOT NULL,
	`name` varchar(180) NOT NULL,
	`description` varchar(1000) NOT NULL,
	`instructions` text NULL,
	`configuration_schema` json NOT NULL,
	`input_schema` json NOT NULL,
	`output_schema` json NOT NULL,
	`capabilities` json NOT NULL,
	`required_permissions` json NOT NULL,
	`default_approval_policy` json NULL,
	`changelog` text NULL,
	`status` varchar(40) NOT NULL DEFAULT 'published',
	`review_notes` text NULL,
	`reviewed_by` char(36) NULL,
	`reviewed_at` timestamp(3) NULL,
	`published_at` timestamp(3) NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now(3)),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now(3)) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `ai_agent_template_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_agent_template_versions_template_version_unique` UNIQUE(`template_id`,`version`)
);--> statement-breakpoint
ALTER TABLE `ai_agent_template_versions` ADD CONSTRAINT `ai_agent_template_versions_template_id_fk` FOREIGN KEY (`template_id`) REFERENCES `ai_agent_templates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `ai_agent_template_versions` ADD CONSTRAINT `ai_agent_template_versions_reviewed_by_fk` FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
CREATE INDEX `ai_agent_template_versions_template_idx` ON `ai_agent_template_versions` (`template_id`);--> statement-breakpoint
CREATE INDEX `ai_agent_template_versions_status_idx` ON `ai_agent_template_versions` (`status`);--> statement-breakpoint

ALTER TABLE `ai_agent_definitions` ADD `installed_version` varchar(80) NOT NULL DEFAULT '1.0.0';--> statement-breakpoint
ALTER TABLE `ai_agent_definitions` ADD `template_version_id` char(36) NULL;--> statement-breakpoint
ALTER TABLE `ai_agent_definitions` ADD `installed_from_marketplace` boolean NOT NULL DEFAULT true;--> statement-breakpoint
ALTER TABLE `ai_agent_definitions` ADD CONSTRAINT `ai_agent_definitions_template_version_id_fk` FOREIGN KEY (`template_version_id`) REFERENCES `ai_agent_template_versions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint

CREATE TABLE `ai_agent_installations` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`template_id` char(36) NOT NULL,
	`template_version_id` char(36) NULL,
	`installed_version` varchar(80) NOT NULL,
	`agent_definition_id` char(36) NOT NULL,
	`installed_by` char(36) NOT NULL,
	`status` varchar(40) NOT NULL DEFAULT 'active',
	`installed_at` timestamp(3) NOT NULL DEFAULT (now(3)),
	`uninstalled_at` timestamp(3) NULL,
	`uninstalled_by` char(36) NULL,
	`metadata` json NULL,
	CONSTRAINT `ai_agent_installations_id` PRIMARY KEY(`id`)
);--> statement-breakpoint
ALTER TABLE `ai_agent_installations` ADD CONSTRAINT `ai_agent_installations_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `ai_agent_installations` ADD CONSTRAINT `ai_agent_installations_workspace_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `ai_agent_installations` ADD CONSTRAINT `ai_agent_installations_template_id_fk` FOREIGN KEY (`template_id`) REFERENCES `ai_agent_templates`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `ai_agent_installations` ADD CONSTRAINT `ai_agent_installations_template_version_id_fk` FOREIGN KEY (`template_version_id`) REFERENCES `ai_agent_template_versions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `ai_agent_installations` ADD CONSTRAINT `ai_agent_installations_agent_definition_id_fk` FOREIGN KEY (`agent_definition_id`) REFERENCES `ai_agent_definitions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `ai_agent_installations` ADD CONSTRAINT `ai_agent_installations_installed_by_fk` FOREIGN KEY (`installed_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `ai_agent_installations` ADD CONSTRAINT `ai_agent_installations_uninstalled_by_fk` FOREIGN KEY (`uninstalled_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
CREATE INDEX `ai_agent_installations_org_status_idx` ON `ai_agent_installations` (`organization_id`, `status`);--> statement-breakpoint
CREATE INDEX `ai_agent_installations_workspace_idx` ON `ai_agent_installations` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `ai_agent_installations_template_idx` ON `ai_agent_installations` (`template_id`);--> statement-breakpoint
CREATE INDEX `ai_agent_installations_agent_idx` ON `ai_agent_installations` (`agent_definition_id`);
