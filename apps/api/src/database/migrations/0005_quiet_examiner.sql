CREATE TABLE `examinations` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`name` varchar(180) NOT NULL,
	`academic_year_id` char(36) NOT NULL,
	`term_id` char(36),
	`examination_type` enum('monthly_test','mid_term','final_term','annual','entry_assessment','other') NOT NULL DEFAULT 'other',
	`start_date` varchar(20) NOT NULL,
	`end_date` varchar(20) NOT NULL,
	`examination_status` enum('draft','scheduled','in_progress','completed','published','archived') NOT NULL DEFAULT 'draft',
	`description` varchar(1000),
	`published_at` varchar(40),
	`published_by` varchar(120),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `examinations_id` PRIMARY KEY(`id`),
	CONSTRAINT `examinations_workspace_name_year_unique` UNIQUE(`workspace_id`,`name`,`academic_year_id`)
);
--> statement-breakpoint
CREATE TABLE `examination_subjects` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`examination_id` char(36) NOT NULL,
	`grade_id` char(36) NOT NULL,
	`section_id` char(36),
	`subject_id` char(36) NOT NULL,
	`maximum_marks` int NOT NULL,
	`passing_marks` int NOT NULL,
	`weightage` int,
	`exam_date` varchar(20),
	`exam_subject_status` enum('draft','scheduled','completed','cancelled') NOT NULL DEFAULT 'draft',
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `examination_subjects_id` PRIMARY KEY(`id`),
	CONSTRAINT `exam_subjects_scope_unique` UNIQUE(`workspace_id`,`examination_id`,`grade_id`,`section_id`,`subject_id`)
);
--> statement-breakpoint
CREATE TABLE `assessments` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`title` varchar(180) NOT NULL,
	`academic_year_id` char(36) NOT NULL,
	`term_id` char(36),
	`grade_id` char(36) NOT NULL,
	`section_id` char(36) NOT NULL,
	`subject_id` char(36) NOT NULL,
	`teacher_id` char(36) NOT NULL,
	`assessment_type` enum('class_test','assignment','quiz','project','practical','oral','other') NOT NULL DEFAULT 'other',
	`maximum_marks` int NOT NULL,
	`passing_marks` int NOT NULL,
	`weightage` int,
	`assessment_date` varchar(20) NOT NULL,
	`assessment_status` enum('draft','assigned','in_progress','completed','published','archived') NOT NULL DEFAULT 'draft',
	`description` varchar(1000),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `assessments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `grading_rules` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`grade` varchar(20) NOT NULL,
	`min_percentage_basis_points` int NOT NULL,
	`max_percentage_basis_points` int NOT NULL,
	`grade_point_basis_points` int,
	`description` varchar(500),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `grading_rules_id` PRIMARY KEY(`id`),
	CONSTRAINT `grading_rules_workspace_grade_unique` UNIQUE(`workspace_id`,`grade`)
);
--> statement-breakpoint
CREATE TABLE `mark_records` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`mark_source_type` enum('examination','assessment') NOT NULL,
	`source_id` char(36) NOT NULL,
	`examination_subject_id` char(36),
	`academic_year_id` char(36) NOT NULL,
	`term_id` char(36),
	`grade_id` char(36) NOT NULL,
	`section_id` char(36) NOT NULL,
	`subject_id` char(36) NOT NULL,
	`student_id` char(36) NOT NULL,
	`maximum_marks` int NOT NULL,
	`obtained_marks` int NOT NULL,
	`percentage_basis_points` int NOT NULL,
	`grade` varchar(20),
	`grade_point_basis_points` int,
	`remarks` varchar(1000),
	`entered_by` varchar(120) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mark_records_id` PRIMARY KEY(`id`),
	CONSTRAINT `mark_records_source_student_subject_unique` UNIQUE(`workspace_id`,`mark_source_type`,`source_id`,`student_id`,`subject_id`)
);
--> statement-breakpoint
CREATE TABLE `result_publications` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`examination_id` char(36) NOT NULL,
	`academic_year_id` char(36) NOT NULL,
	`term_id` char(36),
	`grade_id` char(36) NOT NULL,
	`section_id` char(36) NOT NULL,
	`result_status` enum('draft','in_progress','completed','published','archived') NOT NULL DEFAULT 'draft',
	`results` json NOT NULL,
	`published_at` varchar(40),
	`published_by` varchar(120),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `result_publications_id` PRIMARY KEY(`id`),
	CONSTRAINT `result_publications_scope_unique` UNIQUE(`workspace_id`,`examination_id`,`grade_id`,`section_id`)
);
--> statement-breakpoint
ALTER TABLE `examinations` ADD CONSTRAINT `examinations_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `examinations` ADD CONSTRAINT `examinations_academic_year_id_academic_years_id_fk` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `examinations` ADD CONSTRAINT `examinations_term_id_academic_terms_id_fk` FOREIGN KEY (`term_id`) REFERENCES `academic_terms`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `examination_subjects` ADD CONSTRAINT `examination_subjects_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `examination_subjects` ADD CONSTRAINT `examination_subjects_examination_id_examinations_id_fk` FOREIGN KEY (`examination_id`) REFERENCES `examinations`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `examination_subjects` ADD CONSTRAINT `examination_subjects_grade_id_grade_levels_id_fk` FOREIGN KEY (`grade_id`) REFERENCES `grade_levels`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `examination_subjects` ADD CONSTRAINT `examination_subjects_section_id_sections_id_fk` FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `examination_subjects` ADD CONSTRAINT `examination_subjects_subject_id_subjects_id_fk` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `assessments` ADD CONSTRAINT `assessments_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `assessments` ADD CONSTRAINT `assessments_academic_year_id_academic_years_id_fk` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `assessments` ADD CONSTRAINT `assessments_term_id_academic_terms_id_fk` FOREIGN KEY (`term_id`) REFERENCES `academic_terms`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `assessments` ADD CONSTRAINT `assessments_grade_id_grade_levels_id_fk` FOREIGN KEY (`grade_id`) REFERENCES `grade_levels`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `assessments` ADD CONSTRAINT `assessments_section_id_sections_id_fk` FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `assessments` ADD CONSTRAINT `assessments_subject_id_subjects_id_fk` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `assessments` ADD CONSTRAINT `assessments_teacher_id_staff_members_id_fk` FOREIGN KEY (`teacher_id`) REFERENCES `staff_members`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `grading_rules` ADD CONSTRAINT `grading_rules_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `mark_records` ADD CONSTRAINT `mark_records_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `mark_records` ADD CONSTRAINT `mark_records_examination_subject_id_examination_subjects_id_fk` FOREIGN KEY (`examination_subject_id`) REFERENCES `examination_subjects`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `mark_records` ADD CONSTRAINT `mark_records_academic_year_id_academic_years_id_fk` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `mark_records` ADD CONSTRAINT `mark_records_term_id_academic_terms_id_fk` FOREIGN KEY (`term_id`) REFERENCES `academic_terms`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `mark_records` ADD CONSTRAINT `mark_records_grade_id_grade_levels_id_fk` FOREIGN KEY (`grade_id`) REFERENCES `grade_levels`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `mark_records` ADD CONSTRAINT `mark_records_section_id_sections_id_fk` FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `mark_records` ADD CONSTRAINT `mark_records_subject_id_subjects_id_fk` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `mark_records` ADD CONSTRAINT `mark_records_student_id_students_id_fk` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `result_publications` ADD CONSTRAINT `result_publications_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `result_publications` ADD CONSTRAINT `result_publications_examination_id_examinations_id_fk` FOREIGN KEY (`examination_id`) REFERENCES `examinations`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `result_publications` ADD CONSTRAINT `result_publications_academic_year_id_academic_years_id_fk` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `result_publications` ADD CONSTRAINT `result_publications_term_id_academic_terms_id_fk` FOREIGN KEY (`term_id`) REFERENCES `academic_terms`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `result_publications` ADD CONSTRAINT `result_publications_grade_id_grade_levels_id_fk` FOREIGN KEY (`grade_id`) REFERENCES `grade_levels`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `result_publications` ADD CONSTRAINT `result_publications_section_id_sections_id_fk` FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX `examinations_workspace_year_idx` ON `examinations` (`workspace_id`,`academic_year_id`);--> statement-breakpoint
CREATE INDEX `examinations_workspace_status_idx` ON `examinations` (`workspace_id`,`examination_status`);--> statement-breakpoint
CREATE INDEX `exam_subjects_workspace_exam_idx` ON `examination_subjects` (`workspace_id`,`examination_id`);--> statement-breakpoint
CREATE INDEX `exam_subjects_class_idx` ON `examination_subjects` (`workspace_id`,`grade_id`,`section_id`);--> statement-breakpoint
CREATE INDEX `assessments_workspace_date_idx` ON `assessments` (`workspace_id`,`assessment_date`);--> statement-breakpoint
CREATE INDEX `assessments_class_idx` ON `assessments` (`workspace_id`,`grade_id`,`section_id`);--> statement-breakpoint
CREATE INDEX `assessments_teacher_idx` ON `assessments` (`workspace_id`,`teacher_id`);--> statement-breakpoint
CREATE INDEX `grading_rules_workspace_min_idx` ON `grading_rules` (`workspace_id`,`min_percentage_basis_points`);--> statement-breakpoint
CREATE INDEX `mark_records_workspace_student_idx` ON `mark_records` (`workspace_id`,`student_id`);--> statement-breakpoint
CREATE INDEX `mark_records_source_idx` ON `mark_records` (`workspace_id`,`mark_source_type`,`source_id`);--> statement-breakpoint
CREATE INDEX `result_publications_workspace_exam_idx` ON `result_publications` (`workspace_id`,`examination_id`);
