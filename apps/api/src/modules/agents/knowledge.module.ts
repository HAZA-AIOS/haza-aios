import { sendJson } from "../../common/http/json.js";
import { ApiError } from "../../common/errors/api-error.js";
import type { BackendModule } from "../module-registry.js";
import { AuthService } from "../auth/services/auth.service.js";
import type { PermissionKey } from "../auth/auth.types.js";
import { assertUuid, createTenantContext } from "../platform/tenant-context.js";
import { KnowledgeService } from "./services/knowledge.service.js";
import { readText } from "./knowledge-validation.js";

const base = "/api/v1/organizations/:organizationId/knowledge";

async function requireKnowledgeAuth(
  authService: AuthService,
  request: any,
  organizationId: string,
  allowedPermissions: PermissionKey[],
) {
  const auth = await authService.authenticateRequest(request);
  const membership = auth.memberships.find(
    (item) => item.organizationId === organizationId && item.status === "active",
  );
  if (!membership) {
    throw new ApiError(404, "NOT_FOUND", "Organization not found.");
  }
  const hasPerm = allowedPermissions.some((p) => membership.permissions.includes(p));
  if (!hasPerm) {
    throw new ApiError(403, "FORBIDDEN", "Permission denied.");
  }
  return auth;
}

export const knowledgeModule: BackendModule = {
  name: "knowledge",
  register(router) {
    // 1. Stats
    router.register({
      method: "GET",
      path: `${base}/stats`,
      async handler(request, response, { database, routeParams }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        await requireKnowledgeAuth(new AuthService(database), request, organizationId, [
          "knowledge.read",
          "agent.read",
        ]);
        const url = new URL(request.url ?? "/", "http://localhost");
        const workspaceId = url.searchParams.get("workspaceId") ?? undefined;
        sendJson(response, 200, {
          stats: await new KnowledgeService(database).getStats(organizationId, workspaceId),
        });
      },
    });

    // 2. Collections List
    router.register({
      method: "GET",
      path: `${base}/collections`,
      async handler(request, response, { database, routeParams }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        await requireKnowledgeAuth(new AuthService(database), request, organizationId, [
          "knowledge.read",
          "agent.read",
        ]);
        const url = new URL(request.url ?? "/", "http://localhost");
        const workspaceId = url.searchParams.get("workspaceId") ?? undefined;
        sendJson(response, 200, {
          collections: await new KnowledgeService(database).listCollections(organizationId, workspaceId),
        });
      },
    });

    // 3. Collections Create
    router.register({
      method: "POST",
      path: `${base}/collections`,
      async handler(request, response, { database, routeParams }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        const auth = await requireKnowledgeAuth(new AuthService(database), request, organizationId, [
          "knowledge.manage",
          "agent.manage",
        ]);
        const body = (request.body as any) || {};
        const workspaceId = body.workspaceId || "default-ws";
        sendJson(response, 201, {
          collection: await new KnowledgeService(database).createCollection(
            organizationId,
            workspaceId,
            auth.user.id,
            body,
          ),
        });
      },
    });

    // 4. Collections Get
    router.register({
      method: "GET",
      path: `${base}/collections/:collectionId`,
      async handler(request, response, { database, routeParams }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.collectionId, "collectionId");
        await requireKnowledgeAuth(new AuthService(database), request, organizationId, [
          "knowledge.read",
          "agent.read",
        ]);
        sendJson(response, 200, {
          collection: await new KnowledgeService(database).getCollection(
            organizationId,
            routeParams.collectionId,
          ),
        });
      },
    });

    // 5. Collections Update
    router.register({
      method: "PATCH",
      path: `${base}/collections/:collectionId`,
      async handler(request, response, { database, routeParams }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.collectionId, "collectionId");
        await requireKnowledgeAuth(new AuthService(database), request, organizationId, [
          "knowledge.manage",
          "agent.manage",
        ]);
        sendJson(response, 200, {
          collection: await new KnowledgeService(database).updateCollection(
            organizationId,
            routeParams.collectionId,
            (request.body as any) || {},
          ),
        });
      },
    });

    // 6. Collections Archive/Delete
    router.register({
      method: "DELETE",
      path: `${base}/collections/:collectionId`,
      async handler(request, response, { database, routeParams }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.collectionId, "collectionId");
        await requireKnowledgeAuth(new AuthService(database), request, organizationId, [
          "knowledge.manage",
          "agent.manage",
        ]);
        await new KnowledgeService(database).archiveCollection(organizationId, routeParams.collectionId);
        sendJson(response, 200, { archived: true });
      },
    });

    // 7. Document Upload & Ingestion
    router.register({
      method: "POST",
      path: `${base}/upload`,
      async handler(request, response, { database, routeParams }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        const auth = await requireKnowledgeAuth(new AuthService(database), request, organizationId, [
          "knowledge.ingest",
          "knowledge.manage",
          "agent.manage",
        ]);
        const body = (request.body as any) || {};
        const fileName = String(body.fileName || "uploaded-document.txt");
        const mimeType = body.mimeType ? String(body.mimeType) : "text/plain";
        const collectionId = body.collectionId ? String(body.collectionId) : undefined;
        const description = body.description ? String(body.description) : undefined;
        const workspaceId = String(body.workspaceId || "default-ws");

        let buffer: Buffer;
        if (body.fileBase64 && typeof body.fileBase64 === "string") {
          buffer = Buffer.from(body.fileBase64, "base64");
        } else if (typeof body.content === "string") {
          buffer = Buffer.from(body.content, "utf8");
        } else {
          throw new ApiError(400, "VALIDATION_FAILED", "Document content or fileBase64 required.");
        }

        if (buffer.length > 25 * 1024 * 1024) {
          throw new ApiError(413, "PAYLOAD_TOO_LARGE", "File size exceeds 25MB limit.");
        }

        const source = await new KnowledgeService(database).uploadAndIngestDocument(
          organizationId,
          workspaceId,
          auth.user.id,
          {
            fileName,
            mimeType,
            buffer,
            collectionId,
            description,
          },
        );

        sendJson(response, 201, { source });
      },
    });

    // 8. Hybrid Search Endpoint
    router.register({
      method: "POST",
      path: `${base}/search`,
      async handler(request, response, { database, routeParams }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        const auth = await requireKnowledgeAuth(new AuthService(database), request, organizationId, [
          "knowledge.search",
          "knowledge.retrieve",
          "agent.read",
        ]);
        const body = (request.body as any) || {};
        const query = readText(body.query, 1000);
        const limit = typeof body.limit === "number" ? Math.min(Math.max(1, body.limit), 50) : 5;
        const searchMode = body.searchMode ?? "hybrid";
        const collectionIds = Array.isArray(body.collectionIds) ? body.collectionIds.map(String) : undefined;
        const minScore = typeof body.minScore === "number" ? body.minScore : undefined;
        const workspaceId = body.workspaceId ? String(body.workspaceId) : undefined;

        const results = await new KnowledgeService(database).search(
          organizationId,
          {
            query,
            limit,
            mode: searchMode,
            collectionIds,
            minScore,
          },
          {
            workspaceId,
            userId: auth.user.id,
          },
        );

        sendJson(response, 200, results);
      },
    });

    // 9. Retrieval Audits History
    router.register({
      method: "GET",
      path: `${base}/retrievals`,
      async handler(request, response, { database, routeParams }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        await requireKnowledgeAuth(new AuthService(database), request, organizationId, [
          "knowledge.read",
          "agent.read",
        ]);
        const url = new URL(request.url ?? "/", "http://localhost");
        const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)));
        sendJson(response, 200, {
          retrievals: await new KnowledgeService(database).listRetrievals(organizationId, limit),
        });
      },
    });

    // 10. Chunks for Source
    router.register({
      method: "GET",
      path: `${base}/sources/:sourceId/chunks`,
      async handler(request, response, { database, routeParams }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.sourceId, "sourceId");
        const auth = await requireKnowledgeAuth(new AuthService(database), request, organizationId, [
          "knowledge.read",
          "agent.read",
        ]);
        sendJson(response, 200, {
          chunks: await new KnowledgeService(database).getChunks(
            organizationId,
            routeParams.sourceId,
            auth.user.id,
          ),
        });
      },
    });

    // 11. List Sources (DB-14 compatible + enhanced)
    router.register({
      method: "GET",
      path: base,
      async handler(request, response, { database, routeParams }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        const auth = await requireKnowledgeAuth(new AuthService(database), request, organizationId, [
          "knowledge.read",
          "agent.read",
        ]);
        const url = new URL(request.url ?? "/", "http://localhost");
        const collectionId = url.searchParams.get("collectionId") ?? undefined;
        const workspaceId = url.searchParams.get("workspaceId") ?? undefined;
        sendJson(response, 200, {
          sources: await new KnowledgeService(database).list(
            organizationId,
            auth.user.id,
            workspaceId,
            collectionId,
          ),
        });
      },
    });

    // 12. Create Source (DB-14 compatible)
    router.register({
      method: "POST",
      path: base,
      async handler(request, response, { database, routeParams }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        const auth = await requireKnowledgeAuth(new AuthService(database), request, organizationId, [
          "knowledge.manage",
          "agent.manage",
        ]);
        const url = new URL(request.url ?? "/", "http://localhost");
        const workspaceId = url.searchParams.get("workspaceId") ?? undefined;
        sendJson(response, 201, {
          source: await new KnowledgeService(database).create(
            organizationId,
            auth.user.id,
            request.body,
            workspaceId,
          ),
        });
      },
    });

    // 13. Get Single Source (DB-14 compatible)
    router.register({
      method: "GET",
      path: `${base}/:sourceId`,
      async handler(request, response, { database, routeParams }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.sourceId, "sourceId");
        const auth = await requireKnowledgeAuth(new AuthService(database), request, organizationId, [
          "knowledge.read",
          "agent.read",
        ]);
        sendJson(response, 200, {
          source: await new KnowledgeService(database).get(
            organizationId,
            routeParams.sourceId,
            auth.user.id,
          ),
        });
      },
    });

    // 14. Archive Source (DB-14 compatible)
    router.register({
      method: "DELETE",
      path: `${base}/:sourceId`,
      async handler(request, response, { database, routeParams }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.sourceId, "sourceId");
        const auth = await requireKnowledgeAuth(new AuthService(database), request, organizationId, [
          "knowledge.manage",
          "agent.manage",
        ]);
        await new KnowledgeService(database).archive(
          organizationId,
          routeParams.sourceId,
          auth.user.id,
        );
        sendJson(response, 200, { archived: true });
      },
    });

    // 15. Agent Retrieve (DB-14 backward compatibility)
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agents/:agentId/knowledge/search",
      async handler(request, response, { database, routeParams }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.agentId, "agentId");
        const auth = await requireKnowledgeAuth(new AuthService(database), request, organizationId, [
          "knowledge.retrieve",
          "agent.read",
        ]);
        const body = request.body as { query?: unknown; limit?: unknown } | null;
        const query = readText(body?.query, 1000);
        const limit = body?.limit ?? 5;
        if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 20)
          throw new ApiError(400, "VALIDATION_FAILED", "Limit must be between 1 and 20.");
        sendJson(response, 200, {
          results: await new KnowledgeService(database).retrieve(
            organizationId,
            routeParams.agentId,
            auth.user.id,
            query,
            limit,
          ),
        });
      },
    });
  },
};
