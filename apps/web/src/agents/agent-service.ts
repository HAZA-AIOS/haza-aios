import type { AgentTemplate, AgentInstance, AgentRun, AgentConfiguration } from "./agent.types";
import { AgentRegistry } from "./agent-registry";
import { apiClient } from "@/api/api-client";
import { readStoredAuth } from "@/auth/auth-storage";

const INSTANCES_KEY = "haza-aios.agents.instances";
const RUNS_KEY = "haza-aios.agents.runs";

export class AgentServiceClass {
  private templateCache: AgentTemplate[] = AgentRegistry.getAll();

  // --- Templates (Registry Wrapper) ---
  getTemplates(): AgentTemplate[] {
    if (isTestRuntime()) registerDefaultTemplates();
    return this.templateCache.length ? this.templateCache : AgentRegistry.getAll();
  }

  getTemplate(id: string): AgentTemplate | undefined {
    return this.getTemplates().find((template) => template.id === id) ?? AgentRegistry.get(id);
  }

  getAvailableTemplates(): AgentTemplate[] {
    return this.getTemplates().filter((template) => template.status === "available");
  }

  async getAvailableTemplatesForOrg(organizationId: string): Promise<AgentTemplate[]> {
    if (isTestRuntime()) return this.getAvailableTemplates();
    const auth = readStoredAuth();
    const response = await apiClient.request<{ templates: AgentTemplate[] }>(`/api/v1/organizations/${organizationId}/agents/templates`, {
      authToken: auth?.session.accessToken,
    });
    this.templateCache = response.templates;
    response.templates.forEach((template) => AgentRegistry.register(template));
    return response.templates;
  }

  async getTemplateForOrg(id: string, organizationId: string): Promise<AgentTemplate | undefined> {
    const cached = this.getTemplate(id);
    if (cached) return cached;
    const templates = await this.getAvailableTemplatesForOrg(organizationId);
    return templates.find((template) => template.id === id);
  }

  // --- Instances ---
  private getInstancesDb(): AgentInstance[] {
    if (!isTestRuntime()) return [];
    const data = localStorage.getItem(INSTANCES_KEY);
    return data ? JSON.parse(data) : [];
  }

  private saveInstancesDb(instances: AgentInstance[]): void {
    if (!isTestRuntime()) return;
    localStorage.setItem(INSTANCES_KEY, JSON.stringify(instances));
  }

  async getInstances(organizationId: string): Promise<AgentInstance[]> {
    if (!isTestRuntime()) {
      const auth = readStoredAuth();
      const response = await apiClient.request<{ agents: AgentInstance[] }>(`/api/v1/organizations/${organizationId}/agents`, {
        authToken: auth?.session.accessToken,
      });
      return response.agents;
    }
    return this.getInstancesDb().filter(i => i.organizationId === organizationId);
  }

  async getInstance(id: string, organizationId: string): Promise<AgentInstance | undefined> {
    if (!isTestRuntime()) {
      const auth = readStoredAuth();
      try {
        const response = await apiClient.request<{ agent: AgentInstance }>(`/api/v1/organizations/${organizationId}/agents/${id}`, {
          authToken: auth?.session.accessToken,
        });
        return response.agent;
      } catch (error) {
        if ((error as { status?: number }).status === 404) return undefined;
        throw error;
      }
    }
    return this.getInstancesDb().find(i => i.id === id && i.organizationId === organizationId);
  }

