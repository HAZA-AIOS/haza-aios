import { useCallback, useEffect, useState } from "react";
import { AgentService } from "./agent-service";
import type { AgentTemplate, AgentInstance, AgentConfiguration } from "./agent.types";
import { useOrganization } from "../org/use-organization";

export function useAgentTemplates() {
  const { currentOrganization } = useOrganization();
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  
  useEffect(() => {
    Promise.resolve().then(async () => {
      if (!currentOrganization) {
        setTemplates([]);
        return;
      }
      setTemplates(await AgentService.getAvailableTemplatesForOrg(currentOrganization.id));
    });
  }, [currentOrganization]);

  return { templates };
}

export function useAgentInstances() {
  const { currentOrganization } = useOrganization();
  const [instances, setInstances] = useState<AgentInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchInstances = useCallback(async () => {
    if (!currentOrganization) return;
    setIsLoading(true);
    const data = await AgentService.getInstances(currentOrganization.id);
    setInstances(data);
    setIsLoading(false);
  }, [currentOrganization]);

  useEffect(() => {
    Promise.resolve().then(fetchInstances);
  }, [fetchInstances]);

  const activateAgent = async (templateId: string) => {
    if (!currentOrganization) return;
    await AgentService.activateAgent(currentOrganization.id, templateId);
    await fetchInstances();
  };

  const pauseAgent = async (instanceId: string) => {
    if (!currentOrganization) return;
    await AgentService.pauseInstance(instanceId, currentOrganization.id);
    await fetchInstances();
  };

  const updateConfiguration = async (instanceId: string, config: Partial<AgentConfiguration>) => {
    if (!currentOrganization) return;
    await AgentService.updateConfiguration(instanceId, currentOrganization.id, config);
    await fetchInstances();
  };

  return { instances, isLoading, activateAgent, pauseAgent, updateConfiguration };
}
