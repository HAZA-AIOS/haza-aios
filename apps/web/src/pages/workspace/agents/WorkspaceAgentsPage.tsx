import React from "react";
import { Button } from "@haza-aios/ui/components/button";
import { AgentCard } from "@haza-aios/ui/components/agent-primitives";
import { useAgentTemplates, useAgentInstances } from "../../../agents/use-agents";
import { useNavigate } from "react-router-dom";

export const WorkspaceAgentsPage: React.FC = () => {
  const { templates } = useAgentTemplates();
  const { instances, isLoading, activateAgent } = useAgentInstances();
  const navigate = useNavigate();

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Agents</h1>
        <p className="text-muted-foreground mt-2">
          Discover and manage AI agents for your organization.
        </p>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">My Active Agents</h2>
        {isLoading ? (
          <p className="text-muted-foreground">Loading active agents...</p>
        ) : instances.length === 0 ? (
          <div className="bg-muted p-8 text-center rounded-lg border border-dashed">
            <p className="text-muted-foreground mb-4">You don't have any active agents yet.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {instances.map(instance => {
              const template = templates.find(t => t.id === instance.agentTemplateId);
              return (
                <AgentCard 
                  key={instance.id}
                  name={instance.name}
                  description={template?.description || ""}
                  status={instance.status}
                  icon={template?.icon}
                  category={template?.category}
                  industry={template?.industry}
                  capabilities={template?.capabilities}
                  onClick={() => navigate(`/workspace/agents/${instance.id}`)}
                  action={
                    <Button variant="outline" className="w-full" onClick={(e) => { e.stopPropagation(); navigate(`/workspace/agents/${instance.id}`); }}>
                      Configure
                    </Button>
                  }
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-4 pt-6 border-t">
        <h2 className="text-xl font-semibold">Available Agent Templates</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {templates.map(template => {
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
                action={
                  <Button 
                    className="w-full" 
                    variant={isActive ? "secondary" : "default"}
                    disabled={isActive}
                    onClick={() => activateAgent(template.id)}
                  >
                    {isActive ? "Activated" : "Activate Agent"}
                  </Button>
                }
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
