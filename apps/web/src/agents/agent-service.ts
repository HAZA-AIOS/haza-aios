import type { AgentTemplate, AgentInstance, AgentRun } from "./agent.types";
import { AgentRegistry } from "./agent-registry";

const INSTANCES_KEY = "haza-aios.agents.instances";
const RUNS_KEY = "haza-aios.agents.runs";

export class AgentServiceClass {
  // --- Templates (Registry Wrapper) ---
  getTemplates(): AgentTemplate[] {
    return AgentRegistry.getAll();
  }

  getTemplate(id: string): AgentTemplate | undefined {
    return AgentRegistry.get(id);
  }

  getAvailableTemplates(): AgentTemplate[] {
    return AgentRegistry.getAvailable();
  }

  // --- Instances ---
  private getInstancesDb(): AgentInstance[] {
    const data = localStorage.getItem(INSTANCES_KEY);
    return data ? JSON.parse(data) : [];
  }

  private saveInstancesDb(instances: AgentInstance[]): void {
    localStorage.setItem(INSTANCES_KEY, JSON.stringify(instances));
  }

  async getInstances(organizationId: string): Promise<AgentInstance[]> {
    return this.getInstancesDb().filter(i => i.organizationId === organizationId);
  }

  async getInstance(id: string, organizationId: string): Promise<AgentInstance | undefined> {
    return this.getInstancesDb().find(i => i.id === id && i.organizationId === organizationId);
  }

  async activateAgent(organizationId: string, templateId: string): Promise<AgentInstance> {
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

  async updateConfiguration(id: string, organizationId: string, config: any): Promise<AgentInstance> {
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
    return runs;
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
    industry: "education",
    status: "available",
    icon: "📝",
    capabilities: [{ key: "generate", name: "Content Generation", description: "Generates text content" }],
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
