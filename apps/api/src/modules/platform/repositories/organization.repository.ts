import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { organizationMemberships, organizations, organizationSettings, workspaces } from "../../../database/schema.js";
import type { RepositoryContext } from "../../../database/repositories/repository-context.js";
import type { CreateOrganizationInput, OrganizationRecord, OrganizationSettingsRecord, UpdateOrganizationInput } from "../platform.types.js";

export class OrganizationRepository {
  constructor(private readonly context: RepositoryContext) {}

  async create(input: CreateOrganizationInput): Promise<OrganizationRecord> {
    const id = randomUUID();
    const now = new Date();

    await this.context.db.insert(organizations).values({
      id,
      name: input.name,
      legalName: input.legalName ?? input.name,
      slug: input.slug ?? input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
      description: input.description,
      industry: input.industry,
      organizationType: input.organizationType,
      website: input.website,
      email: input.email,
      phone: input.phone,
      country: input.country,
      timezone: input.timezone ?? "UTC",
      currency: input.currency ?? "USD",
      ownerId: input.ownerId,
      createdAt: now,
      updatedAt: now,
    });

    const organization = await this.getById(id);
    if (!organization) throw new Error("Organization create failed.");
    return organization;
  }

  async createBootstrapRecords(input: { organizationId: string; ownerId: string; workspaceName: string; workspaceCode: string; timezone: string; currency: string }): Promise<{ membershipId: string; workspaceId: string }> {
    const now = new Date();
    const workspaceId = randomUUID();
    const membershipId = randomUUID();

    await this.context.db.insert(workspaces).values({
      id: workspaceId,
      organizationId: input.organizationId,
      name: input.workspaceName,
      code: input.workspaceCode,
      type: "primary",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    await this.context.db.insert(organizationSettings).values({
      id: randomUUID(),
      organizationId: input.organizationId,
      timezone: input.timezone,
      locale: "en",
      currency: input.currency,
      preferences: {},
      createdAt: now,
      updatedAt: now,
    });
    await this.context.db.insert(organizationMemberships).values({
      id: membershipId,
      organizationId: input.organizationId,
      userId: input.ownerId,
      role: "Owner",
      status: "active",
      joinedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return { membershipId, workspaceId };
  }

  async getById(id: string): Promise<OrganizationRecord | null> {
    const rows = await this.context.db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async getBySlug(slug: string): Promise<OrganizationRecord | null> {
    const rows = await this.context.db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
    return rows[0] ?? null;
  }

  async list(): Promise<OrganizationRecord[]> {
    return this.context.db.select().from(organizations).orderBy(desc(organizations.createdAt));
  }

  async update(id: string, input: UpdateOrganizationInput): Promise<OrganizationRecord | null> {
    await this.context.db.update(organizations).set({
      ...input,
      archivedAt: input.status === "archived" ? new Date() : undefined,
      updatedAt: new Date(),
    }).where(eq(organizations.id, id));

    return this.getById(id);
  }

  async getSettings(organizationId: string): Promise<OrganizationSettingsRecord | null> {
    const rows = await this.context.db.select().from(organizationSettings).where(eq(organizationSettings.organizationId, organizationId)).limit(1);
    return rows[0] ?? null;
  }

  async updateSettings(organizationId: string, input: Partial<Pick<OrganizationSettingsRecord, "timezone" | "locale" | "currency" | "preferences">>): Promise<OrganizationSettingsRecord | null> {
    await this.context.db.update(organizationSettings).set({
      ...input,
      updatedAt: new Date(),
    }).where(eq(organizationSettings.organizationId, organizationId));
    return this.getSettings(organizationId);
  }

  async membershipExists(organizationId: string, userId: string): Promise<boolean> {
    const rows = await this.context.db.select({ id: organizationMemberships.id }).from(organizationMemberships).where(and(
      eq(organizationMemberships.organizationId, organizationId),
      eq(organizationMemberships.userId, userId),
    )).limit(1);
    return rows.length > 0;
  }
}
