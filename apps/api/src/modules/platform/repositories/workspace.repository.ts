import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { workspaces } from "../../../database/schema.js";
import type { RepositoryContext } from "../../../database/repositories/repository-context.js";
import type { CreateWorkspaceInput, UpdateWorkspaceInput, WorkspaceRecord } from "../platform.types.js";

export class WorkspaceRepository {
  constructor(private readonly context: RepositoryContext) {}

  async create(input: CreateWorkspaceInput): Promise<WorkspaceRecord> {
    const id = randomUUID();
    const now = new Date();
    await this.context.db.insert(workspaces).values({
      id,
      organizationId: input.organizationId,
      name: input.name,
      code: input.code ?? input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
      type: input.type ?? "primary",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    const workspace = await this.getByIdForOrganization(input.organizationId, id);
    if (!workspace) throw new Error("Workspace create failed.");
    return workspace;
  }

  async listByOrganization(organizationId: string): Promise<WorkspaceRecord[]> {
    return this.context.db.select().from(workspaces).where(eq(workspaces.organizationId, organizationId));
  }

  async getByIdForOrganization(organizationId: string, workspaceId: string): Promise<WorkspaceRecord | null> {
    const rows = await this.context.db.select().from(workspaces).where(and(
      eq(workspaces.organizationId, organizationId),
      eq(workspaces.id, workspaceId),
    )).limit(1);
    return rows[0] ?? null;
  }

  async updateForOrganization(organizationId: string, workspaceId: string, input: UpdateWorkspaceInput): Promise<WorkspaceRecord | null> {
    await this.context.db.update(workspaces).set({
      ...input,
      archivedAt: input.status === "archived" ? new Date() : undefined,
      updatedAt: new Date(),
    }).where(and(
      eq(workspaces.organizationId, organizationId),
      eq(workspaces.id, workspaceId),
    ));

    return this.getByIdForOrganization(organizationId, workspaceId);
  }
}
