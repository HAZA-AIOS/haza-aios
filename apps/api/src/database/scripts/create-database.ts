import mysql from "mysql2/promise";
import { createLogger } from "../../common/logging/logger.js";
import { loadConfig } from "../../config/env.js";
import { assertSafeStagingDatabaseConfig } from "../../config/staging-database-guard.js";

const validDatabaseName = /^[A-Za-z0-9_]+$/;
const config = loadConfig(process.env);
const logger = createLogger(config);

if (config.appEnv === "production") {
  throw new Error("Database creation script is strictly forbidden in production");
}

if (config.appEnv === "staging") {
  assertSafeStagingDatabaseConfig(config.database, {
    appEnv: "staging",
    requireStagingAuth: true,
  });
}

if (!validDatabaseName.test(config.database.name)) {
  throw new Error("DATABASE_NAME may contain only letters, numbers, and underscores");
}

const connection = await mysql.createConnection({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  timezone: "Z",
});

try {
  await connection.query(`create database if not exists \`${config.database.name}\` character set utf8mb4 collate utf8mb4_unicode_ci`);
  logger.info("database_created_or_exists", {
    database: config.database.name,
  });
} finally {
  await connection.end();
}
