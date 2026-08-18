import { sendJson } from "../../common/http/json.js";
import type { BackendModule } from "../module-registry.js";

export const healthModule: BackendModule = {
  name: "health",
  register(router) {
    router.register({
      method: "GET",
      path: "/api/v1/health",
      handler(_request, response, { config }) {
        sendJson(response, 200, {
          status: "ok",
          service: config.serviceName,
          version: config.version,
          timestamp: new Date().toISOString(),
        });
      },
    });

    router.register({
      method: "GET",
      path: "/api/v1/readiness",
      async handler(_request, response, { config, database }) {
        let databaseStatus: "up" | "down" = "up";

        try {
          await database.ping();
        } catch {
          databaseStatus = "down";
        }

        const isReady = databaseStatus === "up";

        sendJson(response, isReady ? 200 : 503, {
          status: isReady ? "ready" : "not_ready",
          service: config.serviceName,
          checks: {
            config: "ok",
            database: databaseStatus,
          },
          dependencies: {
            database: databaseStatus,
          },
          timestamp: new Date().toISOString(),
        });
      },
    });

    router.register({
      method: "GET",
      path: "/api/v1/liveness",
      handler(_request, response, { config }) {
        sendJson(response, 200, {
          status: "alive",
          service: config.serviceName,
          timestamp: new Date().toISOString(),
        });
      },
    });
  },
};
