CREATE TABLE `finance_fee_categories` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`code` varchar(80) NOT NULL,
	`name` varchar(160) NOT NULL,
	`status` varchar(40) NOT NULL DEFAULT 'active',
	`display_order` int NOT NULL DEFAULT 0,
	`payload` json NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `finance_fee_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `finance_fee_categories_workspace_code_unique` UNIQUE(`workspace_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `finance_fee_structures` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`academic_year_id` char(36) NOT NULL,
	`grade_id` char(36) NOT NULL,
	`fee_category_id` char(36) NOT NULL,
	`name` varchar(180) NOT NULL,
	`amount_cents` int NOT NULL,
	`status` varchar(40) NOT NULL DEFAULT 'active',
	`payload` json NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `finance_fee_structures_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `finance_student_fee_assignments` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`student_id` char(36) NOT NULL,
	`enrollment_id` char(36) NOT NULL,
	`fee_structure_id` char(36) NOT NULL,
	`status` varchar(40) NOT NULL DEFAULT 'active',
	`amount_cents` int NOT NULL,
	`payload` json NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `finance_student_fee_assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `finance_assignments_student_structure_unique` UNIQUE(`workspace_id`,`student_id`,`enrollment_id`,`fee_structure_id`)
);
--> statement-breakpoint
CREATE TABLE `finance_discounts` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`student_id` char(36),
	`fee_category_id` char(36),
	`name` varchar(180) NOT NULL,
	`discount_type` varchar(40) NOT NULL,
	`status` varchar(40) NOT NULL DEFAULT 'active',
	`payload` json NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `finance_discounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `finance_invoices` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`student_id` char(36) NOT NULL,
	`enrollment_id` char(36) NOT NULL,
	`academic_year_id` char(36) NOT NULL,
	`invoice_number` varchar(80) NOT NULL,
	`issue_date` varchar(20) NOT NULL,
	`due_date` varchar(20) NOT NULL,
	`status` varchar(40) NOT NULL DEFAULT 'draft',
	`total_cents` int NOT NULL DEFAULT 0,
	`paid_amount_cents` int NOT NULL DEFAULT 0,
	`balance_cents` int NOT NULL DEFAULT 0,
	`payload` json NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `finance_invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `finance_invoices_workspace_number_unique` UNIQUE(`workspace_id`,`invoice_number`)
);
--> statement-breakpoint
CREATE TABLE `finance_payments` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`invoice_id` char(36) NOT NULL,
	`student_id` char(36) NOT NULL,
	`amount_cents` int NOT NULL,
	`payment_date` varchar(20) NOT NULL,
	`payment_method` varchar(40) NOT NULL,
	`reference_number` varchar(120),
	`status` varchar(40) NOT NULL DEFAULT 'recorded',
	`payload` json NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `finance_payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `finance_receipts` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`invoice_id` char(36) NOT NULL,
	`payment_id` char(36) NOT NULL,
	`student_id` char(36) NOT NULL,
	`receipt_number` varchar(80) NOT NULL,
	`amount_cents` int NOT NULL,
	`receipt_date` varchar(20) NOT NULL,
	`payload` json NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `finance_receipts_id` PRIMARY KEY(`id`),
	CONSTRAINT `finance_receipts_workspace_number_unique` UNIQUE(`workspace_id`,`receipt_number`)
);
--> statement-breakpoint
CREATE TABLE `communication_templates` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`name` varchar(180) NOT NULL,
	`category` varchar(80) NOT NULL,
	`status` varchar(40) NOT NULL DEFAULT 'active',
	`payload` json NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `communication_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `announcements` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`title` varchar(220) NOT NULL,
	`status` varchar(40) NOT NULL DEFAULT 'draft',
	`priority` varchar(40) NOT NULL DEFAULT 'normal',
	`payload` json NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `announcements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `communication_messages` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`subject` varchar(220) NOT NULL,
	`status` varchar(40) NOT NULL DEFAULT 'sent',
	`priority` varchar(40) NOT NULL DEFAULT 'normal',
	`idempotency_key` varchar(160),
	`payload` json NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `communication_messages_id` PRIMARY KEY(`id`),
	CONSTRAINT `communication_messages_idempotency_unique` UNIQUE(`workspace_id`,`idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `sis_notifications` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`recipient_kind` varchar(40) NOT NULL,
	`recipient_id` varchar(120) NOT NULL,
	`recipient_user_id` char(36),
	`notification_type` varchar(120) NOT NULL,
	`is_read` boolean NOT NULL DEFAULT false,
	`payload` json NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sis_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `communication_deliveries` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`communication_id` char(36),
	`announcement_id` char(36),
	`notification_id` char(36),
	`recipient_id` varchar(120) NOT NULL,
	`recipient_kind` varchar(40) NOT NULL,
	`channel` varchar(40) NOT NULL,
	`status` varchar(40) NOT NULL,
	`payload` json NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `communication_deliveries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notification_preferences` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`recipient_kind` varchar(40) NOT NULL,
	`recipient_id` varchar(120) NOT NULL,
	`payload` json NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notification_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `notification_preferences_recipient_unique` UNIQUE(`workspace_id`,`recipient_kind`,`recipient_id`)
);
--> statement-breakpoint
CREATE TABLE `portal_policies` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`payload` json NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `portal_policies_id` PRIMARY KEY(`id`),
	CONSTRAINT `portal_policies_workspace_unique` UNIQUE(`workspace_id`)
);
--> statement-breakpoint
CREATE TABLE `portal_update_requests` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`requester_user_id` char(36) NOT NULL,
	`requester_role` varchar(40) NOT NULL,
	`student_id` char(36),
	`request_type` varchar(80) NOT NULL,
	`status` varchar(40) NOT NULL DEFAULT 'submitted',
	`payload` json NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `portal_update_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `finance_fee_categories` ADD CONSTRAINT `fk_fin_cat_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `finance_fee_structures` ADD CONSTRAINT `fk_fin_struct_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `finance_fee_structures` ADD CONSTRAINT `fk_fin_struct_year` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `finance_fee_structures` ADD CONSTRAINT `fk_fin_struct_grade` FOREIGN KEY (`grade_id`) REFERENCES `grade_levels`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `finance_fee_structures` ADD CONSTRAINT `fk_fin_struct_category` FOREIGN KEY (`fee_category_id`) REFERENCES `finance_fee_categories`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `finance_student_fee_assignments` ADD CONSTRAINT `fk_fin_assign_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `finance_student_fee_assignments` ADD CONSTRAINT `fk_fin_assign_student` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `finance_student_fee_assignments` ADD CONSTRAINT `fk_fin_assign_enrollment` FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `finance_student_fee_assignments` ADD CONSTRAINT `fk_fin_assign_structure` FOREIGN KEY (`fee_structure_id`) REFERENCES `finance_fee_structures`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `finance_discounts` ADD CONSTRAINT `fk_fin_discount_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `finance_discounts` ADD CONSTRAINT `fk_fin_discount_student` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `finance_discounts` ADD CONSTRAINT `fk_fin_discount_category` FOREIGN KEY (`fee_category_id`) REFERENCES `finance_fee_categories`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `finance_invoices` ADD CONSTRAINT `fk_fin_invoice_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `finance_invoices` ADD CONSTRAINT `fk_fin_invoice_student` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `finance_invoices` ADD CONSTRAINT `fk_fin_invoice_enrollment` FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `finance_invoices` ADD CONSTRAINT `fk_fin_invoice_year` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `finance_payments` ADD CONSTRAINT `fk_fin_payment_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `finance_payments` ADD CONSTRAINT `fk_fin_payment_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `finance_invoices`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `finance_payments` ADD CONSTRAINT `fk_fin_payment_student` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `finance_receipts` ADD CONSTRAINT `fk_fin_receipt_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `finance_receipts` ADD CONSTRAINT `fk_fin_receipt_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `finance_invoices`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `finance_receipts` ADD CONSTRAINT `fk_fin_receipt_payment` FOREIGN KEY (`payment_id`) REFERENCES `finance_payments`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `finance_receipts` ADD CONSTRAINT `fk_fin_receipt_student` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `communication_templates` ADD CONSTRAINT `fk_comm_template_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `announcements` ADD CONSTRAINT `fk_announcement_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `communication_messages` ADD CONSTRAINT `fk_comm_message_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `sis_notifications` ADD CONSTRAINT `fk_sis_notification_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `communication_deliveries` ADD CONSTRAINT `fk_comm_delivery_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `notification_preferences` ADD CONSTRAINT `fk_notification_pref_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `portal_policies` ADD CONSTRAINT `fk_portal_policy_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `portal_update_requests` ADD CONSTRAINT `fk_portal_request_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `portal_update_requests` ADD CONSTRAINT `fk_portal_request_student` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX `finance_fee_categories_workspace_status_idx` ON `finance_fee_categories` (`workspace_id`,`status`);--> statement-breakpoint
