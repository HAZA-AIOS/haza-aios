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

const describeDatabase = process.env.RUN_DB_INTEGRATION_TESTS === "true" ? describe : describe.skip;
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(currentDirectory, "../src/database/migrations");

const logger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

describeDatabase("Epic 13 — AI Agent Configuration & Builder Integration", () => {
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

  it("verifies builder options, custom creation, draft saving, validation rules, publishing, versioning, restore, diffing, mock preview, and multi-tenant isolation", async () => {
    const server = createApp(config, logger, database);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const suffix = randomUUID().slice(0, 8);

    try {
      // 1. Setup Tenant A
      const tenantA = await registerTenant(
        baseUrl,
        `epic13-owner-${suffix}@example.com`,
        `Epic13 Org ${suffix}`,
      );
      const workspacesA = await readWorkspaces(baseUrl, tenantA.organizationId, tenantA.accessToken);
      const workspaceIdA = workspacesA[0].id;

      // Setup Tenant B (for multi-tenant isolation verification)
      const tenantB = await registerTenant(
        baseUrl,
        `epic13-other-${suffix}@example.com`,
        `Epic13 Foreign Org ${suffix}`,
      );

      // 2. Discover Catalog Options
      const catalogRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/builder/catalog-options`,
        { headers: { authorization: `Bearer ${tenantA.accessToken}` } },
      );
      expect(catalogRes.status).toBe(200);
      const catalogData = (await catalogRes.json()) as {
        catalogOptions: {
          providers: Array<{ id: string; name: string }>;
          models: Array<{ id: string; name: string; provider: string }>;
          capabilities: Array<{ key: string; name: string; riskLevel: string }>;
          tools: Array<{ toolKey: string; name: string; riskLevel: string }>;
          knowledgeSources: Array<{ id: string }>;
        };
      };
      expect(catalogData.catalogOptions.providers.some((p) => p.id === "mock")).toBe(true);
      expect(catalogData.catalogOptions.models.length).toBeGreaterThan(0);
      expect(catalogData.catalogOptions.capabilities.length).toBeGreaterThan(0);
      expect(catalogData.catalogOptions.tools.some((t) => t.toolKey === "web_search")).toBe(true);

      // 3. Test Validation Engine Endpoint Directly
      // 3a. Valid Configuration
      const validConfig = {
        identity: {
          name: `Custom Agent ${suffix}`,
          agentKey: `custom_agent_${suffix}`,
          description: "Enterprise assistant for custom testing",
          category: "General",
        },
        model: {
          provider: "mock",
          modelSelection: "mock-gpt-4o",
          temperature: 0.7,
          maxTokens: 2048,
          timeoutSeconds: 60,
        },
        instructions: {
          role: "Enterprise Quality Auditor",
          objectives: "Review incoming documents and evaluate compliance.",
          boundaryConstraints: "Never disclose unverified internal policies.",
          behavioralRules: "Be polite, concise, and structured.",
          outputFormat: "Markdown",
          prohibitedActions: "Do not execute unapproved destructive tasks.",
          escalationRequirements: "Escalate compliance failures to compliance officer.",
          systemInstructions: "",
        },
        capabilities: [
          {
            key: "analyze",
            name: "Compliance Analysis",
            description: "Analyze compliance metrics",
            riskLevel: "low",
            requiresApproval: false,
          },
        ],
        tools: [
          {
            toolKey: "document_parser",
            name: "Document Parser",
            description: "Parse documents",
            category: "Data Processing",
            riskLevel: "low",
            requiresApproval: false,
            permissions: ["tool.document.parse"],
          },
        ],
        knowledge: [],
        humanApproval: {
          policy: "never",
          approverRoles: ["admin"],
          escalationTimeoutHours: 24,
          fallbackAction: "deny",
          sensitiveCapabilities: [],
        },
      };

      const valOkRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/00000000-0000-0000-0000-000000000000/builder/validate`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tenantA.accessToken}`,
          },
          body: JSON.stringify({ configuration: validConfig }),
        },
      );
      expect(valOkRes.status).toBe(200);
      const valOkData = (await valOkRes.json()) as { valid: boolean; errors: unknown[] };
      expect(valOkData.valid).toBe(true);
      expect(valOkData.errors.length).toBe(0);

      // 3b. Secret Key Rejection Test
      const secretConfig = JSON.parse(JSON.stringify(validConfig));
      secretConfig.model.apiKey = "sk-ant-live-secret-12345";
      const valSecretRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/00000000-0000-0000-0000-000000000000/builder/validate`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tenantA.accessToken}`,
          },
          body: JSON.stringify({ configuration: secretConfig }),
        },
      );
      expect(valSecretRes.status).toBe(200);
      const valSecretData = (await valSecretRes.json()) as { valid: boolean; errors: Array<{ field: string; message: string }> };
      expect(valSecretData.valid).toBe(false);
      expect(valSecretData.errors.some((e) => e.message.includes("Provider secrets detected"))).toBe(true);

      // 3c. High Risk Capability Approval Policy Constraint
      const highRiskConfig = JSON.parse(JSON.stringify(validConfig));
      highRiskConfig.capabilities.push({
        key: "execute_action",
        name: "Action Execution",
        description: "Executes state modification",
        riskLevel: "high",
        requiresApproval: true,
      });
      highRiskConfig.humanApproval.policy = "never"; // Forbidden for high-risk
      const valHighRiskRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/00000000-0000-0000-0000-000000000000/builder/validate`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tenantA.accessToken}`,
          },
          body: JSON.stringify({ configuration: highRiskConfig }),
        },
      );
      expect(valHighRiskRes.status).toBe(200);
      const valHighRiskData = (await valHighRiskRes.json()) as { valid: boolean; errors: Array<{ message: string }> };
      expect(valHighRiskData.valid).toBe(false);
      expect(valHighRiskData.errors.some((e) => e.message.includes("Human approval cannot be disabled"))).toBe(true);

      // 3d. Cross-Tenant Knowledge Source Isolation Check
      const crossTenantConfig = JSON.parse(JSON.stringify(validConfig));
      crossTenantConfig.knowledge.push({
        sourceId: "00000000-0000-0000-0000-999999999999", // Unowned/foreign source
        enabled: true,
      });
      const valCrossRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/00000000-0000-0000-0000-000000000000/builder/validate`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tenantA.accessToken}`,
          },
          body: JSON.stringify({ configuration: crossTenantConfig }),
        },
      );
      expect(valCrossRes.status).toBe(200);
      const valCrossData = (await valCrossRes.json()) as { valid: boolean; errors: Array<{ message: string }> };
      expect(valCrossData.valid).toBe(false);
      expect(valCrossData.errors.some((e) => e.message.includes("does not belong to your organization"))).toBe(true);

      // 4. Create New Custom Agent via Builder
      const createRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/builder/new`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tenantA.accessToken}`,
          },
          body: JSON.stringify({
            workspaceId: workspaceIdA,
            configuration: validConfig,
          }),
        },
      );
      expect(createRes.status).toBe(201);
      const createData = (await createRes.json()) as {
        agent: { id: string; name: string; agentKey: string; status: string };
        revision: { id: string; revisionNumber: number; status: string };
      };
      const agentId = createData.agent.id;
      expect(agentId).toBeDefined();
      expect(createData.revision.revisionNumber).toBe(1);
      expect(createData.revision.status).toBe("draft");

      // 5. Load Builder Context
      const builderContextRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/${agentId}/builder`,
        { headers: { authorization: `Bearer ${tenantA.accessToken}` } },
      );
      expect(builderContextRes.status).toBe(200);
      const builderContext = (await builderContextRes.json()) as {
        agent: { id: string; name: string };
        draftRevision: { id: string; status: string; revisionNumber: number };
        catalogOptions: unknown;
      };
      expect(builderContext.agent.id).toBe(agentId);
      expect(builderContext.draftRevision).toBeDefined();

      // 6. Save Draft Revision with Edits
      const draftUpdateConfig = JSON.parse(JSON.stringify(validConfig));
      draftUpdateConfig.instructions.objectives = "Updated objectives: strict quarterly compliance audit.";
      draftUpdateConfig.tools.push({
        toolKey: "web_search",
        name: "Web Search",
        description: "Search web",
        category: "Information",
        riskLevel: "low",
        requiresApproval: false,
        permissions: ["tool.search.web"],
      });

      const draftSaveRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/${agentId}/builder/draft`,
        {
          method: "PUT",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tenantA.accessToken}`,
          },
          body: JSON.stringify({
            configuration: draftUpdateConfig,
            version: "1.1.0-draft",
            changelog: "Added web search tool and clarified objectives",
          }),
        },
      );
      expect(draftSaveRes.status).toBe(200);
      const draftSaveData = (await draftSaveRes.json()) as {
        revision: { id: string; version: string; changelog: string };
        validation: { valid: boolean };
      };
      expect(draftSaveData.validation.valid).toBe(true);
      expect(draftSaveData.revision.version).toBe("1.1.0-draft");

      // 7. Test Safe Mock Preview Endpoint
      const previewRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/${agentId}/builder/preview`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tenantA.accessToken}`,
          },
          body: JSON.stringify({
            testPrompt: "Can you analyze whether our current attendance records comply with state standards?",
            configuration: draftUpdateConfig,
          }),
        },
      );
      expect(previewRes.status).toBe(200);
      const previewData = (await previewRes.json()) as {
        preview: {
          simulated: boolean;
          provider: string;
          content: string;
          latencyMs: number;
          validationWarnings: string[];
        };
      };
      expect(previewData.preview.simulated).toBe(true);
      expect(previewData.preview.provider).toBe("mock");
      expect(previewData.preview.content.length).toBeGreaterThan(0);
      expect(previewData.preview.validationWarnings[0]).toContain("SIMULATED EXECUTION");

      // 8. Publish Draft Revision
      const publishRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/${agentId}/builder/publish`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tenantA.accessToken}`,
          },
          body: JSON.stringify({
            version: "1.1.0",
            changelog: "Initial production release of compliance agent",
          }),
        },
      );
      expect(publishRes.status).toBe(200);
      const publishData = (await publishRes.json()) as {
        revision: { id: string; status: string; version: string; revisionNumber: number };
        agent: { id: string; instructions: string; tools: Array<{ toolKey: string }> };
      };
      const rev1Id = publishData.revision.id;
      expect(publishData.revision.status).toBe("published");
      expect(publishData.revision.version).toBe("1.1.0");
      expect(publishData.agent.instructions).toContain("ROLE & PERSONA");
      expect(publishData.agent.tools.some((t) => t.toolKey === "web_search")).toBe(true);

      // 9. Save and Publish a Second Revision (Revision 2) to test history and rollback
      const rev2Config = JSON.parse(JSON.stringify(draftUpdateConfig));
      rev2Config.model.temperature = 0.2;
      rev2Config.instructions.behavioralRules = "Strict and formal tone only.";

      await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/${agentId}/builder/draft`,
        {
          method: "PUT",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tenantA.accessToken}`,
          },
          body: JSON.stringify({
            configuration: rev2Config,
            version: "1.2.0-draft",
            changelog: "Lowered temperature to 0.2 for strict determinism",
          }),
        },
      );

      const pub2Res = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/${agentId}/builder/publish`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tenantA.accessToken}`,
          },
          body: JSON.stringify({
            version: "1.2.0",
            changelog: "Released deterministic compliance policy",
          }),
        },
      );
      expect(pub2Res.status).toBe(200);
      const pub2Data = (await pub2Res.json()) as { revision: { id: string; revisionNumber: number } };
      const rev2Id = pub2Data.revision.id;
      expect(pub2Data.revision.revisionNumber).toBe(2);

      // 10. List Revisions History
      const revsListRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/${agentId}/builder/revisions`,
        { headers: { authorization: `Bearer ${tenantA.accessToken}` } },
      );
      expect(revsListRes.status).toBe(200);
      const revsListData = (await revsListRes.json()) as { items: Array<{ id: string; revisionNumber: number; status: string }>; total: number };
      expect(revsListData.total).toBeGreaterThanOrEqual(2);
      expect(revsListData.items.some((r) => r.revisionNumber === 1 && r.status === "published")).toBe(true);
      expect(revsListData.items.some((r) => r.revisionNumber === 2 && r.status === "published")).toBe(true);

      // 11. Revision Diff Comparison
      const compareRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/${agentId}/builder/revisions/compare?baseRevisionId=${rev1Id}&targetRevisionId=${rev2Id}`,
        { headers: { authorization: `Bearer ${tenantA.accessToken}` } },
      );
      expect(compareRes.status).toBe(200);
      const compareData = (await compareRes.json()) as {
        diffs: Array<{ field: string; path: string; before: unknown; after: unknown; action: string }>;
      };
      expect(compareData.diffs.some((d) => d.path === "model.temperature" && d.after === 0.2)).toBe(true);

      // 12. Restore Historical Revision into Draft
      const restoreRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/${agentId}/builder/revisions/${rev1Id}/restore`,
        {
          method: "POST",
          headers: { authorization: `Bearer ${tenantA.accessToken}` },
        },
      );
      expect(restoreRes.status).toBe(200);
      const restoreData = (await restoreRes.json()) as {
        revision: { status: string; changelog: string; configuration: { model: { temperature: number } } };
      };
      expect(restoreData.revision.status).toBe("draft");
      expect(restoreData.revision.configuration.model.temperature).toBe(0.7); // Restored from Rev 1
      expect(restoreData.revision.changelog).toContain("Restored from revision 1");

      // 13. Duplicate Configuration into New Agent
      const dupRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/${agentId}/builder/duplicate`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tenantA.accessToken}`,
          },
          body: JSON.stringify({
            workspaceId: workspaceIdA,
            newName: `Cloned Agent ${suffix}`,
            newAgentKey: `cloned_agent_${suffix}`,
          }),
        },
      );
      expect(dupRes.status).toBe(201);
      const dupData = (await dupRes.json()) as {
        agent: { id: string; name: string; agentKey: string };
        revision: { revisionNumber: number; status: string };
      };
      expect(dupData.agent.name).toBe(`Cloned Agent ${suffix}`);
      expect(dupData.agent.agentKey).toBe(`cloned_agent_${suffix}`);
      expect(dupData.revision.revisionNumber).toBe(1);

      // Duplicate Key Collision Check -> 409
      const dupConflictRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/${agentId}/builder/duplicate`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tenantA.accessToken}`,
          },
          body: JSON.stringify({
            workspaceId: workspaceIdA,
            newName: `Cloned Agent Collision ${suffix}`,
            newAgentKey: `cloned_agent_${suffix}`, // Already taken
          }),
        },
      );
      expect(dupConflictRes.status).toBe(409);

      // 14. Multi-Tenant Isolation Verification
      // Tenant B read Tenant A's builder context -> 404
      const foreignBuilder = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantB.organizationId}/agents/${agentId}/builder`,
        { headers: { authorization: `Bearer ${tenantB.accessToken}` } },
      );
      expect(foreignBuilder.status).toBe(404);

      // Tenant B save draft on Tenant A's agent -> 404
      const foreignDraft = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantB.organizationId}/agents/${agentId}/builder/draft`,
        {
          method: "PUT",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tenantB.accessToken}`,
          },
          body: JSON.stringify({ configuration: validConfig }),
        },
      );
      expect(foreignDraft.status).toBe(404);

      // Tenant B publish Tenant A's agent -> 404
      const foreignPublish = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantB.organizationId}/agents/${agentId}/builder/publish`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tenantB.accessToken}`,
          },
          body: JSON.stringify({ version: "2.0.0" }),
        },
      );
      expect(foreignPublish.status).toBe(404);

      // Tenant B list Tenant A's revisions -> 404/empty
      const foreignRevs = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantB.organizationId}/agents/${agentId}/builder/revisions`,
        { headers: { authorization: `Bearer ${tenantB.accessToken}` } },
      );
      expect(foreignRevs.status).toBe(200);
      const foreignRevsData = (await foreignRevs.json()) as { total: number };
      expect(foreignRevsData.total).toBe(0);

      // Tenant B restore Tenant A's revision -> 404
      const foreignRestore = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantB.organizationId}/agents/${agentId}/builder/revisions/${rev1Id}/restore`,
        {
          method: "POST",
          headers: { authorization: `Bearer ${tenantB.accessToken}` },
        },
      );
      expect(foreignRestore.status).toBe(404);

      // Tenant B duplicate Tenant A's agent -> 404
      const foreignDup = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantB.organizationId}/agents/${agentId}/builder/duplicate`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tenantB.accessToken}`,
          },
          body: JSON.stringify({
            workspaceId: workspaceIdA,
            newName: "Stolen Agent",
            newAgentKey: "stolen_agent",
          }),
        },
      );
      expect(foreignDup.status).toBe(404);
    } finally {
      await closeServer(server);
    }
  });
});

async function registerTenant(baseUrl: string, email: string, organizationName: string) {
  const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      firstName: "Builder",
      lastName: "Admin",
      email,
      password: "password123",
      organizationName,
      industry: "Education",
      organizationType: "School",
      country: "United States",
    }),
  });
  const body = (await response.json()) as {
    session: { accessToken: string };
    memberships: Array<{ organizationId: string }>;
  };
  expect(response.status).toBe(201);
  return { accessToken: body.session.accessToken, organizationId: body.memberships[0].organizationId };
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
