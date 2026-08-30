import { ApiError } from "../../../common/errors/api-error.js";
import type { DatabaseClient } from "../../../database/client.js";
import { createRepositoryContext } from "../../../database/repositories/repository-context.js";
import { OrganizationRepository } from "../repositories/organization.repository.js";
import { WorkspaceRepository } from "../repositories/workspace.repository.js";
import type { CreateWorkspaceInput, UpdateWorkspaceInput, WorkspaceRecord } from "../platform.types.js";

export class WorkspaceService {
  constructor(private readonly database: DatabaseClient) {}

  async createWorkspace(input: CreateWorkspaceInput): Promise<WorkspaceRecord> {
    await this.assertOrganization(input.organizationId);
    return new WorkspaceRepository(createRepositoryContext(this.database.db)).create(input);
  }

  async listWorkspaces(organizationId: string): Promise<WorkspaceRecord[]> {
    await this.assertOrganization(organizationId);
    return new WorkspaceRepository(createRepositoryContext(this.database.db)).listByOrganization(organizationId);
  }

  async getWorkspace(organizationId: string, workspaceId: string): Promise<WorkspaceRecord> {
    await this.assertOrganization(organizationId);
    const workspace = await new WorkspaceRepository(createRepositoryContext(this.database.db)).getByIdForOrganization(organizationId, workspaceId);
    if (!workspace) throw new ApiError(404, "NOT_FOUND", "Workspace not found for organization.");
    return workspace;
  }

  async updateWorkspace(organizationId: string, workspaceId: string, input: UpdateWorkspaceInput): Promise<WorkspaceRecord> {
    await this.getWorkspace(organizationId, workspaceId);
    const workspace = await new WorkspaceRepository(createRepositoryContext(this.database.db)).updateForOrganization(organizationId, workspaceId, input);
    if (!workspace) throw new ApiError(404, "NOT_FOUND", "Workspace not found for organization.");
    return workspace;
  }

  private async assertOrganization(organizationId: string): Promise<void> {
    const organization = await new OrganizationRepository(createRepositoryContext(this.database.db)).getById(organizationId);
    if (!organization) throw new ApiError(404, "NOT_FOUND", "Organization not found.");
  }
}
