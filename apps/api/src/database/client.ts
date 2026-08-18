import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql, { type Pool } from "mysql2/promise";
import type { Logger } from "../common/logging/logger.js";
import type { DatabaseConfig } from "../config/env.js";
import { mapDatabaseError } from "./errors.js";
import { schema, type DatabaseSchema } from "./schema.js";

export type Database = MySql2Database<DatabaseSchema>;
export type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export type DatabaseClient = {
  db: Database;
  ping: () => Promise<void>;
  close: () => Promise<void>;
  transaction: <T>(work: (transaction: DatabaseTransaction) => Promise<T>) => Promise<T>;
};

export function createDatabaseClient(config: DatabaseConfig, logger: Logger): DatabaseClient {
  const pool = createPool(config);
  const db = drizzle(pool, {
    mode: "default",
    schema,
  });

  return {
    db,
    async ping() {
      try {
        await pool.query("select 1");
      } catch (error) {
        throw mapDatabaseError(error, "DATABASE_UNAVAILABLE");
      }
    },
    async close() {
      try {
        await pool.end();
      } catch (error) {
        logger.warn("database_pool_close_failed", {
          reason: mapDatabaseError(error).code,
        });
      }
    },
    async transaction(work) {
      try {
        return await db.transaction(work);
      } catch (error) {
        throw mapDatabaseError(error, "DATABASE_TRANSACTION_FAILED");
      }
    },
  };
}

function createPool(config: DatabaseConfig): Pool {
  return mysql.createPool({
    host: config.host,
    port: config.port,
    database: config.name,
    user: config.user,
    password: config.password,
    waitForConnections: true,
    connectionLimit: config.connectionLimit,
    namedPlaceholders: true,
    timezone: "Z",
  });
}
