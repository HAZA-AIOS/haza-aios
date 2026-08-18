import { createApp } from "./app.js";
import { createLogger } from "./common/logging/logger.js";
import { loadConfig } from "./config/env.js";
import { createDatabaseClient } from "./database/client.js";

const config = loadConfig();
const logger = createLogger(config);
const database = createDatabaseClient(config.database, logger);
const server = createApp(config, logger, database);

server.listen(config.port, config.host, () => {
  logger.info("api_started", {
    host: config.host,
    port: config.port,
    environment: config.nodeEnv,
    apiBasePath: config.apiBasePath,
  });
});

function shutdown(signal: NodeJS.Signals) {
  logger.info("api_shutdown_started", { signal });
  server.close(async (error) => {
    if (error) {
      logger.error("api_shutdown_failed", { signal });
      process.exitCode = 1;
    } else {
      await database.close();
      logger.info("api_shutdown_complete", { signal });
    }
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
