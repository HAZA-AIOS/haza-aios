import React, { useState, useMemo } from "react";
import { Button } from "@haza-aios/ui/components/button";
import { AgentCard } from "@haza-aios/ui/components/agent-primitives";
import {
  AgentSearch,
  AgentCategoryNav,
  AgentFilters,
  VersionBadge,
  PublisherBadge,
  PublishingStatusBadge,
} from "@haza-aios/ui/components/agent-marketplace-primitives";
import { useAgentTemplates, useAgentInstances, useMarketplaceCatalog } from "../../../agents/use-agents";
import { navigate } from "../../../routes/navigation";
import { AppShell } from "../../../components/AppShell";
import { MarketplaceInstallModal } from "../marketplace/MarketplaceInstallModal";
import type { MarketplaceCatalogItem } from "../../../agents/agent.types";
import { Download, Layers, Plus, Sparkles, Loader2, CheckCircle2 } from "lucide-react";

const CATEGORIES = [
  "Productivity",
  "Content",
  "Communication",
  "Analytics",
  "Operations",
  "Education",
  "Sales",
  "Marketing",
  "Support",
  "Document",
  "Workflow",
];
const INDUSTRIES = ["General", "Education", "Healthcare", "Corporate", "Government", "Other"];
const STATUSES = ["available", "published", "coming_soon"];

