import { ApiError } from "../../../common/errors/api-error.js";
import type { DatabaseClient } from "../../../database/client.js";
import { createRepositoryContext } from "../../../database/repositories/repository-context.js";
import { OrganizationRepository } from "../repositories/organization.repository.js";
import { OrganizationModuleRepository } from "../repositories/organization-module.repository.js";
import type { EnableModuleInput, OrganizationModuleRecord } from "../platform.types.js";

export class OrganizationModuleService {
  constructor(private readonly database: DatabaseClient) {}

  async listModules(organizationId: string): Promise<OrganizationModuleRecord[]> {
    await this.assertOrganization(organizationId);
    return new OrganizationModuleRepository(createRepositoryContext(this.database.db)).listByOrganization(organizationId);
  }

  async enableModule(input: EnableModuleInput): Promise<OrganizationModuleRecord> {
    await this.assertOrganization(input.organizationId);
    this.assertModuleKey(input.moduleKey);
    return new OrganizationModuleRepository(createRepositoryContext(this.database.db)).enable(input);
  }

  async disableModule(organizationId: string, moduleKey: string): Promise<OrganizationModuleRecord> {
    await this.assertOrganization(organizationId);
    this.assertModuleKey(moduleKey);
    const module = await new OrganizationModuleRepository(createRepositoryContext(this.database.db)).disable(organizationId, moduleKey);
    if (!module) throw new ApiError(404, "NOT_FOUND", "Organization module activation not found.");
    return module;
  }

  private async assertOrganization(organizationId: string): Promise<void> {
    const organization = await new OrganizationRepository(createRepositoryContext(this.database.db)).getById(organizationId);
    if (!organization) throw new ApiError(404, "NOT_FOUND", "Organization not found.");
  }

  private assertModuleKey(moduleKey: string): void {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(moduleKey)) {
      throw new ApiError(400, "VALIDATION_FAILED", "Request validation failed", [
        { field: "moduleKey", message: "moduleKey must contain lowercase letters, numbers, and hyphens" },
      ]);
    }
  }
}
