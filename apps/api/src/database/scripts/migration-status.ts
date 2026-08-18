import { createLogger } from "../../common/logging/logger.js";
import { loadConfig } from "../../config/env.js";
import { createDatabaseClient } from "../client.js";

type MigrationRow = {
  id: number;
  hash: string;
  created_at: number;
};

const config = loadConfig(process.env);
const logger = createLogger(config);
const database = createDatabaseClient(config.database, logger);

try {
  await database.ping();
  const [tables] = await database.db.execute("show tables like '__drizzle_migrations'");
  const tableRows = tables as unknown as unknown[];

  if (tableRows.length === 0) {
    logger.info("database_migration_status", {
      database: config.database.name,
      status: "pending",
      applied: 0,
    });
  } else {
    const [migrations] = await database.db.execute("select id, hash, created_at from __drizzle_migrations order by created_at asc");
    const applied = migrations as unknown as MigrationRow[];

    logger.info("database_migration_status", {
      database: config.database.name,
      status: "clean",
      applied: applied.length,
      latestMigrationId: applied.at(-1)?.id,
    });
  }
} finally {
  await database.close();
}
