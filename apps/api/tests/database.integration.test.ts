import { migrate } from "drizzle-orm/mysql2/migrator";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger } from "../src/common/logging/logger.js";
import { loadConfig } from "../src/config/env.js";
import { createDatabaseClient, type DatabaseClient } from "../src/database/client.js";
import { internalDatabaseChecks } from "../src/database/schema.js";
import { withTransaction } from "../src/database/transactions.js";

const describeDatabase = process.env.RUN_DB_INTEGRATION_TESTS === "true" ? describe : describe.skip;
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(currentDirectory, "../src/database/migrations");

describeDatabase("database integration", () => {
  let database: DatabaseClient;

  beforeAll(async () => {
    const config = loadConfig({
      ...process.env,
      NODE_ENV: "test",
    });
    const logger = createLogger(config);
    database = createDatabaseClient(config.database, logger);
    await migrateIfNeeded(database);
  });

  afterAll(async () => {
    await database.close();
  });

  it("connects to MySQL", async () => {
    await expect(database.ping()).resolves.toBeUndefined();
  });

  it("keeps migrations idempotent", async () => {
    await expect(migrate(database.db, { migrationsFolder })).resolves.toBeUndefined();
  });

  it("commits transaction work", async () => {
    const id = randomUUID();

    await withTransaction(database, async ({ tx }) => {
      await tx.insert(internalDatabaseChecks).values({
        id,
        name: "transaction commit check",
      });
    });

    const rows = await database.db.select().from(internalDatabaseChecks).where(eq(internalDatabaseChecks.id, id));

    expect(rows).toHaveLength(1);
  });

  it("rolls back transaction work", async () => {
    const id = randomUUID();

    await expect(withTransaction(database, async ({ tx }) => {
      await tx.insert(internalDatabaseChecks).values({
        id,
        name: "transaction rollback check",
      });
      throw new Error("rollback");
    })).rejects.toThrow("Database operation failed.");

    const rows = await database.db.select().from(internalDatabaseChecks).where(eq(internalDatabaseChecks.id, id));

    expect(rows).toHaveLength(0);
  });
});

async function migrateIfNeeded(database: DatabaseClient): Promise<void> {
  try {
    await migrate(database.db, { migrationsFolder });
  } catch (error) {
    const code = (error as { cause?: { code?: string } }).cause?.code;
    if (code === "ER_TABLE_EXISTS_ERROR") return;
    throw error;
  }
}
