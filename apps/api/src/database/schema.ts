import { boolean, char, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";

export const internalDatabaseChecks = mysqlTable("internal_database_checks", {
  id: char("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
});

export const schema = {
  internalDatabaseChecks,
};

export type DatabaseSchema = typeof schema;
