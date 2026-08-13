// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AgentBuilderPage } from "../builder/AgentBuilderPage";
import { AgentService } from "../../../../agents/agent-service";
import * as useOrganizationHook from "../../../../org/use-organization";

// Mock dependencies
vi.mock("../../../../routes/navigation", () => ({
  navigate: vi.fn(),
  usePathname: () => "/workspace/agents/mock-instance-1/configure"
}));

vi.mock("../../../../org/use-organization", () => ({
  useOrganization: vi.fn()
}));

// Mock the AgentService to return a predictable instance
const mockConfig = {
  version: "1.0",
  general: { description: "Test Description" },
  instructions: { systemInstructions: "", objectives: "", constraints: "", responseStyle: "" },
  behavior: { tone: "Neutral", formality: "Standard", creativity: 50, responseLength: "Medium", language: "English", communicationStyle: "Direct" },
  inputs: [],
  outputs: [],
  tools: [],
  model: { provider: "Platform Default", modelSelection: "Auto", responseQuality: "Balanced", temperature: 0.7, tokenLimits: 2048 },
  memory: { enabled: true, conversationContext: true, persistentMemory: false, organizationKnowledgeFoundation: false },
  notifications: { inApp: true, email: false, onSuccess: false, onFailure: true, requireApproval: false },
  advanced: { executionLimits: 100, timeoutSeconds: 30, retryCount: 1, loggingLevel: "Info", debugMode: false }
};

const mockInstance = {
  id: "mock-instance-1",
  organizationId: "org-1",
  agentTemplateId: "template-worksheet-creator",
  name: "Test Instance",
  status: "active",
  configuration: mockConfig,
  enabled: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const mockTemplate = {
  id: "template-worksheet-creator",
  name: "Test Template",
  description: "Test Template Desc"
};

describe("Agent Builder Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useOrganizationHook.useOrganization as any).mockReturnValue({
      organization: { id: "org-1", name: "Test Org" }
    });
    
    vi.spyOn(AgentService, "getInstance").mockResolvedValue(mockInstance as any);
    vi.spyOn(AgentService, "getTemplate").mockReturnValue(mockTemplate as any);
    vi.spyOn(AgentService, "updateConfiguration").mockResolvedValue(mockInstance as any);
  });

  it("should load the agent configuration and render the general settings", async () => {
    render(<AgentBuilderPage />);
    
    // Wait for the instance to load
    await waitFor(() => {
      expect(screen.getByText("Test Instance Configuration")).toBeDefined();
    });
    
    // Check if description is loaded in the textarea
    const descTextarea = screen.getByDisplayValue("Test Description");
    expect(descTextarea).toBeDefined();
  });

  it("should detect unsaved changes when modifying a field", async () => {
    render(<AgentBuilderPage />);
    
    await waitFor(() => {
      expect(screen.getByText("Test Instance Configuration")).toBeDefined();
    });
    
    const saveButton = screen.getByText("Save Configuration");
    expect((saveButton as HTMLButtonElement).disabled).toBe(true);
    
    const descTextarea = screen.getByDisplayValue("Test Description");
    fireEvent.change(descTextarea, { target: { value: "Updated Description" } });
    
    expect(screen.getByText("Unsaved changes")).toBeDefined();
    expect((saveButton as HTMLButtonElement).disabled).toBe(false);
  });
  
  it("should switch tabs correctly", async () => {
    render(<AgentBuilderPage />);
    
    await waitFor(() => {
      expect(screen.getByText("Test Instance Configuration")).toBeDefined();
    });
    
    const instructionsTab = screen.getByText("Instructions");
    fireEvent.click(instructionsTab);
    
    expect(screen.getByText("System Instructions")).toBeDefined();
  });
});
