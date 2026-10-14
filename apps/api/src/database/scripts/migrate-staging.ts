import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger } from "../../common/logging/logger.js";
import { loadConfig } from "../../config/env.js";
import { assertSafeStagingDatabaseConfig } from "../../config/staging-database-guard.js";
import { createDatabaseClient } from "../client.js";
import { migrate } from "../mysql94-migrator.js";

/**
 * HAZA AIOS — Dedicated Staging Migration Runner
 * 
 * Safety Rules:
 * 1. Must be executed with APP_ENV=staging (or NODE_ENV=staging).
 * 2. Requires STAGING_DATABASE_ALLOWED=true or ALLOW_STAGING_MIGRATIONS=true.
 * 3. Enforces fail-closed assertSafeStagingDatabaseConfig before connecting.
 * 4. Never targets production database haza_aios or production hosts.
 */

const config = loadConfig(process.env);
const logger = createLogger(config);

// 1. Enforce staging context
if (config.appEnv !== "staging") {
  logger.error("staging_migration_refused_wrong_env", {
    appEnv: config.appEnv,
    nodeEnv: config.nodeEnv,
    message: "Staging migration runner requires APP_ENV=staging",
  });
  process.exit(1);
}

// 2. Enforce explicit operator authorization flag
const isStagingAllowed =
  process.env.STAGING_DATABASE_ALLOWED === "true" ||
  process.env.ALLOW_STAGING_MIGRATIONS === "true";

if (!isStagingAllowed) {
  logger.error("staging_migration_refused_no_auth", {
    message:
      "Staging migration runner requires explicit STAGING_DATABASE_ALLOWED=true environment flag.",
  });
  process.exit(1);
}

// 3. Pre-connection fail-closed guard assertion
assertSafeStagingDatabaseConfig(config.database, {
  appEnv: "staging",
  requireStagingAuth: true,
});

logger.info("staging_migration_guard_verified", {
  database: config.database.name,
  host: config.database.host,
});

const database = createDatabaseClient(config.database, logger, { appEnv: "staging" });
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(currentDirectory, "../migrations");

try {
  logger.info("staging_migrations_starting", {
    database: config.database.name,
  });

  await migrate(database.db, { migrationsFolder });

  logger.info("staging_migrations_applied_successfully", {
    database: config.database.name,
  });
} catch (error) {
  logger.error("staging_migrations_failed", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
} finally {
  await database.close();
}
