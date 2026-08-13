import type { AgentInstance, AgentRun } from "../agent.types";
import { MockModelProvider } from "./providers/MockModelProvider";
import { MemoryProvider } from "./providers/MemoryProvider";
import { ToolExecutor } from "./tools/ToolExecutor";
import { ResultProcessor } from "./ResultProcessor";

export class AgentExecutor {
  private modelProvider = new MockModelProvider();
  private memoryProvider = new MemoryProvider();
  private toolExecutor = new ToolExecutor();
  private resultProcessor = new ResultProcessor();

  /**
   * Executes a single agent run
   */
  async execute(run: AgentRun, instance: AgentInstance, updateStatus: (status: AgentRun["status"], data?: any) => void): Promise<void> {
    try {
      updateStatus("running");
      
      const startTime = Date.now();

      // 1. Context Assembly
      const context = await this.memoryProvider.getContext(instance);
      
      // 2. Prompt Construction
      const systemPrompt = this.constructSystemPrompt(instance);
      const userPrompt = typeof run.input === "string" ? run.input : JSON.stringify(run.input);

      // 3. Model Request
      let response = await this.modelProvider.generate({
        systemPrompt,
        userPrompt,
        context,
        tools: instance.configuration?.tools
      }, instance);

        // 4. Tool Execution Loop (simplified for this Epic)
      if (response.toolCalls && response.toolCalls.length > 0) {
        updateStatus("waiting", { message: "Executing tools..." });
        
        const toolExecutions = run.metadata?.toolCalls || [];
        
        for (const toolCall of response.toolCalls) {
          const startTime = Date.now();
          const toolResult = await this.toolExecutor.execute({
            toolId: toolCall.function.name,
            arguments: JSON.parse(toolCall.function.arguments || "{}"),
            instance,
            userId: run.requestedBy,
            organizationId: run.organizationId
          });
          const duration = Date.now() - startTime;
          
          toolExecutions.push({
            tool: toolCall.function.name,
            status: toolResult.success ? "success" : "failed",
            timestamp: new Date().toISOString(),
            duration
          });
          
          // Normally we'd feed the result back to the model, but for mock purposes we append to text
          response.text += `\n\n[Tool Result from ${toolCall.function.name}]: ${JSON.stringify(toolResult.data || toolResult.error)}`;
        }
        
        updateStatus("running", { metadata: { ...run.metadata, toolCalls: toolExecutions } });
      }

      // 5. Result Processing
      const finalOutput = this.resultProcessor.process(response.text, instance);

      // 6. Memory Update
      await this.memoryProvider.saveInteraction(instance, run.input, finalOutput);

      // 7. Complete Run
      const duration = Date.now() - startTime;
      updateStatus("completed", { output: finalOutput, duration });

    } catch (error: any) {
      updateStatus("failed", { error: error.message || "Unknown execution error" });
    }
  }

  private constructSystemPrompt(instance: AgentInstance): string {
    const config = instance.configuration;
    let prompt = "Platform Secure System Instructions: You are an AI Agent running within the HAZA AIOS Platform.\n\n";
    
    if (config?.instructions?.systemInstructions) {
      prompt += `Agent Instructions:\n${config.instructions.systemInstructions}\n\n`;
    }
    
    if (config?.instructions?.objectives) {
      prompt += `Objectives:\n${config.instructions.objectives}\n\n`;
    }
    
    if (config?.instructions?.constraints) {
      prompt += `Constraints:\n${config.instructions.constraints}\n\n`;
    }

    return prompt;
  }
}
