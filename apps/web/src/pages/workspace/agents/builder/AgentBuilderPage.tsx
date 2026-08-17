import React, { useEffect, useState } from "react";
import { usePathname, navigate } from "../../../../routes/navigation";
import { useOrganization } from "../../../../org/use-organization";
import { useAgentInstances } from "../../../../agents/use-agents";
import { AgentService } from "../../../../agents/agent-service";
import type { AgentInstance, AgentTemplate, AgentConfiguration } from "../../../../agents/agent.types";
import { AppShell } from "../../../../components/AppShell";
import { Button } from "@haza-aios/ui/components/button";
import { 
  BuilderContainer, 
  BuilderSidebar, 
  BuilderNavItem, 
  BuilderContent 
} from "@haza-aios/ui/components/agent-builder-primitives";
import {
  GeneralSettings,
  InstructionsEditor,
  BehaviorSettings,
  InputsConfig,
  OutputsConfig,
  ToolsConfig,
  KnowledgeConfig,
  ModelMemorySettings
} from "./AgentBuilderSections";

type Tab = "General" | "Instructions" | "Behavior" | "Inputs" | "Outputs" | "Tools" | "Knowledge" | "Model & Memory" | "Preview";

export const AgentBuilderPage: React.FC = () => {
  const pathname = usePathname();
  // Extract id from /workspace/agents/:id/configure
  const id = pathname.split("/")[3];
  
  const { currentOrganization } = useOrganization();
  const { updateConfiguration } = useAgentInstances();
  
  const [instance, setInstance] = useState<AgentInstance | null>(null);
  const [template, setTemplate] = useState<AgentTemplate | null>(null);
  const [configDraft, setConfigDraft] = useState<AgentConfiguration | null>(null);
  
  const [activeTab, setActiveTab] = useState<Tab>("General");
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!currentOrganization || !id) return;
    AgentService.getInstance(id, currentOrganization.id).then(inst => {
      if (inst) {
        setInstance(inst);
        setConfigDraft(JSON.parse(JSON.stringify(inst.configuration)));
        const tpl = AgentService.getTemplate(inst.agentTemplateId);
        setTemplate(tpl || null);
      }
    });
  }, [id, currentOrganization]);

  if (!instance || !template || !configDraft) return <AppShell><div className="p-6">Loading Builder...</div></AppShell>;

  const handleConfigChange = (updates: Partial<AgentConfiguration>) => {
    setConfigDraft(prev => {
      if (!prev) return prev;
      return { ...prev, ...updates };
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    await updateConfiguration(instance.id, configDraft);
    setHasChanges(false);
    setIsSaving(false);
  };

  const tabs: Tab[] = [
    "General", "Instructions", "Behavior", "Inputs", "Outputs", "Tools", "Knowledge", "Model & Memory", "Preview"
  ];

  return (
    <AppShell>
      <div className="flex flex-col h-[calc(100vh-64px)] w-full relative overflow-hidden">
      {/* Builder Header */}
      <div className="flex-shrink-0 flex items-center justify-between border-b px-6 py-3 bg-background">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/workspace/agents/${instance.id}`)}>
            &larr; Exit
          </Button>
          <div>
            <h1 className="font-semibold text-lg">{instance.name} Configuration</h1>
            <p className="text-xs text-muted-foreground">Based on: {template.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && <span className="text-sm text-amber-600">Unsaved changes</span>}
          <Button variant="outline" size="sm" disabled={!hasChanges} onClick={() => {
            setConfigDraft(JSON.parse(JSON.stringify(instance.configuration)));
            setHasChanges(false);
          }}>
            Discard
          </Button>
          <Button size="sm" disabled={!hasChanges || isSaving} onClick={handleSave}>
            {isSaving ? "Saving..." : "Save Configuration"}
          </Button>
        </div>
      </div>

      <BuilderContainer>
        <BuilderSidebar>
          <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Configuration</div>
          {tabs.map(tab => (
            <BuilderNavItem 
              key={tab} 
              label={tab} 
              isActive={activeTab === tab} 
              onClick={() => setActiveTab(tab)} 
            />
          ))}
        </BuilderSidebar>
        
        <BuilderContent>
          {activeTab === "General" && <GeneralSettings config={configDraft} onChange={handleConfigChange} />}
          {activeTab === "Instructions" && <InstructionsEditor config={configDraft} onChange={handleConfigChange} />}
          {activeTab === "Behavior" && <BehaviorSettings config={configDraft} onChange={handleConfigChange} />}
          {activeTab === "Inputs" && <InputsConfig config={configDraft} onChange={handleConfigChange} />}
          {activeTab === "Outputs" && <OutputsConfig config={configDraft} onChange={handleConfigChange} />}
          {activeTab === "Tools" && <ToolsConfig config={configDraft} onChange={handleConfigChange} />}
          {activeTab === "Knowledge" && <KnowledgeConfig config={configDraft} onChange={handleConfigChange} />}
          {activeTab === "Model & Memory" && <ModelMemorySettings config={configDraft} onChange={handleConfigChange} />}
          
          {activeTab === "Preview" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold tracking-tight">Configuration Preview</h2>
              <p className="text-muted-foreground">A summary of the agent's current configured state.</p>
              
              <div className="bg-muted p-6 rounded-xl border space-y-4 font-mono text-sm overflow-auto">
                <pre>{JSON.stringify(configDraft, null, 2)}</pre>
              </div>
            </div>
          )}
        </BuilderContent>
      </BuilderContainer>
      </div>
    </AppShell>
  );
};
