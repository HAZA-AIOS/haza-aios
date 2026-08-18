import { createApp } from "./app.js";
import { createLogger } from "./common/logging/logger.js";
import { loadConfig } from "./config/env.js";

const config = loadConfig();
const logger = createLogger(config);
const server = createApp(config, logger);

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
  server.close((error) => {
    if (error) {
      logger.error("api_shutdown_failed", { signal });
      process.exitCode = 1;
    } else {
      logger.info("api_shutdown_complete", { signal });
    }
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
