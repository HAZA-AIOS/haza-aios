CREATE TABLE `finance_late_fee_policies` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`academic_year_id` char(36) NOT NULL,
	`code` varchar(80) NOT NULL,
	`name` varchar(180) NOT NULL,
	`grace_period_days` int NOT NULL DEFAULT 5,
	`fee_type` varchar(40) NOT NULL DEFAULT 'fixed',
	`amount_cents` int NOT NULL DEFAULT 0,
	`percentage_rate` int NOT NULL DEFAULT 0,
	`max_cap_cents` int NOT NULL DEFAULT 0,
	`status` varchar(40) NOT NULL DEFAULT 'active',
	`apply_automatically` boolean NOT NULL DEFAULT false,
	`payload` json NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `finance_late_fee_policies_id` PRIMARY KEY(`id`),
	CONSTRAINT `finance_late_fee_policies_workspace_code_unique` UNIQUE(`workspace_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `finance_expense_categories` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`code` varchar(80) NOT NULL,
	`name` varchar(160) NOT NULL,
	`status` varchar(40) NOT NULL DEFAULT 'active',
	`display_order` int NOT NULL DEFAULT 0,
	`payload` json NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `finance_expense_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `finance_expense_categories_workspace_code_unique` UNIQUE(`workspace_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `finance_expenses` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`category_id` char(36) NOT NULL,
	`expense_number` varchar(80) NOT NULL,
	`title` varchar(255) NOT NULL,
	`amount_cents` int NOT NULL,
	`expense_date` varchar(20) NOT NULL,
	`payee` varchar(180) NOT NULL,
	`payment_method` varchar(40) NOT NULL DEFAULT 'bank_transfer',
	`status` varchar(40) NOT NULL DEFAULT 'draft',
	`payload` json NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `finance_expenses_id` PRIMARY KEY(`id`),
	CONSTRAINT `finance_expenses_workspace_number_unique` UNIQUE(`workspace_id`,`expense_number`)
);
--> statement-breakpoint
CREATE TABLE `finance_incomes` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`income_number` varchar(80) NOT NULL,
	`source` varchar(160) NOT NULL,
	`category` varchar(80) NOT NULL,
	`amount_cents` int NOT NULL,
	`received_date` varchar(20) NOT NULL,
	`payment_method` varchar(40) NOT NULL DEFAULT 'cash',
	`status` varchar(40) NOT NULL DEFAULT 'received',
	`payload` json NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `finance_incomes_id` PRIMARY KEY(`id`),
	CONSTRAINT `finance_incomes_workspace_number_unique` UNIQUE(`workspace_id`,`income_number`)
);
--> statement-breakpoint
CREATE TABLE `finance_accounts` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`account_number` varchar(80) NOT NULL,
	`name` varchar(160) NOT NULL,
	`account_type` varchar(40) NOT NULL DEFAULT 'bank',
	`balance_cents` int NOT NULL DEFAULT 0,
	`status` varchar(40) NOT NULL DEFAULT 'active',
	`payload` json NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `finance_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `finance_accounts_workspace_number_unique` UNIQUE(`workspace_id`,`account_number`)
);
--> statement-breakpoint
ALTER TABLE `finance_late_fee_policies` ADD CONSTRAINT `finance_late_fee_policies_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `finance_late_fee_policies` ADD CONSTRAINT `finance_late_fee_policies_academic_year_id_academic_years_id_fk` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `finance_expense_categories` ADD CONSTRAINT `finance_expense_categories_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `finance_expenses` ADD CONSTRAINT `finance_expenses_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `finance_expenses` ADD CONSTRAINT `finance_expenses_category_id_finance_expense_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `finance_expense_categories`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `finance_incomes` ADD CONSTRAINT `finance_incomes_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `finance_accounts` ADD CONSTRAINT `finance_accounts_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX `finance_late_fee_policies_workspace_status_idx` ON `finance_late_fee_policies` (`workspace_id`,`status`);--> statement-breakpoint
CREATE INDEX `finance_expense_categories_workspace_status_idx` ON `finance_expense_categories` (`workspace_id`,`status`);--> statement-breakpoint
CREATE INDEX `finance_expenses_workspace_status_idx` ON `finance_expenses` (`workspace_id`,`status`);--> statement-breakpoint
CREATE INDEX `finance_expenses_workspace_date_idx` ON `finance_expenses` (`workspace_id`,`expense_date`);--> statement-breakpoint
CREATE INDEX `finance_incomes_workspace_date_idx` ON `finance_incomes` (`workspace_id`,`received_date`);--> statement-breakpoint
CREATE INDEX `finance_accounts_workspace_status_idx` ON `finance_accounts` (`workspace_id`,`status`);
