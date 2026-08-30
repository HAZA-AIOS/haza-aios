import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { organizationModules } from "../../../database/schema.js";
import type { RepositoryContext } from "../../../database/repositories/repository-context.js";
import type { EnableModuleInput, OrganizationModuleRecord } from "../platform.types.js";

export class OrganizationModuleRepository {
  constructor(private readonly context: RepositoryContext) {}

  async listByOrganization(organizationId: string): Promise<OrganizationModuleRecord[]> {
    const rows = await this.context.db.select().from(organizationModules).where(eq(organizationModules.organizationId, organizationId));
    return rows.map(normalizeOrganizationModule);
  }

  async getByKeyForOrganization(organizationId: string, moduleKey: string): Promise<OrganizationModuleRecord | null> {
    const rows = await this.context.db.select().from(organizationModules).where(and(
      eq(organizationModules.organizationId, organizationId),
      eq(organizationModules.moduleKey, moduleKey),
    )).limit(1);
    return rows[0] ? normalizeOrganizationModule(rows[0]) : null;
  }

  async enable(input: EnableModuleInput): Promise<OrganizationModuleRecord> {
    const existing = await this.getByKeyForOrganization(input.organizationId, input.moduleKey);
    const now = new Date();

    if (existing) {
      await this.context.db.update(organizationModules).set({
        status: "activated",
        enabled: input.enabled ?? true,
        settings: input.settings ?? existing.settings,
        activatedAt: now,
        activatedBy: input.activatedBy,
        updatedAt: now,
      }).where(eq(organizationModules.id, existing.id));
      const updated = await this.getByKeyForOrganization(input.organizationId, input.moduleKey);
      if (!updated) throw new Error("Module activation update failed.");
      return updated;
    }

    const id = randomUUID();
    await this.context.db.insert(organizationModules).values({
      id,
      organizationId: input.organizationId,
      moduleKey: input.moduleKey,
      status: "activated",
      enabled: input.enabled ?? true,
      settings: input.settings,
      activatedAt: now,
      activatedBy: input.activatedBy,
      createdAt: now,
      updatedAt: now,
    });

    const created = await this.getByKeyForOrganization(input.organizationId, input.moduleKey);
    if (!created) throw new Error("Module activation create failed.");
    return created;
  }

  async disable(organizationId: string, moduleKey: string): Promise<OrganizationModuleRecord | null> {
    await this.context.db.update(organizationModules).set({
      status: "deactivated",
      enabled: false,
      updatedAt: new Date(),
    }).where(and(
      eq(organizationModules.organizationId, organizationId),
      eq(organizationModules.moduleKey, moduleKey),
    ));

    return this.getByKeyForOrganization(organizationId, moduleKey);
  }

  async updateSettings(organizationId: string, moduleKey: string, settings: Record<string, unknown>): Promise<OrganizationModuleRecord | null> {
    await this.context.db.update(organizationModules).set({
      settings,
      updatedAt: new Date(),
    }).where(and(
      eq(organizationModules.organizationId, organizationId),
      eq(organizationModules.moduleKey, moduleKey),
    ));

    return this.getByKeyForOrganization(organizationId, moduleKey);
  }
}

function normalizeOrganizationModule(row: OrganizationModuleRecord): OrganizationModuleRecord {
  return {
    ...row,
    settings: normalizeJsonRecord(row.settings),
  };
}

function normalizeJsonRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return normalizeJsonRecord(parsed);
    } catch {
      return null;
    }
  }
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return null;
}
