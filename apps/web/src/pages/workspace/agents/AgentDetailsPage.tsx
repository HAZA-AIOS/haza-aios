import React, { useEffect, useState } from "react";
import { navigate, usePathname } from "../../../routes/navigation";
import { useOrganization } from "../../../org/use-organization";
import { AgentService } from "../../../agents/agent-service";
import type { AgentInstance, AgentTemplate } from "../../../agents/agent.types";
import { Button } from "@haza-aios/ui/components/button";
import { AgentBadge, AgentStatus, AgentCapabilityList } from "@haza-aios/ui/components/agent-primitives";
import { useAgentInstances } from "../../../agents/use-agents";

export const AgentDetailsPage: React.FC = () => {
  const pathname = usePathname();
  const id = pathname.replace("/workspace/agents/", ""); // could be template or instance ID
  const { organization } = useOrganization();
  const { activateAgent, pauseAgent } = useAgentInstances();
  
  const [template, setTemplate] = useState<AgentTemplate | null>(null);
  const [instance, setInstance] = useState<AgentInstance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organization || !id) return;

    const load = async () => {
      setLoading(true);
      // Try resolving as template first
      const tpl = AgentService.getTemplate(id);
      if (tpl) {
        setTemplate(tpl);
        // See if there's an active instance for this template
        const instances = await AgentService.getInstances(organization.id);
        const activeInst = instances.find(i => i.agentTemplateId === tpl.id);
        setInstance(activeInst || null);
      } else {
        // Try resolving as instance
        const inst = await AgentService.getInstance(id, organization.id);
        if (inst) {
          setInstance(inst);
          const instTpl = AgentService.getTemplate(inst.agentTemplateId);
          setTemplate(instTpl || null);
        }
      }
      setLoading(false);
    };
    load();
  }, [id, organization]);

  if (loading) return <div className="p-6 text-muted-foreground">Loading agent details...</div>;
  if (!template) return <div className="p-6 text-destructive">Agent not found.</div>;

  const handleActivate = async () => {
    if (!organization) return;
    await activateAgent(template.id);
    const instances = await AgentService.getInstances(organization.id);
    const activeInst = instances.find(i => i.agentTemplateId === template.id);
    setInstance(activeInst || null);
  };

  const handlePause = async () => {
    if (!organization || !instance) return;
    await pauseAgent(instance.id);
    const inst = await AgentService.getInstance(instance.id, organization.id);
    setInstance(inst || null);
  };

  return (
    <div className="space-y-8 p-6 max-w-5xl mx-auto">
      <Button variant="ghost" onClick={() => navigate("/workspace/agents")} className="mb-4 text-muted-foreground hover:text-foreground">
        &larr; Back to Marketplace
      </Button>
      
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="text-5xl bg-muted border rounded-2xl p-4 h-24 w-24 flex items-center justify-center shadow-sm">
            {template.icon}
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{instance ? instance.name : template.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <AgentBadge category={template.category} industry={template.industry} />
              <AgentStatus status={instance ? instance.status : template.status} />
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          {instance ? (
            instance.status === "active" ? (
              <Button variant="destructive" onClick={handlePause}>Pause Agent</Button>
            ) : (
              <Button onClick={handleActivate}>Re-activate Agent</Button>
            )
          ) : (
            <Button onClick={handleActivate} size="lg">Activate Agent</Button>
          )}
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-3 pt-6 border-t">
        <div className="md:col-span-2 space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-3">About this Agent</h2>
            <p className="text-muted-foreground leading-relaxed">{template.description}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Capabilities & Features</h2>
            {template.capabilities.length > 0 ? (
              <AgentCapabilityList capabilities={template.capabilities} />
            ) : (
              <p className="text-muted-foreground text-sm">No capabilities listed.</p>
            )}
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Required Tools & Permissions</h2>
            {template.requiredPermissions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {template.requiredPermissions.map(perm => (
                  <span key={perm} className="text-xs bg-muted px-2 py-1 rounded-md border font-mono">
                    {perm}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No special permissions required.</p>
            )}
          </section>
          
          {instance && (
            <section className="bg-blue-50 dark:bg-blue-950/20 p-6 rounded-xl border border-blue-100 dark:border-blue-900">
              <h2 className="text-xl font-semibold mb-2 text-blue-900 dark:text-blue-100">Configuration</h2>
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
                This agent is currently active in your organization workspace. You can configure its parameters here.
              </p>
              <Button variant="outline" className="bg-white dark:bg-background">Open Configuration Engine</Button>
            </section>
          )}
        </div>
        
        <div className="space-y-6">
          <div className="bg-muted/50 p-5 rounded-xl border">
            <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Technical Details</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Version</span>
                <span className="font-medium">{template.version}</span>
              </li>
              <li className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Released</span>
                <span className="font-medium">{new Date(template.createdAt).toLocaleDateString()}</span>
              </li>
              <li className="flex justify-between pb-2">
                <span className="text-muted-foreground">Developer</span>
                <span className="font-medium">HAZA AIOS Platform</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
