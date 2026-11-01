CREATE TABLE `knowledge_collections` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`name` varchar(200) NOT NULL,
	`slug` varchar(200) NOT NULL,
	`description` text,
	`industry` varchar(60) NOT NULL DEFAULT 'education',
	`visibility` varchar(20) NOT NULL DEFAULT 'workspace',
	`access_policy` json,
	`status` varchar(20) NOT NULL DEFAULT 'active',
	`created_by` char(36) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `knowledge_collections_id` PRIMARY KEY(`id`),
	CONSTRAINT `knowledge_collections_org_slug_idx` UNIQUE(`organization_id`,`slug`)
);
--> statement-breakpoint
ALTER TABLE `knowledge_collections` ADD CONSTRAINT `knowledge_collections_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE `knowledge_collections` ADD CONSTRAINT `knowledge_collections_ws_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE `knowledge_collections` ADD CONSTRAINT `knowledge_collections_user_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
CREATE INDEX `knowledge_collections_org_ws_status_idx` ON `knowledge_collections` (`organization_id`,`workspace_id`,`status`);
--> statement-breakpoint
ALTER TABLE `knowledge_sources` ADD `workspace_id` char(36);
--> statement-breakpoint
ALTER TABLE `knowledge_sources` ADD `collection_id` char(36);
--> statement-breakpoint
ALTER TABLE `knowledge_sources` ADD `file_name` varchar(255);
--> statement-breakpoint
ALTER TABLE `knowledge_sources` ADD `file_type` varchar(50);
--> statement-breakpoint
ALTER TABLE `knowledge_sources` ADD `file_size_bytes` bigint;
--> statement-breakpoint
ALTER TABLE `knowledge_sources` ADD `mime_type` varchar(120);
--> statement-breakpoint
ALTER TABLE `knowledge_sources` ADD `storage_uri` varchar(500);
--> statement-breakpoint
ALTER TABLE `knowledge_sources` ADD `storage_backend` varchar(40) NOT NULL DEFAULT 'database_durable';
--> statement-breakpoint
ALTER TABLE `knowledge_sources` ADD `current_version` int NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `knowledge_sources` ADD `metadata` json;
--> statement-breakpoint
ALTER TABLE `knowledge_sources` MODIFY COLUMN `ingestion_status` varchar(40) NOT NULL DEFAULT 'ready';
--> statement-breakpoint
ALTER TABLE `knowledge_sources` ADD CONSTRAINT `knowledge_sources_collection_fk` FOREIGN KEY (`collection_id`) REFERENCES `knowledge_collections`(`id`) ON DELETE SET NULL ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE `knowledge_sources` ADD CONSTRAINT `knowledge_sources_ws_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE SET NULL ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE `knowledge_chunks` ADD `workspace_id` char(36);
--> statement-breakpoint
ALTER TABLE `knowledge_chunks` ADD `section_heading` varchar(255);
--> statement-breakpoint
ALTER TABLE `knowledge_chunks` ADD `page_number` int;
--> statement-breakpoint
ALTER TABLE `knowledge_chunks` ADD `token_count` int NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `knowledge_chunks` ADD `content_hash` varchar(64);
--> statement-breakpoint
CREATE TABLE `ai_agent_knowledge_documents` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`source_id` char(36) NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`content_type` varchar(120) NOT NULL,
	`raw_content` longtext,
	`content_hash` varchar(64) NOT NULL,
	`checksum` varchar(128) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `ai_agent_knowledge_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `ai_agent_knowledge_documents` ADD CONSTRAINT `ai_agent_knowledge_docs_source_fk` FOREIGN KEY (`source_id`) REFERENCES `knowledge_sources`(`id`) ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
CREATE INDEX `ai_agent_knowledge_docs_source_ver_idx` ON `ai_agent_knowledge_documents` (`source_id`,`version`);
--> statement-breakpoint
CREATE INDEX `ai_agent_knowledge_docs_org_ws_idx` ON `ai_agent_knowledge_documents` (`organization_id`,`workspace_id`);
--> statement-breakpoint
CREATE TABLE `ai_agent_knowledge_embeddings` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`source_id` char(36) NOT NULL,
	`chunk_id` char(36) NOT NULL,
	`provider` varchar(60) NOT NULL DEFAULT 'mock',
	`model` varchar(120) NOT NULL DEFAULT 'mock-text-embedding',
	`dimensions` int NOT NULL DEFAULT 1536,
	`embedding` json NOT NULL,
	`content_hash` varchar(64) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `ai_agent_knowledge_embeddings_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_agent_knowledge_embeddings_chunk_unique` UNIQUE(`chunk_id`)
);
--> statement-breakpoint
ALTER TABLE `ai_agent_knowledge_embeddings` ADD CONSTRAINT `ai_agent_knowledge_emb_chunk_fk` FOREIGN KEY (`chunk_id`) REFERENCES `knowledge_chunks`(`id`) ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE `ai_agent_knowledge_embeddings` ADD CONSTRAINT `ai_agent_knowledge_emb_source_fk` FOREIGN KEY (`source_id`) REFERENCES `knowledge_sources`(`id`) ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
CREATE INDEX `ai_agent_knowledge_emb_source_idx` ON `ai_agent_knowledge_embeddings` (`source_id`);
--> statement-breakpoint
CREATE INDEX `ai_agent_knowledge_emb_org_ws_idx` ON `ai_agent_knowledge_embeddings` (`organization_id`,`workspace_id`);
--> statement-breakpoint
CREATE TABLE `ai_agent_knowledge_retrievals` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`agent_id` char(36),
	`run_id` char(36),
	`query` varchar(1000) NOT NULL,
	`retrieval_mode` varchar(40) NOT NULL DEFAULT 'hybrid',
	`matched_chunk_ids` json NOT NULL,
	`scores` json NOT NULL,
	`latency_ms` int NOT NULL DEFAULT 0,
	`requested_by` char(36) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `ai_agent_knowledge_retrievals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `ai_agent_knowledge_retrievals` ADD CONSTRAINT `ai_agent_knowledge_ret_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE `ai_agent_knowledge_retrievals` ADD CONSTRAINT `ai_agent_knowledge_ret_user_fk` FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
CREATE INDEX `ai_agent_knowledge_ret_org_created_idx` ON `ai_agent_knowledge_retrievals` (`organization_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `ai_agent_knowledge_ret_run_idx` ON `ai_agent_knowledge_retrievals` (`run_id`);

