import React from "react";
import { Button } from "@haza-aios/ui/components/button";
import { AgentCard } from "@haza-aios/ui/components/agent-primitives";
import { useAgentTemplates, useAgentInstances } from "../../../agents/use-agents";
import { navigate } from "../../../routes/navigation";

export const WorkspaceActiveAgentsPage: React.FC = () => {
  const { templates } = useAgentTemplates();
  const { instances, isLoading, activateAgent } = useAgentInstances();

  return (
    <div className="space-y-8 p-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Active Agents</h1>
          <p className="text-muted-foreground mt-2">
            Manage your organization's activated AI agents.
          </p>
        </div>
        <Button onClick={() => navigate("/workspace/agents/discover")}>
          Discover New Agents
        </Button>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <p className="text-muted-foreground">Loading active agents...</p>
        ) : instances.length === 0 ? (
          <div className="bg-muted p-12 text-center rounded-lg border border-dashed flex flex-col items-center justify-center">
            <p className="text-muted-foreground mb-4">You don't have any active agents yet.</p>
            <Button onClick={() => navigate("/workspace/agents/discover")}>
              Browse the Agent Marketplace
            </Button>
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
    </div>
  );
};
