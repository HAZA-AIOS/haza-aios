import { ApiError } from "../common/errors/api-error.js";
import type { RouteDefinition, RouteHandler } from "./types.js";

export class ApiRouter {
  private readonly routes: Array<RouteDefinition & { segments: string[] }> = [];

  register(route: RouteDefinition) {
    this.routes.push({ ...route, segments: toSegments(route.path) });
  }

  match(method: string | undefined, path: string): { handler: RouteHandler; params: Record<string, string> } {
    const requestMethod = (method ?? "GET").toUpperCase();
    const pathSegments = toSegments(path);

    for (const route of this.routes) {
      if (route.method.toUpperCase() !== requestMethod || route.segments.length !== pathSegments.length) {
        continue;
      }

      const params: Record<string, string> = {};
      const matches = route.segments.every((segment, index) => {
        if (segment.startsWith(":")) {
          params[segment.slice(1)] = decodeURIComponent(pathSegments[index]);
          return true;
        }

        return segment === pathSegments[index];
      });

      if (matches) {
        return { handler: route.handler, params };
      }
    }

    throw new ApiError(404, "NOT_FOUND", "API route not found");
  }
}

function toSegments(path: string): string[] {
  return path.split("/").filter(Boolean);
}
