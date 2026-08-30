CREATE TABLE `academic_terms` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`academic_year_id` char(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`start_date` varchar(20) NOT NULL,
	`end_date` varchar(20) NOT NULL,
	`academic_term_status` enum('planned','active','completed') NOT NULL DEFAULT 'planned',
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `academic_terms_id` PRIMARY KEY(`id`),
	CONSTRAINT `academic_terms_year_name_unique` UNIQUE(`academic_year_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `academic_years` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`start_date` varchar(20) NOT NULL,
	`end_date` varchar(20) NOT NULL,
	`academic_year_status` enum('planned','active','completed','archived') NOT NULL DEFAULT 'planned',
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `academic_years_id` PRIMARY KEY(`id`),
	CONSTRAINT `academic_years_workspace_name_unique` UNIQUE(`workspace_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `class_subjects` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`grade_id` char(36) NOT NULL,
	`subject_id` char(36) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `class_subjects_id` PRIMARY KEY(`id`),
	CONSTRAINT `class_subjects_grade_subject_unique` UNIQUE(`grade_id`,`subject_id`)
);
--> statement-breakpoint
CREATE TABLE `enrollments` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`student_id` char(36) NOT NULL,
	`academic_year` varchar(120) NOT NULL,
	`grade_id` char(36) NOT NULL,
	`section_id` char(36) NOT NULL,
	`enrollment_date` varchar(40) NOT NULL,
	`enrollment_status` enum('active','completed','dropped','transferred') NOT NULL DEFAULT 'active',
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `enrollments_id` PRIMARY KEY(`id`),
	CONSTRAINT `enrollments_student_year_active_guard` UNIQUE(`student_id`,`academic_year`,`enrollment_status`)
);
--> statement-breakpoint
CREATE TABLE `grade_levels` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`level` int NOT NULL,
	`display_order` int NOT NULL,
	`academic_entity_status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `grade_levels_id` PRIMARY KEY(`id`),
	CONSTRAINT `grade_levels_workspace_name_unique` UNIQUE(`workspace_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `guardians` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`user_id` char(36),
	`first_name` varchar(120) NOT NULL,
	`last_name` varchar(120) NOT NULL,
	`guardian_relationship` enum('father','mother','guardian','other') NOT NULL DEFAULT 'guardian',
	`email` varchar(255) NOT NULL,
	`phone` varchar(80) NOT NULL,
	`address` varchar(1000),
	`occupation` varchar(255),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `guardians_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sections` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`grade_id` char(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`capacity` int,
	`academic_entity_status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sections_id` PRIMARY KEY(`id`),
	CONSTRAINT `sections_grade_name_unique` UNIQUE(`grade_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `staff_departments` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`name` varchar(160) NOT NULL,
	`description` varchar(1000),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `staff_departments_id` PRIMARY KEY(`id`),
	CONSTRAINT `staff_departments_workspace_name_unique` UNIQUE(`workspace_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `staff_members` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`employee_number` varchar(80) NOT NULL,
	`user_id` char(36),
	`first_name` varchar(120) NOT NULL,
	`middle_name` varchar(120),
	`last_name` varchar(120) NOT NULL,
	`preferred_name` varchar(120),
	`date_of_birth` varchar(20),
	`gender` enum('male','female','other','prefer_not_to_say'),
	`phone` varchar(80),
	`email` varchar(255),
	`address` varchar(1000),
	`photo_url` varchar(1000),
	`hire_date` varchar(20) NOT NULL,
	`staff_type` enum('teacher','administrator','coordinator','accountant','counselor','librarian','it_staff','support_staff','other') NOT NULL DEFAULT 'teacher',
	`employment_status` enum('full_time','part_time','contract','temporary','volunteer') NOT NULL DEFAULT 'full_time',
	`staff_status` enum('active','inactive','on_leave','suspended','resigned','terminated','archived') NOT NULL DEFAULT 'active',
	`department_id` char(36),
	`qualifications` text,
	`metadata` json,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `staff_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `staff_members_workspace_employee_unique` UNIQUE(`workspace_id`,`employee_number`)
);
--> statement-breakpoint
CREATE TABLE `student_guardians` (
	`id` char(36) NOT NULL,
	`student_id` char(36) NOT NULL,
	`guardian_id` char(36) NOT NULL,
	`is_emergency_contact` boolean NOT NULL DEFAULT false,
	`is_primary_contact` boolean NOT NULL DEFAULT false,
	`portal_access_enabled` boolean NOT NULL DEFAULT false,
	`authorized_for_portal` boolean NOT NULL DEFAULT false,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `student_guardians_id` PRIMARY KEY(`id`),
	CONSTRAINT `student_guardians_student_guardian_unique` UNIQUE(`student_id`,`guardian_id`)
);
--> statement-breakpoint
CREATE TABLE `students` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`user_id` char(36),
	`admission_number` varchar(80) NOT NULL,
	`student_number` varchar(80),
	`first_name` varchar(120) NOT NULL,
	`middle_name` varchar(120),
	`last_name` varchar(120) NOT NULL,
	`preferred_name` varchar(120),
	`date_of_birth` varchar(20) NOT NULL,
	`gender` enum('male','female','other','prefer_not_to_say') NOT NULL,
	`nationality` varchar(120),
	`email` varchar(255),
	`phone` varchar(80),
	`address` varchar(1000),
	`photo_url` varchar(1000),
	`admission_date` varchar(20) NOT NULL,
	`student_status` enum('applicant','active','inactive','withdrawn','graduated','transferred','archived') NOT NULL DEFAULT 'applicant',
	`portal_access_enabled` boolean NOT NULL DEFAULT false,
	`metadata` json,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `students_id` PRIMARY KEY(`id`),
	CONSTRAINT `students_workspace_admission_unique` UNIQUE(`workspace_id`,`admission_number`)
);
--> statement-breakpoint
CREATE TABLE `subjects` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`name` varchar(160) NOT NULL,
	`code` varchar(60) NOT NULL,
	`description` varchar(1000),
	`academic_entity_status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`display_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subjects_id` PRIMARY KEY(`id`),
	CONSTRAINT `subjects_workspace_code_unique` UNIQUE(`workspace_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `teaching_assignments` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`staff_id` char(36) NOT NULL,
	`academic_year` varchar(120) NOT NULL,
	`grade_id` char(36) NOT NULL,
	`section_id` char(36),
	`subject_id` char(36) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `teaching_assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `teaching_assignments_unique` UNIQUE(`workspace_id`,`staff_id`,`academic_year`,`grade_id`,`section_id`,`subject_id`)
);
--> statement-breakpoint
ALTER TABLE `academic_terms` ADD CONSTRAINT `academic_terms_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `academic_terms` ADD CONSTRAINT `academic_terms_academic_year_id_academic_years_id_fk` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `academic_years` ADD CONSTRAINT `academic_years_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `class_subjects` ADD CONSTRAINT `class_subjects_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `class_subjects` ADD CONSTRAINT `class_subjects_grade_id_grade_levels_id_fk` FOREIGN KEY (`grade_id`) REFERENCES `grade_levels`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `class_subjects` ADD CONSTRAINT `class_subjects_subject_id_subjects_id_fk` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_student_id_students_id_fk` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_grade_id_grade_levels_id_fk` FOREIGN KEY (`grade_id`) REFERENCES `grade_levels`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_section_id_sections_id_fk` FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `grade_levels` ADD CONSTRAINT `grade_levels_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `guardians` ADD CONSTRAINT `guardians_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `guardians` ADD CONSTRAINT `guardians_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `sections` ADD CONSTRAINT `sections_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `sections` ADD CONSTRAINT `sections_grade_id_grade_levels_id_fk` FOREIGN KEY (`grade_id`) REFERENCES `grade_levels`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `staff_departments` ADD CONSTRAINT `staff_departments_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `staff_members` ADD CONSTRAINT `staff_members_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `staff_members` ADD CONSTRAINT `staff_members_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `staff_members` ADD CONSTRAINT `staff_members_department_id_staff_departments_id_fk` FOREIGN KEY (`department_id`) REFERENCES `staff_departments`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `student_guardians` ADD CONSTRAINT `student_guardians_student_id_students_id_fk` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `student_guardians` ADD CONSTRAINT `student_guardians_guardian_id_guardians_id_fk` FOREIGN KEY (`guardian_id`) REFERENCES `guardians`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `students` ADD CONSTRAINT `students_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `students` ADD CONSTRAINT `students_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `subjects` ADD CONSTRAINT `subjects_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `teaching_assignments` ADD CONSTRAINT `teaching_assignments_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `teaching_assignments` ADD CONSTRAINT `teaching_assignments_staff_id_staff_members_id_fk` FOREIGN KEY (`staff_id`) REFERENCES `staff_members`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `teaching_assignments` ADD CONSTRAINT `teaching_assignments_grade_id_grade_levels_id_fk` FOREIGN KEY (`grade_id`) REFERENCES `grade_levels`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `teaching_assignments` ADD CONSTRAINT `teaching_assignments_section_id_sections_id_fk` FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `teaching_assignments` ADD CONSTRAINT `teaching_assignments_subject_id_subjects_id_fk` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX `academic_terms_workspace_year_idx` ON `academic_terms` (`workspace_id`,`academic_year_id`);--> statement-breakpoint
CREATE INDEX `academic_years_workspace_status_idx` ON `academic_years` (`workspace_id`,`academic_year_status`);--> statement-breakpoint
CREATE INDEX `class_subjects_workspace_grade_idx` ON `class_subjects` (`workspace_id`,`grade_id`);--> statement-breakpoint
CREATE INDEX `enrollments_workspace_student_idx` ON `enrollments` (`workspace_id`,`student_id`);--> statement-breakpoint
CREATE INDEX `enrollments_workspace_class_idx` ON `enrollments` (`workspace_id`,`grade_id`,`section_id`);--> statement-breakpoint
CREATE INDEX `grade_levels_workspace_order_idx` ON `grade_levels` (`workspace_id`,`display_order`);--> statement-breakpoint
CREATE INDEX `guardians_workspace_email_idx` ON `guardians` (`workspace_id`,`email`);--> statement-breakpoint
CREATE INDEX `sections_workspace_grade_idx` ON `sections` (`workspace_id`,`grade_id`);--> statement-breakpoint
CREATE INDEX `staff_members_workspace_status_idx` ON `staff_members` (`workspace_id`,`staff_status`);--> statement-breakpoint
CREATE INDEX `students_workspace_status_idx` ON `students` (`workspace_id`,`student_status`);--> statement-breakpoint
CREATE INDEX `subjects_workspace_order_idx` ON `subjects` (`workspace_id`,`display_order`);--> statement-breakpoint
CREATE INDEX `teaching_assignments_workspace_staff_idx` ON `teaching_assignments` (`workspace_id`,`staff_id`);