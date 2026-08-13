import { useState, useEffect } from "react";
import { AgentService } from "./agent-service";
import type { AgentTemplate, AgentInstance } from "./agent.types";
import { useOrganization } from "../org/use-organization";

export function useAgentTemplates() {
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  
  useEffect(() => {
    setTemplates(AgentService.getAvailableTemplates());
  }, []);

  return { templates };
}

export function useAgentInstances() {
  const { organization } = useOrganization();
  const [instances, setInstances] = useState<AgentInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchInstances = async () => {
    if (!organization) return;
    setIsLoading(true);
    const data = await AgentService.getInstances(organization.id);
    setInstances(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchInstances();
  }, [organization]);

  const activateAgent = async (templateId: string) => {
    if (!organization) return;
    await AgentService.activateAgent(organization.id, templateId);
    await fetchInstances();
  };

  const pauseAgent = async (instanceId: string) => {
    if (!organization) return;
    await AgentService.pauseInstance(instanceId, organization.id);
    await fetchInstances();
  };

  return { instances, isLoading, activateAgent, pauseAgent };
}
