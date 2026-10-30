import { ApiError } from "../common/errors/api-error.js";
import type { RouteDefinition, RouteHandler } from "./types.js";

export class ApiRouter {
  private readonly routes: Array<RouteDefinition & { segments: string[] }> = [];

  register(route: RouteDefinition) {
    this.routes.push({ ...route, segments: toSegments(route.path) });
    this.routes.sort((a, b) => {
      const minLen = Math.min(a.segments.length, b.segments.length);
      for (let i = 0; i < minLen; i++) {
        const aParam = a.segments[i].startsWith(":");
        const bParam = b.segments[i].startsWith(":");
        if (aParam !== bParam) {
          return aParam ? 1 : -1;
        }
      }
      return b.segments.length - a.segments.length;
    });
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
