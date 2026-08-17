import React, { useState, useMemo } from "react";
import { Button } from "@haza-aios/ui/components/button";
import { AgentCard } from "@haza-aios/ui/components/agent-primitives";
import { AgentSearch, AgentCategoryNav, AgentFilters } from "@haza-aios/ui/components/agent-marketplace-primitives";
import { useAgentTemplates, useAgentInstances } from "../../../agents/use-agents";
import { navigate } from "../../../routes/navigation";
import { AppShell } from "../../../components/AppShell";

const CATEGORIES = ["Productivity", "Content", "Communication", "Analytics", "Operations", "Education", "Sales", "Marketing", "Support", "Document", "Workflow"];
const INDUSTRIES = ["General", "Education", "Healthcare", "Corporate", "Government", "Other"];
const STATUSES = ["available", "coming_soon"];

export const WorkspaceDiscoverPage: React.FC = () => {
  const { templates } = useAgentTemplates();
  const { instances, activateAgent } = useAgentInstances();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedIndustry, setSelectedIndustry] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");

  const filteredTemplates = useMemo(() => {
    return templates.filter(template => {
      // Search
      const matchesSearch = !searchQuery || 
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        template.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Category
      const matchesCategory = activeCategory === "All" || template.category === activeCategory;
      
      // Industry
      // Support lowercase match for existing mock data "education" vs "Education"
      const matchesIndustry = selectedIndustry === "All" || 
        template.industry.toLowerCase() === selectedIndustry.toLowerCase();
      
      // Status
      const matchesStatus = selectedStatus === "All" || template.status === selectedStatus;

      return matchesSearch && matchesCategory && matchesIndustry && matchesStatus;
    });
  }, [templates, searchQuery, activeCategory, selectedIndustry, selectedStatus]);

  const handleClearFilters = () => {
    setSelectedIndustry("All");
    setSelectedStatus("All");
  };

  return (
    <AppShell>
      <div className="space-y-8 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agent Marketplace</h1>
          <p className="text-muted-foreground mt-2">
            Discover and activate specialized AI agents for your organization.
          </p>
        </div>
        <Button onClick={() => navigate("/workspace/agents/active")} variant="outline">
          Manage Active Agents
        </Button>
      </div>

      <div className="space-y-6">
        <div className="flex flex-col md:flex-row gap-4">
          <AgentSearch 
            value={searchQuery} 
            onChange={setSearchQuery} 
            className="flex-1"
          />
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

      <div className="space-y-4 pt-4">
        <h2 className="text-xl font-semibold">Available Agents ({filteredTemplates.length})</h2>
        {filteredTemplates.length === 0 ? (
          <div className="bg-muted p-12 text-center rounded-lg border border-dashed">
            <p className="text-muted-foreground">No agents found matching your criteria.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredTemplates.map(template => {
              const isActive = instances.some(i => i.agentTemplateId === template.id);
              return (
                <AgentCard 
                  key={template.id}
                  name={template.name}
                  description={template.description}
                  icon={template.icon}
                  category={template.category}
                  industry={template.industry}
                  capabilities={template.capabilities}
                  onClick={() => navigate(`/workspace/agents/${template.id}`)}
                  action={
                    <Button 
                      className="w-full" 
                      variant={isActive ? "secondary" : "default"}
                      disabled={isActive}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isActive) activateAgent(template.id);
                      }}
                    >
                      {isActive ? "Activated" : "Activate Agent"}
                    </Button>
                  }
                />
              );
            })}
          </div>
        )}
      </div>
      </div>
    </AppShell>
  );
};
