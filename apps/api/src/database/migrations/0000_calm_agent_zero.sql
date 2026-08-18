CREATE TABLE `internal_database_checks` (
	`id` char(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `internal_database_checks_id` PRIMARY KEY(`id`)
);
