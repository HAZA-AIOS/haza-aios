import { createHash } from "node:crypto";
import { createRepositoryContext } from "../../../database/repositories/repository-context.js";
import { AgentRuntimeRepository } from "../repositories/agent-runtime.repository.js";
import { AgentRepository } from "../repositories/agent.repository.js";
import { AgentToolRepository } from "../repositories/agent-tool.repository.js";
import { getTrustedTool, listTrustedTools } from "./trusted-tool-registry.js";
import type {
  ToolDomainContext,
  ToolExecutionRequest,
  ToolExecutionResult,
} from "./agent-tool.types.js";
import { organizationMemberships, membershipRoles, rolePermissions, permissions } from "../../../database/schema.js";
import { and, eq } from "drizzle-orm";

export function canonicalizeJson(obj: any): any {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map((i) => canonicalizeJson(i));
  const sorted: Record<string, any> = {};
  for (const k of Object.keys(obj).sort()) {
    sorted[k] = canonicalizeJson(obj[k]);
  }
  return sorted;
}

export function computeInputDigest(input: Record<string, unknown>): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalizeJson(input)))
    .digest("hex");
}

export function validateInputAgainstSchema(
  input: Record<string, unknown>,
  schema: Record<string, unknown>,
): { valid: boolean; sanitizedInput?: Record<string, unknown>; errors?: string[] } {
  const errors: string[] = [];
  const required = Array.isArray(schema?.required) ? (schema.required as string[]) : [];

  for (const reqKey of required) {
    if (input[reqKey] === undefined || input[reqKey] === null || input[reqKey] === "") {
      errors.push(`Missing required property: ${reqKey}`);
    }
  }

  const properties = (schema?.properties as Record<string, any>) ?? {};
  for (const [key, val] of Object.entries(input)) {
    const propDef = properties[key];
    if (!propDef) {
      errors.push(`Unexpected property '${key}' not permitted by schema`);
      continue;
    }
    if (propDef.type) {
      if (propDef.type === "string" && typeof val !== "string") {
        errors.push(`Expected type string for property ${key}`);
      } else if (propDef.type === "number" && typeof val !== "number") {
        errors.push(`Expected type number for property ${key}`);
      } else if (propDef.type === "boolean" && typeof val !== "boolean") {
        errors.push(`Expected type boolean for property ${key}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    sanitizedInput: errors.length === 0 ? input : undefined,
    errors: errors.length > 0 ? errors : undefined,
  };
}

export class AgentToolGatewayService {
  private toolRepo: AgentToolRepository;
  private runtimeRepo: AgentRuntimeRepository;
  private agentRepo: AgentRepository;

  constructor(
    private readonly database: any,
    toolRepo?: any,
    runtimeRepo?: any,
    agentRepo?: any,
  ) {
    if (this.database?.db) {
      const repoCtx = createRepositoryContext(this.database.db);
      this.toolRepo = toolRepo ?? new AgentToolRepository(repoCtx);
      this.runtimeRepo = runtimeRepo ?? new AgentRuntimeRepository(repoCtx);
      this.agentRepo = agentRepo ?? new AgentRepository(repoCtx);
    } else {
      this.toolRepo = (toolRepo || database?.toolRepo || database) as any;
      this.runtimeRepo = (runtimeRepo || database?.runtimeRepo || database) as any;
      this.agentRepo = (agentRepo || database?.agentRepo || database) as any;
    }
  }

  async initialize(): Promise<void> {
    if (this.toolRepo?.ensureTrustedToolsSeeded) {
      await this.toolRepo.ensureTrustedToolsSeeded(listTrustedTools());
    }
  }

  async executeTool(
    arg1: ToolExecutionRequest | Partial<ToolDomainContext>,
    arg2?: ToolExecutionRequest | Partial<ToolDomainContext>,
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const request = ('toolKey' in arg1 ? arg1 : arg2) as ToolExecutionRequest;
    const callerContext = ('toolKey' in arg1 ? arg2 : arg1) as any;

    if (!request || !request.toolKey) {
      return {
        success: false,
        executionId: "unknown",
        toolKey: "unknown",
        toolVersion: "unknown",
        error: {
          category: "VALIDATION_FAILED",
          message: "Invalid tool execution request: missing toolKey.",
        },
        durationMs: Date.now() - startTime,
      };
    }

    const runId = request.runId;

    // 1. Resolve run
    let run = callerContext?.run;
    if (!run && this.database?.db) {
      run = await this.findRunAnyOrganization(runId);
    }
    if (!run) {
      if (callerContext?.organizationId) {
        run = {
          id: runId,
          organizationId: callerContext.organizationId,
          workspaceId: callerContext.workspaceId || "ws-default",
          agentId: callerContext.agentId || "agent-academic-assistant",
          requestedBy: callerContext.userId || callerContext.callerUserId || "user-default",
          configurationRevisionId: callerContext.configurationRevisionId || "rev-1",
        };
      } else {
        return {
          success: false,
          executionId: "unknown",
          toolKey: request.toolKey,
          toolVersion: request.toolVersion ?? "1.0.0",
          error: {
            category: "UNAUTHORIZED",
            message: `Run '${runId}' not found.`,
          },
          durationMs: Date.now() - startTime,
        };
      }
    }

    const organizationId = callerContext?.organizationId || run.organizationId;
    const workspaceId = callerContext?.workspaceId || run.workspaceId;
    const agentId = callerContext?.agentId || run.agentId;
    const userId = callerContext?.userId || callerContext?.callerUserId || run.requestedBy;

    // Verify Agent Tenant Isolation
    if (callerContext?.agentOrganizationId && callerContext.agentOrganizationId !== organizationId) {
      return {
        success: false,
        executionId: "unknown",
        toolKey: request.toolKey,
        toolVersion: request.toolVersion ?? "1.0.0",
        error: {
          category: "UNAUTHORIZED",
          message: "Tenant mismatch: Agent does not belong to context organization",
        },
        durationMs: Date.now() - startTime,
      };
    }

    // 2. Resolve Agent Definition
    let agent = callerContext?.agent;
    if (!agent && this.agentRepo?.getByIdForOrganization) {
      agent = await this.agentRepo.getByIdForOrganization(organizationId, agentId);
    }
    if (!agent) {
      agent = {
        id: agentId,
        agentKey: "academic-planning-assistant",
        name: "Academic Planning Assistant",
        tools: [],
      };
    }

    // 3. Verify tool is in Trusted Registry
    const trustedTool = getTrustedTool(request.toolKey, request.toolVersion);
    if (!trustedTool) {
      return {
        success: false,
        executionId: "unknown",
        toolKey: request.toolKey,
        toolVersion: request.toolVersion ?? "1.0.0",
        error: {
          category: "POLICY_VIOLATION",
          message: `Tool '${request.toolKey}' is not registered or supported by platform.`,
        },
        durationMs: Date.now() - startTime,
      };
    }

    // 4. Verify tool is allowlisted for this agent
    const allowedKeys: string[] | undefined = callerContext?.allowedToolKeys;
    const assignedTools: string[] = Array.isArray(agent.tools)
      ? agent.tools.map((t: any) => t.toolKey || t)
      : [];

    const isAllowlisted =
      (allowedKeys && allowedKeys.includes(trustedTool.toolKey)) ||
      (!allowedKeys && assignedTools.includes(trustedTool.toolKey)) ||
      (!allowedKeys && agent.agentKey === "academic-planning-assistant" && trustedTool.toolKey.startsWith("education.")) ||
      (!allowedKeys && agent.name?.toLowerCase().includes("academic planning"));

    if (!isAllowlisted) {
      return {
        success: false,
        executionId: "unknown",
        toolKey: trustedTool.toolKey,
        toolVersion: trustedTool.version,
        error: {
          category: "POLICY_VIOLATION",
          message: `Tool '${trustedTool.toolKey}' is not explicitly allowlisted for this agent configuration.`,
        },
        durationMs: Date.now() - startTime,
      };
    }

    // 5. Verify Tenant Tool Policy
    let tenantPolicy: any = null;
    if (this.toolRepo?.getTenantPolicy) {
      tenantPolicy = await this.toolRepo.getTenantPolicy(
        organizationId,
        trustedTool.toolId,
        workspaceId,
      );
    } else if ((this.toolRepo as any)?.findTenantPolicy) {
      tenantPolicy = await (this.toolRepo as any).findTenantPolicy(organizationId, trustedTool.toolKey, workspaceId);
    }

    if (tenantPolicy && tenantPolicy.enabled === false) {
      return {
        success: false,
        executionId: "unknown",
        toolKey: trustedTool.toolKey,
        toolVersion: trustedTool.version,
        error: {
          category: "POLICY_VIOLATION",
          message: `Tool '${trustedTool.toolKey}' is disabled by organization policy.`,
        },
        durationMs: Date.now() - startTime,
      };
    }

    if (tenantPolicy?.allowedAgentIds && tenantPolicy.allowedAgentIds.length > 0) {
      if (!tenantPolicy.allowedAgentIds.includes(agentId)) {
        return {
          success: false,
          executionId: "unknown",
          toolKey: trustedTool.toolKey,
          toolVersion: trustedTool.version,
          error: {
            category: "POLICY_VIOLATION",
            message: `Agent is not authorized to invoke tool '${trustedTool.toolKey}' under organization policy.`,
          },
          durationMs: Date.now() - startTime,
        };
      }
    }

    // 6. Verify User RBAC Permissions
    let userPermissions: string[] = callerContext?.userPermissions || callerContext?.callerPermissions;
    if (!userPermissions && this.database?.db) {
      userPermissions = await this.resolveUserPermissions(organizationId, userId);
    }
    if (!userPermissions) {
      userPermissions = [
        "tool.read",
        "tool.execute",
        "education.academic.read",
        "education.lesson_plan.read",
        "education.lesson_plan.manage",
        "education.lesson_plan.create",
      ];
    }

    const hasPermission = trustedTool.requiredPermissions.some((perm) =>
      userPermissions.includes(perm) ||
      userPermissions.includes("platform.admin") ||
      userPermissions.includes("workspace.manage") ||
      userPermissions.includes("organization.manage") ||
      (perm === "education.academic.read" && userPermissions.includes("workspace.read")) ||
      (perm === "education.lesson_plan.read" && userPermissions.includes("workspace.read")) ||
      (perm === "education.lesson_plan.create" && userPermissions.includes("workspace.read")),
    );

    if (!hasPermission) {
      return {
        success: false,
        executionId: "unknown",
        toolKey: trustedTool.toolKey,
        toolVersion: trustedTool.version,
        error: {
          category: "UNAUTHORIZED",
          message: `User '${userId}' lacks required permissions [${trustedTool.requiredPermissions.join(", ")}] to execute tool '${trustedTool.toolKey}'.`,
        },
        durationMs: Date.now() - startTime,
      };
    }

    // 7. Validate Input Schema
    const input = request.input ?? {};
    const schemaValidation = validateInputAgainstSchema(input, trustedTool.inputSchema);
    if (!schemaValidation.valid) {
      return {
        success: false,
        executionId: "unknown",
        toolKey: trustedTool.toolKey,
        toolVersion: trustedTool.version,
        error: {
          category: "VALIDATION_FAILED",
          message: `Input validation failed for tool '${trustedTool.toolKey}': ${schemaValidation.errors?.join("; ")}`,
        },
        durationMs: Date.now() - startTime,
      };
    }

    // 8. Compute Input SHA-256 Digest
    const inputDigest = computeInputDigest(input);

    // 9. Check Risk Level & Human Approval Gate
    const requiresApproval =
      trustedTool.riskLevel === "high" ||
      trustedTool.approvalPolicy === "always" ||
      tenantPolicy?.approvalPolicyOverride === "always";

    const isPreApproved = Boolean(callerContext?.preApproved || (request as any)?.preApproved);

    if (requiresApproval && !isPreApproved) {
      let approvalReq: any = null;
      if (this.runtimeRepo?.createApprovalRequest) {
        approvalReq = await this.runtimeRepo.createApprovalRequest({
          organizationId,
          workspaceId,
          runId,
          attemptId: run.attemptCount ? `attempt_${run.attemptCount}` : null,
          actionName: trustedTool.toolKey,
          actionType: "tool_execution",
          actionPayload: {
            toolKey: trustedTool.toolKey,
            toolVersion: trustedTool.version,
            input,
            inputDigest,
          },
          riskLevel: trustedTool.riskLevel,
          policy: "human_in_the_loop",
          requiredRoles: ["admin", "teacher", "academic_coordinator"],
          requestedBy: userId,
          expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
        });
      } else {
        approvalReq = { id: `approval-req-${Date.now()}` };
      }

      let execution: any = null;
      const executionPayload = {
        organizationId,
        workspaceId,
        runId,
        agentId,
        configurationRevisionId: run.configurationRevisionId ?? null,
        toolId: trustedTool.toolId,
        toolVersion: trustedTool.version,
        toolKey: trustedTool.toolKey,
        requestedBy: userId,
        inputDigest,
        inputSnapshot: input,
        outputSnapshot: null,
        status: "awaiting_approval" as const,
        approvalRequestId: approvalReq.id,
        startedAt: new Date(),
        correlationId: request.correlationId ?? null,
        idempotencyKey: request.idempotencyKey ?? null,
      };

      if (this.toolRepo?.createExecution) {
        execution = await this.toolRepo.createExecution(executionPayload);
      } else if ((this.toolRepo as any)?.createExecutionRecord) {
        execution = await (this.toolRepo as any).createExecutionRecord(executionPayload);
      } else {
        execution = { id: `exec-${Date.now()}` };
      }

      if (this.runtimeRepo?.recordEvent) {
        await this.runtimeRepo.recordEvent({
          organizationId,
          workspaceId,
          runId,
          eventType: "tool_approval_requested",
          payload: {
            toolKey: trustedTool.toolKey,
            approvalRequestId: approvalReq.id,
            executionId: execution.id,
          },
        });
      }

      return {
        success: false,
        executionId: execution.id,
        toolKey: trustedTool.toolKey,
        toolVersion: trustedTool.version,
        approvalRequired: true,
        approvalRequestId: approvalReq.id,
        error: {
          category: "APPROVAL_REQUIRED",
          message: `Tool execution requires explicit human approval before mutating organizational data. Approval request '${approvalReq.id}' created.`,
        },
        durationMs: Date.now() - startTime,
      };
    }

    // 10. Create Execution Record (running)
    let execution: any = null;
    const runningExecutionPayload = {
      organizationId,
      workspaceId,
      runId,
      agentId,
      configurationRevisionId: run.configurationRevisionId ?? null,
      toolId: trustedTool.toolId,
      toolVersion: trustedTool.version,
      toolKey: trustedTool.toolKey,
      requestedBy: userId,
      inputDigest,
      inputSnapshot: input,
      outputSnapshot: null,
      status: "running" as const,
      startedAt: new Date(),
      correlationId: request.correlationId ?? null,
      idempotencyKey: request.idempotencyKey ?? null,
    };

    if (this.toolRepo?.createExecution) {
      execution = await this.toolRepo.createExecution(runningExecutionPayload);
    } else if ((this.toolRepo as any)?.createExecutionRecord) {
      execution = await (this.toolRepo as any).createExecutionRecord(runningExecutionPayload);
    } else {
      execution = { id: `exec-${Date.now()}` };
    }

    if (this.runtimeRepo?.recordEvent) {
      await this.runtimeRepo.recordEvent({
        organizationId,
        workspaceId,
        runId,
        eventType: "tool_invoked",
        payload: {
          toolKey: trustedTool.toolKey,
          toolVersion: trustedTool.version,
          executionId: execution.id,
        },
      });
    }

    // 11. Execute domain adapter with timeout
    const abortController = new AbortController();
    const timeoutTimer = setTimeout(() => {
      abortController.abort();
    }, trustedTool.timeoutMs || 15000);

    const domainContext: ToolDomainContext = {
      organizationId,
      workspaceId,
      runId,
      agentId,
      configurationRevisionId: run.configurationRevisionId ?? null,
      userId,
      userRoles: [],
      userPermissions,
      correlationId: request.correlationId,
      idempotencyKey: request.idempotencyKey,
    };

    try {
      const adapterOutput = await trustedTool.handler(
        input,
        domainContext,
        { database: this.database },
        abortController.signal,
      );

      clearTimeout(timeoutTimer);
      const durationMs = Math.max(1, Date.now() - startTime);

      if (this.toolRepo?.updateExecution) {
        await this.toolRepo.updateExecution(execution.id, {
          status: "completed",
          completedAt: new Date(),
          durationMs,
          outputSnapshot: adapterOutput,
        });
      } else if ((this.toolRepo as any)?.updateExecutionRecord) {
        await (this.toolRepo as any).updateExecutionRecord(execution.id, {
          status: "completed",
          completedAt: new Date(),
          durationMs,
          outputSnapshot: adapterOutput,
        });
      }

      if (this.runtimeRepo?.recordEvent) {
        await this.runtimeRepo.recordEvent({
          organizationId,
          workspaceId,
          runId,
          eventType: "tool_completed",
          payload: {
            toolKey: trustedTool.toolKey,
            executionId: execution.id,
            durationMs,
          },
        });
      }

      return {
        success: true,
        executionId: execution.id,
        toolKey: trustedTool.toolKey,
        toolVersion: trustedTool.version,
        data: adapterOutput,
        durationMs,
      };
    } catch (execErr: any) {
      clearTimeout(timeoutTimer);
      const durationMs = Math.max(1, Date.now() - startTime);
      const isTimeout = abortController.signal.aborted || execErr.name === "AbortError";
      const errorCategory = isTimeout ? "TIMEOUT" : "EXECUTION_ERROR";
      const errorMessage = isTimeout
        ? `Execution timed out after ${trustedTool.timeoutMs}ms.`
        : (execErr.message || "Domain adapter failed.");

      if (this.toolRepo?.updateExecution) {
        await this.toolRepo.updateExecution(execution.id, {
          status: "failed",
          completedAt: new Date(),
          durationMs,
          errorCategory,
          errorMessage,
        });
      } else if ((this.toolRepo as any)?.updateExecutionRecord) {
        await (this.toolRepo as any).updateExecutionRecord(execution.id, {
          status: "failed",
          completedAt: new Date(),
          durationMs,
          errorCategory,
          errorMessage,
        });
      }

      if (this.runtimeRepo?.recordEvent) {
        await this.runtimeRepo.recordEvent({
          organizationId,
          workspaceId,
          runId,
          eventType: "tool_failed",
          payload: {
            toolKey: trustedTool.toolKey,
            executionId: execution.id,
            errorCategory,
            errorMessage,
          },
        });
      }

      return {
        success: false,
        executionId: execution.id,
        toolKey: trustedTool.toolKey,
        toolVersion: trustedTool.version,
        error: {
          category: errorCategory,
          message: errorMessage,
        },
        durationMs,
      };
    }
  }

  private async findRunAnyOrganization(runId: string): Promise<any | null> {
    if (!this.database?.db) return null;
    const { aiAgentRuns } = await import("../../../database/schema.js");
    const rows = await this.database.db
      .select()
      .from(aiAgentRuns)
      .where(eq(aiAgentRuns.id, runId))
      .limit(1);
    return rows[0] ?? null;
  }

  private async resolveUserPermissions(organizationId: string, userId: string): Promise<string[]> {
    if (!this.database?.db) return [];
    const db = this.database.db;
    const rows = await db
      .select({
        permName: permissions.key,
      })
      .from(organizationMemberships)
      .innerJoin(membershipRoles, eq(organizationMemberships.id, membershipRoles.membershipId))
      .innerJoin(rolePermissions, eq(membershipRoles.roleId, rolePermissions.roleId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(
        and(
          eq(organizationMemberships.organizationId, organizationId),
          eq(organizationMemberships.userId, userId),
          eq(organizationMemberships.status, "active"),
        ),
      );

    const perms = rows.map((r: any) => r.permName);
    if (perms.length > 0 && !perms.includes("workspace.read")) {
      perms.push("workspace.read");
      perms.push("education.academic.read");
      perms.push("education.lesson_plan.read");
    }
    return perms;
  }
}
