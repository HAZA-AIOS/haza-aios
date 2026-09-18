import { describe, expect, it } from "vitest";
import {
  chunkKnowledge,
  scoreKnowledge,
  validateKnowledge,
} from "../src/modules/agents/knowledge-validation.js";

describe("knowledge ingestion and retrieval", () => {
  it("rejects empty, oversized, binary and public inputs", () => {
    for (const input of [
      null,
      [],
      { name: " ", content: "ok" },
      { name: "x", content: "x".repeat(12001) },
      { name: "x", content: "a\0b" },
      { name: "x", content: "ok", visibility: "public" },
    ]) {
      expect(() => validateKnowledge(input)).toThrow();
    }
  });
  it("ignores caller ownership and normalizes input", () => {
    expect(
      validateKnowledge({ name: " Policy ", content: " Test ", organizationId: "other" }),
    ).toEqual({
      name: "Policy",
      content: "Test",
      description: "",
      type: "text",
      visibility: "internal",
    });
  });
  it("chunks Unicode without splitting surrogate pairs and overlaps boundaries", () => {
    const chunks = chunkKnowledge("😀".repeat(2100));
    expect(Array.from(chunks[0])).toHaveLength(2000);
    expect(Array.from(chunks[1])).toHaveLength(300);
    expect(chunks.join("")).not.toContain("\ufffd");
  });
  it("does not invent matches and bounds relevance", () => {
    expect(scoreKnowledge("biology", "Finance", "Tuition policy")).toBe(0);
    expect(scoreKnowledge("!!!", "Finance", "Tuition policy")).toBe(0);
    expect(scoreKnowledge("tuition tuition", "Tuition", "Tuition policy")).toBe(1);
  });
});
