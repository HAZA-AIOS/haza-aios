// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { WorkspaceDiscoverPage } from "../WorkspaceDiscoverPage";
import * as useOrganizationHook from "../../../../org/use-organization";

// Mock dependencies
vi.mock("../../../../routes/navigation", () => ({
  navigate: vi.fn(),
  usePathname: () => "/workspace/agents/discover"
}));

vi.mock("../../../../org/use-organization", () => ({
  useOrganization: vi.fn()
}));

vi.mock("../../../../auth/use-auth", () => ({
  useAuth: () => ({
    user: { id: "user-1", displayName: "Test User", email: "test@example.com" },
    status: "authenticated",
    logout: vi.fn()
  })
}));

// Quick mock for UI components that might cause issues in JSDOM
vi.mock("@haza-aios/ui/components/agent-marketplace-primitives", () => ({
  AgentSearch: ({ onChange }: { onChange: (value: string) => void }) => (
    <input data-testid="search-input" onChange={(e) => onChange(e.target.value)} />
  ),
  AgentFilters: ({ onSelectIndustry, onClear }: { onSelectIndustry: (value: string) => void; onClear: () => void }) => (
    <div>
      <select data-testid="industry-select" onChange={(e) => onSelectIndustry(e.target.value)}>
        <option value="All">All</option>
        <option value="Education">Education</option>
      </select>
      <button data-testid="clear-filters" onClick={onClear}>Clear</button>
    </div>
  ),
  AgentCategoryNav: ({ onSelectCategory }: { onSelectCategory: (value: string) => void }) => (
    <div data-testid="category-nav">
      <button onClick={() => onSelectCategory("Productivity")}>Productivity</button>
    </div>
  )
}));

describe("Agent Marketplace Discover Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useOrganizationHook.useOrganization).mockReturnValue({
      organization: { id: "org-1", name: "Test Org" },
      currentOrganization: { id: "org-1", name: "Test Org" },
      organizations: [{ id: "org-1", name: "Test Org" }],
      switchOrg: vi.fn()
    });
  });

  it("should render agent templates and filter by search query", async () => {
    render(<WorkspaceDiscoverPage />);
    
    // The Worksheet Creator is from our mock data
    expect(await screen.findByText("Worksheet Creator")).toBeDefined();
    
    // Test search filtering
    const searchInput = screen.getByTestId("search-input");
    fireEvent.change(searchInput, { target: { value: "Sales" } });
    
    // Worksheet Creator should be hidden, Sales Analyzer should be visible
    expect(screen.queryByText("Worksheet Creator")).toBeNull();
    expect(await screen.findByText("Sales Analyzer")).toBeDefined();
  });

  it("should filter by industry", async () => {
    render(<WorkspaceDiscoverPage />);
    
    await screen.findByText("Worksheet Creator");
    const industrySelect = screen.getByTestId("industry-select");
    fireEvent.change(industrySelect, { target: { value: "Education" } });
    
    expect(screen.getByText("Worksheet Creator")).toBeDefined();
    expect(screen.queryByText("Sales Analyzer")).toBeNull();
  });
});
