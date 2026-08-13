import React, { useEffect, useState } from "react";
import { navigate, usePathname } from "../../../routes/navigation";
import { useOrganization } from "../../../org/use-organization";
import { AgentService } from "../../../agents/agent-service";
import type { AgentInstance, AgentTemplate } from "../../../agents/agent.types";
import { Button } from "@haza-aios/ui/components/button";
import { AgentBadge, AgentStatus, AgentCapabilityList } from "@haza-aios/ui/components/agent-primitives";

export const AgentDetailsPage: React.FC = () => {
  const pathname = usePathname();
  const id = pathname.replace("/workspace/agents/", "");
  const { organization } = useOrganization();
  const [instance, setInstance] = useState<AgentInstance | null>(null);
  const [template, setTemplate] = useState<AgentTemplate | null>(null);

  useEffect(() => {
    if (!organization || !id) return;
    AgentService.getInstance(id, organization.id).then(inst => {
      if (inst) {
        setInstance(inst);
        const tpl = AgentService.getTemplate(inst.agentTemplateId);
        setTemplate(tpl || null);
      }
    });
  }, [id, organization]);

  if (!instance || !template) return <div className="p-6">Loading agent details...</div>;

  return (
    <div className="space-y-8 p-6 max-w-4xl">
      <Button variant="ghost" onClick={() => navigate("/workspace/agents")} className="mb-4">
        &larr; Back to Agents
      </Button>
      
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="text-5xl bg-muted rounded-xl p-4 h-20 w-20 flex items-center justify-center">
            {template.icon}
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{instance.name}</h1>
            <div className="mt-2 flex items-center gap-4">
              <AgentBadge category={template.category} industry={template.industry} />
              <AgentStatus status={instance.status} />
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {instance.status === "active" ? (
            <Button variant="destructive" onClick={() => {
              AgentService.pauseInstance(instance.id, organization!.id).then(setInstance);
            }}>Pause Agent</Button>
          ) : (
            <Button onClick={() => {
              AgentService.activateAgent(organization!.id, template.id).then(setInstance);
            }}>Activate Agent</Button>
          )}
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-2">Description</h2>
            <p className="text-muted-foreground">{template.description}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">Capabilities</h2>
            <AgentCapabilityList capabilities={template.capabilities} />
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">Configuration</h2>
            <div className="bg-muted p-4 rounded-lg border">
              <p className="text-sm text-muted-foreground mb-4">
                Configuration interface goes here (schema-driven).
              </p>
              <Button variant="outline">Save Configuration</Button>
            </div>
          </section>
        </div>
        
        <div className="space-y-6">
          <div className="bg-muted p-4 rounded-lg border">
            <h3 className="font-semibold mb-2">Agent Details</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><strong>Version:</strong> {template.version}</li>
              <li><strong>Created:</strong> {new Date(instance.createdAt).toLocaleDateString()}</li>
              <li><strong>Updated:</strong> {new Date(instance.updatedAt).toLocaleDateString()}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
