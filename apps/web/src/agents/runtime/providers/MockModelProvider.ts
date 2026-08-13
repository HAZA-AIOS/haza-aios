import type { AgentInstance } from "../../agent.types";
import type { ModelProvider, ModelGenerationRequest, ModelGenerationResponse } from "./ModelProvider";

export class MockModelProvider implements ModelProvider {
  id = "mock-provider";
  name = "Mock Development Provider";

  async generate(request: ModelGenerationRequest, instance: AgentInstance): Promise<ModelGenerationResponse> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Basic deterministic response based on the input
    if (typeof request.userPrompt === "string" && request.userPrompt.includes("generate_worksheet")) {
      try {
        // If we haven't executed the tools yet (checking text for [Tool Result), let's issue the tool calls
        if (!request.userPrompt.includes("[Tool Result from")) {
          let inputData = JSON.parse(request.userPrompt);
          if (inputData.task === "generate_worksheet") {
            const hasTools = request.tools && request.tools.includes("curriculum_context");
            if (hasTools) {
              return {
                text: "I need to fetch the curriculum and worksheet context first.",
                toolCalls: [
                  {
                    id: "call_curr_" + Math.random().toString(36).substr(2, 9),
                    type: "function",
                    function: {
                      name: "curriculum_context",
                      arguments: JSON.stringify({ subject: inputData.params.subject, grade: inputData.params.grade })
                    }
                  },
                  {
                    id: "call_ws_" + Math.random().toString(36).substr(2, 9),
                    type: "function",
                    function: {
                      name: "worksheet_context",
                      arguments: JSON.stringify({ topic: inputData.params.topic })
                    }
                  }
                ],
                usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
              };
            }
          }
        }
        
        // Either tool calls are not available or we already have the tool results
        const inputData = request.userPrompt.startsWith("{") ? JSON.parse(request.userPrompt.split("\n\n[Tool")[0]) : JSON.parse(request.userPrompt);
        
        if (inputData.task === "generate_worksheet") {
          const params = inputData.params;
          const questions = [];
          const answerKey: Record<string, string> = {};
          
          for (let i = 1; i <= params.questionCount; i++) {
            const qId = `q${i}`;
            const type = params.questionTypes[i % params.questionTypes.length];
            
            let questionObj: any = {
              id: qId,
              number: i,
              type,
              question: `Sample ${type} question about ${params.topic} (${params.difficulty})`
            };
            
            if (type === "multiple-choice") {
              questionObj.options = ["Option A", "Option B", "Option C", "Option D"];
              questionObj.answer = "Option B";
              answerKey[qId] = "Option B";
            } else if (type === "true-false") {
              questionObj.options = ["True", "False"];
              questionObj.answer = "True";
              answerKey[qId] = "True";
            } else {
              questionObj.answer = "Sample detailed answer for grading reference.";
              answerKey[qId] = questionObj.answer;
            }
            questions.push(questionObj);
          }
          
          const worksheetResult = {
            title: `${params.difficulty} ${params.subject} Worksheet: ${params.topic}`,
            params,
            questions,
            answerKey
          };
          
          return {
            text: JSON.stringify(worksheetResult),
            usage: { promptTokens: 100, completionTokens: 500, totalTokens: 600 }
          };
        }
      } catch (e) {
        // ignore parse error, fallback
      }
    }

    let text = `[Mock Model Response] I am the agent "${instance.name}".\n\n`;
    text += `Received Input: ${JSON.stringify(request.userPrompt)}\n`;
    
    if (instance.configuration?.behavior?.tone) {
      text += `My tone is set to: ${instance.configuration.behavior.tone}.\n`;
    }

    if (request.tools && request.tools.length > 0) {
      // Simulate calling a tool if it looks like a calculation or web search
      if (typeof request.userPrompt === "string" && request.userPrompt.toLowerCase().includes("search")) {
        return {
          text: "I need to search for that information.",
          toolCalls: [{
            id: "call_" + Math.random().toString(36).substr(2, 9),
            type: "function",
            function: {
              name: "web_search",
              arguments: JSON.stringify({ query: request.userPrompt })
            }
          }],
          usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 }
        };
      }
    }

    return {
      text,
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150
      }
    };
  }

  async getCapabilities(): Promise<string[]> {
    return ["text-generation", "tool-calling"];
  }
}
