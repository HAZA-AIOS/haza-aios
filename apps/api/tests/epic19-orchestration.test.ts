import { describe, expect, it, beforeEach } from "vitest";
import {
  validateCreateAgentTeam,
  validateCreateWorkflowDefinition,
  validateWorkflowDAG,
} from "../src/modules/agents/validation/orchestration-validation.js";
import { AgentTeamRepository } from "../src/modules/agents/repositories/agent-team.repository.js";
import { AgentWorkflowRepository } from "../src/modules/agents/repositories/agent-workflow.repository.js";
import { AgentRepository } from "../src/modules/agents/repositories/agent.repository.js";
import { AgentTeamService } from "../src/modules/agents/services/agent-team.service.js";
import { AgentOrchestrationService } from "../src/modules/agents/services/agent-orchestration.service.js";
import type { DatabaseClient } from "../src/database/client.js";
import type {
  CreateWorkflowStepInput,
  AgentTeamRecord,
  AgentTeamMemberRecord,
  AgentWorkflowDefinitionRecord,
  AgentWorkflowStepRecord,
  AgentWorkflowRunRecord,
  AgentWorkflowStepRunRecord,
  AgentWorkflowArtifactRecord,
  AgentWorkflowEventRecord,
} from "../src/modules/agents/orchestration.types.js";

