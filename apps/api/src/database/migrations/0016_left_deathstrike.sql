CREATE TABLE `tenant_domains` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`domain` varchar(255) NOT NULL,
	`tenant_domain_status` enum('pending_verification','verified','failed') NOT NULL DEFAULT 'pending_verification',
	`verified_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenant_domains_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenant_domains_domain_unique` UNIQUE(`domain`)
);
--> statement-breakpoint
ALTER TABLE `tenant_domains` ADD CONSTRAINT `tenant_domains_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX `tenant_domains_org_idx` ON `tenant_domains` (`organization_id`);