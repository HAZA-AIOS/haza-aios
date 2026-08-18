import { ApiError } from "../common/errors/api-error.js";
import type { RouteDefinition, RouteHandler } from "./types.js";

export class ApiRouter {
  private readonly routes = new Map<string, RouteHandler>();

  register(route: RouteDefinition) {
    this.routes.set(routeKey(route.method, route.path), route.handler);
  }

  match(method: string | undefined, path: string): RouteHandler {
    const handler = this.routes.get(routeKey(method ?? "GET", path));

    if (!handler) {
      throw new ApiError(404, "NOT_FOUND", "API route not found");
    }

    return handler;
  }
}

function routeKey(method: string, path: string) {
  return `${method.toUpperCase()} ${path}`;
}
