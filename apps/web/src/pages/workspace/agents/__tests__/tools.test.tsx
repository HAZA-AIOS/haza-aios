// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AgentToolsPage } from "../tools/AgentToolsPage";
import { agentToolService } from "../../../../agents/agent-tool-service";
import * as useOrganizationHook from "../../../../org/use-organization";

// Mock dependencies
vi.mock("../../../../routes/navigation", () => ({
  navigate: vi.fn(),
  usePathname: () => "/workspace/agents/tools",
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

vi.mock("../../../../admin/use-platform-admin", () => ({
  useIsSuperAdmin: () => false,
}));

vi.mock("../../../../components/AppShell", () => ({
  AppShell: ({ children }: { children: any }) => <div data-testid="app-shell">{children}</div>,
}));

const mockTools = [
  {
    toolId: "tool-1",
    toolKey: "education.academic_structure.read",
    name: "Read Academic Structure",
    description: "Retrieve academic structure",
    category: "academic_structure",
    industry: "education",
    version: "1.0.0",
    riskLevel: "low" as const,
    executionMode: "sync" as const,
    approvalPolicy: "none",
    requiredPermissions: ["education.academic.read"],
    enabled: true,
  },
  {
    toolId: "tool-2",
    toolKey: "education.lesson_plans.publish",
    name: "Publish Approved Lesson Plan",
    description: "Publish plan with LMS gating",
    category: "lesson_planning",
    industry: "education",
    version: "1.0.0",
    riskLevel: "high" as const,
    executionMode: "sync" as const,
    approvalPolicy: "always",
    requiredPermissions: ["education.lesson_plan.publish"],
    enabled: true,
  },
];

const mockExecutions = [
  {
    id: "exec-1",
    organizationId: "org-1",
    workspaceId: "ws-1",
    runId: "run-1",
    agentId: "agent-1",
    toolId: "tool-1",
    toolVersion: "1.0.0",
    toolKey: "education.academic_structure.read",
    requestedBy: "user-1",
    inputDigest: "abc123digest",
    status: "completed" as const,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: 42,
    createdAt: new Date().toISOString(),
  },
];

const mockMetrics = {
  totalInvocations: 12,
  completedCount: 10,
  failedCount: 1,
  awaitingApprovalCount: 1,
  successRate: 91,
  avgDurationMs: 85,
};

describe("AgentToolsPage UI Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(useOrganizationHook, "useOrganization").mockReturnValue({
      currentOrganization: {
        id: "org-mentor-school",
        name: "Mentor International School",
        industry: "Education",
      } as any,
      currentMembership: null,
      organizations: [],
      isLoading: false,
      error: null,
      createOrg: vi.fn(),
      switchOrg: vi.fn(),
      refresh: vi.fn(),
    });

    vi.spyOn(agentToolService, "listTools").mockResolvedValue(mockTools as any);
    vi.spyOn(agentToolService, "listExecutions").mockResolvedValue({
      executions: mockExecutions as any,
      total: 1,
    });
    vi.spyOn(agentToolService, "getMetrics").mockResolvedValue(mockMetrics);
  });

  it("renders the tools management dashboard header and catalog items", async () => {
    render(<AgentToolsPage />);

    expect(screen.getByText(/Agent Tool Registry & Gateway/i)).toBeDefined();
    expect(screen.getByText(/Epic 16/i)).toBeDefined();
    expect(screen.getByText(/Tool Catalog/i)).toBeDefined();
    expect(screen.getByText(/Execution History/i)).toBeDefined();
    expect(screen.getByText(/Tenant Policies/i)).toBeDefined();
    expect(screen.getByText(/Observability Metrics/i)).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText("Read Academic Structure")).toBeDefined();
      expect(screen.getByText("Publish Approved Lesson Plan")).toBeDefined();
    });
  });

  it("switches to Executions tab and renders execution history", async () => {
    render(<AgentToolsPage />);

    const execTab = screen.getByText(/Execution History/i);
    fireEvent.click(execTab);

    await waitFor(() => {
      expect(screen.getByText("Tool Key")).toBeDefined();
      expect(screen.getByText("education.academic_structure.read")).toBeDefined();
    });
  });

  it("switches to Observability tab and renders telemetry metrics", async () => {
    render(<AgentToolsPage />);

    const metricsTab = screen.getByText(/Observability Metrics/i);
    fireEvent.click(metricsTab);

    await waitFor(() => {
      expect(screen.getByText("Total Tool Invocations")).toBeDefined();
      expect(screen.getByText("Success Rate")).toBeDefined();
      expect(screen.getByText("Average Latency")).toBeDefined();
      expect(screen.getByText("91%")).toBeDefined();
    });
  });
});
