import { describe, expect, it, vi, beforeEach } from "vitest";
import { MockAiProvider } from "../src/modules/agents/providers/mock-ai-provider.js";
import {
  AgentToolGatewayService,
} from "../src/modules/agents/tools/agent-tool-gateway.service.js";
import {
  getTrustedTool,
  listTrustedTools,
} from "../src/modules/agents/tools/trusted-tool-registry.js";
import type { ToolDomainContext } from "../src/modules/agents/tools/agent-tool.types.js";

describe("Epic 16: End-to-End Agent Tools Integration & Multi-Step Runtime Lifecycle", () => {
  let mockRepo: any;
  let mockDb: any;
  let gateway: AgentToolGatewayService;
  let mockProvider: MockAiProvider;

  const testContext: any = {
    organizationId: "org-mentor-school",
    workspaceId: "ws-primary",
    agentId: "agent-academic-planner",
    userId: "user-teacher-sarah",
    callerUserId: "user-teacher-sarah",
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
    agentOrganizationId: "org-mentor-school",
    allowedToolKeys: [
      "education.academic_structure.read",
      "education.subjects.list",
      "education.curriculum.read",
      "education.lesson_plans.read",
      "education.lesson_plans.create_draft",
      "education.lesson_plans.update_draft",
      "education.lesson_plans.publish",
    ],
    configurationRevisionId: "rev-v1",
  };

  const executionHistory: any[] = [];

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
      createExecution: vi.fn(async (record: any) => {
        const item = { ...record, id: `exec-${executionHistory.length + 1}` };
        executionHistory.push(item);
        return item;
      }),
      createExecutionRecord: vi.fn(async (record: any) => {
        const item = { ...record, id: `exec-${executionHistory.length + 1}` };
        executionHistory.push(item);
        return item;
      }),
      updateExecution: vi.fn(async (id: string, updates: any) => {
        const item = executionHistory.find((e) => e.id === id);
        if (item) Object.assign(item, updates);
        return updates;
      }),
      updateExecutionRecord: vi.fn(async (id: string, updates: any) => {
        const item = executionHistory.find((e) => e.id === id);
        if (item) Object.assign(item, updates);
        return updates;
      }),
    };

    mockDb = {};

    gateway = new AgentToolGatewayService(
      mockDb,
      mockRepo,
      {
        createApprovalRequest: vi.fn(async () => ({ id: "approval-req-publish-456" })),
        recordEvent: vi.fn(async () => {}),
      },
      {
        getByIdForOrganization: vi.fn(async () => ({
          id: "agent-academic-planner",
          agentKey: "academic-planning-assistant",
          name: "Academic Planning Assistant",
          tools: [],
        })),
      },
    );
    mockProvider = new MockAiProvider();
  });

  it("completes full educational tool discovery and autonomous invocation lifecycle", async () => {
    // 1. Tool discovery
    const availableTools = listTrustedTools();
    expect(availableTools.length).toBeGreaterThanOrEqual(7);

    // 2. Step 1: Agent inspects academic structure
    const step1 = await gateway.executeTool({
      runId: "run-e2e-1",
      toolKey: "education.academic_structure.read",
      input: {},
    }, testContext);
    expect(step1.success).toBe(true);
    expect((step1.data as any).gradeLevels).toBeDefined();

    // 3. Step 2: Agent queries subjects for Grade 9
    const step2 = await gateway.executeTool({
      runId: "run-e2e-1",
      toolKey: "education.subjects.list",
      input: { gradeLevel: "Grade 9" },
    }, testContext);
    expect(step2.success).toBe(true);
    expect((step2.data as any).subjects).toContain("Science");

    // 4. Step 3: Agent queries curriculum for Periodic Table topic
    const step3 = await gateway.executeTool({
      runId: "run-e2e-1",
      toolKey: "education.curriculum.read",
      input: { subject: "Science", gradeLevel: "Grade 9", topic: "Periodic Trends" },
    }, testContext);
    expect(step3.success).toBe(true);
    expect((step3.data as any).verifiedCurriculumAlignment).toBe(false); // Unverified guidance principle!

    // 5. Step 4: Agent creates editable lesson plan draft
    const step4 = await gateway.executeTool({
      runId: "run-e2e-1",
      toolKey: "education.lesson_plans.create_draft",
      input: {
        title: "Periodic Trends and Electronegativity",
        grade: "Grade 9",
        subject: "Science",
        topic: "Periodic Trends",
        durationMinutes: 45,
        objectives: [
          "Explain atomic radius trends across a period",
          "Identify electronegativity patterns",
        ],
        teachingSequence: [
          "Hook: Compare alkali metals vs halogens (5 min)",
          "Direct instruction on atomic radius (15 min)",
          "Guided practice: Trend sorting activity (15 min)",
          "Formative exit ticket (10 min)",
        ],
      },
    }, testContext);
    expect(step4.success).toBe(true);
    expect((step4.data as any).planId).toBeDefined();
    expect((step4.data as any).status).toBe("draft");

    const createdPlanId = (step4.data as any).planId;

    // 6. Step 5: Teacher refines draft with update_draft tool
    const step5 = await gateway.executeTool({
      runId: "run-e2e-1",
      toolKey: "education.lesson_plans.update_draft",
      input: {
        planId: createdPlanId,
        guidedPractice: "Collaborative trend ordering on interactive whiteboard",
      },
    }, testContext);
    expect(step5.success).toBe(true);
    expect((step5.data as any).updated).toBe(true);

    // 7. Step 6: Agent/Teacher initiates publishing to LMS (high-risk gate)
    const step6 = await gateway.executeTool({
      runId: "run-e2e-1",
      toolKey: "education.lesson_plans.publish",
      input: {
        planId: createdPlanId,
        publishNotes: "Reviewed and approved for Grade 9 Science section A",
      },
    }, testContext);
    expect(step6.success).toBe(false);
    expect(step6.approvalRequired).toBe(true);
    expect(step6.approvalRequestId).toBe("approval-req-publish-456");

    // 8. Step 7: Human supervisor approves -> re-invoked with preApproved: true
    const step7 = await gateway.executeTool({
      runId: "run-e2e-1",
      toolKey: "education.lesson_plans.publish",
      input: {
        planId: createdPlanId,
      },
    }, { ...testContext, preApproved: true });
    expect(step7.success).toBe(true);
    expect((step7.data as any).status).toBe("published");

    // 9. Verify full execution audit trail
    expect(executionHistory.length).toBeGreaterThanOrEqual(6);
    for (const record of executionHistory) {
      expect(record.inputDigest).toBeDefined();
      expect(record.inputDigest).toHaveLength(64);
      expect(record.organizationId).toBe("org-mentor-school");
      expect(record.agentId).toBe("agent-academic-planner");
    }
  });

  it("MockAiProvider correctly simulates tool calls when tools parameter is provided", async () => {
    const tools = [
      {
        name: "education.subjects.list",
        description: "List subjects",
        parameters: { type: "object", properties: { gradeLevel: { type: "string" } } },
      },
    ];

    const response = await mockProvider.invoke({
      model: "mock-gpt-4o",
      messages: [{ role: "user", content: "What subjects are taught in Grade 9?" }],
      tools,
    });

    expect(response.toolCalls).toBeDefined();
    expect(response.toolCalls?.length).toBe(1);
    expect(response.toolCalls?.[0].name).toBe("education.subjects.list");
  });
});
