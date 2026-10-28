import { describe, it, expect, beforeEach } from "vitest";
import { AgentServiceClass } from "../agent-service";
import { AgentRegistry } from "../agent-registry";
import type { AgentTemplate } from "../agent.types";

const mockTemplate: AgentTemplate = {
  id: "test-agent-1",
  name: "Test Agent",
  slug: "test-agent",
  description: "A test agent",
  version: "1.0.0",
  category: "Productivity",
  industry: "general",
  status: "available",
  icon: "🤖",
  capabilities: [],
  requiredPermissions: [],
  configurationSchema: {},
  inputSchema: {},
  outputSchema: {},
  tools: [],
  metadata: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

describe("AgentService", () => {
  let service: AgentServiceClass;

  beforeEach(() => {
    localStorage.clear();
    AgentRegistry.clear();
    AgentRegistry.register(mockTemplate);
    service = new AgentServiceClass();
  });

  it("should activate an agent template into an instance", async () => {
    const orgId = "org-1";
    const instance = await service.activateAgent(orgId, "test-agent-1");
    
    expect(instance.organizationId).toBe(orgId);
    expect(instance.agentTemplateId).toBe("test-agent-1");
    expect(instance.status).toBe("active");
  });

  it("should enforce organization isolation on instances", async () => {
    await service.activateAgent("org-1", "test-agent-1");
    
    const org1Instances = await service.getInstances("org-1");
    const org2Instances = await service.getInstances("org-2");

    expect(org1Instances.length).toBe(1);
    expect(org2Instances.length).toBe(0);
  });

  it("should support suspend, resume, and archive lifecycle transitions", async () => {
    const orgId = "org-1";
    const instance = await service.activateAgent(orgId, "test-agent-1");

    // Suspend
    const suspended = await service.suspendInstance(instance.id, orgId);
    expect(suspended.status).toBe("suspended");
    expect(suspended.enabled).toBe(false);

    // Resume
    const resumed = await service.resumeInstance(instance.id, orgId);
    expect(resumed.status).toBe("active");
    expect(resumed.enabled).toBe(true);

    // Archive
    const archived = await service.archiveInstance(instance.id, orgId);
    expect(archived.status).toBe("archived");
    expect(archived.enabled).toBe(false);
  });

  it("should filter instances by status and search term", async () => {
    const orgId = "org-1";
    const inst = await service.activateAgent(orgId, "test-agent-1");
    await service.suspendInstance(inst.id, orgId);

    const activeList = await service.getInstances(orgId, { status: "active" });
    expect(activeList.length).toBe(0);

    const suspendedList = await service.getInstances(orgId, { status: "suspended" });
    expect(suspendedList.length).toBe(1);

    const matchedSearch = await service.getInstances(orgId, { search: "Test" });
    expect(matchedSearch.length).toBe(1);

    const unmatchedSearch = await service.getInstances(orgId, { search: "NonExistent" });
    expect(unmatchedSearch.length).toBe(0);
  });

  it("should return AI providers and model catalogs", async () => {
    const providers = await service.getProviders("org-1");
    expect(providers.length).toBeGreaterThan(0);
    const mock = providers.find((p) => p.id === "mock");
    expect(mock).toBeDefined();
    expect(mock?.models.some((m) => m.id === "mock-gpt-4o")).toBe(true);
  });
});
