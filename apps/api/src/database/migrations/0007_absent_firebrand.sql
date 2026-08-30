CREATE TABLE `platform_modules` (
	`id` char(36) NOT NULL,
	`module_key` varchar(120) NOT NULL,
	`name` varchar(180) NOT NULL,
	`description` varchar(1000) NOT NULL,
	`category` varchar(80) NOT NULL,
	`industry` varchar(80) NOT NULL,
	`version` varchar(80) NOT NULL,
	`status` varchar(40) NOT NULL DEFAULT 'available',
	`is_core` boolean NOT NULL DEFAULT false,
	`metadata` json NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `platform_modules_id` PRIMARY KEY(`id`),
	CONSTRAINT `platform_modules_key_unique` UNIQUE(`module_key`)
);
--> statement-breakpoint
INSERT IGNORE INTO `platform_modules` (`id`, `module_key`, `name`, `description`, `category`, `industry`, `version`, `status`, `is_core`, `metadata`)
VALUES
	('00000000-0000-4000-8000-000000000101', 'education-sis', 'Education & SIS Suite', 'Education Student Information System for academic structure, students, staff, attendance, timetable, examinations, finance, communication, portal, analytics, and reports.', 'industry', 'Education', '0.1.0-alpha', 'available', false, JSON_OBJECT('tags', JSON_ARRAY('education', 'sis', 'academic'), 'source', 'static-frontend-registry')),
	('00000000-0000-4000-8000-000000000102', 'demo-analytics', 'Demo Analytics', 'Non-production demonstration module for module framework telemetry.', 'utility', 'Cross-Industry', '0.1.0-alpha', 'available', false, JSON_OBJECT('tags', JSON_ARRAY('demo', 'telemetry'), 'source', 'static-frontend-registry')),
	('00000000-0000-4000-8000-000000000103', 'healthcare-ehr', 'Healthcare & Patient EHR (Framework Ready)', 'Future Clinical Patient EHR capability for managing health records, appointments, and care plans.', 'industry', 'Healthcare', '0.1.0-alpha', 'available', false, JSON_OBJECT('tags', JSON_ARRAY('healthcare', 'ehr', 'clinical'), 'source', 'static-frontend-registry')),
	('00000000-0000-4000-8000-000000000104', 'corporate-hr', 'Corporate HR & Operations (Framework Ready)', 'Future Corporate HR capability for managing workforce directories, payroll, and performance goals.', 'industry', 'Corporate', '0.1.0-alpha', 'available', false, JSON_OBJECT('tags', JSON_ARRAY('corporate', 'hr', 'operations'), 'source', 'static-frontend-registry'));
--> statement-breakpoint
CREATE INDEX `platform_modules_status_idx` ON `platform_modules` (`status`);
--> statement-breakpoint
CREATE INDEX `platform_modules_industry_idx` ON `platform_modules` (`industry`);
--> statement-breakpoint
ALTER TABLE `organization_modules` ADD CONSTRAINT `organization_modules_module_key_platform_modules_module_key_fk` FOREIGN KEY (`module_key`) REFERENCES `platform_modules`(`module_key`) ON DELETE restrict ON UPDATE cascade;
