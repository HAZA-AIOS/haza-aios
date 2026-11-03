import { ApiError } from "../../../common/errors/api-error.js";
import type {
  AgentTeamRole,
  CreateAgentTeamInput,
  CreateWorkflowDefinitionInput,
  CreateWorkflowStepInput,
  WorkflowPattern,
  WorkflowValidationResult,
} from "../orchestration.types.js";

const VALID_ROLES: AgentTeamRole[] = ["planner", "specialist", "reviewer", "supervisor"];
const VALID_PATTERNS: WorkflowPattern[] = ["sequential", "parallel", "supervisor_worker"];

export function validateCreateAgentTeam(
  organizationId: string,
  userId: string,
  payload: unknown,
): CreateAgentTeamInput {
  if (!payload || typeof payload !== "object") {
    throw new ApiError(400, "BAD_REQUEST", "Payload must be a JSON object.");
  }
  const body = payload as Record<string, unknown>;

  if (typeof body.name !== "string" || !body.name.trim()) {
    throw new ApiError(400, "BAD_REQUEST", "Team name is required.");
  }
  if (typeof body.workspaceId !== "string" || !body.workspaceId.trim()) {
    throw new ApiError(400, "BAD_REQUEST", "Workspace ID is required.");
  }

  const membersArray = Array.isArray(body.members) ? body.members : [];
  if (membersArray.length === 0) {
    throw new ApiError(400, "BAD_REQUEST", "Agent team must have at least one member.");
  }

  const seenAgents = new Set<string>();
  const validatedMembers = membersArray.map((m: any, idx: number) => {
    if (!m || typeof m !== "object") {
      throw new ApiError(400, "BAD_REQUEST", `Member at index ${idx} must be an object.`);
    }
    if (typeof m.agentId !== "string" || !m.agentId.trim()) {
      throw new ApiError(400, "BAD_REQUEST", `Member at index ${idx} requires a valid agentId.`);
    }
    if (seenAgents.has(m.agentId)) {
      throw new ApiError(400, "BAD_REQUEST", `Agent ${m.agentId} is assigned more than once to this team.`);
    }
    seenAgents.add(m.agentId);

    const role = (m.role as string)?.toLowerCase();
    if (!VALID_ROLES.includes(role as AgentTeamRole)) {
      throw new ApiError(
        400,
        "BAD_REQUEST",
        `Invalid member role '${m.role}'. Allowed roles: ${VALID_ROLES.join(", ")}`,
      );
    }

    return {
      agentId: m.agentId.trim(),
      role: role as AgentTeamRole,
      capabilities: Array.isArray(m.capabilities)
        ? m.capabilities.map((c: any) => String(c).trim()).filter(Boolean)
        : [],
      priority: typeof m.priority === "number" ? m.priority : 0,
    };
  });

  return {
    organizationId,
    workspaceId: body.workspaceId.trim(),
    name: body.name.trim(),
    description: typeof body.description === "string" ? body.description.trim() : "",
    members: validatedMembers,
    createdBy: userId,
  };
}