describe("Epic 19: Multi-Agent Collaboration & Orchestration", () => {
  const ORG_ID = "00000000-0000-4801-a000-000000000001";
  const OTHER_ORG_ID = "00000000-0000-4801-b000-000000000002";
  const WORKSPACE_ID = "00000000-0000-4801-w000-000000000001";
  const USER_ID = "00000000-0000-4801-u000-000000000001";

  // =========================================================================
  // 1. DAG VALIDATION & CYCLE DETECTION ENGINE TESTS
  // =========================================================================
  describe("DAG Validation & Cycle Detection Engine", () => {
    it("validates a linear sequential workflow DAG with correct execution order", () => {
      const steps: CreateWorkflowStepInput[] = [
        {
          stepKey: "plan",
          name: "Curriculum Planner",
          description: "Develops unit outline",
          stepOrder: 0,
          assignedRole: "planner",
          assignedAgentId: null,
          dependsOnStepKeys: [],
          requiresApproval: false,
          approvalRoles: [],
          inputMapping: {},
          outputKey: "unit_plan",
          maxRetries: 2,
          timeoutSeconds: 300,
          configuration: {},
        },
        {
          stepKey: "draft",
          name: "Lesson Specialist",
          description: "Generates daily lesson activities",
          stepOrder: 1,
          assignedRole: "specialist",
          assignedAgentId: null,
          dependsOnStepKeys: ["plan"],
          requiresApproval: false,
          approvalRoles: [],
          inputMapping: { plan: "unit_plan" },
          outputKey: "lesson_drafts",
          maxRetries: 2,
          timeoutSeconds: 300,
          configuration: {},
        },
        {
          stepKey: "review",
          name: "Academic Reviewer",
          description: "Evaluates alignment with standards",
          stepOrder: 2,
          assignedRole: "reviewer",
          assignedAgentId: null,
          dependsOnStepKeys: ["draft"],
          requiresApproval: true,
          approvalRoles: ["curriculum_coordinator"],
          inputMapping: { draft: "lesson_drafts" },
          outputKey: "final_evaluation",
          maxRetries: 2,
          timeoutSeconds: 300,
          configuration: {},
        },
      ];

      const result = validateWorkflowDAG(steps, ["planner", "specialist", "reviewer"]);
      expect(result.valid).toBe(true);
      expect(result.cycleDetected).toBe(false);
      expect(result.errors).toHaveLength(0);
      expect(result.executionOrder).toEqual(["plan", "draft", "review"]);
    });

    it("validates a parallel branch workflow (fork-join) DAG", () => {
      const steps: CreateWorkflowStepInput[] = [
        {
          stepKey: "plan",
          name: "Planner",
          description: "Creates outline",
          stepOrder: 0,
          assignedRole: "planner",
          assignedAgentId: null,
          dependsOnStepKeys: [],
          requiresApproval: false,
          approvalRoles: [],
          inputMapping: {},
          outputKey: "plan_out",
          maxRetries: 2,
          timeoutSeconds: 300,
          configuration: {},
        },
        {
          stepKey: "activities_specialist",
          name: "Activities Specialist",
          description: "Generates hands-on lab experiments",
          stepOrder: 1,
          assignedRole: "specialist",
          assignedAgentId: null,
          dependsOnStepKeys: ["plan"],
          requiresApproval: false,
          approvalRoles: [],
          inputMapping: {},
          outputKey: "activities_out",
          maxRetries: 2,
          timeoutSeconds: 300,
          configuration: {},
        },
        {
          stepKey: "assessment_specialist",
          name: "Assessment Specialist",
          description: "Creates formative quizzes and rubrics",
          stepOrder: 2,
          assignedRole: "specialist",
          assignedAgentId: null,
          dependsOnStepKeys: ["plan"],
          requiresApproval: false,
          approvalRoles: [],
          inputMapping: {},
          outputKey: "assessments_out",
          maxRetries: 2,
          timeoutSeconds: 300,
          configuration: {},
        },
        {
          stepKey: "synthesis",
          name: "Supervisor Synthesizer",
          description: "Combines activities and assessments into complete unit pack",
          stepOrder: 3,
          assignedRole: "supervisor",
          assignedAgentId: null,
          dependsOnStepKeys: ["activities_specialist", "assessment_specialist"],
          requiresApproval: true,
          approvalRoles: ["curriculum_director"],
          inputMapping: {},
          outputKey: "complete_unit_pack",
          maxRetries: 2,
          timeoutSeconds: 300,
          configuration: {},
        },
      ];

      const result = validateWorkflowDAG(steps, ["planner", "specialist", "supervisor"]);
      expect(result.valid).toBe(true);
      expect(result.cycleDetected).toBe(false);
      expect(result.errors).toHaveLength(0);
      expect(result.executionOrder[0]).toBe("plan");
      expect(result.executionOrder[3]).toBe("synthesis");
      // Intermediate parallel steps are in middle
      expect(result.executionOrder.slice(1, 3)).toContain("activities_specialist");
      expect(result.executionOrder.slice(1, 3)).toContain("assessment_specialist");
    });

    it("detects circular dependencies (cycles) using Kahn's algorithm and rejects invalid DAG", () => {
      const cyclicSteps: CreateWorkflowStepInput[] = [
        {
          stepKey: "step_a",
          name: "Step A",
          description: "Step A",
          stepOrder: 0,
          assignedRole: "planner",
          assignedAgentId: null,
          dependsOnStepKeys: ["step_c"], // Cyclic: A -> C -> B -> A
          requiresApproval: false,
          approvalRoles: [],
          inputMapping: {},
          outputKey: "out_a",
          maxRetries: 2,
          timeoutSeconds: 300,
          configuration: {},
        },
        {
          stepKey: "step_b",
          name: "Step B",
          description: "Step B",
          stepOrder: 1,
          assignedRole: "specialist",
          assignedAgentId: null,
          dependsOnStepKeys: ["step_a"],
          requiresApproval: false,
          approvalRoles: [],
          inputMapping: {},
          outputKey: "out_b",
          maxRetries: 2,
          timeoutSeconds: 300,
          configuration: {},
        },
        {
          stepKey: "step_c",
          name: "Step C",
          description: "Step C",
          stepOrder: 2,
          assignedRole: "reviewer",
          assignedAgentId: null,
          dependsOnStepKeys: ["step_b"],
          requiresApproval: false,
          approvalRoles: [],
          inputMapping: {},
          outputKey: "out_c",
          maxRetries: 2,
          timeoutSeconds: 300,
          configuration: {},
        },
      ];

      const result = validateWorkflowDAG(cyclicSteps);
      expect(result.valid).toBe(false);
      expect(result.cycleDetected).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("Cycle detected");
    });

    it("detects self-referencing step and missing dependencies", () => {
      const invalidSteps: CreateWorkflowStepInput[] = [
        {
          stepKey: "self_loop",
          name: "Looping Step",
          description: "Depends on itself",
          stepOrder: 0,
          assignedRole: "planner",
          assignedAgentId: null,
          dependsOnStepKeys: ["self_loop", "ghost_step"],
          requiresApproval: false,
          approvalRoles: [],
          inputMapping: {},
          outputKey: "out",
          maxRetries: 2,
          timeoutSeconds: 300,
          configuration: {},
        },
      ];

      const result = validateWorkflowDAG(invalidSteps);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("cannot depend on itself"))).toBe(true);
      expect(result.errors.some((e) => e.includes("non-existent step 'ghost_step'"))).toBe(true);
    });

    it("detects missing roles when compared against team role coverage", () => {
      const steps: CreateWorkflowStepInput[] = [
        {
          stepKey: "step_1",
          name: "Review",
          description: "Needs reviewer",
          stepOrder: 0,
          assignedRole: "reviewer",
          assignedAgentId: null,
          dependsOnStepKeys: [],
          requiresApproval: false,
          approvalRoles: [],
          inputMapping: {},
          outputKey: "out",
          maxRetries: 2,
          timeoutSeconds: 300,
          configuration: {},
        },
      ];

      const result = validateWorkflowDAG(steps, ["planner", "specialist"]);
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.unresolvedRoles).toContain("reviewer");
    });
  });

  // =========================================================================
  // 2. INPUT PAYLOAD VALIDATION TESTS
  // =========================================================================
  describe("Input Payload Validation", () => {
    it("validates valid Agent Team input", () => {
      const input = {
        name: "Grade 6 Science Multi-Agent Team",
        workspaceId: WORKSPACE_ID,
        description: "Specialized academic planning team",
        members: [
          { agentId: "agent-planner-1", role: "planner", priority: 1 },
          { agentId: "agent-specialist-1", role: "specialist", priority: 2 },
          { agentId: "agent-reviewer-1", role: "reviewer", priority: 3 },
        ],
      };

      const validated = validateCreateAgentTeam(ORG_ID, USER_ID, input);
      expect(validated.name).toBe("Grade 6 Science Multi-Agent Team");
      expect(validated.organizationId).toBe(ORG_ID);
      expect(validated.members).toHaveLength(3);
      expect(validated.members[0].role).toBe("planner");
    });

    it("rejects Agent Team with duplicate agent assignments or invalid roles", () => {
      const dupAgentInput = {
        name: "Duplicate Team",
        workspaceId: WORKSPACE_ID,
        members: [
          { agentId: "agent-1", role: "planner" },
          { agentId: "agent-1", role: "specialist" },
        ],
      };

      expect(() => validateCreateAgentTeam(ORG_ID, USER_ID, dupAgentInput)).toThrow(
        /assigned more than once/,
      );

      const invalidRoleInput = {
        name: "Invalid Role Team",
        workspaceId: WORKSPACE_ID,
        members: [{ agentId: "agent-1", role: "hacker" }],
      };

      expect(() => validateCreateAgentTeam(ORG_ID, USER_ID, invalidRoleInput)).toThrow(
        /Invalid member role/,
      );
    });

    it("validates Workflow Definition input and enforces step ordering", () => {
      const input = {
        name: "Science Unit Plan Workflow",
        workspaceId: WORKSPACE_ID,
        pattern: "sequential",
        steps: [
          {
            stepKey: "plan",
            name: "Unit Planning",
            assignedRole: "planner",
            dependsOnStepKeys: [],
          },
          {
            stepKey: "review",
            name: "Academic Review",
            assignedRole: "reviewer",
            dependsOnStepKeys: ["plan"],
            requiresApproval: true,
          },
        ],
      };

      const validated = validateCreateWorkflowDefinition(ORG_ID, USER_ID, input);
      expect(validated.name).toBe("Science Unit Plan Workflow");
      expect(validated.steps).toHaveLength(2);
      expect(validated.steps[0].stepKey).toBe("plan");
      expect(validated.steps[1].requiresApproval).toBe(true);
    });
  });

  // =========================================================================
  // 3. IN-MEMORY REPOSITORY & ORCHESTRATION SERVICE TESTS
  // =========================================================================
  describe("Agent Team & Orchestration Services (In-Memory)", () => {
    let teamsStore: Map<string, AgentTeamRecord>;
    let teamMembersStore: Map<string, AgentTeamMemberRecord[]>;
    let definitionsStore: Map<string, AgentWorkflowDefinitionRecord>;
    let stepsStore: Map<string, AgentWorkflowStepRecord[]>;
    let runsStore: Map<string, AgentWorkflowRunRecord>;
    let stepRunsStore: Map<string, AgentWorkflowStepRunRecord[]>;
    let artifactsStore: Map<string, AgentWorkflowArtifactRecord[]>;
    let eventsStore: Map<string, AgentWorkflowEventRecord[]>;

    let mockDb: DatabaseClient;
    let mockTeamRepo: any;
    let mockWorkflowRepo: any;
    let mockAgentRepo: any;
    let mockRuntimeService: any;
    let teamService: AgentTeamService;
    let orchestrationService: AgentOrchestrationService;

    beforeEach(() => {
      teamsStore = new Map();
      teamMembersStore = new Map();
      definitionsStore = new Map();
      stepsStore = new Map();
      runsStore = new Map();
      stepRunsStore = new Map();
      artifactsStore = new Map();
      eventsStore = new Map();

      mockDb = { db: {} } as unknown as DatabaseClient;

      // Mock Team Repo
      mockTeamRepo = {
        createTeam: async (input: any) => {
          const teamId = `team-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const memberRecords: AgentTeamMemberRecord[] = input.members.map((m: any, idx: number) => ({
            id: `member-${teamId}-${idx}`,
            teamId,
            agentId: m.agentId,
            role: m.role,
            capabilities: m.capabilities || [],
            priority: m.priority || 0,
            status: "active" as const,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }));
          const record: AgentTeamRecord = {
            id: teamId,
            organizationId: input.organizationId,
            workspaceId: input.workspaceId,
            name: input.name,
            description: input.description || "",
            status: "active",
            createdBy: input.createdBy,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            members: memberRecords,
          };
          teamsStore.set(teamId, record);
          teamMembersStore.set(teamId, memberRecords);
          return record;
        },
        getTeam: async (organizationId: string, teamId: string) => {
          const team = teamsStore.get(teamId);
          if (!team || team.organizationId !== organizationId) return null;
          return { ...team, members: teamMembersStore.get(teamId) || [] };
        },
        listTeams: async (organizationId: string, workspaceId?: string) => {
          const result: AgentTeamRecord[] = [];
          for (const team of teamsStore.values()) {
            if (team.organizationId === organizationId && (!workspaceId || team.workspaceId === workspaceId)) {
              result.push({ ...team, members: teamMembersStore.get(team.id) || [] });
            }
          }
          return result;
        },
      };

      // Mock Workflow Repo
      mockWorkflowRepo = {
        createDefinition: async (input: any) => {
          const defId = `def-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const stepRecords: AgentWorkflowStepRecord[] = input.steps.map((s: any, idx: number) => ({
            id: `step-${defId}-${idx}`,
            workflowDefinitionId: defId,
            organizationId: input.organizationId,
            stepKey: s.stepKey,
            name: s.name,
            description: s.description || "",
            stepOrder: s.stepOrder ?? idx,
            assignedRole: s.assignedRole,
            assignedAgentId: s.assignedAgentId || null,
            dependsOnStepKeys: s.dependsOnStepKeys || [],
            requiresApproval: Boolean(s.requiresApproval),
            approvalRoles: s.approvalRoles || [],
            inputMapping: s.inputMapping || {},
            outputKey: s.outputKey,
            maxRetries: s.maxRetries ?? 2,
            timeoutSeconds: s.timeoutSeconds ?? 300,
            configuration: s.configuration || {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }));
          stepsStore.set(defId, stepRecords);

          const record: AgentWorkflowDefinitionRecord = {
            id: defId,
            organizationId: input.organizationId,
            workspaceId: input.workspaceId,
            teamId: input.teamId || null,
            name: input.name,
            description: input.description || "",
            pattern: input.pattern || "sequential",
            status: "published",
            version: input.version || "1.0.0",
            revision: 1,
            inputSchema: input.inputSchema || {},
            outputSchema: input.outputSchema || null,
            configuration: input.configuration || {},
            createdBy: input.createdBy,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            steps: stepRecords,
          };
          definitionsStore.set(defId, record);
          return record;
        },
        getDefinition: async (organizationId: string, definitionId: string) => {
          const def = definitionsStore.get(definitionId);
          if (!def || def.organizationId !== organizationId) return null;
          return { ...def, steps: stepsStore.get(definitionId) || [] };
        },
        listDefinitions: async (organizationId: string, workspaceId?: string) => {
          const result: AgentWorkflowDefinitionRecord[] = [];
          for (const def of definitionsStore.values()) {
            if (def.organizationId === organizationId && (!workspaceId || def.workspaceId === workspaceId)) {
              result.push({ ...def, steps: stepsStore.get(def.id) || [] });
            }
          }
          return result;
        },
        createRun: async (input: any) => {
          const runId = `wfrun-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const run: AgentWorkflowRunRecord = {
            id: runId,
            organizationId: input.organizationId,
            workspaceId: input.workspaceId,
            workflowDefinitionId: input.workflowDefinitionId,
            teamId: input.teamId || null,
            workflowRevision: input.workflowRevision || 1,
            initiatorUserId: input.initiatorUserId,
            status: "queued",
            idempotencyKey: input.idempotencyKey || null,
            initialInput: input.initialInput,
            finalOutput: null,
            sharedContext: { initialInput: input.initialInput },
            currentStepKey: null,
            totalDurationMs: 0,
            totalEstimatedCostUsd: "0.000000",
            totalPromptTokens: 0,
            totalCompletionTokens: 0,
            safeErrorMessage: null,
            startedAt: null,
            completedAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            stepRuns: [],
            artifacts: [],
          };
          runsStore.set(runId, run);
          stepRunsStore.set(runId, []);
          artifactsStore.set(runId, []);
          eventsStore.set(runId, []);
          return run;
        },
        getRun: async (organizationId: string, runId: string) => {
          const run = runsStore.get(runId);
          if (!run || run.organizationId !== organizationId) return null;
          return {
            ...run,
            stepRuns: stepRunsStore.get(runId) || [],
            artifacts: artifactsStore.get(runId) || [],
          };
        },
        updateRun: async (organizationId: string, runId: string, updates: any) => {
          const run = runsStore.get(runId);
          if (!run) return null;
          Object.assign(run, updates, { updatedAt: new Date().toISOString() });
          return run;
        },
        createStepRun: async (input: any) => {
          const stepRunId = `steprun-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const stepRun: AgentWorkflowStepRunRecord = {
            id: stepRunId,
            workflowRunId: input.workflowRunId,
            stepId: input.stepId,
            stepKey: input.stepKey,
            organizationId: input.organizationId,
            assignedAgentId: input.assignedAgentId || null,
            agentRunId: null,
            status: input.status || "pending",
            inputPayload: input.inputPayload || {},
            outputPayload: null,
            durationMs: 0,
            promptTokens: 0,
            completionTokens: 0,
            retryCount: 0,
            safeErrorMessage: null,
            startedAt: new Date().toISOString(),
            completedAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          const list = stepRunsStore.get(input.workflowRunId) || [];
          list.push(stepRun);
          stepRunsStore.set(input.workflowRunId, list);
          return stepRun;
        },
        listStepRuns: async (runId: string) => {
          return stepRunsStore.get(runId) || [];
        },
        updateStepRun: async (stepRunId: string, updates: any) => {
          for (const list of stepRunsStore.values()) {
            const match = list.find((s) => s.id === stepRunId);
            if (match) {
              Object.assign(match, updates, { updatedAt: new Date().toISOString() });
              return match;
            }
          }
          return null;
        },
        createArtifact: async (input: any) => {
          const artifactId = `art-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const artifact: AgentWorkflowArtifactRecord = {
            id: artifactId,
            workflowRunId: input.workflowRunId,
            stepRunId: input.stepRunId,
            organizationId: input.organizationId,
            workspaceId: input.workspaceId,
            artifactType: input.artifactType,
            name: input.name,
            content: input.content,
            provenance: input.provenance || {},
            visibility: input.visibility || "workspace",
            metadata: input.metadata || {},
            createdAt: new Date().toISOString(),
          };
          const list = artifactsStore.get(input.workflowRunId) || [];
          list.push(artifact);
          artifactsStore.set(input.workflowRunId, list);
          return artifact;
        },
        listArtifacts: async (runId: string) => {
          return artifactsStore.get(runId) || [];
        },
        recordEvent: async (input: any) => {
          const eventId = `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const event: AgentWorkflowEventRecord = {
            id: eventId,
            workflowRunId: input.workflowRunId,
            stepRunId: input.stepRunId || null,
            organizationId: input.organizationId,
            eventType: input.eventType,
            payload: input.payload || {},
            createdAt: new Date().toISOString(),
          };
          const list = eventsStore.get(input.workflowRunId) || [];
          list.push(event);
          eventsStore.set(input.workflowRunId, list);
          return event;
        },
        listEvents: async (runId: string) => {
          return eventsStore.get(runId) || [];
        },
      };

      // Mock Agent Repo
      mockAgentRepo = {
        listByOrganization: async () => [{ id: "agent-1", name: "Default Agent" }],
        getAgent: async (agentId: string) => ({ id: agentId, name: "Academic Agent" }),
      };

      // Mock Runtime Service
      mockRuntimeService = {
        createRun: async (params: any) => ({
          run: {
            id: `agent-run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            status: "completed",
            output: {
              lessonPlan: "Unit outline and 5 lesson activities for Living Systems",
            },
          },
        }),
        claimAndExecute: async () => ({
          success: true,
          run: {
            id: `agent-run-claimed`,
            status: "completed",
            output: {
              lessonPlan: "Unit outline and 5 lesson activities for Living Systems",
            },
          },
        }),
      };

      teamService = new AgentTeamService(mockDb, mockTeamRepo as unknown as AgentTeamRepository);
      orchestrationService = new AgentOrchestrationService(mockDb, {
        workflowRepo: mockWorkflowRepo as unknown as AgentWorkflowRepository,
        teamRepo: mockTeamRepo as unknown as AgentTeamRepository,
        agentRepo: mockAgentRepo as unknown as AgentRepository,
        runtimeService: mockRuntimeService,
      });
    });

    it("creates a team and verifies organization isolation", async () => {
      const teamInput = {
        organizationId: ORG_ID,
        workspaceId: WORKSPACE_ID,
        name: "Middle School Science Team",
        description: "Specialized team for MS Science lesson plans",
        members: [
          { agentId: "agent-1", role: "planner" as const, capabilities: ["planning"], priority: 1 },
          { agentId: "agent-2", role: "specialist" as const, capabilities: ["drafting"], priority: 2 },
        ],
        createdBy: USER_ID,
      };

      const team = await teamService.createTeam(teamInput);
      expect(team.id).toBeDefined();
      expect(team.members).toHaveLength(2);

      // Same org can retrieve team
      const retrieved = await teamService.getTeam(ORG_ID, team.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.name).toBe("Middle School Science Team");

      // Different org cannot retrieve team (throws 404 NOT_FOUND)
      await expect(teamService.getTeam(OTHER_ORG_ID, team.id)).rejects.toThrow(/not found/);
    });

    it("creates a workflow, initializes a run, and executes initial steps", async () => {
      // 1. Create team
      const team = await teamService.createTeam({
        organizationId: ORG_ID,
        workspaceId: WORKSPACE_ID,
        name: "MS Science Team",
        description: "MS Science Team",
        members: [
          { agentId: "agent-planner", role: "planner" as const, capabilities: [], priority: 1 },
          { agentId: "agent-specialist", role: "specialist" as const, capabilities: [], priority: 2 },
          { agentId: "agent-reviewer", role: "reviewer" as const, capabilities: [], priority: 3 },
        ],
        createdBy: USER_ID,
      });

      // 2. Create workflow definition
      const workflow = await orchestrationService.createDefinition({
        organizationId: ORG_ID,
        workspaceId: WORKSPACE_ID,
        teamId: team.id,
        name: "Grade 6 Science - Living Systems",
        description: "Unit plan creation workflow",
        pattern: "sequential",
        version: "1.0.0",
        inputSchema: { type: "object" },
        outputSchema: null,
        configuration: {},
        steps: [
          {
            stepKey: "plan_unit",
            name: "Unit Planning",
            description: "Produces overall unit structure",
            stepOrder: 0,
            assignedRole: "planner",
            assignedAgentId: "agent-planner",
            dependsOnStepKeys: [],
            requiresApproval: false,
            approvalRoles: [],
            inputMapping: {},
            outputKey: "unit_plan",
            maxRetries: 2,
            timeoutSeconds: 300,
            configuration: {},
          },
          {
            stepKey: "generate_activities",
            name: "Generate Activities",
            description: "Produces lab and formative activities",
            stepOrder: 1,
            assignedRole: "specialist",
            assignedAgentId: "agent-specialist",
            dependsOnStepKeys: ["plan_unit"],
            requiresApproval: false,
            approvalRoles: [],
            inputMapping: { unitPlan: "unit_plan" },
            outputKey: "activities",
            maxRetries: 2,
            timeoutSeconds: 300,
            configuration: {},
          },
        ],
        createdBy: USER_ID,
      });

      expect(workflow.id).toBeDefined();
      expect(workflow.steps).toHaveLength(2);

      // 3. Start workflow run
      const run = await orchestrationService.startWorkflowRun(
        ORG_ID,
        workflow.id,
        { topic: "Cells and Living Systems", gradeLevel: "Grade 6" },
        USER_ID,
      );

      expect(run.id).toBeDefined();
      expect(run.status).toBe("completed"); // All non-approval steps auto-complete via mock runtime
      expect(run.stepRuns).toHaveLength(2);

      // Verify execution events recorded
      const events = await mockWorkflowRepo.listEvents(run.id);
      expect(events.some((e: any) => e.eventType === "workflow_started")).toBe(true);
      expect(events.some((e: any) => e.eventType === "workflow_completed")).toBe(true);
    });

    it("enforces human approval pause and resumes upon human decision", async () => {
      // 1. Setup workflow with an immediate approval gate
      const workflow = await orchestrationService.createDefinition({
        organizationId: ORG_ID,
        workspaceId: WORKSPACE_ID,
        teamId: null,
        name: "Approval Gate Workflow",
        description: "Testing human approval pause",
        pattern: "sequential",
        version: "1.0.0",
        inputSchema: { type: "object" },
        outputSchema: null,
        configuration: {},
        steps: [
          {
            stepKey: "approval_step",
            name: "Consequential Action Approval",
            description: "Requires explicit coordinator sign-off",
            stepOrder: 0,
            assignedRole: "reviewer",
            assignedAgentId: "agent-reviewer",
            dependsOnStepKeys: [],
            requiresApproval: true,
            approvalRoles: ["coordinator"],
            inputMapping: {},
            outputKey: "final_out",
            maxRetries: 2,
            timeoutSeconds: 300,
            configuration: {},
          },
        ],
        createdBy: USER_ID,
      });

      // 2. Start run - must enter waiting_approval
      const run = await orchestrationService.startWorkflowRun(
        ORG_ID,
        workflow.id,
        {},
        USER_ID,
      );
      expect(run.status).toBe("waiting_approval");

      const stepRun = run.stepRuns.find((s) => s.stepKey === "approval_step");
      expect(stepRun?.status).toBe("waiting_approval");

      // 3. Approve step run
      const approvedResult = await orchestrationService.approveStepRun(
        ORG_ID,
        run.id,
        "approval_step",
        "approved",
        USER_ID,
        "Unit plan alignment verified with provincial standards.",
      );

      expect(approvedResult.status).toBe("completed");
      const updatedStepRun = approvedResult.stepRuns.find((s) => s.stepKey === "approval_step");
      expect(updatedStepRun?.status).toBe("completed");
    });

    it("rejects approval step and transitions workflow to failed fail-closed state", async () => {
      const workflow = await orchestrationService.createDefinition({
        organizationId: ORG_ID,
        workspaceId: WORKSPACE_ID,
        teamId: null,
        name: "Rejection Workflow",
        description: "Testing human approval rejection",
        pattern: "sequential",
        version: "1.0.0",
        inputSchema: { type: "object" },
        outputSchema: null,
        configuration: {},
        steps: [
          {
            stepKey: "approval_step",
            name: "High Consequence Step",
            description: "Requires review",
            stepOrder: 0,
            assignedRole: "reviewer",
            assignedAgentId: "agent-reviewer",
            dependsOnStepKeys: [],
            requiresApproval: true,
            approvalRoles: ["coordinator"],
            inputMapping: {},
            outputKey: "final_out",
            maxRetries: 2,
            timeoutSeconds: 300,
            configuration: {},
          },
        ],
        createdBy: USER_ID,
      });

      const run = await orchestrationService.startWorkflowRun(
        ORG_ID,
        workflow.id,
        {},
        USER_ID,
      );
      expect(run.status).toBe("waiting_approval");

      const rejectionResult = await orchestrationService.approveStepRun(
        ORG_ID,
        run.id,
        "approval_step",
        "rejected",
        USER_ID,
        "Learning objectives do not meet Grade 6 standards.",
      );

      expect(rejectionResult.status).toBe("failed");
      expect(rejectionResult.safeErrorMessage).toContain("rejected by human reviewer");
    });

    it("cancels an active workflow run cleanly", async () => {
      const workflow = await orchestrationService.createDefinition({
        organizationId: ORG_ID,
        workspaceId: WORKSPACE_ID,
        teamId: null,
        name: "Cancellation Workflow",
        description: "Testing cancellation",
        pattern: "sequential",
        version: "1.0.0",
        inputSchema: { type: "object" },
        outputSchema: null,
        configuration: {},
        steps: [
          {
            stepKey: "approval_step",
            name: "Paused Step",
            description: "Step requiring approval to remain pauseable",
            stepOrder: 0,
            assignedRole: "reviewer",
            assignedAgentId: "agent-reviewer",
            dependsOnStepKeys: [],
            requiresApproval: true,
            approvalRoles: ["coordinator"],
            inputMapping: {},
            outputKey: "final_out",
            maxRetries: 2,
            timeoutSeconds: 300,
            configuration: {},
          },
        ],
        createdBy: USER_ID,
      });

      const run = await orchestrationService.startWorkflowRun(
        ORG_ID,
        workflow.id,
        {},
        USER_ID,
      );
      const cancelledRun = await orchestrationService.cancelWorkflowRun(ORG_ID, run.id, USER_ID);

      expect(cancelledRun.status).toBe("cancelled");
      const events = await mockWorkflowRepo.listEvents(run.id);
      expect(events.some((e: any) => e.eventType === "workflow_cancelled")).toBe(true);
    });
  });
});
