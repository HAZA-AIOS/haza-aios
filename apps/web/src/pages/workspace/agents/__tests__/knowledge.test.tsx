// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AgentKnowledgePage } from "../knowledge/AgentKnowledgePage";
import { agentKnowledgeService } from "../../../../agents/knowledge-service";
import * as useOrganizationHook from "../../../../org/use-organization";

// Mock dependencies
vi.mock("../../../../routes/navigation", () => ({
  navigate: vi.fn(),
  usePathname: () => "/workspace/agents/knowledge",
}));

vi.mock("../../../../org/use-organization", () => ({
  useOrganization: vi.fn(),
}));

vi.mock("../../../../auth/use-auth", () => ({
  useAuth: () => ({
    user: { id: "user-1", displayName: "Test Teacher", email: "teacher@example.com" },
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

const mockStats = {
  collectionsCount: 2,
  sourcesCount: 5,
  embeddingProvider: {
    id: "mock-deterministic-1536",
    name: "1536-dim Unit Normalized",
    model: "haza-embed-1536",
    dimensions: 1536,
    isReal: false,
  },
};

const mockCollections = [
  {
    id: "col-1",
    name: "Cambridge IGCSE Curriculum",
    description: "Official Cambridge secondary learning objectives",
    industry: "education",
    visibility: "workspace" as const,
    documentCount: 3,
    chunkCount: 24,
  },
];

const mockSources = [
  {
    id: "src-1",
    name: "Grade 9 Chemistry Syllabus",
    description: "Acids, bases, and stoichiometry",
    type: "document" as const,
    visibility: "internal" as const,
    ingestionStatus: "ready" as const,
    fileName: "chemistry.pdf",
    fileType: "pdf",
    fileSizeBytes: 204800,
    currentVersion: 1,
    chunkCount: 8,
  },
];

const mockRetrievals = [
  {
    id: "ret-1",
    organizationId: "org-1",
    workspaceId: "ws-1",
    query: "Neutralization reactions in chemistry",
    retrievalMode: "hybrid" as const,
    matchedChunkIds: ["chk-1", "chk-2"],
    scores: { "chk-1": 0.88 },
    latencyMs: 14,
    requestedBy: "user-1",
    createdAt: new Date().toISOString(),
  },
];

describe("AgentKnowledgePage Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useOrganizationHook.useOrganization as any).mockReturnValue({
      currentOrganization: { id: "org-test", name: "Test School" },
    });

    vi.spyOn(agentKnowledgeService, "getStats").mockResolvedValue(mockStats);
    vi.spyOn(agentKnowledgeService, "listCollections").mockResolvedValue(mockCollections);
    vi.spyOn(agentKnowledgeService, "listSources").mockResolvedValue(mockSources);
    vi.spyOn(agentKnowledgeService, "listRetrievals").mockResolvedValue(mockRetrievals);
  });

  it("renders the page header and global summary metric cards", async () => {
    render(<AgentKnowledgePage />);

    expect(screen.getByText("Agent Knowledge & Context Engine")).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText("Cambridge IGCSE Curriculum")).toBeDefined();
    });

    expect(screen.getByText("Overview & Ingest")).toBeDefined();
    expect(screen.getByText("Collections (1)")).toBeDefined();
    expect(screen.getByText("Documents & Chunks (1)")).toBeDefined();
    expect(screen.getByText("Semantic Search Lab")).toBeDefined();
  });
});

