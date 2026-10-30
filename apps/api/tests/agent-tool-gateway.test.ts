import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  AgentToolGatewayService,
  computeInputDigest,
  validateInputAgainstSchema,
} from "../src/modules/agents/tools/agent-tool-gateway.service.js";
import {
  listTrustedTools,
  getTrustedTool,
} from "../src/modules/agents/tools/trusted-tool-registry.js";
import type { ToolDomainContext, ToolExecutionRequest } from "../src/modules/agents/tools/agent-tool.types.js";

describe("Epic 16: Agent Tool Gateway & Organizational Data Security Tests", () => {
  let mockRepo: any;
  let mockDb: any;
  let gateway: AgentToolGatewayService;

  const validContext: any = {
    organizationId: "org-test-1",
    workspaceId: "ws-test-1",
    agentId: "agent-academic-assistant-1",
    userId: "user-teacher-1",
    callerUserId: "user-teacher-1",
    callerPermissions: [
      "tool.read",
      "tool.execute",
      "education.academic.read",
      "education.lesson_plan.read",
      "education.lesson_plan.manage",
      "education.lesson_plan.create",
      "education.lesson_plan.publish",
      "education.academic.manage",
      "workspace.read",
    ],
    userPermissions: [
      "tool.read",
      "tool.execute",
      "education.academic.read",
      "education.lesson_plan.read",
      "education.lesson_plan.manage",
      "education.lesson_plan.create",
      "education.lesson_plan.publish",
      "education.academic.manage",
      "workspace.read",
    ],
    agentOrganizationId: "org-test-1",
    allowedToolKeys: [
      "education.academic_structure.read",
      "education.subjects.list",
      "education.curriculum.read",
      "education.lesson_plans.read",
      "education.lesson_plans.create_draft",
      "education.lesson_plans.update_draft",
      "education.lesson_plans.publish",
    ],
    configurationRevisionId: "rev-1",
  };

  beforeEach(() => {
    mockRepo = {
      findToolByKey: vi.fn(async (key: string) => {
        const tool = getTrustedTool(key);
        if (!tool) return null;
        return {
          id: `id-${key}`,
          toolKey: tool.toolKey,
          name: tool.name,
          riskLevel: tool.riskLevel,
          version: tool.version,
          approvalPolicy: tool.approvalPolicy,
          enabled: tool.enabled,
          deprecated: tool.deprecated,
          executionMode: tool.executionMode,
          timeoutMs: tool.timeoutMs,
          maxAttempts: tool.maxAttempts,
          inputSchema: tool.inputSchema,
          outputSchema: tool.outputSchema,
          requiredPermissions: tool.requiredPermissions,
        };
      }),
      getTenantPolicy: vi.fn(async () => null),
      findTenantPolicy: vi.fn(async () => null),
      createExecution: vi.fn(async (record: any) => ({
        ...record,
        id: `exec-${Date.now()}`,
      })),
      createExecutionRecord: vi.fn(async (record: any) => ({
        ...record,
        id: `exec-${Date.now()}`,
      })),
      updateExecution: vi.fn(async (id: string, updates: any) => updates),
      updateExecutionRecord: vi.fn(async (id: string, updates: any) => updates),
    };

    mockDb = {};

    gateway = new AgentToolGatewayService(
      mockDb,
      mockRepo,
      {
        createApprovalRequest: vi.fn(async () => ({ id: "approval-req-123" })),
        recordEvent: vi.fn(async () => {}),
      },
      {
        getByIdForOrganization: vi.fn(async () => ({
          id: "agent-academic-assistant-1",
          agentKey: "academic-planning-assistant",
          name: "Academic Planning Assistant",
          tools: [],
        })),
      },
    );
  });

  describe("Input Schema Validation & SHA-256 Digest", () => {
    it("computes deterministic SHA-256 digest regardless of object key ordering", () => {
      const digest1 = computeInputDigest({ subject: "Math", gradeLevel: "Grade 5" });
      const digest2 = computeInputDigest({ gradeLevel: "Grade 5", subject: "Math" });
      expect(digest1).toBe(digest2);
      expect(digest1).toHaveLength(64);
    });

    it("validates valid input against tool schema without error", () => {
      const schema = {
        type: "object",
        properties: {
          gradeLevel: { type: "string" },
          subject: { type: "string" },
        },
        required: ["gradeLevel"],
      };

      const result = validateInputAgainstSchema({ gradeLevel: "Grade 8", subject: "Science" }, schema);
      expect(result.valid).toBe(true);
      expect(result.sanitizedInput).toEqual({ gradeLevel: "Grade 8", subject: "Science" });
    });

    it("rejects input missing required schema fields", () => {
      const schema = {
        type: "object",
        properties: {
          gradeLevel: { type: "string" },
        },
        required: ["gradeLevel"],
      };

      const result = validateInputAgainstSchema({}, schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing required property: gradeLevel");
    });

    it("rejects input with invalid data types", () => {
      const schema = {
        type: "object",
        properties: {
          count: { type: "number" },
        },
        required: ["count"],
      };

      const result = validateInputAgainstSchema({ count: "not-a-number" as any }, schema);
      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toContain("Expected type number for property count");
    });

    it("rejects unauthorized extra injected properties", () => {
      const schema = {
        type: "object",
        properties: {
          gradeLevel: { type: "string" },
        },
        required: ["gradeLevel"],
      };

      const result = validateInputAgainstSchema(
        { gradeLevel: "Grade 5", sqlInjection: "'; DROP TABLE users; --" },
        schema,
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Unexpected property 'sqlInjection' not permitted by schema");
    });
  });

  describe("Security Boundaries & Tenant Isolation", () => {
    it("rejects cross-tenant execution when agent org does not match request org", async () => {
      const crossTenantContext = {
        ...validContext,
        agentOrganizationId: "org-malicious-different",
      };

      const request: ToolExecutionRequest = {
        runId: "run-1",
        toolKey: "education.academic_structure.read",
        input: {},
      };

      const result = await gateway.executeTool(request, crossTenantContext);
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("Tenant mismatch");
    });

    it("rejects tool when not explicitly allowlisted in agent configuration", async () => {
      const restrictedContext = {
        ...validContext,
        allowedToolKeys: ["education.subjects.list"], // academic_structure is NOT allowlisted
      };

      const request: ToolExecutionRequest = {
        runId: "run-1",
        toolKey: "education.academic_structure.read",
        input: {},
      };

      const result = await gateway.executeTool(request, restrictedContext);
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("is not explicitly allowlisted");
    });

    it("rejects tool when tenant policy disables it", async () => {
      mockRepo.getTenantPolicy.mockResolvedValueOnce({
        enabled: false,
      });

      const request: ToolExecutionRequest = {
        runId: "run-1",
        toolKey: "education.subjects.list",
        input: {},
      };

      const result = await gateway.executeTool(request, validContext);
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("disabled by organization policy");
    });

    it("rejects tool when agent is not in tenant policy allowedAgentIds list", async () => {
      mockRepo.getTenantPolicy.mockResolvedValueOnce({
        enabled: true,
        allowedAgentIds: ["agent-different-id"],
      });

      const request: ToolExecutionRequest = {
        runId: "run-1",
        toolKey: "education.subjects.list",
        input: {},
      };

      const result = await gateway.executeTool(request, validContext);
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("Agent is not authorized");
    });

    it("rejects execution when caller lacks required tool permissions", async () => {
      const unprivilegedContext = {
        ...validContext,
        callerPermissions: ["other.permission"],
        userPermissions: ["other.permission"],
      };

      const request: ToolExecutionRequest = {
        runId: "run-1",
        toolKey: "education.academic_structure.read",
        input: {},
      };

      const result = await gateway.executeTool(request, unprivilegedContext);
      expect(result.success).toBe(false);
      expect(result.error?.category).toBe("UNAUTHORIZED");
      expect(result.error?.message).toContain("lacks required permissions");
    });
  });

  describe("Risk-Based Human Approval Policy Gating", () => {
    it("executes low-risk read tool immediately without approval gate", async () => {
      const request: ToolExecutionRequest = {
        runId: "run-1",
        toolKey: "education.academic_structure.read",
        input: {},
      };

      const result = await gateway.executeTool(request, validContext);
      expect(result.success).toBe(true);
      expect(result.approvalRequired).toBeUndefined();
      expect(result.data).toBeDefined();
      expect((result.data as any).academicYears).toBeDefined();
    });

    it("pauses high-risk tool (lesson_plans.publish) and requires human approval", async () => {
      const request: ToolExecutionRequest = {
        runId: "run-1",
        toolKey: "education.lesson_plans.publish",
        input: {
          planId: "plan-draft-123",
          publishNotes: "Verified curriculum coverage",
        },
      };

      const result = await gateway.executeTool(request, validContext);
      expect(result.success).toBe(false);
      expect(result.approvalRequired).toBe(true);
      expect(result.approvalRequestId).toBe("approval-req-123");
    });

    it("executes high-risk tool when explicit pre-approval is provided", async () => {
      const preApprovedRequest: any = {
        runId: "run-1",
        toolKey: "education.lesson_plans.publish",
        input: {
          planId: "plan-draft-123",
        },
        preApproved: true,
      };

      const result = await gateway.executeTool(preApprovedRequest, validContext);
      expect(result.success).toBe(true);
      expect(result.approvalRequired).toBeUndefined();
      expect(result.data).toBeDefined();
      expect((result.data as any).status).toBe("published");
    });
  });

  describe("Trusted Tool Registry & Domain Minimization", () => {
    it("registers all 7 production education tools with explicit schemas and permissions", () => {
      const tools = listTrustedTools();
      expect(tools.length).toBe(7);

      const toolKeys = tools.map((t) => t.toolKey);
      expect(toolKeys).toContain("education.academic_structure.read");
      expect(toolKeys).toContain("education.subjects.list");
      expect(toolKeys).toContain("education.curriculum.read");
      expect(toolKeys).toContain("education.lesson_plans.read");
      expect(toolKeys).toContain("education.lesson_plans.create_draft");
      expect(toolKeys).toContain("education.lesson_plans.update_draft");
      expect(toolKeys).toContain("education.lesson_plans.publish");
    });

    it("never exposes student PII in educational domain outputs", async () => {
      const request: ToolExecutionRequest = {
        runId: "run-1",
        toolKey: "education.academic_structure.read",
        input: {},
      };

      const result = await gateway.executeTool(request, validContext);
      const stringified = JSON.stringify(result.data);

      // Verify zero student PII fields
      expect(stringified).not.toContain("studentId");
      expect(stringified).not.toContain("studentName");
      expect(stringified).not.toContain("gradeRecord");
      expect(stringified).not.toContain("attendance");
    });
  });
});
