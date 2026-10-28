import { useCallback, useEffect, useState } from "react";
import { AgentService } from "./agent-service";
import type {
  AgentTemplate,
  AgentInstance,
  AgentConfiguration,
  HumanApprovalPolicy,
  AgentAuditEvent,
  AiProviderInfo,
} from "./agent.types";
import { useOrganization } from "../org/use-organization";

export function useAgentTemplates() {
  const { currentOrganization } = useOrganization();
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.resolve().then(async () => {
      if (!currentOrganization) {
        setTemplates([]);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const data = await AgentService.getAvailableTemplatesForOrg(currentOrganization.id);
        setTemplates(data);
      } finally {
        setIsLoading(false);
      }
    });
  }, [currentOrganization]);

  return { templates, isLoading };
}

export function useAgentInstances() {
  const { currentOrganization } = useOrganization();
  const [instances, setInstances] = useState<AgentInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchInstances = useCallback(async () => {
    if (!currentOrganization) return;
    setIsLoading(true);
    try {
      const data = await AgentService.getInstances(currentOrganization.id);
      setInstances(data);
    } finally {
      setIsLoading(false);
    }
  }, [currentOrganization]);

  useEffect(() => {
    Promise.resolve().then(fetchInstances);
  }, [fetchInstances]);

  const activateAgent = async (
    templateId: string,
    extra?: {
      name?: string;
      description?: string;
      modelProvider?: string;
      modelSelection?: string;
      humanApprovalPolicy?: HumanApprovalPolicy;
    },
  ) => {
    if (!currentOrganization) return;
    const result = await AgentService.activateAgent(
      currentOrganization.id,
      templateId,
      undefined,
      extra,
    );
    await fetchInstances();
    return result;
  };

  const pauseAgent = async (instanceId: string) => {
    if (!currentOrganization) return;
    const result = await AgentService.pauseInstance(instanceId, currentOrganization.id);
    await fetchInstances();
    return result;
  };

  const suspendAgent = async (instanceId: string) => {
    if (!currentOrganization) return;
    const result = await AgentService.suspendInstance(instanceId, currentOrganization.id);
    await fetchInstances();
    return result;
  };

  const resumeAgent = async (instanceId: string) => {
    if (!currentOrganization) return;
    const result = await AgentService.resumeInstance(instanceId, currentOrganization.id);
    await fetchInstances();
    return result;
  };

  const archiveAgent = async (instanceId: string) => {
    if (!currentOrganization) return;
    const result = await AgentService.archiveInstance(instanceId, currentOrganization.id);
    await fetchInstances();
    return result;
  };

  const updateConfiguration = async (instanceId: string, config: Partial<AgentConfiguration>) => {
    if (!currentOrganization) return;
    const result = await AgentService.updateConfiguration(instanceId, currentOrganization.id, config);
    await fetchInstances();
    return result;
  };

  const fetchAuditHistory = async (instanceId: string, page = 1, pageSize = 20) => {
    if (!currentOrganization) return { items: [] as AgentAuditEvent[], total: 0, page: 1, pageSize: 20, totalPages: 1 };
    return AgentService.getAgentAuditHistory(instanceId, currentOrganization.id, page, pageSize);
  };

  const fetchProviders = async (): Promise<AiProviderInfo[]> => {
    if (!currentOrganization) return [];
    return AgentService.getProviders(currentOrganization.id);
  };

  return {
    instances,
    isLoading,
    fetchInstances,
    activateAgent,
    pauseAgent,
    suspendAgent,
    resumeAgent,
    archiveAgent,
    updateConfiguration,
    fetchAuditHistory,
    fetchProviders,
  };
}

export function useMarketplaceCatalog(initialFilter?: {
  search?: string;
  category?: string;
  industry?: string;
  publisher?: string;
  page?: number;
  pageSize?: number;
}) {
  const { currentOrganization } = useOrganization();
  const [catalog, setCatalog] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(initialFilter?.page ?? 1);
  const [pageSize] = useState(initialFilter?.pageSize ?? 20);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCatalog = useCallback(
    async (overrideFilter?: typeof initialFilter) => {
      if (!currentOrganization) return;
      setIsLoading(true);
      setError(null);
      try {
        const res = await AgentService.listMarketplaceCatalog(currentOrganization.id, {
          ...initialFilter,
          ...overrideFilter,
          page,
          pageSize,
        });
        setCatalog(res.items);
        setTotal(res.total);
        setPage(res.page);
        setTotalPages(res.totalPages);
      } catch (err: any) {
        setError(err.message || "Failed to load marketplace catalog");
      } finally {
        setIsLoading(false);
      }
    },
    [currentOrganization, initialFilter, page, pageSize],
  );

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  return {
    catalog,
    total,
    page,
    pageSize,
    totalPages,
    isLoading,
    error,
    fetchCatalog,
    setPage,
  };
}

export function useInstalledMarketplaceAgents() {
  const { currentOrganization } = useOrganization();
  const [installedAgents, setInstalledAgents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInstalled = useCallback(async () => {
    if (!currentOrganization) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await AgentService.listInstalledMarketplaceAgents(currentOrganization.id);
      setInstalledAgents(data);
    } catch (err: any) {
      setError(err.message || "Failed to load installed agents");
    } finally {
      setIsLoading(false);
    }
  }, [currentOrganization]);

  useEffect(() => {
    fetchInstalled();
  }, [fetchInstalled]);

  const upgradeAgent = async (agentId: string, targetVersion: string) => {
    if (!currentOrganization) return;
    const res = await AgentService.upgradeMarketplaceAgent(
      currentOrganization.id,
      agentId,
      targetVersion,
    );
    await fetchInstalled();
    return res;
  };

  const uninstallAgent = async (agentId: string, reason?: string) => {
    if (!currentOrganization) return;
    await AgentService.uninstallMarketplaceAgent(currentOrganization.id, agentId, reason);
    await fetchInstalled();
  };

  return {
    installedAgents,
    isLoading,
    error,
    fetchInstalled,
    upgradeAgent,
    uninstallAgent,
  };
}
