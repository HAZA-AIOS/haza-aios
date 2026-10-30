import type { PermissionKey } from "../../auth/auth.types.js";

export type ToolRiskLevel = "low" | "medium" | "high";
export type ToolExecutionMode = "sync" | "async";
export type ToolApprovalPolicy = "none" | "always" | "on_risk" | "tenant_configured";
export type ToolStatus = "draft" | "active" | "deprecated" | "disabled";
export type ToolScope = "organization" | "workspace";

export interface ToolDefinition {
  toolId: string;
  toolKey: string;
  name: string;
  description: string;
  category: "academic_structure" | "curriculum" | "lesson_planning" | "system";
  industry: "education" | "cross_industry";
  version: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  executionMode: ToolExecutionMode;
  riskLevel: ToolRiskLevel;
  requiredPermissions: (PermissionKey | string)[];
  supportedScopes: ToolScope[];
  approvalPolicy: ToolApprovalPolicy;
  timeoutMs: number;
  maxAttempts: number;
  enabled: boolean;
  deprecated: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ToolVersionDefinition {
  id?: string;
  toolId: string;
  version: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  deprecated: boolean;
  changelog?: string | null;
  createdAt?: Date;
}

export interface ToolTenantPolicy {
  id: string;
  organizationId: string;
  workspaceId?: string | null;
  toolId: string;
  toolKey?: string;
  enabled: boolean;
  approvalPolicyOverride?: ToolApprovalPolicy | null;
  customRateLimitPerMinute?: number | null;
  allowedAgentIds?: string[] | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ToolExecutionRecord {
  id: string;
  organizationId: string;
  workspaceId: string;
  runId: string;
  attemptId?: string | null;
  agentId: string;
  configurationRevisionId?: string | null;
  toolId: string;
  toolVersion: string;
  toolKey: string;
  requestedBy: string;
  inputDigest: string;
  inputSnapshot?: Record<string, unknown> | null;
  outputSnapshot?: Record<string, unknown> | null;
  status: "pending" | "running" | "awaiting_approval" | "completed" | "failed" | "cancelled";
  approvalRequestId?: string | null;
  startedAt: Date;
  completedAt?: Date | null;
  durationMs?: number | null;
  errorCategory?: string | null;
  errorMessage?: string | null;
  correlationId?: string | null;
  idempotencyKey?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
}

export interface ToolDomainContext {
  organizationId: string;
  workspaceId: string;
  runId: string;
  attemptId?: string | null;
  agentId: string;
  configurationRevisionId?: string | null;
  userId: string;
  userRoles: string[];
  userPermissions: string[];
  correlationId?: string;
  idempotencyKey?: string;
}

export type ToolAdapterHandler = (
  input: Record<string, unknown>,
  context: ToolDomainContext,
  services: {
    database: any;
  },
  abortSignal?: AbortSignal,
) => Promise<Record<string, unknown>>;

export interface TrustedToolRegistration extends ToolDefinition {
  handler: ToolAdapterHandler;
}

export interface ToolExecutionRequest {
  runId: string;
  toolKey: string;
  toolVersion?: string;
  input: Record<string, unknown>;
  idempotencyKey?: string;
  correlationId?: string;
}

export interface ToolExecutionResult {
  success: boolean;
  executionId: string;
  toolKey: string;
  toolVersion: string;
  data?: Record<string, unknown>;
  error?: {
    category: "POLICY_VIOLATION" | "VALIDATION_FAILED" | "UNAUTHORIZED" | "APPROVAL_REQUIRED" | "EXECUTION_ERROR" | "TIMEOUT" | "RATE_LIMITED";
    message: string;
    details?: Record<string, unknown>;
  };
  durationMs: number;
  approvalRequired?: boolean;
  approvalRequestId?: string;
}
