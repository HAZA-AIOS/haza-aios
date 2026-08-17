import type { AgentRun, AgentInstance, ContextPackage } from "../agent.types";
import { KnowledgeRetrievalService } from "./knowledge/KnowledgeRetrievalService";
import { KnowledgeService } from "./knowledge/KnowledgeService";
import { ConversationService } from "./conversation/ConversationService";
import { MemoryRetrievalService } from "./memory/MemoryRetrievalService";

export class ContextEngineClass {
  /**
   * Assembles a structured context package for the Agent Runtime based on
   * the agent instance's authorized knowledge and the current run input.
   */
  async assembleContext(run: AgentRun, instance: AgentInstance): Promise<ContextPackage> {
    const contextPackage: ContextPackage = {};

    // 1. Agent Context (Basic config)
    contextPackage.agent = {
      id: instance.id,
      name: instance.name,
      description: instance.configuration.general.description,
      objectives: instance.configuration.instructions.objectives,
      constraints: instance.configuration.instructions.constraints,
    };

    // 2. Organization Context (Hardcoded minimal mock for Epic 17)
    contextPackage.organization = {
      id: instance.organizationId,
      name: "HAZA Mock Organization",
    };

    // 3. Task Context
    // Extracting keywords or task-specific metadata from the input
    let taskContextStr = "";
    if (typeof run.input === "string") {
      taskContextStr = run.input;
    } else {
      taskContextStr = JSON.stringify(run.input);
    }
    contextPackage.task = {
      inputStr: taskContextStr,
      mode: run.metadata?.executionMode || "manual"
    };

    // 4. Knowledge Retrieval (The core of Epic 17)
    // We only fetch knowledge the agent is explicitly authorized to access
    const authorizedKnowledgeIds = instance.configuration.knowledge || [];
    contextPackage.knowledge = [];
    
    if (authorizedKnowledgeIds.length > 0) {
      // In this Epic, we pull the entirety of the authorized knowledge records directly.
      // In a more complex architecture, we would run semantic search over them.
      for (const kId of authorizedKnowledgeIds) {
        const kSource = await KnowledgeService.getKnowledgeSourceById(kId, run.organizationId);
        if (kSource) {
          contextPackage.knowledge.push({
            id: kSource.id,
            title: kSource.name,
            content: kSource.content,
            type: kSource.type
          });
        }
      }
    }

    // 5. Conversation Context
    const conversationId = run.metadata?.conversationId;
    if (conversationId && instance.configuration.memory?.conversationContext !== false) {
      const convo = await ConversationService.getConversation(conversationId, run.organizationId);
      if (convo) {
        contextPackage.conversation = { id: convo.id, title: convo.title };
        // Fetch last 10 messages for context
        const recentMessages = await ConversationService.getMessages(conversationId, 10);
        (contextPackage as any).recentMessages = recentMessages.map(m => ({
          role: m.role,
          content: m.content
        }));
      }
    }

    // 6. Memory Context
    if (instance.configuration.memory?.enabled) {
      const memories = await MemoryRetrievalService.retrieveRelevantMemory({
        organizationId: run.organizationId,
        userId: run.requestedBy || "unknown_user",
        agentInstanceId: instance.id,
        conversationId,
        limit: 15
      });
      
      if (memories.length > 0) {
        (contextPackage as any).memory = memories.map(m => ({
          scope: m.scope,
          type: m.type,
          content: m.content
        }));
      }
    }

    // Optionally if we wanted to auto-query the retrieved text based on the task:
    // const results = await KnowledgeRetrievalService.retrieve({
    //   organizationId: run.organizationId,
    //   query: taskContextStr,
    //   authorizedKnowledgeIds
    // });

    // Metadata logging
    contextPackage.metadata = {
      assembledAt: new Date().toISOString(),
      knowledgeSourcesCount: contextPackage.knowledge.length,
      memoryCount: (contextPackage as any).memory?.length || 0,
      recentMessagesCount: (contextPackage as any).recentMessages?.length || 0,
    };

    return contextPackage;
  }
}

export const ContextEngine = new ContextEngineClass();
