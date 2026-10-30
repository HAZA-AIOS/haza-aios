CREATE TABLE `academic_lesson_plans` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`agent_run_id` char(36) NULL,
	`title` varchar(255) NOT NULL,
	`grade` varchar(50) NOT NULL,
	`subject` varchar(100) NOT NULL,
	`topic` varchar(255) NOT NULL,
	`duration_minutes` int NOT NULL,
	`learning_objectives` json NOT NULL,
	`content` json NOT NULL,
	`status` enum('draft','reviewed','approved','published','archived') NOT NULL DEFAULT 'draft',
	`curriculum_reference` varchar(255) NULL,
	`curriculum_verified` boolean NOT NULL DEFAULT false,
	`created_by` char(36) NOT NULL,
	`approved_by` char(36) NULL,
	`approved_at` timestamp(3) NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now(3)),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now(3)) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `academic_lesson_plans_id` PRIMARY KEY(`id`)
);--> statement-breakpoint

ALTER TABLE `academic_lesson_plans` ADD CONSTRAINT `academic_lesson_plans_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `academic_lesson_plans` ADD CONSTRAINT `academic_lesson_plans_workspace_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `academic_lesson_plans` ADD CONSTRAINT `academic_lesson_plans_run_fk` FOREIGN KEY (`agent_run_id`) REFERENCES `ai_agent_runs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `academic_lesson_plans` ADD CONSTRAINT `academic_lesson_plans_creator_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `academic_lesson_plans` ADD CONSTRAINT `academic_lesson_plans_approver_fk` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint

CREATE INDEX `academic_lesson_plans_org_ws_idx` ON `academic_lesson_plans` (`organization_id`, `workspace_id`);--> statement-breakpoint
CREATE INDEX `academic_lesson_plans_org_status_idx` ON `academic_lesson_plans` (`organization_id`, `status`);--> statement-breakpoint
CREATE INDEX `academic_lesson_plans_creator_idx` ON `academic_lesson_plans` (`created_by`);--> statement-breakpoint
CREATE INDEX `academic_lesson_plans_run_idx` ON `academic_lesson_plans` (`agent_run_id`);