  async activateAgent(organizationId: string, templateId: string, workspaceId?: string): Promise<AgentInstance> {
    if (!isTestRuntime()) {
      const auth = readStoredAuth();
      const resolvedWorkspaceId = workspaceId ?? await this.getDefaultWorkspaceId(organizationId);
      const response = await apiClient.request<{ agent: AgentInstance }>(`/api/v1/organizations/${organizationId}/agents`, {
        method: "POST",
        authToken: auth?.session.accessToken,
        body: JSON.stringify({ templateId, workspaceId: resolvedWorkspaceId }),
      });
      return response.agent;
    }

    const template = this.getTemplate(templateId);
    if (!template) throw new Error("Template not found");

    const instances = this.getInstancesDb();
    
    // Check if already active
    const existing = instances.find(i => i.organizationId === organizationId && i.agentTemplateId === templateId);
    if (existing) {
      if (existing.status !== "active") {
        existing.status = "active";
        existing.enabled = true;
        existing.updatedAt = new Date().toISOString();
        this.saveInstancesDb(instances);
      }
      return existing;
    }

    const newInstance: AgentInstance = {
      id: `instance-${Date.now()}`,
      organizationId,
      agentTemplateId: template.id,
      name: `${template.name} (Instance)`,
      status: "active",
      configuration: {
        version: "1.0",
        general: { description: template.description },
        instructions: { systemInstructions: "", objectives: "", constraints: "", responseStyle: "" },
        behavior: { tone: "Neutral", formality: "Standard", creativity: 50, responseLength: "Medium", language: "English", communicationStyle: "Direct" },
        inputs: [],
        outputs: [],
        tools: [],
        knowledge: [],
        model: { provider: "Platform Default", modelSelection: "Auto", responseQuality: "Balanced", temperature: 0.7, tokenLimits: 2048 },
        memory: { enabled: true, conversationContext: true, persistentMemory: false, organizationKnowledgeFoundation: false },
        notifications: { inApp: true, email: false, onSuccess: false, onFailure: true, requireApproval: false },
        advanced: { executionLimits: 100, timeoutSeconds: 30, retryCount: 1, loggingLevel: "Info", debugMode: false }
      },
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    instances.push(newInstance);
    this.saveInstancesDb(instances);
    return newInstance;
  }

  async updateConfiguration(id: string, organizationId: string, config: Partial<AgentConfiguration>): Promise<AgentInstance> {
    if (!isTestRuntime()) {
      const auth = readStoredAuth();
      const response = await apiClient.request<{ agent: AgentInstance }>(`/api/v1/organizations/${organizationId}/agents/${id}/configuration`, {
        method: "PATCH",
        authToken: auth?.session.accessToken,
        body: JSON.stringify({ configuration: config }),
      });
      return response.agent;
    }

    const instances = this.getInstancesDb();
    const instance = instances.find(i => i.id === id && i.organizationId === organizationId);
    if (!instance) throw new Error("Instance not found");

    instance.configuration = { ...instance.configuration, ...config };
    instance.status = "configured";
    instance.updatedAt = new Date().toISOString();
    this.saveInstancesDb(instances);
    return instance;
  }

  async pauseInstance(id: string, organizationId: string): Promise<AgentInstance> {
    if (!isTestRuntime()) {
      const auth = readStoredAuth();
      const response = await apiClient.request<{ agent: AgentInstance }>(`/api/v1/organizations/${organizationId}/agents/${id}/status`, {
        method: "PATCH",
        authToken: auth?.session.accessToken,
        body: JSON.stringify({ status: "paused" }),
      });
      return response.agent;
    }

    const instances = this.getInstancesDb();
    const instance = instances.find(i => i.id === id && i.organizationId === organizationId);
    if (!instance) throw new Error("Instance not found");

    instance.status = "paused";
    instance.enabled = false;
    instance.updatedAt = new Date().toISOString();
    this.saveInstancesDb(instances);
    return instance;
  }

  // --- Runs (Execution Model Placeholder) ---
  private getRunsDb(): AgentRun[] {
    const data = localStorage.getItem(RUNS_KEY);
    return data ? JSON.parse(data) : [];
  }

  public saveRunsDb(runs: AgentRun[]): void {
    localStorage.setItem(RUNS_KEY, JSON.stringify(runs));
  }

  async getRuns(organizationId: string, instanceId?: string): Promise<AgentRun[]> {
    let runs = this.getRunsDb().filter(r => r.organizationId === organizationId);
    if (instanceId) {
      runs = runs.filter(r => r.agentInstanceId === instanceId);
    }
    // Sort by startedAt descending
    return runs.sort((a, b) => {
      const timeA = a.startedAt ? new Date(a.startedAt).getTime() : 0;
      const timeB = b.startedAt ? new Date(b.startedAt).getTime() : 0;
      return timeB - timeA;
    });
  }

  async saveAgentRun(run: AgentRun): Promise<void> {
    const runs = this.getRunsDb();
    runs.push(run);
    this.saveRunsDb(runs);
  }

  async updateAgentRun(runId: string, updates: Partial<AgentRun>): Promise<AgentRun> {
    const runs = this.getRunsDb();
    const index = runs.findIndex(r => r.id === runId);
    if (index === -1) throw new Error("Run not found");
    
    runs[index] = { ...runs[index], ...updates };
    this.saveRunsDb(runs);
    return runs[index];
  }

  private async getDefaultWorkspaceId(organizationId: string): Promise<string> {
    const auth = readStoredAuth();
    const response = await apiClient.request<{ workspaces: Array<{ id: string }> }>(`/api/v1/organizations/${organizationId}/workspaces`, {
      authToken: auth?.session.accessToken,
    });
    const workspaceId = response.workspaces[0]?.id;
    if (!workspaceId) throw new Error("Workspace not found.");
    return workspaceId;
  }
}

export const AgentService = new AgentServiceClass();

// Seed some initial mock templates for the registry
import type { AgentTemplate as AT } from "./agent.types";

const mockTemplates: AT[] = [
  {
    id: "template-worksheet-creator",
    name: "Worksheet Creator",
    slug: "worksheet-creator",
    description: "Automatically generates customized student worksheets and quizzes based on subject and difficulty.",
    version: "1.0.0",
    category: "Education",
    industry: "Education",
    status: "available",
    icon: "📝",
    capabilities: [
      { key: "generate", name: "Educational content generation", description: "Generates educational materials" },
      { key: "transform", name: "Worksheet structuring", description: "Structures content into a worksheet format" },
      { key: "analyze", name: "Difficulty control", description: "Adjusts content based on grade and difficulty" }
    ],
    requiredPermissions: ["module.education.view"],
    configurationSchema: {},
    inputSchema: {},
    outputSchema: {},
    tools: [],
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "template-sales-analyzer",
    name: "Sales Analyzer",
    slug: "sales-analyzer",
    description: "Analyzes quarterly sales data and predicts future revenue trends.",
    version: "1.0.0",
    category: "Analytics",
    industry: "corporate",
    status: "available",
    icon: "📈",
    capabilities: [{ key: "analyze", name: "Data Analysis", description: "Analyzes structured data" }],
    requiredPermissions: ["module.sales.view"],
    configurationSchema: {},
    inputSchema: {},
    outputSchema: {},
    tools: [],
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

mockTemplates.forEach(t => AgentRegistry.register(t));

function registerDefaultTemplates() {
  if (AgentRegistry.getAll().length > 0) return;
  mockTemplates.forEach(t => AgentRegistry.register(t));
}

function isTestRuntime() {
  return import.meta.env.MODE === "test";
}
