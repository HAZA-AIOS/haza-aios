import type { AgentInstance } from "../../agent.types";

export class ResultProcessor {
  /**
   * Processes and validates the raw output from the model
   */
  process(rawOutput: string, instance: AgentInstance): any {
    // 1. Basic parsing (e.g. if the agent output definition expects JSON)
    const expectedFormat = instance.configuration?.outputs?.[0]?.format;
    
    if (expectedFormat === "JSON" || expectedFormat === "Structured data") {
      try {
        // Attempt to extract JSON from markdown blocks if necessary
        let jsonStr = rawOutput;
        const match = rawOutput.match(/```(?:json)?\n([\s\S]*?)\n```/);
        if (match) {
          jsonStr = match[1];
        }
        return JSON.parse(jsonStr);
      } catch (error) {
        // Validation Error
        throw new Error("Failed to parse expected JSON output from model");
      }
    }

    // Default to returning the raw text
    return rawOutput;
  }
}
