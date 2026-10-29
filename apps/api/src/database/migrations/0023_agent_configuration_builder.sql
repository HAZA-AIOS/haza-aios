ALTER TABLE `ai_agent_definitions` ADD `active_revision_number` int NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `ai_agent_definitions` ADD `active_revision_id` char(36) NULL;--> statement-breakpoint

CREATE TABLE `ai_agent_configuration_revisions` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`agent_id` char(36) NOT NULL,
	`revision_number` int NOT NULL,
	`version` varchar(80) NOT NULL DEFAULT '1.0.0',
	`status` varchar(40) NOT NULL DEFAULT 'draft',
	`configuration` json NOT NULL,
	`validation_status` varchar(40) NOT NULL DEFAULT 'valid',
	`validation_errors` json NULL,
	`changelog` text NULL,
	`created_by` char(36) NOT NULL,
	`published_by` char(36) NULL,
	`published_at` timestamp(3) NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now(3)),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now(3)) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `ai_agent_configuration_revisions_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_agent_config_revisions_agent_revision_unique` UNIQUE(`agent_id`,`revision_number`)
);--> statement-breakpoint

ALTER TABLE `ai_agent_configuration_revisions` ADD CONSTRAINT `ai_agent_config_revisions_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `ai_agent_configuration_revisions` ADD CONSTRAINT `ai_agent_config_revisions_workspace_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `ai_agent_configuration_revisions` ADD CONSTRAINT `ai_agent_config_revisions_agent_fk` FOREIGN KEY (`agent_id`) REFERENCES `ai_agent_definitions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `ai_agent_configuration_revisions` ADD CONSTRAINT `ai_agent_config_revisions_creator_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `ai_agent_configuration_revisions` ADD CONSTRAINT `ai_agent_config_revisions_publisher_fk` FOREIGN KEY (`published_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `ai_agent_definitions` ADD CONSTRAINT `ai_agent_definitions_active_revision_fk` FOREIGN KEY (`active_revision_id`) REFERENCES `ai_agent_configuration_revisions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint

CREATE INDEX `ai_agent_config_revisions_org_agent_status_idx` ON `ai_agent_configuration_revisions` (`organization_id`, `agent_id`, `status`);--> statement-breakpoint
CREATE INDEX `ai_agent_config_revisions_agent_idx` ON `ai_agent_configuration_revisions` (`agent_id`);--> statement-breakpoint

INSERT INTO `ai_agent_configuration_revisions` (
  `id`,
  `organization_id`,
  `workspace_id`,
  `agent_id`,
  `revision_number`,
  `version`,
  `status`,
  `configuration`,
  `validation_status`,
  `validation_errors`,
  `changelog`,
  `created_by`,
  `published_by`,
  `published_at`,
  `created_at`,
  `updated_at`
)
SELECT 
  UUID(),
  d.organization_id,
  d.workspace_id,
  d.id,
  1,
  COALESCE(d.installed_version, '1.0.0'),
  'published',
  JSON_OBJECT(
    'identity', JSON_OBJECT('name', d.name, 'description', d.description, 'agentKey', d.agent_key),
    'model', JSON_OBJECT('provider', d.model_provider, 'modelSelection', d.model_selection, 'temperature', 0.7, 'maxTokens', 2048, 'timeoutSeconds', 60),
    'instructions', JSON_OBJECT('systemInstructions', COALESCE(d.instructions, ''), 'objectives', '', 'constraints', '', 'tone', 'Professional'),
    'capabilities', JSON_ARRAY(),
    'tools', JSON_ARRAY(),
    'knowledge', COALESCE(JSON_EXTRACT(d.configuration, '$.knowledge'), JSON_ARRAY()),
    'humanApproval', COALESCE(d.human_approval_policy, JSON_OBJECT('required', false, 'approverRoles', JSON_ARRAY('admin', 'owner')))
  ),
  'valid',
  NULL,
  'Initial baseline configuration snapshot',
  d.created_by,
  d.created_by,
  d.created_at,
  d.created_at,
  d.updated_at
FROM `ai_agent_definitions` d
WHERE NOT EXISTS (
  SELECT 1 FROM `ai_agent_configuration_revisions` r WHERE r.agent_id = d.id
);--> statement-breakpoint

UPDATE `ai_agent_definitions` d
JOIN `ai_agent_configuration_revisions` r ON r.agent_id = d.id AND r.revision_number = 1
SET d.active_revision_id = r.id
WHERE d.active_revision_id IS NULL;
