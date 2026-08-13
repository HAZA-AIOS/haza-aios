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
});
