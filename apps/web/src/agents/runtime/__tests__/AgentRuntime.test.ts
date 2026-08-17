import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Runtime } from "../AgentRuntime";
import { AgentServiceClass } from "../../agent-service";
import { ConversationService } from "../conversation/ConversationService";
import type { AgentInstance, AgentExecutionRequest } from "../../agent.types";

const mockInstance: AgentInstance = {
  id: "inst-1",
  agentTemplateId: "tpl-1",
  organizationId: "org-1",
  name: "Test Agent",
  status: "configured",
  enabled: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  configuration: {
    version: "1.0",
    general: { description: "" },
    instructions: { systemInstructions: "Be helpful", objectives: "", constraints: "", responseStyle: "" },
    behavior: { tone: "professional", formality: "high", creativity: 0.5, responseLength: "medium", language: "en", communicationStyle: "direct" },
    inputs: [],
    outputs: [],
    tools: ["web_search"],
    knowledge: [],
    model: { provider: "mock", modelSelection: "mock-1", responseQuality: "high", temperature: 0.7, tokenLimits: 1000 },
    memory: { enabled: true, conversationContext: true, persistentMemory: false, organizationKnowledgeFoundation: false },
    notifications: { inApp: false, email: false, onSuccess: false, onFailure: false, requireApproval: false },
    advanced: { executionLimits: 1, timeoutSeconds: 30, retryCount: 0, loggingLevel: "info", debugMode: false }
  }
};

describe("AgentRuntime", () => {
  let mockAgentService: any;

  beforeEach(() => {
    mockAgentService = {
      saveAgentRun: vi.fn(),
      updateAgentRun: vi.fn()
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should reject execution if agent does not belong to organization", async () => {
    const request: AgentExecutionRequest = {
      agentInstanceId: "inst-1",
      organizationId: "org-2", // different org
      input: "Hello",
      requestedBy: "user-1",
      executionMode: "manual"
    };

    await expect(Runtime.requestExecution(request, mockInstance, () => mockAgentService))
      .rejects.toThrow("AuthorizationError");
  });

  it("should reject execution if agent is inactive", async () => {
    const inactiveInstance = { ...mockInstance, status: "disabled" as any };
    const request: AgentExecutionRequest = {
      agentInstanceId: "inst-1",
      organizationId: "org-1",
      input: "Hello",
      requestedBy: "user-1",
      executionMode: "manual"
    };

    await expect(Runtime.requestExecution(request, inactiveInstance, () => mockAgentService))
      .rejects.toThrow("AgentInactiveError");
  });

  it("should create a run and save it to the database", async () => {
    const request: AgentExecutionRequest = {
      agentInstanceId: "inst-1",
      organizationId: "org-1",
      input: "Hello",
      requestedBy: "user-1",
      executionMode: "manual"
    };

    const run = await Runtime.requestExecution(request, mockInstance, () => mockAgentService);
    
    expect(run).toBeDefined();
    expect(run.status).toBe("queued");
    expect(run.input).toBe("Hello");
    expect(mockAgentService.saveAgentRun).toHaveBeenCalledWith(run);
  });

  it("should create a conversation if one is not provided", async () => {
    const request: AgentExecutionRequest = {
      agentInstanceId: "inst-1",
      organizationId: "org-1",
      input: "Hello again",
      requestedBy: "user-1",
      executionMode: "manual"
    };

    const spy = vi.spyOn(ConversationService, 'createConversation');
    const run = await Runtime.requestExecution(request, mockInstance, () => mockAgentService);
    
    expect(spy).toHaveBeenCalled();
    expect(run.metadata?.conversationId).toBeDefined();
    expect(run.metadata?.conversationId).toContain("conv_");
  });

  it("should reuse conversation if provided", async () => {
    const request: AgentExecutionRequest = {
      agentInstanceId: "inst-1",
      organizationId: "org-1",
      conversationId: "conv_existing",
      input: "Hello again",
      requestedBy: "user-1",
      executionMode: "manual"
    };

    const spy = vi.spyOn(ConversationService, 'createConversation');
    const run = await Runtime.requestExecution(request, mockInstance, () => mockAgentService);
    
    expect(spy).not.toHaveBeenCalled();
    expect(run.metadata?.conversationId).toBe("conv_existing");
  });
});
