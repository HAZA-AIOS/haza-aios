import { Runtime } from "../AgentRuntime";
import { AgentService } from "../../agent-service";
import { ToolRegistry } from "../tools/ToolRegistry";
import { KnowledgeRetrievalService } from "../knowledge/KnowledgeRetrievalService";
import type { AgentInstance } from "../../agent.types";
import type { WorkflowStep, WorkflowExecutionContext, StepResult } from "./workflow.types";
import { ToolExecutor } from "../tools/ToolExecutor";

export class StepExecutors {

  static async executeAgentStep(step: WorkflowStep, context: WorkflowExecutionContext): Promise<StepResult> {
    const config = step.configuration;
    
    // Resolve input from context
    let input = config.input || context.task?.input || {};
    if (typeof input === "string" && input.startsWith("{{") && input.endsWith("}}")) {
      const varName = input.replace(/[{}]/g, "").trim();
      input = context.variables[varName] || context.previousResults[varName] || input;
    }

    try {
      const agentInstanceId = config.agentInstanceId || context.agentInstanceId;
      if (!agentInstanceId) throw new Error("No agentInstanceId provided for Agent Step");
      
      const instance = await AgentService.getInstance(agentInstanceId, context.organizationId);
      if (!instance) throw new Error(`Agent ${agentInstanceId} not found`);

      // Mock setting up a JSON output schema if the step expects structured output
      if (config.requireJson) {
        // We'd dynamically update instructions, but since we are mocking, we just add it to input
        input = `${input}\n\nPlease respond ONLY with valid JSON.`;
      }

      const run = await Runtime.requestExecution({
        agentInstanceId,
        organizationId: context.organizationId,
        input: input,
        requestedBy: context.userId,
        executionMode: "workflow",
        metadata: {
          taskId: context.taskId,
          workflowId: context.workflow.id,
          stepId: step.id
        }
      }, instance, () => AgentService as any);

      // Poll until complete
      let currentRun = run;
      while (["queued", "running", "waiting"].includes(currentRun.status)) {
        await new Promise(r => setTimeout(r, 1000));
        const runs = await AgentService.getRuns(context.organizationId, agentInstanceId);
        currentRun = runs.find(r => r.id === run.id) || currentRun;
      }

      if (currentRun.status === "failed") {
        throw new Error(currentRun.error || "Agent execution failed");
      }

      let resultData = currentRun.output;
      if (config.requireJson && typeof resultData === "string") {
        try {
          resultData = JSON.parse(resultData);
        } catch (e) {
          // Keep string if parsing fails
        }
      }

      return {
        stepId: step.id,
        success: true,
        status: "completed",
        data: resultData,
        startedAt: currentRun.startedAt || new Date().toISOString(),
        completedAt: currentRun.completedAt || new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        stepId: step.id,
        success: false,
        status: "failed",
        error: error.message,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      };
    }
  }

  static async executeToolStep(step: WorkflowStep, context: WorkflowExecutionContext): Promise<StepResult> {
    const config = step.configuration;
    const startedAt = new Date().toISOString();

    try {
      const toolId = config.toolId;
      const tool = ToolRegistry.getTool(toolId);
      if (!tool) throw new Error(`Tool ${toolId} not found`);

      // Map parameters from context
      let params = { ...config.params };
      for (const [k, v] of Object.entries(params)) {
        if (typeof v === "string" && v.startsWith("{{") && v.endsWith("}}")) {
          const varName = v.replace(/[{}]/g, "").trim();
          params[k] = context.variables[varName] || context.previousResults[varName] || v;
        }
      }

      const executor = new ToolExecutor();
      const instance =
        context.agentInstanceId
          ? await AgentService.getInstance(context.agentInstanceId, context.organizationId)
          : undefined;

      const executionInstance: AgentInstance =
        instance ||
        ({
          id: "workflow-tool-context",
          organizationId: context.organizationId,
          agentTemplateId: "workflow",
          name: "Workflow Tool Context",
          status: "active",
          enabled: true,
          configuration: {
            version: "1.0",
            general: { description: "Workflow-scoped tool execution context" },
            instructions: { systemInstructions: "", objectives: "", constraints: "", responseStyle: "" },
            behavior: {
              tone: "Neutral",
              formality: "Standard",
              creativity: 50,
              responseLength: "Medium",
              language: "English",
              communicationStyle: "Direct",
            },
            inputs: [],
            outputs: [],
            tools: [tool.definition.id],
            knowledge: [],
            model: {
              provider: "Platform Default",
              modelSelection: "Auto",
              responseQuality: "Balanced",
              temperature: 0.7,
              tokenLimits: 2048,
            },
            memory: {
              enabled: false,
              conversationContext: false,
              persistentMemory: false,
              organizationKnowledgeFoundation: false,
            },
            notifications: {
              inApp: false,
              email: false,
              onSuccess: false,
              onFailure: false,
              requireApproval: false,
            },
            advanced: {
              executionLimits: 100,
              timeoutSeconds: 30,
              retryCount: 0,
              loggingLevel: "Info",
              debugMode: false,
            },
          },
          createdAt: startedAt,
          updatedAt: startedAt,
        } satisfies AgentInstance);

      const result = await executor.execute({
        toolId: tool.definition.id,
        arguments: params,
        instance: executionInstance,
        userId: context.userId,
        organizationId: context.organizationId,
      });

      return {
        stepId: step.id,
        success: result.success,
        status: result.success ? "completed" : "failed",
        data: result.data,
        error: result.error,
        startedAt,
        completedAt: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        stepId: step.id,
        success: false,
        status: "failed",
        error: error.message,
        startedAt,
        completedAt: new Date().toISOString()
      };
    }
  }

  static async executeKnowledgeStep(step: WorkflowStep, context: WorkflowExecutionContext): Promise<StepResult> {
    const config = step.configuration;
    const startedAt = new Date().toISOString();
    
    try {
      const query = config.query || "";
      const results = await KnowledgeRetrievalService.retrieve({
        organizationId: context.organizationId,
        query,
        authorizedKnowledgeIds: config.knowledgeIds || []
      });

      return {
        stepId: step.id,
        success: true,
        status: "completed",
        data: results.map(r => r.content).join("\n\n"),
        startedAt,
        completedAt: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        stepId: step.id,
        success: false,
        status: "failed",
        error: error.message,
        startedAt,
        completedAt: new Date().toISOString()
      };
    }
  }

  static async executeConditionStep(step: WorkflowStep, context: WorkflowExecutionContext): Promise<StepResult> {
    const config = step.configuration;
    const startedAt = new Date().toISOString();
    
    try {
      const { variable, operator, value } = config;
      // Resolve variable
      const actualValue = context.variables[variable] || context.previousResults[variable];
      let success = false;

      switch(operator) {
        case "==": success = actualValue == value; break;
        case "!=": success = actualValue != value; break;
        case ">": success = actualValue > value; break;
        case "<": success = actualValue < value; break;
        case "contains": success = String(actualValue).includes(String(value)); break;
        case "exists": success = actualValue !== undefined && actualValue !== null; break;
        default: success = false;
      }

      return {
        stepId: step.id,
        success,
        status: "completed",
        data: { matched: success },
        startedAt,
        completedAt: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        stepId: step.id,
        success: false,
        status: "failed",
        error: error.message,
        startedAt,
        completedAt: new Date().toISOString()
      };
    }
  }
}
