import { ApiError } from "../../../common/errors/api-error.js";
import type { DatabaseClient } from "../../../database/client.js";
import { mapDatabaseError } from "../../../database/errors.js";
import { createRepositoryContext } from "../../../database/repositories/repository-context.js";
import { withTransaction } from "../../../database/transactions.js";
import { OrganizationRepository } from "../repositories/organization.repository.js";
import { generateSlug } from "../validation/platform-validation.js";
import type { CreateOrganizationInput, OrganizationRecord, OrganizationSettingsRecord, UpdateOrganizationInput } from "../platform.types.js";

export class OrganizationService {
  constructor(private readonly database: DatabaseClient) {}

  async createOrganization(input: CreateOrganizationInput): Promise<{ organization: OrganizationRecord; settings: OrganizationSettingsRecord }> {
    return withTransaction(this.database, async ({ tx }) => {
      const repository = new OrganizationRepository(createRepositoryContext(tx));
      const organization = await repository.create(input);
      await repository.createBootstrapRecords({
        organizationId: organization.id,
        ownerId: input.ownerId,
        workspaceName: input.workspaceName ?? `${organization.name} Workspace`,
        workspaceCode: input.workspaceCode ?? generateSlug(input.workspaceName ?? organization.name),
        timezone: organization.timezone,
        currency: organization.currency,
      });
      const settings = await repository.getSettings(organization.id);
      if (!settings) throw new Error("Organization settings bootstrap failed.");
      return { organization, settings };
    }).catch((error: unknown) => {
      const mapped = mapDatabaseError(error);
      if (mapped.code === "DATABASE_UNIQUE_CONSTRAINT") {
        throw new ApiError(409, "DATABASE_UNIQUE_CONSTRAINT", "Organization slug or owner membership already exists.");
      }
      throw error;
    });
  }

  async listOrganizations(): Promise<OrganizationRecord[]> {
    return new OrganizationRepository(createRepositoryContext(this.database.db)).list();
  }

  async getOrganization(id: string): Promise<OrganizationRecord> {
    const organization = await new OrganizationRepository(createRepositoryContext(this.database.db)).getById(id);
    if (!organization) throw new ApiError(404, "NOT_FOUND", "Organization not found.");
    return organization;
  }

  async updateOrganization(id: string, input: UpdateOrganizationInput): Promise<OrganizationRecord> {
    await this.getOrganization(id);
    const organization = await new OrganizationRepository(createRepositoryContext(this.database.db)).update(id, input);
    if (!organization) throw new ApiError(404, "NOT_FOUND", "Organization not found.");
    return organization;
  }

  async getSettings(organizationId: string): Promise<OrganizationSettingsRecord> {
    await this.getOrganization(organizationId);
    const settings = await new OrganizationRepository(createRepositoryContext(this.database.db)).getSettings(organizationId);
    if (!settings) throw new ApiError(404, "NOT_FOUND", "Organization settings not found.");
    return settings;
  }

  async updateSettings(organizationId: string, input: Partial<Pick<OrganizationSettingsRecord, "timezone" | "locale" | "currency" | "preferences">>): Promise<OrganizationSettingsRecord> {
    await this.getOrganization(organizationId);
    const settings = await new OrganizationRepository(createRepositoryContext(this.database.db)).updateSettings(organizationId, input);
    if (!settings) throw new ApiError(404, "NOT_FOUND", "Organization settings not found.");
    return settings;
  }
}
