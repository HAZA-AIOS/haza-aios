import type { AgentInstance } from "../../agent.types";
import { ToolRegistry } from "./ToolRegistry";

export interface ToolExecutionRequest {
  toolId: string;
  arguments: any;
  instance: AgentInstance;
  userId?: string;
  organizationId: string;
}

export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
}

export class ToolExecutor {
  async execute(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    const { toolId, arguments: args, instance, userId, organizationId } = request;

    // 1. Tool Selection
    const toolImpl = ToolRegistry.getTool(toolId);
    if (!toolImpl) {
      return {
        success: false,
        error: `Unknown tool: ${toolId}`
      };
    }

    // 2. Permission Check (Organization / Agent Level)
    if (!instance.configuration?.tools?.includes(toolId) && toolId !== "web_search") {
      return {
        success: false,
        error: `Agent is not authorized to use tool: ${toolId}`
      };
    }

    // 3. Execution with strict boundaries
    try {
      const data = await toolImpl.execute(args, {
        instance,
        userId,
        organizationId
      });

      // 4. Output Validation (assuming toolImpl handles internal validation)
      return {
        success: true,
        data
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Tool execution failed"
      };
    }
  }
}
