import { migrate } from "../src/database/mysql94-migrator.js";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import type { Server } from "node:http";
import { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { createLogger } from "../src/common/logging/logger.js";
import { loadConfig, type ApiConfig } from "../src/config/env.js";
import { createDatabaseClient, type DatabaseClient } from "../src/database/client.js";
import { sql } from "drizzle-orm";
import { createRepositoryContext } from "../src/database/repositories/repository-context.js";
import { AuthRepository } from "../src/modules/auth/repositories/auth.repository.js";

const describeDatabase = process.env.RUN_DB_INTEGRATION_TESTS === "true" ? describe : describe.skip;
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(currentDirectory, "../src/database/migrations");

const logger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

describeDatabase("Epic 12 — AI Agent Registry & Marketplace Integration", () => {
  let config: ApiConfig;
  let database: DatabaseClient;

  beforeAll(async () => {
    config = loadConfig({
      ...process.env,
      NODE_ENV: "test",
      LOG_LEVEL: "error",
    });
    database = createDatabaseClient(config.database, createLogger(config));
    await migrate(database.db, { migrationsFolder });
  }, 30_000);

  afterAll(async () => {
    await database.close();
  });

  it("verifies catalog discovery, semantic versioning, safe installation, explicit upgrade, governance workflow, and tenant isolation", async () => {
    const server = createApp(config, logger, database);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const suffix = randomUUID().slice(0, 8);

    try {
      // 1. Register Primary Tenant (Tenant A) and Secondary Tenant (Tenant B)
      const tenantA = await registerTenant(
        baseUrl,
        `epic12-owner-a-${suffix}@example.com`,
        `Epic12 Tenant A ${suffix}`,
      );
      const workspaceIdA = (await readWorkspaces(baseUrl, tenantA.organizationId, tenantA.accessToken))[0].id;

      const tenantB = await registerTenant(
        baseUrl,
        `epic12-owner-b-${suffix}@example.com`,
        `Epic12 Tenant B ${suffix}`,
      );
      const workspaceIdB = (await readWorkspaces(baseUrl, tenantB.organizationId, tenantB.accessToken))[0].id;

      // Make Tenant A user also a platform admin for review tests
      await grantPlatformAdmin(database, tenantA.userId, tenantA.organizationId);

      // Reset any upgraded platform templates from prior test runs to ensure deterministic version tests
      await database.db.execute(sql`
        DELETE FROM ai_agent_template_versions WHERE version = '2.0.0'
      `);
      await database.db.execute(sql`
        UPDATE ai_agent_templates SET latest_version = '1.0.0' WHERE publisher_type = 'platform'
      `);

      // -------------------------------------------------------------
      // TEST 1: Browse Marketplace Catalog
      // -------------------------------------------------------------
      const catalogRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/marketplace/catalog?page=1&pageSize=10`,
        { headers: { authorization: `Bearer ${tenantA.accessToken}` } },
      );
      expect(catalogRes.status).toBe(200);
      const catalogData = (await catalogRes.json()) as {
        items: Array<{
          id: string;
          name: string;
          latestVersion: string;
          publishingStatus: string;
          visibility: string;
          capabilities: any[];
        }>;
        total: number;
        page: number;
      };
      expect(catalogData.items.length).toBeGreaterThanOrEqual(1);
      const platformAgent = catalogData.items.find((i) => i.publishingStatus === "published");
      expect(platformAgent).toBeDefined();
      expect(platformAgent?.latestVersion).toBeTruthy();

      // -------------------------------------------------------------
      // TEST 2: Agent Profile & Version Listing
      // -------------------------------------------------------------
      const targetTemplateId = platformAgent!.id;
      const profileRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/marketplace/agents/${targetTemplateId}?workspaceId=${workspaceIdA}`,
        { headers: { authorization: `Bearer ${tenantA.accessToken}` } },
      );
      expect(profileRes.status).toBe(200);
      const profileData = (await profileRes.json()) as {
        profile: {
          id: string;
          name: string;
          latestVersion: string;
          versions: Array<{ version: string }>;
          installed: boolean;
        };
      };
      expect(profileData.profile.id).toBe(targetTemplateId);
      expect(profileData.profile.latestVersion).toBeTruthy();
      expect(profileData.profile.installed).toBe(false);

      // -------------------------------------------------------------
      // TEST 3: Safe Idempotent Agent Installation
      // -------------------------------------------------------------
      const installRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/marketplace/install`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tenantA.accessToken}`,
          },
          body: JSON.stringify({
            workspaceId: workspaceIdA,
            templateId: targetTemplateId,
            version: profileData.profile.latestVersion,
            name: `Installed Agent A ${suffix}`,
          }),
        },
      );
      expect(installRes.status).toBe(201);
      const installBody = (await installRes.json()) as { agent: { id: string; installedVersion: string; status: string } };
      expect(installBody.agent.id).toBeTruthy();
      expect(installBody.agent.installedVersion).toBe(profileData.profile.latestVersion);
      expect(installBody.agent.status).toBe("active");
      const installedAgentId = installBody.agent.id;

      // Verify idempotency: installing again in same workspace returns the active instance
      const duplicateInstallRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/marketplace/install`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tenantA.accessToken}`,
          },
          body: JSON.stringify({
            workspaceId: workspaceIdA,
            templateId: targetTemplateId,
          }),
        },
      );
      expect(duplicateInstallRes.status).toBe(201);
      const duplicateBody = (await duplicateInstallRes.json()) as { agent: { id: string } };
      expect(duplicateBody.agent.id).toBe(installedAgentId);

      // Verify installed agents listing
      const installedListRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/marketplace/installed`,
        { headers: { authorization: `Bearer ${tenantA.accessToken}` } },
      );
      expect(installedListRes.status).toBe(200);
      const installedListData = (await installedListRes.json()) as {
        installedAgents: Array<{ agentDefinitionId: string; installedVersion: string }>;
      };
      expect(installedListData.installedAgents.some((a) => a.agentDefinitionId === installedAgentId)).toBe(true);

      // -------------------------------------------------------------
      // TEST 4: Versioning & Explicit Upgrade
      // -------------------------------------------------------------
      // Seed a v2.0.0 published version for this template
      const newVersionId = randomUUID();
      await database.db.execute(sql`
        INSERT INTO ai_agent_template_versions (
          id, template_id, version, name, description,
          configuration_schema, input_schema, output_schema,
          capabilities, required_permissions, status, published_at, created_at, updated_at
        ) VALUES (
          ${newVersionId}, ${targetTemplateId}, '2.0.0', 'Upgraded Agent Template', 'Version 2.0.0 description',
          '{}', '{}', '{}', '[]', '[]', 'published', NOW(3), NOW(3), NOW(3)
        )
      `);
      await database.db.execute(sql`
        UPDATE ai_agent_templates SET latest_version = '2.0.0' WHERE id = ${targetTemplateId}
      `);

      // Verify installed agent now shows upgrade available
      const checkInstalledRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/marketplace/installed`,
        { headers: { authorization: `Bearer ${tenantA.accessToken}` } },
      );
      const checkInstalledData = (await checkInstalledRes.json()) as {
        installedAgents: Array<{ agentDefinitionId: string; installedVersion: string; isUpgradeAvailable: boolean; latestTemplateVersion: string }>;
      };
      const matchingInstalled = checkInstalledData.installedAgents.find((a) => a.agentDefinitionId === installedAgentId);
      expect(matchingInstalled?.isUpgradeAvailable).toBe(true);
      expect(matchingInstalled?.latestTemplateVersion).toBe("2.0.0");

      // Upgrade agent
      const upgradeRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/marketplace/installed/${installedAgentId}/upgrade`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tenantA.accessToken}`,
          },
          body: JSON.stringify({ targetVersion: "2.0.0" }),
        },
      );
      expect(upgradeRes.status).toBe(200);
      const upgradedBody = (await upgradeRes.json()) as { agent: { installedVersion: string } };
      expect(upgradedBody.agent.installedVersion).toBe("2.0.0");

      // -------------------------------------------------------------
      // TEST 5: Uninstall Safeguards
      // -------------------------------------------------------------
      const uninstallRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/marketplace/installed/${installedAgentId}/uninstall`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tenantA.accessToken}`,
          },
          body: JSON.stringify({ reason: "Testing decommissioning workflow" }),
        },
      );
      expect(uninstallRes.status).toBe(200);

      // Verify instance status is archived
      const verifyAgentRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/${installedAgentId}`,
        { headers: { authorization: `Bearer ${tenantA.accessToken}` } },
      );
      expect(verifyAgentRes.status).toBe(200);
      const verifyAgentBody = (await verifyAgentRes.json()) as { agent: { status: string; enabled: boolean } };
      expect(verifyAgentBody.agent.status).toBe("archived");
      expect(verifyAgentBody.agent.enabled).toBe(false);

      // -------------------------------------------------------------
      // TEST 6: Publisher Workflow & Governance State Machine
      // -------------------------------------------------------------
      // Tenant B authors a custom agent listing
      const createListingRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantB.organizationId}/marketplace/publisher/templates`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tenantB.accessToken}`,
          },
          body: JSON.stringify({
            name: `Tenant B Custom Evaluator ${suffix}`,
            slug: `tenant-b-evaluator-${suffix}`,
            category: "Analytics",
            industry: "Education",
            version: "1.0.0",
            summary: "Custom evaluation agent authored by Tenant B",
            description: "Detailed description of custom agent for testing publishing lifecycle.",
            visibility: "platform",
          }),
        },
      );
      expect(createListingRes.status).toBe(201);
      const createdListing = (await createListingRes.json()) as { template: { id: string; publishingStatus: string } };
      expect(createdListing.template.id).toBeTruthy();
      expect(createdListing.template.publishingStatus).toBe("draft");
      const customTemplateId = createdListing.template.id;

      // Submit for review
      const submitRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantB.organizationId}/marketplace/publisher/templates/${customTemplateId}/submit`,
        {
          method: "POST",
          headers: { authorization: `Bearer ${tenantB.accessToken}` },
        },
      );
      expect(submitRes.status).toBe(200);

      // Verify ordinary tenant admin (Tenant B) CANNOT approve their own submission
      const unauthorizedReviewRes = await fetch(
        `${baseUrl}/api/v1/platform/marketplace/reviews/${customTemplateId}/decision`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tenantB.accessToken}`, // Tenant B is NOT platform admin
          },
          body: JSON.stringify({ decision: "published" }),
        },
      );
      expect(unauthorizedReviewRes.status).toBe(403);

      // Verify platform admin (Tenant A user) CAN view pending reviews and approve
      const pendingReviewsRes = await fetch(`${baseUrl}/api/v1/platform/marketplace/reviews`, {
        headers: { authorization: `Bearer ${tenantA.accessToken}` },
      });
      expect(pendingReviewsRes.status).toBe(200);
      const pendingReviewsData = (await pendingReviewsRes.json()) as { submissions: Array<{ id: string }> };
      expect(pendingReviewsData.submissions.some((s) => s.id === customTemplateId)).toBe(true);

      // Platform admin approves and publishes
      const approveRes = await fetch(
        `${baseUrl}/api/v1/platform/marketplace/reviews/${customTemplateId}/decision`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tenantA.accessToken}`,
          },
          body: JSON.stringify({
            decision: "published",
            reviewNotes: "Meets all HAZA security and quality standards.",
          }),
        },
      );
      expect(approveRes.status).toBe(200);

      // Now Tenant A can discover and see this published agent in the catalog
      const updatedCatalogRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/marketplace/catalog?search=${suffix}`,
        { headers: { authorization: `Bearer ${tenantA.accessToken}` } },
      );
      const updatedCatalogData = (await updatedCatalogRes.json()) as { items: Array<{ id: string }> };
      expect(updatedCatalogData.items.some((i) => i.id === customTemplateId)).toBe(true);

      // -------------------------------------------------------------
      // TEST 7: Tenant Isolation on Private Organization Agents
      // -------------------------------------------------------------
      // Tenant B authors a private agent
      const createPrivateRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantB.organizationId}/marketplace/publisher/templates`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tenantB.accessToken}`,
          },
          body: JSON.stringify({
            name: `Tenant B Top Secret Agent ${suffix}`,
            slug: `tenant-b-secret-${suffix}`,
            category: "Operations",
            industry: "Education",
            version: "1.0.0",
            description: "Confidential proprietary agent for Tenant B only.",
            visibility: "private_organization",
          }),
        },
      );
      const privateTemplateId = ((await createPrivateRes.json()) as { template: { id: string } }).template.id;

      // Tenant A attempts to install Tenant B's private agent -> 403 FORBIDDEN
      const unauthorizedInstallRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/marketplace/install`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tenantA.accessToken}`,
          },
          body: JSON.stringify({
            workspaceId: workspaceIdA,
            templateId: privateTemplateId,
          }),
        },
      );
      expect(unauthorizedInstallRes.status).toBe(403);

      // -------------------------------------------------------------
      // TEST 8: Aggregate Analytics
      // -------------------------------------------------------------
      const analyticsRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/marketplace/analytics`,
        { headers: { authorization: `Bearer ${tenantA.accessToken}` } },
      );
      expect(analyticsRes.status).toBe(200);
      const analyticsData = (await analyticsRes.json()) as {
        analytics: {
          publishedAgentsCount: number;
          totalInstallationsCount: number;
          activeInstallationsCount: number;
          agentsByIndustry: Record<string, number>;
        };
      };
      expect(analyticsData.analytics.publishedAgentsCount).toBeGreaterThanOrEqual(1);
      expect(analyticsData.analytics.totalInstallationsCount).toBeGreaterThanOrEqual(1);
    } finally {
      try {
        await database.db.execute(sql`
          DELETE FROM ai_agent_template_versions WHERE version = '2.0.0'
        `);
        await database.db.execute(sql`
          UPDATE ai_agent_templates SET latest_version = '1.0.0' WHERE publisher_type = 'platform'
        `);
      } catch {
        // ignore teardown errors
      }
      await closeServer(server);
    }
  });
});