CREATE INDEX `finance_fee_structures_workspace_year_idx` ON `finance_fee_structures` (`workspace_id`,`academic_year_id`);--> statement-breakpoint
CREATE INDEX `finance_fee_structures_class_idx` ON `finance_fee_structures` (`workspace_id`,`grade_id`);--> statement-breakpoint
CREATE INDEX `finance_assignments_student_idx` ON `finance_student_fee_assignments` (`workspace_id`,`student_id`);--> statement-breakpoint
CREATE INDEX `finance_discounts_student_idx` ON `finance_discounts` (`workspace_id`,`student_id`);--> statement-breakpoint
CREATE INDEX `finance_discounts_category_idx` ON `finance_discounts` (`workspace_id`,`fee_category_id`);--> statement-breakpoint
CREATE INDEX `finance_invoices_student_idx` ON `finance_invoices` (`workspace_id`,`student_id`);--> statement-breakpoint
CREATE INDEX `finance_invoices_status_idx` ON `finance_invoices` (`workspace_id`,`status`);--> statement-breakpoint
CREATE INDEX `finance_payments_invoice_idx` ON `finance_payments` (`workspace_id`,`invoice_id`);--> statement-breakpoint
CREATE INDEX `finance_payments_student_idx` ON `finance_payments` (`workspace_id`,`student_id`);--> statement-breakpoint
CREATE INDEX `finance_payments_reference_idx` ON `finance_payments` (`workspace_id`,`reference_number`);--> statement-breakpoint
CREATE INDEX `finance_receipts_student_idx` ON `finance_receipts` (`workspace_id`,`student_id`);--> statement-breakpoint
CREATE INDEX `communication_templates_workspace_idx` ON `communication_templates` (`workspace_id`,`status`);--> statement-breakpoint
CREATE INDEX `announcements_workspace_status_idx` ON `announcements` (`workspace_id`,`status`);--> statement-breakpoint
CREATE INDEX `communication_messages_workspace_status_idx` ON `communication_messages` (`workspace_id`,`status`);--> statement-breakpoint
CREATE INDEX `sis_notifications_recipient_idx` ON `sis_notifications` (`workspace_id`,`recipient_kind`,`recipient_id`,`is_read`);--> statement-breakpoint
CREATE INDEX `sis_notifications_user_idx` ON `sis_notifications` (`workspace_id`,`recipient_user_id`);--> statement-breakpoint
CREATE INDEX `communication_deliveries_workspace_idx` ON `communication_deliveries` (`workspace_id`,`status`);--> statement-breakpoint
CREATE INDEX `portal_requests_user_idx` ON `portal_update_requests` (`workspace_id`,`requester_user_id`,`requester_role`);--> statement-breakpoint
CREATE INDEX `portal_requests_student_idx` ON `portal_update_requests` (`workspace_id`,`student_id`);
