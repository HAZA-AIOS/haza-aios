import { eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { platformModules } from "../../../database/schema.js";
import type { RepositoryContext } from "../../../database/repositories/repository-context.js";
import type { PlatformModuleRecord, UpsertPlatformModuleInput } from "../platform.types.js";

export class PlatformModuleRepository {
  constructor(private readonly context: RepositoryContext) {}

  async listCatalog(): Promise<PlatformModuleRecord[]> {
    const rows = await this.context.db.select().from(platformModules);
    return rows.map(normalizePlatformModule);
  }

  async getByKey(moduleKey: string): Promise<PlatformModuleRecord | null> {
    const rows = await this.context.db.select().from(platformModules).where(eq(platformModules.key, moduleKey)).limit(1);
    return rows[0] ? normalizePlatformModule(rows[0]) : null;
  }

  async listByKeys(moduleKeys: string[]): Promise<PlatformModuleRecord[]> {
    if (moduleKeys.length === 0) return [];
    const rows = await this.context.db.select().from(platformModules).where(inArray(platformModules.key, moduleKeys));
    return rows.map(normalizePlatformModule);
  }

  async upsert(input: UpsertPlatformModuleInput): Promise<PlatformModuleRecord> {
    const existing = await this.getByKey(input.key);
    const now = new Date();

    if (existing) {
      await this.context.db.update(platformModules).set({
        name: input.name,
        description: input.description,
        category: input.category,
        industry: input.industry,
        version: input.version,
        status: input.status,
        isCore: input.isCore,
        metadata: input.metadata,
        updatedAt: now,
      }).where(eq(platformModules.id, existing.id));

      const updated = await this.getByKey(input.key);
      if (!updated) throw new Error("Platform module catalog update failed.");
      return updated;
    }

    const id = randomUUID();
    await this.context.db.insert(platformModules).values({
      id,
      key: input.key,
      name: input.name,
      description: input.description,
      category: input.category,
      industry: input.industry,
      version: input.version,
      status: input.status,
      isCore: input.isCore,
      metadata: input.metadata,
      createdAt: now,
      updatedAt: now,
    });

    const created = await this.getByKey(input.key);
    if (!created) throw new Error("Platform module catalog create failed.");
    return created;
  }
}

function normalizePlatformModule(row: PlatformModuleRecord): PlatformModuleRecord {
  return {
    ...row,
    metadata: normalizeJsonRecord(row.metadata),
  };
}

function normalizeJsonRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return normalizeJsonRecord(parsed);
    } catch {
      return {};
    }
  }
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}
