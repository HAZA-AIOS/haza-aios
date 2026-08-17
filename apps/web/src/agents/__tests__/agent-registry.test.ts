import { describe, it, expect, beforeEach } from "vitest";
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

describe("AgentRegistry", () => {
  beforeEach(() => {
    AgentRegistry.clear();
  });

  it("should register and retrieve an agent template", () => {
    AgentRegistry.register(mockTemplate);
    const retrieved = AgentRegistry.get("test-agent-1");
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe("Test Agent");
  });

  it("should filter templates by category and industry", () => {
    AgentRegistry.register(mockTemplate);
    AgentRegistry.register({
      ...mockTemplate,
      id: "test-agent-2",
      category: "Education",
      industry: "education"
    });

    const eduAgents = AgentRegistry.getByIndustry("education");
    expect(eduAgents.length).toBe(1);
    expect(eduAgents[0].id).toBe("test-agent-2");

    const prodAgents = AgentRegistry.getByCategory("Productivity");
    expect(prodAgents.length).toBe(1);
    expect(prodAgents[0].id).toBe("test-agent-1");
  });
});
