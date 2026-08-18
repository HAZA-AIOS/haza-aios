CREATE TABLE `auth_sessions` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`token_hash` char(64) NOT NULL,
	`auth_session_status` enum('active','revoked','expired') NOT NULL DEFAULT 'active',
	`remember_me` boolean NOT NULL DEFAULT false,
	`expires_at` datetime(3) NOT NULL,
	`revoked_at` datetime(3),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `auth_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `auth_sessions_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `membership_roles` (
	`id` char(36) NOT NULL,
	`membership_id` char(36) NOT NULL,
	`role_id` char(36) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `membership_roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `membership_roles_membership_role_unique` UNIQUE(`membership_id`,`role_id`)
);
--> statement-breakpoint
CREATE TABLE `permissions` (
	`id` char(36) NOT NULL,
	`permission_key` varchar(120) NOT NULL,
	`description` varchar(500) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `permissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `permissions_key_unique` UNIQUE(`permission_key`)
);
--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`id` char(36) NOT NULL,
	`role_id` char(36) NOT NULL,
	`permission_id` char(36) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `role_permissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `role_permissions_role_permission_unique` UNIQUE(`role_id`,`permission_id`)
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` char(36) NOT NULL,
	`organization_id` char(36),
	`name` varchar(120) NOT NULL,
	`role_scope` enum('platform','organization') NOT NULL DEFAULT 'organization',
	`system_key` varchar(120),
	`description` varchar(500) NOT NULL,
	`is_system` boolean NOT NULL DEFAULT false,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `roles_org_name_unique` UNIQUE(`organization_id`,`name`),
	CONSTRAINT `roles_system_key_unique` UNIQUE(`system_key`)
);
--> statement-breakpoint
CREATE TABLE `security_events` (
	`id` char(36) NOT NULL,
	`user_id` char(36),
	`organization_id` char(36),
	`event_type` varchar(120) NOT NULL,
	`security_event_severity` enum('info','warning','critical') NOT NULL DEFAULT 'info',
	`ip_address` varchar(80),
	`user_agent` text,
	`metadata` json,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `security_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` char(36) NOT NULL,
	`email` varchar(255) NOT NULL,
	`normalized_email` varchar(255) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`first_name` varchar(120) NOT NULL,
	`last_name` varchar(120) NOT NULL,
	`display_name` varchar(240) NOT NULL,
	`email_verified` boolean NOT NULL DEFAULT false,
	`user_status` enum('active','inactive','suspended','pending','archived') NOT NULL DEFAULT 'active',
	`last_login_at` datetime(3),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_normalized_email_unique` UNIQUE(`normalized_email`)
);
--> statement-breakpoint
CREATE TABLE `workspace_memberships` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`organization_membership_id` char(36) NOT NULL,
	`organization_membership_status` enum('active','pending','suspended') NOT NULL DEFAULT 'active',
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workspace_memberships_id` PRIMARY KEY(`id`),
	CONSTRAINT `workspace_memberships_workspace_membership_unique` UNIQUE(`workspace_id`,`organization_membership_id`)
);
--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD CONSTRAINT `auth_sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `membership_roles` ADD CONSTRAINT `membership_roles_membership_id_organization_memberships_id_fk` FOREIGN KEY (`membership_id`) REFERENCES `organization_memberships`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `membership_roles` ADD CONSTRAINT `membership_roles_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_permission_id_permissions_id_fk` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `roles` ADD CONSTRAINT `roles_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `workspace_memberships` ADD CONSTRAINT `workspace_memberships_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `workspace_memberships` ADD CONSTRAINT `workspace_memberships_org_membership_fk` FOREIGN KEY (`organization_membership_id`) REFERENCES `organization_memberships`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX `auth_sessions_user_status_idx` ON `auth_sessions` (`user_id`,`auth_session_status`);--> statement-breakpoint
CREATE INDEX `roles_scope_idx` ON `roles` (`role_scope`);--> statement-breakpoint
CREATE INDEX `security_events_user_idx` ON `security_events` (`user_id`);--> statement-breakpoint
CREATE INDEX `security_events_org_idx` ON `security_events` (`organization_id`);--> statement-breakpoint
CREATE INDEX `security_events_type_idx` ON `security_events` (`event_type`);--> statement-breakpoint
CREATE INDEX `users_status_idx` ON `users` (`user_status`);
