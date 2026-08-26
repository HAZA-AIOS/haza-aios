CREATE TABLE `attendance_records` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`session_id` char(36) NOT NULL,
	`enrollment_id` char(36) NOT NULL,
	`student_id` char(36) NOT NULL,
	`attendance_status` enum('present','absent','late','excused') NOT NULL DEFAULT 'present',
	`note` varchar(1000),
	`marked_at` timestamp(3) NOT NULL DEFAULT (now()),
	`marked_by` varchar(120) NOT NULL,
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `attendance_records_id` PRIMARY KEY(`id`),
	CONSTRAINT `attendance_records_session_enrollment_unique` UNIQUE(`session_id`,`enrollment_id`)
);
--> statement-breakpoint
CREATE TABLE `attendance_sessions` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`academic_year_id` char(36) NOT NULL,
	`attendance_date` varchar(20) NOT NULL,
	`grade_id` char(36) NOT NULL,
	`section_id` char(36) NOT NULL,
	`subject_id` char(36),
	`teacher_id` char(36),
	`attendance_session_type` enum('daily','period','subject') NOT NULL DEFAULT 'daily',
	`attendance_session_status` enum('draft','completed') NOT NULL DEFAULT 'draft',
	`marked_by` varchar(120),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `attendance_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `attendance_sessions_scope_unique` UNIQUE(`workspace_id`,`academic_year_id`,`attendance_date`,`grade_id`,`section_id`,`attendance_session_type`,`subject_id`)
);
--> statement-breakpoint
CREATE TABLE `school_schedules` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`academic_year_id` char(36) NOT NULL,
	`working_days` json NOT NULL,
	`schedule_start_time` varchar(10) NOT NULL,
	`schedule_end_time` varchar(10) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `school_schedules_id` PRIMARY KEY(`id`),
	CONSTRAINT `school_schedules_workspace_year_unique` UNIQUE(`workspace_id`,`academic_year_id`)
);
--> statement-breakpoint
CREATE TABLE `time_periods` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`start_time` varchar(10) NOT NULL,
	`end_time` varchar(10) NOT NULL,
	`period_type` enum('teaching','break','activity') NOT NULL DEFAULT 'teaching',
	`display_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `time_periods_id` PRIMARY KEY(`id`),
	CONSTRAINT `time_periods_workspace_name_unique` UNIQUE(`workspace_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `timetable_entries` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`academic_year_id` char(36) NOT NULL,
	`term_id` char(36),
	`grade_id` char(36) NOT NULL,
	`section_id` char(36) NOT NULL,
	`subject_id` char(36) NOT NULL,
	`teacher_id` char(36) NOT NULL,
	`period_id` char(36) NOT NULL,
	`room_id` varchar(120),
	`day_of_week` int NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `timetable_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `timetable_entries_class_slot_unique` UNIQUE(`workspace_id`,`academic_year_id`,`grade_id`,`section_id`,`day_of_week`,`period_id`),
	CONSTRAINT `timetable_entries_teacher_slot_unique` UNIQUE(`workspace_id`,`academic_year_id`,`teacher_id`,`day_of_week`,`period_id`),
	CONSTRAINT `timetable_entries_room_slot_unique` UNIQUE(`workspace_id`,`academic_year_id`,`room_id`,`day_of_week`,`period_id`)
);
--> statement-breakpoint
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_session_id_attendance_sessions_id_fk` FOREIGN KEY (`session_id`) REFERENCES `attendance_sessions`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_enrollment_id_enrollments_id_fk` FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_student_id_students_id_fk` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `attendance_sessions` ADD CONSTRAINT `attendance_sessions_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `attendance_sessions` ADD CONSTRAINT `attendance_sessions_academic_year_id_academic_years_id_fk` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `attendance_sessions` ADD CONSTRAINT `attendance_sessions_grade_id_grade_levels_id_fk` FOREIGN KEY (`grade_id`) REFERENCES `grade_levels`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `attendance_sessions` ADD CONSTRAINT `attendance_sessions_section_id_sections_id_fk` FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `attendance_sessions` ADD CONSTRAINT `attendance_sessions_subject_id_subjects_id_fk` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `attendance_sessions` ADD CONSTRAINT `attendance_sessions_teacher_id_staff_members_id_fk` FOREIGN KEY (`teacher_id`) REFERENCES `staff_members`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `school_schedules` ADD CONSTRAINT `school_schedules_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `school_schedules` ADD CONSTRAINT `school_schedules_academic_year_id_academic_years_id_fk` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `time_periods` ADD CONSTRAINT `time_periods_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `timetable_entries` ADD CONSTRAINT `timetable_entries_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `timetable_entries` ADD CONSTRAINT `timetable_entries_academic_year_id_academic_years_id_fk` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `timetable_entries` ADD CONSTRAINT `timetable_entries_term_id_academic_terms_id_fk` FOREIGN KEY (`term_id`) REFERENCES `academic_terms`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `timetable_entries` ADD CONSTRAINT `timetable_entries_grade_id_grade_levels_id_fk` FOREIGN KEY (`grade_id`) REFERENCES `grade_levels`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `timetable_entries` ADD CONSTRAINT `timetable_entries_section_id_sections_id_fk` FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `timetable_entries` ADD CONSTRAINT `timetable_entries_subject_id_subjects_id_fk` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `timetable_entries` ADD CONSTRAINT `timetable_entries_teacher_id_staff_members_id_fk` FOREIGN KEY (`teacher_id`) REFERENCES `staff_members`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `timetable_entries` ADD CONSTRAINT `timetable_entries_period_id_time_periods_id_fk` FOREIGN KEY (`period_id`) REFERENCES `time_periods`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX `attendance_records_workspace_student_idx` ON `attendance_records` (`workspace_id`,`student_id`);--> statement-breakpoint
CREATE INDEX `attendance_records_session_idx` ON `attendance_records` (`session_id`);--> statement-breakpoint
CREATE INDEX `attendance_sessions_workspace_date_idx` ON `attendance_sessions` (`workspace_id`,`attendance_date`);--> statement-breakpoint
CREATE INDEX `attendance_sessions_class_idx` ON `attendance_sessions` (`workspace_id`,`academic_year_id`,`grade_id`,`section_id`);--> statement-breakpoint
CREATE INDEX `time_periods_workspace_order_idx` ON `time_periods` (`workspace_id`,`display_order`);--> statement-breakpoint
CREATE INDEX `timetable_entries_workspace_teacher_idx` ON `timetable_entries` (`workspace_id`,`teacher_id`);--> statement-breakpoint
CREATE INDEX `timetable_entries_workspace_class_idx` ON `timetable_entries` (`workspace_id`,`grade_id`,`section_id`);