CREATE TABLE `organization_memberships` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`user_id` varchar(120) NOT NULL,
	`organization_membership_role` enum('Owner','Admin','Member') NOT NULL DEFAULT 'Owner',
	`organization_membership_status` enum('active','pending','suspended') NOT NULL DEFAULT 'active',
	`joined_at` timestamp(3) NOT NULL DEFAULT (now()),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organization_memberships_id` PRIMARY KEY(`id`),
	CONSTRAINT `organization_memberships_org_user_unique` UNIQUE(`organization_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `organization_modules` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`module_key` varchar(120) NOT NULL,
	`organization_module_status` enum('activated','deactivated') NOT NULL DEFAULT 'activated',
	`enabled` boolean NOT NULL DEFAULT true,
	`settings` json,
	`activated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`activated_by` varchar(120),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organization_modules_id` PRIMARY KEY(`id`),
	CONSTRAINT `organization_modules_org_key_unique` UNIQUE(`organization_id`,`module_key`)
);
--> statement-breakpoint
CREATE TABLE `organization_settings` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`timezone` varchar(80) NOT NULL DEFAULT 'UTC',
	`locale` varchar(20) NOT NULL DEFAULT 'en',
	`currency` char(3) NOT NULL DEFAULT 'USD',
	`preferences` json NOT NULL DEFAULT ('{}'),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organization_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `organization_settings_org_unique` UNIQUE(`organization_id`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` char(36) NOT NULL,
	`name` varchar(180) NOT NULL,
	`legal_name` varchar(220) NOT NULL,
	`slug` varchar(120) NOT NULL,
	`description` varchar(1000),
	`industry` varchar(80) NOT NULL,
	`organization_type` varchar(80) NOT NULL,
	`website` varchar(255),
	`email` varchar(255) NOT NULL,
	`phone` varchar(80),
	`country` varchar(120) NOT NULL,
	`timezone` varchar(80) NOT NULL DEFAULT 'UTC',
	`currency` char(3) NOT NULL DEFAULT 'USD',
	`organization_status` enum('active','suspended','archived') NOT NULL DEFAULT 'active',
	`owner_id` varchar(120) NOT NULL,
	`archived_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`),
	CONSTRAINT `organizations_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`name` varchar(180) NOT NULL,
	`code` varchar(80) NOT NULL,
	`workspace_type` enum('primary','general','industry') NOT NULL DEFAULT 'primary',
	`workspace_status` enum('active','archived') NOT NULL DEFAULT 'active',
	`archived_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workspaces_id` PRIMARY KEY(`id`),
	CONSTRAINT `workspaces_org_code_unique` UNIQUE(`organization_id`,`code`)
);
--> statement-breakpoint
ALTER TABLE `organization_memberships` ADD CONSTRAINT `organization_memberships_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `organization_modules` ADD CONSTRAINT `organization_modules_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `organization_settings` ADD CONSTRAINT `organization_settings_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `workspaces` ADD CONSTRAINT `workspaces_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX `organization_memberships_user_status_idx` ON `organization_memberships` (`user_id`,`organization_membership_status`);--> statement-breakpoint
CREATE INDEX `organization_modules_org_status_idx` ON `organization_modules` (`organization_id`,`organization_module_status`);--> statement-breakpoint
CREATE INDEX `organizations_status_idx` ON `organizations` (`organization_status`);--> statement-breakpoint
CREATE INDEX `workspaces_org_status_idx` ON `workspaces` (`organization_id`,`workspace_status`);