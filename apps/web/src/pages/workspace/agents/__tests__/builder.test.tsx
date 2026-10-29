// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AgentBuilderPage } from "../builder/AgentBuilderPage";
import { AgentBuilderApiClient } from "../../../../agents/agent-builder-service";
import * as useOrganizationHook from "../../../../org/use-organization";

// Mock dependencies
vi.mock("../../../../routes/navigation", () => ({
  navigate: vi.fn(),
  usePathname: () => "/workspace/agents/mock-agent-1/builder",
}));

vi.mock("../../../../org/use-organization", () => ({
  useOrganization: vi.fn(),
}));

vi.mock("../../../../auth/use-auth", () => ({
  useAuth: () => ({
    user: { id: "user-1", displayName: "Test User", email: "test@example.com" },
    status: "authenticated",
    logout: vi.fn(),
  }),
}));

const mockCatalog = {
  providers: [
    {
      id: "mock",
      name: "Mock Provider (Zero-Cost)",
      defaultModel: "mock-gpt-4o",
      supportedModels: ["mock-gpt-4o", "mock-claude-3-5-sonnet"],
    },
  ],
  models: [
    {
      id: "mock-gpt-4o",
      name: "GPT-4o (Simulated)",
      provider: "mock",
      contextWindow: 128000,
      maxTokens: 4096,
      recommendedFor: "General intelligence",
    },
  ],
  capabilities: [
    {
      key: "reasoning",
      name: "Chain of Thought Reasoning",
      description: "Performs step-by-step logic",
      category: "core",
      isDangerous: false,
    },
  ],
  tools: [
    {
      key: "calculator",
      name: "Calculator",
      description: "Safe math evaluator",
      category: "utilities",
      permissionRequired: "agents:read",
      riskLevel: "low",
    },
  ],
  knowledgeSources: [
    {
      id: "kb-1",
      name: "Internal Handbook",
      description: "Organization policies",
      sourceCount: 12,
    },
  ],
  approvalPolicies: [
    {
      id: "always",
      name: "Always Require Approval",
      description: "All tool invocations require signoff",
    },
    {
      id: "risk_threshold",
      name: "Risk-Based Approval",
      description: "Only high-risk tools require signoff",
    },
  ],
};

const mockFullConfig = {
  identity: {
    name: "Test Builder Agent",
    agentKey: "test-builder-agent",
    description: "Enterprise test agent description",
    category: "General",
    icon: "🤖",
    tags: ["qa", "testing"],
  },
  model: {
    provider: "mock",
    modelSelection: "mock-gpt-4o",
    temperature: 0.7,
    maxTokens: 2048,
    timeoutSeconds: 60,
  },
  instructions: {
    role: "Test Assistant",
    objectives: "Execute test suites",
    boundaryConstraints: "Never leak credentials",
    behavioralRules: "Be polite and concise",
    outputFormat: "Markdown",
    prohibitedActions: "Do not execute unverified code",
    escalationRequirements: "Escalate to admin",
    systemInstructions: "You are an automated testing agent.",
  },
  capabilities: ["reasoning"],
  tools: ["calculator"],
  knowledge: ["kb-1"],
  humanApproval: {
    policy: "risk_threshold",
    riskThreshold: "high",
    approverRoles: ["admin"],
    escalationTimeoutHours: 24,
    fallbackAction: "deny",
    sensitiveCapabilities: [],
  },
};

const mockRevision = {
  id: "rev-1",
  agentId: "mock-agent-1",
  revisionNumber: 1,
  version: "1.0.0",
  status: "published",
  configuration: mockFullConfig,
  validationStatus: "valid",
  validationSummary: { valid: true, errorCount: 0, warningCount: 0, errors: [], warnings: [] },
  changelog: "Initial creation",
  createdByName: "Admin",
  createdAt: new Date().toISOString(),
};

