import { ApiError } from "../../../common/errors/api-error.js";
import type { DatabaseClient } from "../../../database/client.js";
import { createRepositoryContext } from "../../../database/repositories/repository-context.js";
import { OrganizationRepository } from "../repositories/organization.repository.js";
import { OrganizationModuleRepository } from "../repositories/organization-module.repository.js";
import { PlatformModuleRepository } from "../repositories/platform-module.repository.js";
import type { EnableModuleInput, OrganizationModuleRecord, OrganizationModuleWithCatalog, PlatformModuleRecord, UpdateModuleConfigurationInput, UpsertPlatformModuleInput } from "../platform.types.js";

const systemModules: UpsertPlatformModuleInput[] = [
  {
    key: "education-sis",
    name: "Education & SIS Suite",
    description: "Education Student Information System for academic structure, students, staff, attendance, timetable, examinations, finance, communication, portal, analytics, and reports.",
    category: "industry",
    industry: "Education",
    version: "0.1.0-alpha",
    status: "available",
    isCore: false,
    metadata: { tags: ["education", "sis", "academic"], source: "static-frontend-registry" },
  },
  {
    key: "demo-analytics",
    name: "Demo Analytics",
    description: "Non-production demonstration module for module framework telemetry.",
    category: "utility",
    industry: "Cross-Industry",
    version: "0.1.0-alpha",
    status: "available",
    isCore: false,
    metadata: { tags: ["demo", "telemetry"], source: "static-frontend-registry" },
  },
  {
    key: "healthcare-ehr",
    name: "Healthcare & Patient EHR (Framework Ready)",
    description: "Future Clinical Patient EHR capability for managing health records, appointments, and care plans.",
    category: "industry",
    industry: "Healthcare",
    version: "0.1.0-alpha",
    status: "available",
    isCore: false,
    metadata: { tags: ["healthcare", "ehr", "clinical"], source: "static-frontend-registry" },
  },
  {
    key: "corporate-hr",
    name: "Corporate HR & Operations (Framework Ready)",
    description: "Future Corporate HR capability for managing workforce directories, payroll, and performance goals.",
    category: "industry",
    industry: "Corporate",
    version: "0.1.0-alpha",
    status: "available",
    isCore: false,
    metadata: { tags: ["corporate", "hr", "operations"], source: "static-frontend-registry" },
  },
];

export class OrganizationModuleService {
  constructor(private readonly database: DatabaseClient) {}

  async listCatalog(): Promise<PlatformModuleRecord[]> {
    await this.ensureCatalog();
    return new PlatformModuleRepository(createRepositoryContext(this.database.db)).listCatalog();
  }

  async listModules(organizationId: string): Promise<OrganizationModuleWithCatalog[]> {
    await this.assertOrganization(organizationId);
    await this.ensureCatalog();
    const context = createRepositoryContext(this.database.db);
    const catalog = await new PlatformModuleRepository(context).listCatalog();
    const states = await new OrganizationModuleRepository(context).listByOrganization(organizationId);
    return catalog.map((module) => ({
      catalog: module,
      state: states.find((state) => state.moduleKey === module.key) ?? null,
    }));
  }

  async enableModule(input: EnableModuleInput): Promise<OrganizationModuleRecord> {
    await this.assertOrganization(input.organizationId);
    this.assertModuleKey(input.moduleKey);
    const module = await this.assertCatalogModule(input.moduleKey);
    if (module.status !== "available") {
      throw new ApiError(409, "VALIDATION_FAILED", "Module is not available for activation.");
    }
    return new OrganizationModuleRepository(createRepositoryContext(this.database.db)).enable(input);
  }

  async disableModule(organizationId: string, moduleKey: string): Promise<OrganizationModuleRecord> {
    await this.assertOrganization(organizationId);
    this.assertModuleKey(moduleKey);
    const catalogModule = await this.assertCatalogModule(moduleKey);
    if (catalogModule.isCore) {
      throw new ApiError(409, "VALIDATION_FAILED", "Core modules cannot be deactivated.");
    }
    const module = await new OrganizationModuleRepository(createRepositoryContext(this.database.db)).disable(organizationId, moduleKey);
    if (!module) throw new ApiError(404, "NOT_FOUND", "Organization module activation not found.");
    return module;
  }

  async updateConfiguration(input: UpdateModuleConfigurationInput): Promise<OrganizationModuleRecord> {
    await this.assertOrganization(input.organizationId);
    this.assertModuleKey(input.moduleKey);
    await this.assertCatalogModule(input.moduleKey);
    const repository = new OrganizationModuleRepository(createRepositoryContext(this.database.db));
    const existing = await repository.getByKeyForOrganization(input.organizationId, input.moduleKey);

    if (!existing) {
      return repository.enable({
        organizationId: input.organizationId,
        moduleKey: input.moduleKey,
        enabled: false,
        settings: input.settings,
        activatedBy: input.activatedBy,
      });
    }

    const module = await repository.updateSettings(input.organizationId, input.moduleKey, {
      ...(existing.settings ?? {}),
      ...input.settings,
    });
    if (!module) throw new ApiError(404, "NOT_FOUND", "Organization module activation not found.");
    return module;
  }

  async ensureCatalog(): Promise<void> {
    const repository = new PlatformModuleRepository(createRepositoryContext(this.database.db));
    for (const module of systemModules) {
      await repository.upsert(module);
    }
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

  private async assertCatalogModule(moduleKey: string): Promise<PlatformModuleRecord> {
    await this.ensureCatalog();
    const module = await new PlatformModuleRepository(createRepositoryContext(this.database.db)).getByKey(moduleKey);
    if (!module) throw new ApiError(404, "NOT_FOUND", "Platform module not found.");
    return module;
  }
}
