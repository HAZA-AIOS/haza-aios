ALTER TABLE `portal_update_requests` ADD `reference_number` varchar(80);--> statement-breakpoint
ALTER TABLE `portal_update_requests` ADD `application_number` varchar(80);--> statement-breakpoint
CREATE UNIQUE INDEX `portal_requests_workspace_ref_num_unique` ON `portal_update_requests` (`workspace_id`,`reference_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `portal_requests_workspace_app_num_unique` ON `portal_update_requests` (`workspace_id`,`application_number`);