describe("Epic 13 - AI Agent Visual Builder Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useOrganizationHook.useOrganization as any).mockReturnValue({
      organization: { id: "org-1", name: "Test Org" },
      currentOrganization: { id: "org-1", name: "Test Org" },
      organizations: [{ id: "org-1", name: "Test Org" }],
      switchOrg: vi.fn(),
    });

    vi.spyOn(AgentBuilderApiClient, "getCatalogOptions").mockResolvedValue(mockCatalog as any);
    vi.spyOn(AgentBuilderApiClient, "getBuilderContext").mockResolvedValue({
      agent: {
        id: "mock-agent-1",
        organizationId: "org-1",
        name: "Test Builder Agent",
        agentKey: "test-builder-agent",
        description: "Enterprise test agent description",
        status: "active",
        activeRevisionId: "rev-1",
        activeRevisionNumber: 1,
      },
      activeRevision: mockRevision,
      draftRevision: null,
    } as any);

    vi.spyOn(AgentBuilderApiClient, "listRevisions").mockResolvedValue({
      items: [mockRevision],
      total: 1,
      page: 1,
      pageSize: 20,
    } as any);

    vi.spyOn(AgentBuilderApiClient, "validateConfiguration").mockResolvedValue({
      valid: true,
      errorCount: 0,
      warningCount: 0,
      errors: [],
      warnings: [],
    } as any);

    vi.spyOn(AgentBuilderApiClient, "saveDraft").mockResolvedValue({
      revision: mockRevision,
      validation: { valid: true, errorCount: 0, warningCount: 0, errors: [], warnings: [] },
    } as any);
  });

  it("should load the agent configuration and render the visual builder sections", async () => {
    render(<AgentBuilderPage />);

    // Wait for the context to load
    await waitFor(() => {
      expect(screen.getAllByText("Test Builder Agent").length).toBeGreaterThan(0);
    });

    // Check header bar details
    expect(screen.getByText(/Key: test-builder-agent/)).toBeDefined();
    expect(screen.getByText("Synchronized")).toBeDefined();

    // Check identity section fields
    const descTextarea = screen.getByDisplayValue("Enterprise test agent description");
    expect(descTextarea).toBeDefined();
  });

  it("should detect unsaved draft edits when modifying a field and allow discard", async () => {
    render(<AgentBuilderPage />);

    await waitFor(() => {
      expect(screen.getByText("Synchronized")).toBeDefined();
    });

    const descTextarea = screen.getByDisplayValue("Enterprise test agent description");
    fireEvent.change(descTextarea, { target: { value: "Updated Agent Description" } });

    // Status badge switches to Unsaved Draft Edits
    expect(screen.getByText("Unsaved Draft Edits")).toBeDefined();

    // Discard button resets value
    const discardButton = screen.getByRole("button", { name: /discard/i });
    expect(discardButton).toBeDefined();
    fireEvent.click(discardButton);

    expect(screen.getByText("Synchronized")).toBeDefined();
  });

  it("should navigate through builder tabs correctly", async () => {
    render(<AgentBuilderPage />);

    await waitFor(() => {
      expect(screen.getByText("Synchronized")).toBeDefined();
    });

    // Switch to Instructions tab
    const instructionsTab = screen.getByRole("button", { name: /3\. Instructions/i });
    fireEvent.click(instructionsTab);

    // Verify Instructions section elements
    expect(screen.getByText("Role & Persona")).toBeDefined();
    expect(screen.getByText("Boundary Constraints")).toBeDefined();
    expect(screen.getByDisplayValue("Never leak credentials")).toBeDefined();
  });

  it("should run validation and display validation tab", async () => {
    render(<AgentBuilderPage />);

    await waitFor(() => {
      expect(screen.getByText("Synchronized")).toBeDefined();
    });

    const validateButton = screen.getByRole("button", { name: /^validate$/i });
    fireEvent.click(validateButton);

    await waitFor(() => {
      expect(AgentBuilderApiClient.validateConfiguration).toHaveBeenCalled();
    });
  });
});
