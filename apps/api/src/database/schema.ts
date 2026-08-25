import { boolean, char, datetime, index, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const organizationStatus = mysqlEnum("organization_status", ["active", "suspended", "archived"]);
export const workspaceStatus = mysqlEnum("workspace_status", ["active", "archived"]);
export const workspaceType = mysqlEnum("workspace_type", ["primary", "general", "industry"]);
export const moduleStatus = mysqlEnum("organization_module_status", ["activated", "deactivated"]);
export const membershipRole = mysqlEnum("organization_membership_role", ["Owner", "Admin", "Member"]);
export const membershipStatus = mysqlEnum("organization_membership_status", ["active", "pending", "suspended"]);
export const userStatus = mysqlEnum("user_status", ["active", "inactive", "suspended", "pending", "archived"]);
export const roleScope = mysqlEnum("role_scope", ["platform", "organization"]);
export const sessionStatus = mysqlEnum("auth_session_status", ["active", "revoked", "expired"]);
export const securityEventSeverity = mysqlEnum("security_event_severity", ["info", "warning", "critical"]);

export const internalDatabaseChecks = mysqlTable("internal_database_checks", {
  id: char("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
});

export const organizations = mysqlTable("organizations", {
  id: char("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  legalName: varchar("legal_name", { length: 220 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull(),
  description: varchar("description", { length: 1000 }),
  industry: varchar("industry", { length: 80 }).notNull(),
  organizationType: varchar("organization_type", { length: 80 }).notNull(),
  website: varchar("website", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 80 }),
  country: varchar("country", { length: 120 }).notNull(),
  timezone: varchar("timezone", { length: 80 }).notNull().default("UTC"),
  currency: char("currency", { length: 3 }).notNull().default("USD"),
  status: organizationStatus.notNull().default("active"),
  ownerId: varchar("owner_id", { length: 120 }).notNull(),
  archivedAt: timestamp("archived_at", { fsp: 3 }),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
}, (table) => [
  uniqueIndex("organizations_slug_unique").on(table.slug),
  index("organizations_status_idx").on(table.status),
]);

export const users = mysqlTable("users", {
  id: char("id", { length: 36 }).primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  normalizedEmail: varchar("normalized_email", { length: 255 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  firstName: varchar("first_name", { length: 120 }).notNull(),
  lastName: varchar("last_name", { length: 120 }).notNull(),
  displayName: varchar("display_name", { length: 240 }).notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  status: userStatus.notNull().default("active"),
  lastLoginAt: datetime("last_login_at", { fsp: 3 }),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
}, (table) => [
  uniqueIndex("users_normalized_email_unique").on(table.normalizedEmail),
  index("users_status_idx").on(table.status),
]);

export const workspaces = mysqlTable("workspaces", {
  id: char("id", { length: 36 }).primaryKey(),
  organizationId: char("organization_id", { length: 36 }).notNull().references(() => organizations.id, { onDelete: "restrict", onUpdate: "cascade" }),
  name: varchar("name", { length: 180 }).notNull(),
  code: varchar("code", { length: 80 }).notNull(),
  type: workspaceType.notNull().default("primary"),
  status: workspaceStatus.notNull().default("active"),
  archivedAt: timestamp("archived_at", { fsp: 3 }),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
}, (table) => [
  uniqueIndex("workspaces_org_code_unique").on(table.organizationId, table.code),
  index("workspaces_org_status_idx").on(table.organizationId, table.status),
]);

export const organizationSettings = mysqlTable("organization_settings", {
  id: char("id", { length: 36 }).primaryKey(),
  organizationId: char("organization_id", { length: 36 }).notNull().references(() => organizations.id, { onDelete: "restrict", onUpdate: "cascade" }),
  timezone: varchar("timezone", { length: 80 }).notNull().default("UTC"),
  locale: varchar("locale", { length: 20 }).notNull().default("en"),
  currency: char("currency", { length: 3 }).notNull().default("USD"),
  preferences: json("preferences").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
}, (table) => [
  uniqueIndex("organization_settings_org_unique").on(table.organizationId),
]);

export const organizationModules = mysqlTable("organization_modules", {
  id: char("id", { length: 36 }).primaryKey(),
  organizationId: char("organization_id", { length: 36 }).notNull().references(() => organizations.id, { onDelete: "restrict", onUpdate: "cascade" }),
  moduleKey: varchar("module_key", { length: 120 }).notNull(),
  status: moduleStatus.notNull().default("activated"),
  enabled: boolean("enabled").notNull().default(true),
  settings: json("settings").$type<Record<string, unknown>>(),
  activatedAt: timestamp("activated_at", { fsp: 3 }).notNull().defaultNow(),
  activatedBy: varchar("activated_by", { length: 120 }),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
}, (table) => [
  uniqueIndex("organization_modules_org_key_unique").on(table.organizationId, table.moduleKey),
  index("organization_modules_org_status_idx").on(table.organizationId, table.status),
]);

export const organizationMemberships = mysqlTable("organization_memberships", {
  id: char("id", { length: 36 }).primaryKey(),
  organizationId: char("organization_id", { length: 36 }).notNull().references(() => organizations.id, { onDelete: "restrict", onUpdate: "cascade" }),
  userId: varchar("user_id", { length: 120 }).notNull(),
  role: membershipRole.notNull().default("Owner"),
  status: membershipStatus.notNull().default("active"),
  joinedAt: timestamp("joined_at", { fsp: 3 }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
}, (table) => [
  uniqueIndex("organization_memberships_org_user_unique").on(table.organizationId, table.userId),
  index("organization_memberships_user_status_idx").on(table.userId, table.status),
]);

export const permissions = mysqlTable("permissions", {
  id: char("id", { length: 36 }).primaryKey(),
  key: varchar("permission_key", { length: 120 }).notNull(),
  description: varchar("description", { length: 500 }).notNull(),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
}, (table) => [
  uniqueIndex("permissions_key_unique").on(table.key),
]);

export const roles = mysqlTable("roles", {
  id: char("id", { length: 36 }).primaryKey(),
  organizationId: char("organization_id", { length: 36 }).references(() => organizations.id, { onDelete: "restrict", onUpdate: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  scope: roleScope.notNull().default("organization"),
  systemKey: varchar("system_key", { length: 120 }),
  description: varchar("description", { length: 500 }).notNull(),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
}, (table) => [
  uniqueIndex("roles_org_name_unique").on(table.organizationId, table.name),
  uniqueIndex("roles_system_key_unique").on(table.systemKey),
  index("roles_scope_idx").on(table.scope),
]);

export const rolePermissions = mysqlTable("role_permissions", {
  id: char("id", { length: 36 }).primaryKey(),
  roleId: char("role_id", { length: 36 }).notNull().references(() => roles.id, { onDelete: "restrict", onUpdate: "cascade" }),
  permissionId: char("permission_id", { length: 36 }).notNull().references(() => permissions.id, { onDelete: "restrict", onUpdate: "cascade" }),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("role_permissions_role_permission_unique").on(table.roleId, table.permissionId),
]);

export const membershipRoles = mysqlTable("membership_roles", {
  id: char("id", { length: 36 }).primaryKey(),
  membershipId: char("membership_id", { length: 36 }).notNull().references(() => organizationMemberships.id, { onDelete: "restrict", onUpdate: "cascade" }),
  roleId: char("role_id", { length: 36 }).notNull().references(() => roles.id, { onDelete: "restrict", onUpdate: "cascade" }),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("membership_roles_membership_role_unique").on(table.membershipId, table.roleId),
]);

export const workspaceMemberships = mysqlTable("workspace_memberships", {
  id: char("id", { length: 36 }).primaryKey(),
  workspaceId: char("workspace_id", { length: 36 }).notNull().references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
  organizationMembershipId: char("organization_membership_id", { length: 36 }).notNull().references(() => organizationMemberships.id, { onDelete: "restrict", onUpdate: "cascade" }),
  status: membershipStatus.notNull().default("active"),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
}, (table) => [
  uniqueIndex("workspace_memberships_workspace_membership_unique").on(table.workspaceId, table.organizationMembershipId),
]);

export const authSessions = mysqlTable("auth_sessions", {
  id: char("id", { length: 36 }).primaryKey(),
  userId: char("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "restrict", onUpdate: "cascade" }),
  tokenHash: char("token_hash", { length: 64 }).notNull(),
  status: sessionStatus.notNull().default("active"),
  rememberMe: boolean("remember_me").notNull().default(false),
  expiresAt: datetime("expires_at", { fsp: 3 }).notNull(),
  revokedAt: datetime("revoked_at", { fsp: 3 }),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
}, (table) => [
  uniqueIndex("auth_sessions_token_hash_unique").on(table.tokenHash),
  index("auth_sessions_user_status_idx").on(table.userId, table.status),
]);

export const securityEvents = mysqlTable("security_events", {
  id: char("id", { length: 36 }).primaryKey(),
  userId: char("user_id", { length: 36 }),
  organizationId: char("organization_id", { length: 36 }),
  eventType: varchar("event_type", { length: 120 }).notNull(),
  severity: securityEventSeverity.notNull().default("info"),
  ipAddress: varchar("ip_address", { length: 80 }),
  userAgent: text("user_agent"),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
}, (table) => [
  index("security_events_user_idx").on(table.userId),
  index("security_events_org_idx").on(table.organizationId),
  index("security_events_type_idx").on(table.eventType),
]);


export const academicYearStatus = mysqlEnum("academic_year_status", ["planned", "active", "completed", "archived"]);
export const academicTermStatus = mysqlEnum("academic_term_status", ["planned", "active", "completed"]);
export const academicEntityStatus = mysqlEnum("academic_entity_status", ["active", "inactive"]);
export const studentStatus = mysqlEnum("student_status", ["applicant", "active", "inactive", "withdrawn", "graduated", "transferred", "archived"]);
export const gender = mysqlEnum("gender", ["male", "female", "other", "prefer_not_to_say"]);
export const guardianRelationship = mysqlEnum("guardian_relationship", ["father", "mother", "guardian", "other"]);
export const enrollmentStatus = mysqlEnum("enrollment_status", ["active", "completed", "dropped", "transferred"]);
export const staffType = mysqlEnum("staff_type", ["teacher", "administrator", "coordinator", "accountant", "counselor", "librarian", "it_staff", "support_staff", "other"]);
export const staffStatus = mysqlEnum("staff_status", ["active", "inactive", "on_leave", "suspended", "resigned", "terminated", "archived"]);
export const employmentStatus = mysqlEnum("employment_status", ["full_time", "part_time", "contract", "temporary", "volunteer"]);

export const academicYears = mysqlTable("academic_years", {
  id: char("id", { length: 36 }).primaryKey(),
  workspaceId: char("workspace_id", { length: 36 }).notNull().references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  startDate: varchar("start_date", { length: 20 }).notNull(),
  endDate: varchar("end_date", { length: 20 }).notNull(),
  status: academicYearStatus.notNull().default("planned"),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
}, (table) => [
  uniqueIndex("academic_years_workspace_name_unique").on(table.workspaceId, table.name),
  index("academic_years_workspace_status_idx").on(table.workspaceId, table.status),
]);

export const academicTerms = mysqlTable("academic_terms", {
  id: char("id", { length: 36 }).primaryKey(),
  workspaceId: char("workspace_id", { length: 36 }).notNull().references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
  academicYearId: char("academic_year_id", { length: 36 }).notNull().references(() => academicYears.id, { onDelete: "restrict", onUpdate: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  startDate: varchar("start_date", { length: 20 }).notNull(),
  endDate: varchar("end_date", { length: 20 }).notNull(),
  status: academicTermStatus.notNull().default("planned"),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
}, (table) => [
  uniqueIndex("academic_terms_year_name_unique").on(table.academicYearId, table.name),
  index("academic_terms_workspace_year_idx").on(table.workspaceId, table.academicYearId),
]);

export const gradeLevels = mysqlTable("grade_levels", {
  id: char("id", { length: 36 }).primaryKey(),
  workspaceId: char("workspace_id", { length: 36 }).notNull().references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  level: int("level").notNull(),
  order: int("display_order").notNull(),
  status: academicEntityStatus.notNull().default("active"),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
}, (table) => [
  uniqueIndex("grade_levels_workspace_name_unique").on(table.workspaceId, table.name),
  index("grade_levels_workspace_order_idx").on(table.workspaceId, table.order),
]);

export const sections = mysqlTable("sections", {
  id: char("id", { length: 36 }).primaryKey(),
  workspaceId: char("workspace_id", { length: 36 }).notNull().references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
  gradeId: char("grade_id", { length: 36 }).notNull().references(() => gradeLevels.id, { onDelete: "restrict", onUpdate: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  capacity: int("capacity"),
  status: academicEntityStatus.notNull().default("active"),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
}, (table) => [
  uniqueIndex("sections_grade_name_unique").on(table.gradeId, table.name),
  index("sections_workspace_grade_idx").on(table.workspaceId, table.gradeId),
]);

export const subjects = mysqlTable("subjects", {
  id: char("id", { length: 36 }).primaryKey(),
  workspaceId: char("workspace_id", { length: 36 }).notNull().references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  code: varchar("code", { length: 60 }).notNull(),
  description: varchar("description", { length: 1000 }),
  status: academicEntityStatus.notNull().default("active"),
  displayOrder: int("display_order").notNull().default(0),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
}, (table) => [
  uniqueIndex("subjects_workspace_code_unique").on(table.workspaceId, table.code),
  index("subjects_workspace_order_idx").on(table.workspaceId, table.displayOrder),
]);

export const classSubjects = mysqlTable("class_subjects", {
  id: char("id", { length: 36 }).primaryKey(),
  workspaceId: char("workspace_id", { length: 36 }).notNull().references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
  gradeId: char("grade_id", { length: 36 }).notNull().references(() => gradeLevels.id, { onDelete: "restrict", onUpdate: "cascade" }),
  subjectId: char("subject_id", { length: 36 }).notNull().references(() => subjects.id, { onDelete: "restrict", onUpdate: "cascade" }),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("class_subjects_grade_subject_unique").on(table.gradeId, table.subjectId),
  index("class_subjects_workspace_grade_idx").on(table.workspaceId, table.gradeId),
]);

export const staffDepartments = mysqlTable("staff_departments", {
  id: char("id", { length: 36 }).primaryKey(),
  workspaceId: char("workspace_id", { length: 36 }).notNull().references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  description: varchar("description", { length: 1000 }),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
}, (table) => [
  uniqueIndex("staff_departments_workspace_name_unique").on(table.workspaceId, table.name),
]);

export const staffMembers = mysqlTable("staff_members", {
  id: char("id", { length: 36 }).primaryKey(),
  workspaceId: char("workspace_id", { length: 36 }).notNull().references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
  employeeNumber: varchar("employee_number", { length: 80 }).notNull(),
  userId: char("user_id", { length: 36 }).references(() => users.id, { onDelete: "restrict", onUpdate: "cascade" }),
  firstName: varchar("first_name", { length: 120 }).notNull(),
  middleName: varchar("middle_name", { length: 120 }),
  lastName: varchar("last_name", { length: 120 }).notNull(),
  preferredName: varchar("preferred_name", { length: 120 }),
  dateOfBirth: varchar("date_of_birth", { length: 20 }),
  gender: gender,
  phone: varchar("phone", { length: 80 }),
  email: varchar("email", { length: 255 }),
  address: varchar("address", { length: 1000 }),
  photoUrl: varchar("photo_url", { length: 1000 }),
  hireDate: varchar("hire_date", { length: 20 }).notNull(),
  staffType: staffType.notNull().default("teacher"),
  employmentStatus: employmentStatus.notNull().default("full_time"),
  status: staffStatus.notNull().default("active"),
  departmentId: char("department_id", { length: 36 }).references(() => staffDepartments.id, { onDelete: "restrict", onUpdate: "cascade" }),
  qualifications: text("qualifications"),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
}, (table) => [
  uniqueIndex("staff_members_workspace_employee_unique").on(table.workspaceId, table.employeeNumber),
  index("staff_members_workspace_status_idx").on(table.workspaceId, table.status),
]);

export const teachingAssignments = mysqlTable("teaching_assignments", {
  id: char("id", { length: 36 }).primaryKey(),
  workspaceId: char("workspace_id", { length: 36 }).notNull().references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
  staffId: char("staff_id", { length: 36 }).notNull().references(() => staffMembers.id, { onDelete: "restrict", onUpdate: "cascade" }),
  academicYear: varchar("academic_year", { length: 120 }).notNull(),
  gradeId: char("grade_id", { length: 36 }).notNull().references(() => gradeLevels.id, { onDelete: "restrict", onUpdate: "cascade" }),
  sectionId: char("section_id", { length: 36 }).references(() => sections.id, { onDelete: "restrict", onUpdate: "cascade" }),
  subjectId: char("subject_id", { length: 36 }).notNull().references(() => subjects.id, { onDelete: "restrict", onUpdate: "cascade" }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
}, (table) => [
  uniqueIndex("teaching_assignments_unique").on(table.workspaceId, table.staffId, table.academicYear, table.gradeId, table.sectionId, table.subjectId),
  index("teaching_assignments_workspace_staff_idx").on(table.workspaceId, table.staffId),
]);

export const students = mysqlTable("students", {
  id: char("id", { length: 36 }).primaryKey(),
  workspaceId: char("workspace_id", { length: 36 }).notNull().references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
  userId: char("user_id", { length: 36 }).references(() => users.id, { onDelete: "restrict", onUpdate: "cascade" }),
  admissionNumber: varchar("admission_number", { length: 80 }).notNull(),
  studentNumber: varchar("student_number", { length: 80 }),
  firstName: varchar("first_name", { length: 120 }).notNull(),
  middleName: varchar("middle_name", { length: 120 }),
  lastName: varchar("last_name", { length: 120 }).notNull(),
  preferredName: varchar("preferred_name", { length: 120 }),
  dateOfBirth: varchar("date_of_birth", { length: 20 }).notNull(),
  gender: gender.notNull(),
  nationality: varchar("nationality", { length: 120 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 80 }),
  address: varchar("address", { length: 1000 }),
  photoUrl: varchar("photo_url", { length: 1000 }),
  admissionDate: varchar("admission_date", { length: 20 }).notNull(),
  status: studentStatus.notNull().default("applicant"),
  portalAccessEnabled: boolean("portal_access_enabled").notNull().default(false),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
}, (table) => [
  uniqueIndex("students_workspace_admission_unique").on(table.workspaceId, table.admissionNumber),
  index("students_workspace_status_idx").on(table.workspaceId, table.status),
]);

export const guardians = mysqlTable("guardians", {
  id: char("id", { length: 36 }).primaryKey(),
  workspaceId: char("workspace_id", { length: 36 }).notNull().references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
  userId: char("user_id", { length: 36 }).references(() => users.id, { onDelete: "restrict", onUpdate: "cascade" }),
  firstName: varchar("first_name", { length: 120 }).notNull(),
  lastName: varchar("last_name", { length: 120 }).notNull(),
  relationship: guardianRelationship.notNull().default("guardian"),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 80 }).notNull(),
  address: varchar("address", { length: 1000 }),
  occupation: varchar("occupation", { length: 255 }),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
}, (table) => [
  index("guardians_workspace_email_idx").on(table.workspaceId, table.email),
]);

export const studentGuardians = mysqlTable("student_guardians", {
  id: char("id", { length: 36 }).primaryKey(),
  studentId: char("student_id", { length: 36 }).notNull().references(() => students.id, { onDelete: "restrict", onUpdate: "cascade" }),
  guardianId: char("guardian_id", { length: 36 }).notNull().references(() => guardians.id, { onDelete: "restrict", onUpdate: "cascade" }),
  isEmergencyContact: boolean("is_emergency_contact").notNull().default(false),
  isPrimaryContact: boolean("is_primary_contact").notNull().default(false),
  portalAccessEnabled: boolean("portal_access_enabled").notNull().default(false),
  authorizedForPortal: boolean("authorized_for_portal").notNull().default(false),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
}, (table) => [
  uniqueIndex("student_guardians_student_guardian_unique").on(table.studentId, table.guardianId),
]);

export const enrollments = mysqlTable("enrollments", {
  id: char("id", { length: 36 }).primaryKey(),
  workspaceId: char("workspace_id", { length: 36 }).notNull().references(() => workspaces.id, { onDelete: "restrict", onUpdate: "cascade" }),
  studentId: char("student_id", { length: 36 }).notNull().references(() => students.id, { onDelete: "restrict", onUpdate: "cascade" }),
  academicYear: varchar("academic_year", { length: 120 }).notNull(),
  gradeId: char("grade_id", { length: 36 }).notNull().references(() => gradeLevels.id, { onDelete: "restrict", onUpdate: "cascade" }),
  sectionId: char("section_id", { length: 36 }).notNull().references(() => sections.id, { onDelete: "restrict", onUpdate: "cascade" }),
  enrollmentDate: varchar("enrollment_date", { length: 40 }).notNull(),
  status: enrollmentStatus.notNull().default("active"),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
}, (table) => [
  uniqueIndex("enrollments_student_year_active_guard").on(table.studentId, table.academicYear, table.status),
  index("enrollments_workspace_student_idx").on(table.workspaceId, table.studentId),
  index("enrollments_workspace_class_idx").on(table.workspaceId, table.gradeId, table.sectionId),
]);
export const schema = {
  academicTerms,
  academicYears,
  classSubjects,
  enrollments,
  gradeLevels,
  guardians,  authSessions,
  internalDatabaseChecks,
  membershipRoles,
  organizationMemberships,
  organizationModules,
  organizationSettings,
  organizations,
  permissions,
  rolePermissions,
  roles,
  sections,
  securityEvents,
  staffDepartments,
  staffMembers,
  studentGuardians,
  students,
  subjects,
  teachingAssignments,
  users,
  workspaceMemberships,
  workspaces,
};

export type DatabaseSchema = typeof schema;
