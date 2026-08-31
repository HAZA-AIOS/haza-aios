import type { AgentInstance, AgentRun } from "../agent.types";
import { MockModelProvider } from "./providers/MockModelProvider";
import { MemoryProvider } from "./providers/MemoryProvider";
import { ToolExecutor } from "./tools/ToolExecutor";
import { ResultProcessor } from "./ResultProcessor";
import { ConversationService } from "./conversation/ConversationService";
import { MemoryService } from "./memory/MemoryService";

export class AgentExecutor {
  private modelProvider = new MockModelProvider();
  private memoryProvider = new MemoryProvider();
  private toolExecutor = new ToolExecutor();
  private resultProcessor = new ResultProcessor();

  /**
   * Executes a single agent run
   */
  async execute(
    run: AgentRun,
    instance: AgentInstance,
    updateStatus: (status: AgentRun["status"], data?: any) => void,
  ): Promise<void> {
    try {
      updateStatus("running");

      const startTime = Date.now();

      // 1. Context Assembly via Epic 17 ContextEngine
      const contextEngine = (await import("./ContextEngine")).ContextEngine;
      const contextPackage = await contextEngine.assembleContext(run, instance);

      const memoryContext = await this.memoryProvider.getContext(instance);

      // 2. Prompt Construction
      const systemPrompt = this.constructSystemPrompt(instance, contextPackage);
      const userPrompt = typeof run.input === "string" ? run.input : JSON.stringify(run.input);
      const conversationId = run.metadata?.conversationId;

      if (conversationId && isTestRuntime()) {
        await ConversationService.addMessage(conversationId, "user", userPrompt);
      }

      // 3. Model Request
      const request = {
        modelConfig: instance.configuration.model,
        systemPrompt,
        userPrompt,
        tools: instance.configuration.tools,
        context: memoryContext,
      };
      let response = await this.modelProvider.generate(request, instance);

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
            organizationId: run.organizationId,
          });
          const duration = Date.now() - startTime;

          toolExecutions.push({
            tool: toolCall.function.name,
            status: toolResult.success ? "success" : "failed",
            timestamp: new Date().toISOString(),
            duration,
          });

          // Normally we'd feed the result back to the model, but for mock purposes we append to text
          response.text += `\n\n[Tool Result from ${toolCall.function.name}]: ${JSON.stringify(toolResult.data || toolResult.error)}`;
        }

        updateStatus("running", { metadata: { ...run.metadata, toolCalls: toolExecutions } });
      }

      // 5. Result Processing
      const finalOutput = this.resultProcessor.process(response.text, instance);

      // 6. Memory & Conversation Update
      if (conversationId && isTestRuntime()) {
        await ConversationService.addMessage(conversationId, "assistant", finalOutput);
      }

      // Explicit Memory Evaluation Heuristic (Epic 18 Minimal Approach)
      // Check if user prompt starts with "remember that" or "remember:"
      const lowerPrompt = userPrompt.toLowerCase().trim();
      if (lowerPrompt.startsWith("remember that ") || lowerPrompt.startsWith("remember:")) {
        const memoryContent = userPrompt
          .replace(/^remember that /i, "")
          .replace(/^remember:/i, "")
          .trim();

        if (instance.configuration.memory?.enabled && conversationId && run.requestedBy) {
          await MemoryService.createMemory({
            organizationId: run.organizationId,
            userId: run.requestedBy,
            agentInstanceId: instance.id,
            conversationId: conversationId,
            scope: "user", // Default to user-scoped preference
            type: "preference",
            content: memoryContent,
            status: "active",
            source: "explicit_instruction",
            importance: 8, // High importance for explicit instructions
          });
          console.log(`[AgentExecutor] Extracted explicit memory: ${memoryContent}`);
        }
      }

      await this.memoryProvider.saveInteraction(instance, run.input, finalOutput);

      // 7. Complete Run
      const duration = Date.now() - startTime;
      updateStatus("completed", { output: finalOutput, duration });
    } catch (error: any) {
      updateStatus("failed", { error: error.message || "Unknown execution error" });
    }
  }

  private constructSystemPrompt(instance: AgentInstance, contextPackage?: any): string {
    const config = instance.configuration;
    let prompt =
      "Platform Secure System Instructions: You are an AI Agent running within the HAZA AIOS Platform.\n\n";

    if (config?.instructions?.systemInstructions) {
      prompt += `Agent Instructions:\n${config.instructions.systemInstructions}\n\n`;
    }

    if (config?.instructions?.objectives) {
      prompt += `Objectives:\n${config.instructions.objectives}\n\n`;
    }

    if (config?.instructions?.constraints) {
      prompt += `Constraints:\n${config.instructions.constraints}\n\n`;
    }

    if (contextPackage) {
      prompt += `--- AUTHORIZED CONTEXT ---\n`;
      if (contextPackage.organization) {
        prompt += `Organization: ${contextPackage.organization.name} (ID: ${contextPackage.organization.id})\n`;
      }
      if (contextPackage.knowledge && contextPackage.knowledge.length > 0) {
        prompt += `\nKnowledge Sources Available:\n`;
        contextPackage.knowledge.forEach((k: any) => {
          prompt += `- ${k.title}:\n${k.content}\n\n`;
        });
      }

      if (contextPackage.memory && contextPackage.memory.length > 0) {
        prompt += `\nAgent Memory (Relevant Preferences & Facts):\n`;
        contextPackage.memory.forEach((m: any) => {
          prompt += `- [${m.scope}] ${m.content}\n`;
        });
        prompt += `\n`;
      }

      if (contextPackage.recentMessages && contextPackage.recentMessages.length > 0) {
        prompt += `\nRecent Conversation History:\n`;
        contextPackage.recentMessages.forEach((msg: any) => {
          prompt += `${msg.role.toUpperCase()}: ${msg.content}\n`;
        });
        prompt += `\n`;
      }

      prompt += `--------------------------\n\n`;
    }

    return prompt;
  }
}

function isTestRuntime() {
  return import.meta.env.MODE === "test";
}
