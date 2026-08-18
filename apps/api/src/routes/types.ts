import type { IncomingMessage, ServerResponse } from "node:http";
import type { Logger } from "../common/logging/logger.js";
import type { ApiConfig } from "../config/env.js";
import type { RequestContext } from "../middleware/request-context.js";

export type ApiRequest = IncomingMessage & {
  body?: unknown;
};

export type RouteContext = {
  config: ApiConfig;
  logger: Logger;
  requestContext: RequestContext;
  url: URL;
};

export type RouteHandler = (request: ApiRequest, response: ServerResponse, context: RouteContext) => Promise<void> | void;

export type RouteDefinition = {
  method: string;
  path: string;
  handler: RouteHandler;
};