export function validateCreateWorkflowDefinition(
  organizationId: string,
  userId: string,
  payload: unknown,
): CreateWorkflowDefinitionInput {
  if (!payload || typeof payload !== "object") {
    throw new ApiError(400, "BAD_REQUEST", "Payload must be a JSON object.");
  }
  const body = payload as Record<string, unknown>;

  if (typeof body.name !== "string" || !body.name.trim()) {
    throw new ApiError(400, "BAD_REQUEST", "Workflow name is required.");
  }
  if (typeof body.workspaceId !== "string" || !body.workspaceId.trim()) {
    throw new ApiError(400, "BAD_REQUEST", "Workspace ID is required.");
  }

  const pattern = (body.pattern as string)?.toLowerCase() || "sequential";
  if (!VALID_PATTERNS.includes(pattern as WorkflowPattern)) {
    throw new ApiError(
      400,
      "BAD_REQUEST",
      `Invalid workflow pattern '${body.pattern}'. Allowed: ${VALID_PATTERNS.join(", ")}`,
    );
  }

  const stepsArray = Array.isArray(body.steps) ? body.steps : [];
  if (stepsArray.length === 0) {
    throw new ApiError(400, "BAD_REQUEST", "Workflow must contain at least one step.");
  }

  const seenStepKeys = new Set<string>();
  const validatedSteps: CreateWorkflowStepInput[] = stepsArray.map((s: any, idx: number) => {
    if (!s || typeof s !== "object") {
      throw new ApiError(400, "BAD_REQUEST", `Step at index ${idx} must be an object.`);
    }
    const stepKey = typeof s.stepKey === "string" ? s.stepKey.trim() : `step_${idx + 1}`;
    if (seenStepKeys.has(stepKey)) {
      throw new ApiError(400, "BAD_REQUEST", `Duplicate stepKey '${stepKey}' found in workflow.`);
    }
    seenStepKeys.add(stepKey);

    const assignedRole = (s.assignedRole as string)?.toLowerCase() || "specialist";
    if (!VALID_ROLES.includes(assignedRole as AgentTeamRole)) {
      throw new ApiError(
        400,
        "BAD_REQUEST",
        `Invalid step role '${s.assignedRole}'. Allowed: ${VALID_ROLES.join(", ")}`,
      );
    }

    const dependsOn = Array.isArray(s.dependsOnStepKeys)
      ? s.dependsOnStepKeys.map((d: any) => String(d).trim()).filter(Boolean)
      : [];

    return {
      stepKey,
      name: typeof s.name === "string" && s.name.trim() ? s.name.trim() : `Step ${idx + 1}`,
      description: typeof s.description === "string" ? s.description.trim() : "",
      stepOrder: typeof s.stepOrder === "number" ? s.stepOrder : idx,
      assignedRole: assignedRole as AgentTeamRole,
      assignedAgentId: typeof s.assignedAgentId === "string" ? s.assignedAgentId.trim() : null,
      dependsOnStepKeys: dependsOn,
      requiresApproval: Boolean(s.requiresApproval),
      approvalRoles: Array.isArray(s.approvalRoles)
        ? s.approvalRoles.map((r: any) => String(r).trim()).filter(Boolean)
        : [],
      inputMapping: s.inputMapping && typeof s.inputMapping === "object" ? s.inputMapping : {},
      outputKey: typeof s.outputKey === "string" && s.outputKey.trim() ? s.outputKey.trim() : `${stepKey}_output`,
      maxRetries: typeof s.maxRetries === "number" ? Math.max(0, s.maxRetries) : 2,
      timeoutSeconds: typeof s.timeoutSeconds === "number" ? Math.max(10, s.timeoutSeconds) : 300,
      configuration: s.configuration && typeof s.configuration === "object" ? s.configuration : {},
    };
  });

  return {
    organizationId,
    workspaceId: body.workspaceId.trim(),
    teamId: typeof body.teamId === "string" && body.teamId.trim() ? body.teamId.trim() : null,
    name: body.name.trim(),
    description: typeof body.description === "string" ? body.description.trim() : "",
    pattern: pattern as WorkflowPattern,
    version: typeof body.version === "string" && body.version.trim() ? body.version.trim() : "1.0.0",
    inputSchema: body.inputSchema && typeof body.inputSchema === "object" ? (body.inputSchema as Record<string, unknown>) : { type: "object" },
    outputSchema: body.outputSchema && typeof body.outputSchema === "object" ? (body.outputSchema as Record<string, unknown>) : null,
    configuration: body.configuration && typeof body.configuration === "object" ? (body.configuration as Record<string, unknown>) : {},
    steps: validatedSteps,
    createdBy: userId,
  };
}

/**
 * Validates a DAG of workflow steps:
 * 1. Checks that all dependsOnStepKeys reference existing steps.
 * 2. Detects cycles using Kahn's algorithm (Topological sort).
 * 3. Identifies unresolved roles if a team role list is provided.
 */
export function validateWorkflowDAG(
  steps: CreateWorkflowStepInput[],
  teamRoles?: AgentTeamRole[],
): WorkflowValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const stepKeyMap = new Map<string, CreateWorkflowStepInput>();
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  const dependencyGraph: Record<string, string[]> = {};

  for (const step of steps) {
    stepKeyMap.set(step.stepKey, step);
    inDegree.set(step.stepKey, 0);
    adjacency.set(step.stepKey, []);
    dependencyGraph[step.stepKey] = step.dependsOnStepKeys || [];
  }

  // Build edges: upstream -> downstream
  for (const step of steps) {
    for (const depKey of step.dependsOnStepKeys || []) {
      if (!stepKeyMap.has(depKey)) {
        errors.push(`Step '${step.stepKey}' depends on non-existent step '${depKey}'.`);
        continue;
      }
      if (depKey === step.stepKey) {
        errors.push(`Step '${step.stepKey}' cannot depend on itself.`);
        continue;
      }
      adjacency.get(depKey)!.push(step.stepKey);
      inDegree.set(step.stepKey, (inDegree.get(step.stepKey) || 0) + 1);
    }
  }

  // Kahn's algorithm for topological sorting and cycle detection
  const queue: string[] = [];
  for (const [key, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(key);
    }
  }

  const executionOrder: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    executionOrder.push(node);

    for (const neighbor of adjacency.get(node) || []) {
      const newDeg = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) {
        queue.push(neighbor);
      }
    }
  }

  const cycleDetected = executionOrder.length !== steps.length;
  if (cycleDetected) {
    const cyclicNodes = steps.filter((s) => !executionOrder.includes(s.stepKey)).map((s) => s.stepKey);
    errors.push(`Cycle detected involving steps: ${cyclicNodes.join(", ")}`);
  }

  // Check unresolved roles
  const unresolvedRoles: string[] = [];
  if (teamRoles && teamRoles.length > 0) {
    const availableRoleSet = new Set(teamRoles);
    for (const step of steps) {
      if (!availableRoleSet.has(step.assignedRole)) {
        unresolvedRoles.push(step.assignedRole);
        warnings.push(
          `Step '${step.stepKey}' requires role '${step.assignedRole}', which is not present in assigned team.`,
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    cycleDetected,
    unresolvedRoles: Array.from(new Set(unresolvedRoles)),
    dependencyGraph,
    executionOrder,
  };
}

