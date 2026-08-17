import type { ToolExecutionContext } from "./ToolRegistry";
import { ToolRegistry } from "./ToolRegistry";
import { KnowledgeRetrievalService } from "../knowledge/KnowledgeRetrievalService";

ToolRegistry.register({
  definition: {
    id: "knowledge_search",
    name: "Knowledge Search Tool",
    description: "Search authorized organizational knowledge base for relevant documents and guidelines.",
    category: "Knowledge",
    inputSchema: { 
      type: "object", 
      properties: { 
        query: { type: "string" },
        limit: { type: "number" }
      },
      required: ["query"]
    },
    outputSchema: { 
      type: "object", 
      properties: { 
        results: { 
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              content: { type: "string" }
            }
          }
        }
      } 
    },
    permissions: ["knowledge:search"],
    status: "active"
  },
  execute: async (input: { query?: string; limit?: number }, context: ToolExecutionContext) => {
    if (!input.query) throw new Error("query is required");

    // We must have an instance to know what knowledge they are allowed to search
    if (!context.instance) {
      throw new Error("Instance context is missing, cannot resolve authorized knowledge sources.");
    }

    const authorizedKnowledgeIds = context.instance.configuration.knowledge || [];
    
    const results = await KnowledgeRetrievalService.retrieve({
      organizationId: context.organizationId,
      query: input.query,
      authorizedKnowledgeIds,
      limit: input.limit || 5
    });

    return {
      results: results.map(r => ({ title: r.title, content: r.content }))
    };
  }
});
