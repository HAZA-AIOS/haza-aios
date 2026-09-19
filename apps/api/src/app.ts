import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { ApiError } from "./common/errors/api-error.js";
import { sendJson } from "./common/http/json.js";
import { createLogger, type Logger } from "./common/logging/logger.js";
import type { ApiConfig } from "./config/env.js";
import { createDatabaseClient, type DatabaseClient } from "./database/client.js";
import { applyCors } from "./middleware/cors.js";
import { readJsonBody } from "./middleware/body.js";
import { createRequestContext } from "./middleware/request-context.js";
import { applySecurityHeaders } from "./middleware/security.js";
import { agentsModule } from "./modules/agents/agents.module.js";
import { authModule } from "./modules/auth/auth.module.js";
import { educationModule } from "./modules/education/education.module.js";
import { foundationModule } from "./modules/foundation/foundation.module.js";
import { healthModule } from "./modules/health/health.module.js";
import { registerModules } from "./modules/module-registry.js";
import { platformModule } from "./modules/platform/platform.module.js";
import { ApiRouter } from "./routes/router.js";

export function createApp(config: ApiConfig, logger: Logger = createLogger(config), database: DatabaseClient = createDatabaseClient(config.database, logger)) {
  const router = new ApiRouter();

  registerModules(router, [
    healthModule,
    foundationModule,
    authModule,
    platformModule,
    agentsModule,
    educationModule,
  ]);

  return createServer(async (request, response) => {
    const requestContext = createRequestContext(request, response);
    applySecurityHeaders(response);
    applyCors(request, response, config);

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? `${config.host}:${config.port}`}`);
      const apiRequest = request as IncomingMessage & { body?: unknown };
      apiRequest.body = await readJsonBody(request, config.bodyLimitBytes);
      const route = router.match(request.method, url.pathname);

      await route.handler(apiRequest, response, {
        config,
        database,
        logger,
        requestContext,
        routeParams: route.params,
        url,
      });

      logger.info("request_completed", {
        method: request.method,
        path: url.pathname,
        statusCode: response.statusCode,
        requestId: requestContext.requestId,
        durationMs: Date.now() - requestContext.startedAt,
      });
    } catch (error) {
      handleError(error, response, logger, requestContext.requestId, config.nodeEnv);
    }
  });
}

function handleError(error: unknown, response: ServerResponse, logger: Logger, requestId: string, nodeEnv: ApiConfig["nodeEnv"]) {
  const apiError = error instanceof ApiError
    ? error
    : new ApiError(500, "INTERNAL_SERVER_ERROR", "Internal server error");

  logger.error(apiError.message, {
    code: apiError.code,
    statusCode: apiError.statusCode,
    requestId,
    internalErrorCode: readInternalErrorCode(error),
    internalErrorType: error instanceof Error ? error.name : typeof error,
  });

  sendJson(response, apiError.statusCode, {
    error: {
      code: apiError.code,
      message: apiError.message,
      requestId,
      ...(nodeEnv !== "production" && apiError.details ? { details: apiError.details } : {}),
    },
  });
}

function readInternalErrorCode(error: unknown): string | undefined {
  let current = error;

  for (let depth = 0; depth < 5 && current && typeof current === "object"; depth += 1) {
    const candidate = current as { code?: unknown; errno?: unknown; cause?: unknown };

    if (typeof candidate.code === "string") {
      return candidate.code;
    }

    if (typeof candidate.errno === "number") {
      return String(candidate.errno);
    }

    current = candidate.cause;
  }

  return undefined;
}
