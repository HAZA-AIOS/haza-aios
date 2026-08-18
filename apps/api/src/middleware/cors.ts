import type { IncomingMessage, ServerResponse } from "node:http";
import type { ApiConfig } from "../config/env.js";

export function applyCors(request: IncomingMessage, response: ServerResponse, config: ApiConfig) {
  const origin = request.headers.origin;

  if (origin === config.webOrigin) {
    response.setHeader("access-control-allow-origin", origin);
    response.setHeader("vary", "Origin");
  }

  response.setHeader("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type,authorization,x-request-id");
  response.setHeader("access-control-expose-headers", "x-request-id");
}