async function registerTenant(baseUrl: string, email: string, organizationName: string) {
  const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      firstName: "Agent",
      lastName: "Tester",
      email,
      password: "password123",
      organizationName,
      industry: "Education",
      organizationType: "School",
      country: "United States",
    }),
  });
  const body = (await response.json()) as {
    user: { id: string };
    session: { accessToken: string };
    memberships: Array<{ organizationId: string }>;
  };
  expect(response.status).toBe(201);
  return {
    userId: body.user.id,
    accessToken: body.session.accessToken,
    organizationId: body.memberships[0].organizationId,
  };
}

async function readWorkspaces(baseUrl: string, organizationId: string, accessToken: string) {
  const response = await fetch(`${baseUrl}/api/v1/organizations/${organizationId}/workspaces`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const body = (await response.json()) as { workspaces: Array<{ id: string }> };
  expect(response.status).toBe(200);
  return body.workspaces;
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  server.close();
  await once(server, "close");
}

async function grantPlatformAdmin(database: DatabaseClient, userId: string, organizationId: string) {
  const context = createRepositoryContext(database.db);
  const authRepo = new AuthRepository(context);
  const membership = await authRepo.getMembershipByOrganizationAndUser(organizationId, userId);
  if (!membership) throw new Error("Membership not found");

  const platformAdminRoleId = await authRepo.ensureRole({
    name: "Platform Administrator",
    scope: "platform",
    description: "Full platform admin",
    permissionKeys: ["platform.admin"],
  });

  await authRepo.assignRoleToMembership(membership.id, platformAdminRoleId);
}
