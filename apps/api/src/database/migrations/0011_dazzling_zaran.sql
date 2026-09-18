CREATE TABLE `knowledge_chunks` (
	`id` char(36) NOT NULL,
	`source_id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`ordinal` int NOT NULL,
	`content` text NOT NULL,
	CONSTRAINT `knowledge_chunks_id` PRIMARY KEY(`id`),
	CONSTRAINT `knowledge_chunks_source_ordinal_idx` UNIQUE(`source_id`,`ordinal`)
);
--> statement-breakpoint
CREATE TABLE `knowledge_sources` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`name` varchar(200) NOT NULL,
	`description` text NOT NULL,
	`type` enum('text','document','structured') NOT NULL,
	`visibility` enum('internal','private') NOT NULL,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`content` text NOT NULL,
	`content_hash` varchar(64) NOT NULL,
	`ingestion_status` enum('ready') NOT NULL DEFAULT 'ready',
	`created_by` char(36) NOT NULL,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `knowledge_sources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `knowledge_chunks` ADD CONSTRAINT `knowledge_chunks_source_id_knowledge_sources_id_fk` FOREIGN KEY (`source_id`) REFERENCES `knowledge_sources`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `knowledge_chunks` ADD CONSTRAINT `knowledge_chunks_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `knowledge_sources` ADD CONSTRAINT `knowledge_sources_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `knowledge_sources` ADD CONSTRAINT `knowledge_sources_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `knowledge_chunks_tenant_idx` ON `knowledge_chunks` (`organization_id`);--> statement-breakpoint
CREATE INDEX `knowledge_sources_tenant_idx` ON `knowledge_sources` (`organization_id`,`status`);