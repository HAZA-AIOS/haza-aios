ALTER TABLE `ai_agent_templates` MODIFY COLUMN `agent_lifecycle_status` enum('draft','available','configured','active','paused','disabled','archived','suspended') NOT NULL DEFAULT 'available';--> statement-breakpoint
ALTER TABLE `ai_agent_definitions` MODIFY COLUMN `agent_lifecycle_status` enum('draft','available','configured','active','paused','disabled','archived','suspended') NOT NULL DEFAULT 'active';--> statement-breakpoint
ALTER TABLE `ai_agent_templates` ADD `default_approval_policy` json;--> statement-breakpoint
ALTER TABLE `ai_agent_definitions` ADD `human_approval_policy` json;
