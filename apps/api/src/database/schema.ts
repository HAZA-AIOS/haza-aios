import { boolean, char, index, json, mysqlEnum, mysqlTable, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const organizationStatus = mysqlEnum("organization_status", ["active", "suspended", "archived"]);
export const workspaceStatus = mysqlEnum("workspace_status", ["active", "archived"]);
export const workspaceType = mysqlEnum("workspace_type", ["primary", "general", "industry"]);
export const moduleStatus = mysqlEnum("organization_module_status", ["activated", "deactivated"]);
export const membershipRole = mysqlEnum("organization_membership_role", ["Owner", "Admin", "Member"]);
export const membershipStatus = mysqlEnum("organization_membership_status", ["active", "pending", "suspended"]);

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

export const schema = {
  internalDatabaseChecks,
  organizations,
  organizationMemberships,
  organizationModules,
  organizationSettings,
  workspaces,
};

export type DatabaseSchema = typeof schema;
