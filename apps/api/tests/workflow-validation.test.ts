import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  validateCreateRun,
  validateCreateWorkflow,
  validateSteps,
  validateUpdateRun,
} from "../src/modules/workflows/workflow-validation.js";

describe("DB-15 workflow validation", () => {
  it("normalizes a workflow and preserves the existing sequential contract", () => {
    const organizationId = randomUUID();
    const workflow = validateCreateWorkflow(organizationId, randomUUID(), {
      id: randomUUID(),
      workspaceId: randomUUID(),
      name: "Student onboarding",
      status: "active",
      configuration: { mode: "sequential" },
    });
    expect(workflow.organizationId).toBe(organizationId);
    expect(workflow.version).toBe("1.0.0");
    expect(workflow.description).toBe("");
  });

  it("rejects duplicate step order and unsupported step types", () => {
    expect(() =>
      validateSteps({
        steps: [
          { id: randomUUID(), name: "One", type: "agent", order: 0 },
          { id: randomUUID(), name: "Two", type: "tool", order: 0 },
        ],
      }),
    ).toThrow("order values must be unique");
    expect(() => validateSteps({ steps: [{ name: "One", type: "webhook", order: 0 }] })).toThrow(
      "Unsupported type",
    );
  });

  it("rejects secret-like workflow input and accepts durable step results", () => {
    expect(() =>
      validateCreateRun(randomUUID(), randomUUID(), {
        workflowId: randomUUID(),
        input: { password: "do-not-store" },
      }),
    ).toThrow("secret-like");
    const stepId = randomUUID();
    const update = validateUpdateRun({
      status: "completed",
      stepResults: { [stepId]: { success: true, status: "completed", data: { count: 2 } } },
    });
    expect(update.stepResults?.[stepId].status).toBe("completed");
  });
});
