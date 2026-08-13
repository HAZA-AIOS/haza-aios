import type { Tool, AgentInstance } from "../../agent.types";

export interface ToolExecutionContext {
  instance: AgentInstance;
  userId?: string;
  organizationId: string;
}

export interface ToolImplementation {
  definition: Tool;
  execute: (input: any, context: ToolExecutionContext) => Promise<any>;
}

class Registry {
  private tools: Map<string, ToolImplementation> = new Map();

  register(impl: ToolImplementation) {
    this.tools.set(impl.definition.id, impl);
  }

  getTool(id: string): ToolImplementation | undefined {
    return this.tools.get(id);
  }

  getAllTools(): Tool[] {
    return Array.from(this.tools.values()).map(t => t.definition);
  }
}

export const ToolRegistry = new Registry();