export const WorkspaceDiscoverPage: React.FC = () => {
  const { templates, isLoading: isLoadingFallback } = useAgentTemplates();
  const { instances, fetchInstances } = useAgentInstances();
  const {
    catalog,
    isLoading: isLoadingCatalog,
    error: catalogError,
    fetchCatalog,
  } = useMarketplaceCatalog();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedIndustry, setSelectedIndustry] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedAgentForInstall, setSelectedAgentForInstall] = useState<MarketplaceCatalogItem | null>(null);

  // Combine live catalog items or fallback to templates
  const allItems: MarketplaceCatalogItem[] = useMemo(() => {
    if (catalog && catalog.length > 0) {
      return catalog;
    }
    return templates.map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      summary: t.summary || null,
      description: t.description,
      latestVersion: t.latestVersion || t.version || "1.0.0",
      category: t.category,
      industry: t.industry,
      icon: t.icon,
      publisherType: t.publisherType || "platform",
      publisherOrganizationId: t.publisherOrganizationId || null,
      publisherOrganizationName: null,
      visibility: t.visibility || "platform",
      publishingStatus: (t.publishingStatus || "published") as any,
      capabilities: t.capabilities || [],
      publishedAt: t.publishedAt || t.createdAt,
    }));
  }, [catalog, templates]);

  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      // Search
      const matchesSearch =
        !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.summary && item.summary.toLowerCase().includes(searchQuery.toLowerCase()));

      // Category
      const matchesCategory = activeCategory === "All" || item.category === activeCategory;

      // Industry
      const matchesIndustry =
        selectedIndustry === "All" ||
        item.industry.toLowerCase() === selectedIndustry.toLowerCase();

      // Status
      const matchesStatus =
        selectedStatus === "All" ||
        item.publishingStatus === selectedStatus ||
        (selectedStatus === "available" && item.publishingStatus === "published");

      return matchesSearch && matchesCategory && matchesIndustry && matchesStatus;
    });
  }, [allItems, searchQuery, activeCategory, selectedIndustry, selectedStatus]);

  const handleClearFilters = () => {
    setSelectedIndustry("All");
    setSelectedStatus("All");
  };

  const isLoading = isLoadingCatalog && isLoadingFallback;

  return (
    <AppShell>
      <div className="space-y-8 p-6 max-w-7xl mx-auto animate-in fade-in-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-7 w-7 text-primary" />
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                AI Agent Marketplace
              </h1>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              Discover, inspect, and install approved AI agents for your organization with strict
              tenant isolation.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => navigate("/workspace/agents/builder/new")}
              size="sm"
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
            >
              <Plus className="h-4 w-4" />
              Build Custom Agent
            </Button>
            <Button
              onClick={() => navigate("/workspace/marketplace/installed")}
              variant="outline"
              size="sm"
              className="gap-1.5"
            >
              <Layers className="h-4 w-4" />
              Installed Agents ({instances.length})
            </Button>
            <Button
              onClick={() => navigate("/workspace/marketplace/publisher")}
              variant="secondary"
              size="sm"
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Publisher Workspace
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4">
            <AgentSearch value={searchQuery} onChange={setSearchQuery} className="flex-1" />
            <AgentFilters
              industries={INDUSTRIES}
              selectedIndustry={selectedIndustry}
              onSelectIndustry={setSelectedIndustry}
              statuses={STATUSES}
              selectedStatus={selectedStatus}
              onSelectStatus={setSelectedStatus}
              onClear={handleClearFilters}
            />
          </div>

          <AgentCategoryNav
            categories={CATEGORIES}
            activeCategory={activeCategory}
            onSelectCategory={setActiveCategory}
          />
        </div>

        {/* Catalog Grid */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">
              Approved Agents ({filteredItems.length})
            </h2>
          </div>

          {isLoading ? (
            <div className="p-16 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading marketplace catalog...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="bg-card/40 p-16 text-center rounded-2xl border border-dashed border-border space-y-3">
              <p className="text-muted-foreground text-sm">No agents found matching your criteria.</p>
              <Button variant="outline" size="sm" onClick={handleClearFilters}>
                Clear All Filters
              </Button>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {filteredItems.map((item) => {
                const installedInstance = instances.find(
                  (i) => i.agentTemplateId === item.id || (i as any).templateId === item.id,
                );
                const isInstalled = Boolean(installedInstance);

                return (
                  <div
                    key={item.id}
                    onClick={() => navigate(`/workspace/marketplace/agents/${item.id}`)}
                    className="cursor-pointer group flex flex-col justify-between p-6 rounded-2xl border border-border bg-card/60 backdrop-blur-sm hover:border-primary/50 hover:bg-card/90 transition-all duration-200 shadow-sm"
                  >
                    <div className="space-y-4">
                      {/* Top Bar: Icon + Badges */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-3xl p-3 rounded-xl bg-muted/60 border border-border group-hover:scale-105 transition-transform shrink-0">
                          {item.icon || "🤖"}
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <VersionBadge version={item.latestVersion} />
                            <PublishingStatusBadge status={item.publishingStatus} />
                          </div>
                          <PublisherBadge publisherType={item.publisherType} />
                        </div>
                      </div>

                      {/* Name & Summary */}
                      <div>
                        <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                          {item.name}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                          {item.summary || item.description}
                        </p>
                      </div>

                      {/* Capabilities pill list */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {item.capabilities.slice(0, 3).map((cap: any, idx: number) => (
                          <span
                            key={cap.key || idx}
                            className="px-2 py-0.5 rounded text-[11px] font-medium bg-muted text-muted-foreground border border-border/80"
                          >
                            {cap.name || cap.key}
                          </span>
                        ))}
                        {item.capabilities.length > 3 && (
                          <span className="text-[11px] text-muted-foreground font-mono self-center">
                            +{item.capabilities.length - 3}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom Action */}
                    <div className="pt-6 border-t border-border/60 mt-4 flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground font-medium">
                        {item.category} • {item.industry}
                      </span>
                      {isInstalled ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/workspace/marketplace/agents/${item.id}`);
                          }}
                          className="h-8 text-xs gap-1 font-semibold"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                          Installed
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAgentForInstall(item);
                          }}
                          className="h-8 text-xs gap-1.5 shadow-sm"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Install
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Installation Modal */}
        <MarketplaceInstallModal
          agent={selectedAgentForInstall}
          isOpen={Boolean(selectedAgentForInstall)}
          onClose={() => setSelectedAgentForInstall(null)}
          onSuccess={() => {
            fetchInstances();
            fetchCatalog();
          }}
        />
      </div>
    </AppShell>
  );
};
