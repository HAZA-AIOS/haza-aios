import { migrate } from "drizzle-orm/mysql2/migrator";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger } from "../../common/logging/logger.js";
import { loadConfig } from "../../config/env.js";
import { createDatabaseClient } from "../client.js";

const config = loadConfig(process.env);
const logger = createLogger(config);
const database = createDatabaseClient(config.database, logger);
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(currentDirectory, "../migrations");

try {
  await migrate(database.db, { migrationsFolder });
  logger.info("database_migrations_applied", {
    database: config.database.name,
  });
} finally {
  await database.close();
}
