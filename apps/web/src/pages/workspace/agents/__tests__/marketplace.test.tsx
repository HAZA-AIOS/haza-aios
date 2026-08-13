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

// Quick mock for UI components that might cause issues in JSDOM
vi.mock("@haza-aios/ui/components/agent-marketplace-primitives", () => ({
  AgentSearch: ({ onChange }: any) => (
    <input data-testid="search-input" onChange={(e) => onChange(e.target.value)} />
  ),
  AgentFilters: ({ onSelectIndustry, onSelectStatus, onClear }: any) => (
    <div>
      <select data-testid="industry-select" onChange={(e) => onSelectIndustry(e.target.value)}>
        <option value="All">All</option>
        <option value="Education">Education</option>
      </select>
      <button data-testid="clear-filters" onClick={onClear}>Clear</button>
    </div>
  ),
  AgentCategoryNav: ({ onSelectCategory }: any) => (
    <div data-testid="category-nav">
      <button onClick={() => onSelectCategory("Productivity")}>Productivity</button>
    </div>
  )
}));

describe("Agent Marketplace Discover Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useOrganizationHook.useOrganization as any).mockReturnValue({
      organization: { id: "org-1", name: "Test Org" }
    });
  });

  it("should render agent templates and filter by search query", async () => {
    render(<WorkspaceDiscoverPage />);
    
    // The Worksheet Creator is from our mock data
    expect(screen.getByText("Worksheet Creator")).toBeDefined();
    
    // Test search filtering
    const searchInput = screen.getByTestId("search-input");
    fireEvent.change(searchInput, { target: { value: "Sales" } });
    
    // Worksheet Creator should be hidden, Sales Analyzer should be visible
    expect(screen.queryByText("Worksheet Creator")).toBeNull();
    expect(screen.getByText("Sales Analyzer")).toBeDefined();
  });

  it("should filter by industry", async () => {
    render(<WorkspaceDiscoverPage />);
    
    const industrySelect = screen.getByTestId("industry-select");
    fireEvent.change(industrySelect, { target: { value: "Education" } });
    
    expect(screen.getByText("Worksheet Creator")).toBeDefined();
    expect(screen.queryByText("Sales Analyzer")).toBeNull();
  });
});
