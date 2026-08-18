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
      handler(_request, response, { config }) {
        sendJson(response, 200, {
          status: "ready",
          service: config.serviceName,
          checks: {
            config: "ok",
            database: "not_configured_db1",
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
