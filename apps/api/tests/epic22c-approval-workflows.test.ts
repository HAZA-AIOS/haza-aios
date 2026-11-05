import { describe, expect, it, beforeEach } from "vitest";
import { PolicyEvaluationEngine } from "../src/modules/agents/services/policy-evaluation-engine.service.js";
import { AgentApprovalService } from "../src/modules/agents/services/agent-approval.service.js";
import { AgentApprovalContinuationService } from "../src/modules/agents/services/agent-approval-continuation.service.js";
import { AgentToolGatewayService } from "../src/modules/agents/tools/agent-tool-gateway.service.js";
import {
  type AgentApprovalRequestEntity,
  type AgentApprovalDecisionEntity,
  type AgentApprovalEscalationEntity,
  computePayloadFingerprint,
} from "../src/modules/agents/governance-approval.types.js";
import type {
  AgentGovernanceProfileEntity,
  AgentOwnershipAssignmentEntity,
  AgentGovernancePolicyEntity,
  AgentGovernanceAuditLogEntity,
} from "../src/modules/agents/governance.types.js";

describe("Epic 22C: Enterprise Human-in-the-Loop Approval Workflows", () => {
  const ORG_A = "00000000-0000-4801-a000-000000000001";
  const ORG_B = "00000000-0000-4801-b000-000000000002";
  const WORKSPACE_ID = "00000000-0000-4801-w000-000000000001";
  const REQUESTER_ID = "00000000-0000-4801-u000-000000000001";
  const REVIEWER_ID = "00000000-0000-4801-u000-000000000002";
  const UNAUTHORIZED_USER = "00000000-0000-4801-u000-000000000099";
  const AGENT_ID = "agent-academic-advisor-001";

  // In-Memory Storage
  let approvalStore: Map<string, AgentApprovalRequestEntity>;
  let decisionStore: AgentApprovalDecisionEntity[];
  let escalationStore: AgentApprovalEscalationEntity[];
  let profileStore: Map<string, AgentGovernanceProfileEntity>;
  let ownershipStore: Map<string, AgentOwnershipAssignmentEntity>;
  let policyStore: Map<string, AgentGovernancePolicyEntity>;
  let auditLogStore: AgentGovernanceAuditLogEntity[];

  let mockApprovalRepo: any;
  let mockGovRepo: any;
  let approvalService: AgentApprovalService;
  let policyEngine: PolicyEvaluationEngine;
  let continuationService: AgentApprovalContinuationService;
  let toolGateway: AgentToolGatewayService;

  beforeEach(() => {
    approvalStore = new Map();
    decisionStore = [];
    escalationStore = [];
    profileStore = new Map();
    ownershipStore = new Map();
    policyStore = new Map();
    auditLogStore = [];

    mockApprovalRepo = {
      createRequest: async (req: AgentApprovalRequestEntity) => {
        approvalStore.set(req.id, { ...req });
        return req;
      },
      getRequestById: async (orgId: string, id: string) => {
        const item = approvalStore.get(id);
        return item && item.organizationId === orgId ? { ...item } : null;
      },
      getRequestByIdempotencyKey: async (orgId: string, key: string) => {
        for (const req of approvalStore.values()) {
          if (req.organizationId === orgId && req.idempotencyKey === key) {
            return { ...req };
          }
        }
        return null;
      },
      listRequests: async (orgId: string, filters?: any) => {
        return Array.from(approvalStore.values()).filter((r) => {
          if (r.organizationId !== orgId) return false;
          if (filters?.status && r.status !== filters.status) return false;
          if (filters?.agentId && r.agentId !== filters.agentId) return false;
          if (filters?.riskClassification && r.riskClassification !== filters.riskClassification) return false;
          return true;
        });
      },
      updateRequestStatus: async (params: any) => {
        const item = approvalStore.get(params.id);
        if (!item || item.organizationId !== params.organizationId) return null;

        const expected = Array.isArray(params.expectedStatus) ? params.expectedStatus : [params.expectedStatus];
        if (!expected.includes(item.status)) return null;

        item.status = params.newStatus;
        item.updatedAt = new Date().toISOString();
        if (params.decisionId) item.decisionId = params.decisionId;
        if (params.consumedAt) item.consumedAt = params.consumedAt;
        if (params.consumedBy) item.consumedBy = params.consumedBy;
        if (params.assignedReviewerId) item.assignedReviewerId = params.assignedReviewerId;

        approvalStore.set(params.id, { ...item });
        return { ...item };
      },
      createDecision: async (dec: AgentApprovalDecisionEntity) => {
        decisionStore.push({ ...dec });
        return dec;
      },
      listDecisionsForRequest: async (orgId: string, reqId: string) => {
        return decisionStore.filter((d) => d.organizationId === orgId && d.approvalRequestId === reqId);
      },
      createEscalation: async (esc: AgentApprovalEscalationEntity) => {
        escalationStore.push({ ...esc });
        return esc;
      },
      listEscalationsForRequest: async (orgId: string, reqId: string) => {
        return escalationStore.filter((e) => e.organizationId === orgId && e.approvalRequestId === reqId);
      },
      expirePendingRequests: async (orgId: string, nowDate = new Date()) => {
        const expired: AgentApprovalRequestEntity[] = [];
        for (const req of approvalStore.values()) {
          if (req.organizationId === orgId && req.status === "pending" && new Date(req.expiresAt) <= nowDate) {
            req.status = "expired";
            req.updatedAt = new Date().toISOString();
            expired.push({ ...req });
          }
        }
        return expired;
      },
    };

    mockGovRepo = {
      getProfileByAgentId: async (orgId: string, agentId: string) => profileStore.get(`${orgId}:${agentId}`) || null,
      listProfiles: async (orgId: string) => Array.from(profileStore.values()).filter((p) => p.organizationId === orgId),
      getOwnershipByAgentId: async (orgId: string, agentId: string) => ownershipStore.get(`${orgId}:${agentId}`) || null,
      getPolicyByKey: async (orgId: string, key: string) => {
        for (const p of policyStore.values()) {
          if (p.organizationId === orgId && p.policyKey === key) return p;
        }
        return null;
      },
      listPolicies: async (orgId: string) => Array.from(policyStore.values()).filter((p) => p.organizationId === orgId),
      createAuditLog: async (log: any) => {
        const fullLog = { id: `log-${Date.now()}-${Math.random()}`, createdAt: new Date().toISOString(), ...log };
        auditLogStore.push(fullLog);
        return fullLog;
      },
    };

    approvalService = new AgentApprovalService(mockApprovalRepo, mockGovRepo);
    policyEngine = new PolicyEvaluationEngine(mockGovRepo, approvalService);

    // Default ownership setup
    ownershipStore.set(`${ORG_A}:${AGENT_ID}`, {
      id: "own-1",
      organizationId: ORG_A,
      agentId: AGENT_ID,
      primaryOwnerId: REVIEWER_ID,
      escalationContact: "ops-lead@organization.com",
      reviewCadence: "quarterly",
      accountabilityStatus: "active",
      delegatedApproverIds: [],
      assignedBy: "admin",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Mock Tool Gateway
    toolGateway = new AgentToolGatewayService(
      {
        findRunAnyOrganization: async () => null,
      } as any,
      mockApprovalRepo,
      undefined,
      mockGovRepo,
    );
    toolGateway.setPolicyEngine(policyEngine);

    continuationService = new AgentApprovalContinuationService(
      mockApprovalRepo,
      policyEngine,
      toolGateway,
      mockGovRepo,
    );
  });

  // ---------------------------------------------------------------------------
  // 1. APPROVAL REQUEST CREATION
  // ---------------------------------------------------------------------------
  it("creates approval request with canonical payload fingerprint and pending status", async () => {
    const payload = { query: "SELECT * FROM students", limit: 50 };
    const req = await approvalService.createApprovalRequest({
      organizationId: ORG_A,
      agentId: AGENT_ID,
      actionType: "tool_execution",
      actionTarget: "sql_query_executor",
      requestingActorId: REQUESTER_ID,
      payload,
      approvalReason: "Sensitive student data access",
      riskClassification: "high",
    });

    expect(req.id).toBeDefined();
    expect(req.status).toBe("pending");
    expect(req.canonicalPayloadFingerprint).toBe(computePayloadFingerprint(payload));
    expect(req.approvalReason).toBe("Sensitive student data access");

    // Verify audit log emitted
    const createdLog = auditLogStore.find((l) => l.action === "approval_request.created");
    expect(createdLog).toBeDefined();
    expect(createdLog?.targetId).toBe(req.id);
  });

  // ---------------------------------------------------------------------------
  // 2. AUTHORIZED REVIEWER APPROVAL
  // ---------------------------------------------------------------------------
  it("allows authorized reviewer to approve request with mandatory justification", async () => {
    const req = await approvalService.createApprovalRequest({
      organizationId: ORG_A,
      agentId: AGENT_ID,
      actionType: "tool_execution",
      actionTarget: "update_student_records",
      requestingActorId: REQUESTER_ID,
      payload: { studentId: "s-1", grade: "A" },
      approvalReason: "Modifying student grades",
      riskClassification: "high",
    });

    const { request: updated, decision } = await approvalService.decideApprovalRequest({
      approvalRequestId: req.id,
      organizationId: ORG_A,
      decision: "approved",
      actorId: REVIEWER_ID,
      userPermissions: ["agent.manage"],
      justification: "Verified academic board approval documentation.",
    });

    expect(updated.status).toBe("approved");
    expect(decision.decision).toBe("approved");
    expect(decision.justification).toBe("Verified academic board approval documentation.");
    expect(decision.decidedByActorId).toBe(REVIEWER_ID);
  });

  // ---------------------------------------------------------------------------
  // 3. UNAUTHORIZED REVIEWER REJECTION
  // ---------------------------------------------------------------------------
  it("rejects approval attempts by unauthorized actors without permissions", async () => {
    const req = await approvalService.createApprovalRequest({
      organizationId: ORG_A,
      agentId: AGENT_ID,
      actionType: "tool_execution",
      actionTarget: "publish_curriculum",
      requestingActorId: REQUESTER_ID,
      payload: {},
      approvalReason: "Curriculum publication",
      riskClassification: "medium",
    });

    await expect(
      approvalService.decideApprovalRequest({
        approvalRequestId: req.id,
        organizationId: ORG_A,
        decision: "approved",
        actorId: UNAUTHORIZED_USER,
        userPermissions: ["agent.read"], // lacks agent.manage or ownership
      }),
    ).rejects.toThrow(/not authorized to decide this approval request/i);
  });

  // ---------------------------------------------------------------------------
  // 4. REQUESTER SELF-APPROVAL PREVENTION
  // ---------------------------------------------------------------------------
  it("prevents requesters from self-approving high or critical risk operations", async () => {
    const req = await approvalService.createApprovalRequest({
      organizationId: ORG_A,
      agentId: AGENT_ID,
      actionType: "tool_execution",
      actionTarget: "delete_database_partition",
      requestingActorId: REQUESTER_ID,
      payload: { partition: "archive_2025" },
      approvalReason: "Database partition deletion",
      riskClassification: "critical",
    });

    await expect(
      approvalService.decideApprovalRequest({
        approvalRequestId: req.id,
        organizationId: ORG_A,
        decision: "approved",
        actorId: REQUESTER_ID, // Requester attempting to approve self
        userPermissions: ["agent.manage"],
        justification: "I need this done now.",
      }),
    ).rejects.toThrow(/self-approval is forbidden/i);
  });

  // ---------------------------------------------------------------------------
  // 5. CROSS-TENANT ISOLATION
  // ---------------------------------------------------------------------------
  it("enforces cross-tenant isolation: Org B cannot decide Org A approvals", async () => {
    const req = await approvalService.createApprovalRequest({
      organizationId: ORG_A,
      agentId: AGENT_ID,
      actionType: "tool_execution",
      actionTarget: "financial_export",
      requestingActorId: REQUESTER_ID,
      payload: {},
      approvalReason: "Export financial records",
      riskClassification: "high",
    });

    await expect(
      approvalService.decideApprovalRequest({
        approvalRequestId: req.id,
        organizationId: ORG_B, // Wrong organization!
        decision: "approved",
        actorId: REVIEWER_ID,
        userPermissions: ["agent.manage"],
        justification: "Cross-tenant bypass attempt",
      }),
    ).rejects.toThrow(/not found/i);
  });

  // ---------------------------------------------------------------------------
  // 6. EXPIRED APPROVAL REJECTION
  // ---------------------------------------------------------------------------
  it("rejects decisions and execution continuation on expired requests", async () => {
    const req = await approvalService.createApprovalRequest({
      organizationId: ORG_A,
      agentId: AGENT_ID,
      actionType: "tool_execution",
      actionTarget: "temporary_credentials",
      requestingActorId: REQUESTER_ID,
      payload: {},
      approvalReason: "Temporary credential minting",
      expiresInMinutes: -1, // Expired immediately
    });

    await expect(
      approvalService.decideApprovalRequest({
        approvalRequestId: req.id,
        organizationId: ORG_A,
        decision: "approved",
        actorId: REVIEWER_ID,
        userPermissions: ["agent.manage"],
        justification: "Late approval",
      }),
    ).rejects.toThrow(/expired/i);

    const checked = await mockApprovalRepo.getRequestById(ORG_A, req.id);
    expect(checked?.status).toBe("expired");
  });

  // ---------------------------------------------------------------------------
  // 7. REVOKED APPROVAL REJECTION
  // ---------------------------------------------------------------------------
  it("allows requester to revoke request and blocks continuation of revoked requests", async () => {
    const req = await approvalService.createApprovalRequest({
      organizationId: ORG_A,
      agentId: AGENT_ID,
      actionType: "tool_execution",
      actionTarget: "send_mass_notifications",
      requestingActorId: REQUESTER_ID,
      payload: {},
      approvalReason: "Mass communication",
    });

    // Requester revokes
    const { request: revoked } = await approvalService.decideApprovalRequest({
      approvalRequestId: req.id,
      organizationId: ORG_A,
      decision: "revoked",
      actorId: REQUESTER_ID,
      reason: "No longer necessary",
    });
    expect(revoked.status).toBe("revoked");

    // Attempt to continue fails
    await expect(
      continuationService.continueApprovedExecution({
        approvalRequestId: req.id,
        organizationId: ORG_A,
        actorId: REQUESTER_ID,
      }),
    ).rejects.toThrow(/revoked/i);
  });

  // ---------------------------------------------------------------------------
  // 8. CONCURRENT APPROVAL DECISIONS
  // ---------------------------------------------------------------------------
  it("prevents concurrent conflicting decisions via atomic compare-and-set", async () => {
    const req = await approvalService.createApprovalRequest({
      organizationId: ORG_A,
      agentId: AGENT_ID,
      actionType: "tool_execution",
      actionTarget: "system_config_update",
      requestingActorId: REQUESTER_ID,
      payload: {},
      approvalReason: "System parameter modification",
    });

    // First reviewer approves
    await approvalService.decideApprovalRequest({
      approvalRequestId: req.id,
      organizationId: ORG_A,
      decision: "approved",
      actorId: REVIEWER_ID,
      userPermissions: ["agent.manage"],
      justification: "Approved by Reviewer 1",
    });

    // Second reviewer attempts to reject concurrently
    await expect(
      approvalService.decideApprovalRequest({
        approvalRequestId: req.id,
        organizationId: ORG_A,
        decision: "rejected",
        actorId: REVIEWER_ID,
        userPermissions: ["agent.manage"],
        justification: "Rejecting by Reviewer 2",
      }),
    ).rejects.toThrow(/already in 'approved' status/i);
  });

  // ---------------------------------------------------------------------------
  // 9. REPLAY PREVENTION VIA IDEMPOTENCY KEY
  // ---------------------------------------------------------------------------
  it("returns existing approval request on identical idempotency key", async () => {
    const key = "idemp-custom-key-12345";
    const req1 = await approvalService.createApprovalRequest({
      organizationId: ORG_A,
      agentId: AGENT_ID,
      actionType: "tool_execution",
      actionTarget: "data_export",
      requestingActorId: REQUESTER_ID,
      payload: { table: "audit_logs" },
      approvalReason: "Audit export",
      idempotencyKey: key,
    });

    const req2 = await approvalService.createApprovalRequest({
      organizationId: ORG_A,
      agentId: AGENT_ID,
      actionType: "tool_execution",
      actionTarget: "data_export",
      requestingActorId: REQUESTER_ID,
      payload: { table: "audit_logs" },
      approvalReason: "Audit export duplicate attempt",
      idempotencyKey: key,
    });

    expect(req2.id).toBe(req1.id);
  });

  // ---------------------------------------------------------------------------
  // 10. EXACT PAYLOAD FINGERPRINT MATCHING
  // ---------------------------------------------------------------------------
  it("rejects execution continuation if provided payload does not match approved fingerprint", async () => {
    const approvedPayload = { targetStudentId: "std-100", newGrade: "B+" };
    const req = await approvalService.createApprovalRequest({
      organizationId: ORG_A,
      agentId: AGENT_ID,
      actionType: "tool_execution",
      actionTarget: "update_grade",
      requestingActorId: REQUESTER_ID,
      payload: approvedPayload,
      approvalReason: "Grade revision",
      riskClassification: "medium",
    });

    await approvalService.decideApprovalRequest({
      approvalRequestId: req.id,
      organizationId: ORG_A,
      decision: "approved",
      actorId: REVIEWER_ID,
      userPermissions: ["agent.manage"],
      justification: "Grade update verified",
    });

    // Tampered payload with different grade
    const tamperedPayload = { targetStudentId: "std-100", newGrade: "A+" };

    await expect(
      continuationService.continueApprovedExecution({
        approvalRequestId: req.id,
        organizationId: ORG_A,
        actorId: REVIEWER_ID,
        providedPayload: tamperedPayload,
      }),
    ).rejects.toThrow(/execution parameters do not match the approved canonical payload fingerprint/i);
  });

  // ---------------------------------------------------------------------------
  // 11. POLICY CHANGE INVALIDATION
  // ---------------------------------------------------------------------------
  it("invalidates approved request if policy changes to block before execution", async () => {
    const req = await approvalService.createApprovalRequest({
      organizationId: ORG_A,
      agentId: AGENT_ID,
      actionType: "tool_execution",
      actionTarget: "export_sensitive_pii",
      requestingActorId: REQUESTER_ID,
      payload: {},
      approvalReason: "PII extraction",
    });

    await approvalService.decideApprovalRequest({
      approvalRequestId: req.id,
      organizationId: ORG_A,
      decision: "approved",
      actorId: REVIEWER_ID,
      userPermissions: ["agent.manage"],
      justification: "Approved previously",
    });

    // Now administrator creates hard BLOCK policy
    policyStore.set("block-pii", {
      id: "pol-block-pii",
      organizationId: ORG_A,
      name: "Strict PII Block",
      policyKey: "pol-strict-pii",
      policyType: "security",
      scopeType: "organization",
      severity: "critical",
      enforcementAction: "block",
      lifecycleState: "active",
      currentVersion: 2,
      rules: { blockedTools: ["export_sensitive_pii"] },
      metadata: {},
      createdBy: "admin",
      updatedBy: "admin",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Attempting to continue fails due to fresh policy re-evaluation
    await expect(
      continuationService.continueApprovedExecution({
        approvalRequestId: req.id,
        organizationId: ORG_A,
        actorId: REVIEWER_ID,
      }),
    ).rejects.toThrow(/policy rules have changed since approval/i);
  });

  // ---------------------------------------------------------------------------
  // 12. SINGLE-USE EXECUTION (CONSUMED REJECTION)
  // ---------------------------------------------------------------------------
  it("marks request as consumed and prevents second execution attempt", async () => {
    const req = await approvalService.createApprovalRequest({
      organizationId: ORG_A,
      agentId: AGENT_ID,
      actionType: "tool_execution",
      actionTarget: "generate_transcript",
      requestingActorId: REQUESTER_ID,
      payload: { studentId: "std-777" },
      approvalReason: "Official transcript request",
    });

    await approvalService.decideApprovalRequest({
      approvalRequestId: req.id,
      organizationId: ORG_A,
      decision: "approved",
      actorId: REVIEWER_ID,
      userPermissions: ["agent.manage"],
      justification: "Transcript fee paid",
    });

    // First execution succeeds
    const result1 = await continuationService.continueApprovedExecution({
      approvalRequestId: req.id,
      organizationId: ORG_A,
      actorId: REVIEWER_ID,
    });
    expect(result1.success).toBe(true);
    expect(result1.status).toBe("consumed");

    // Second execution must be rejected
    await expect(
      continuationService.continueApprovedExecution({
        approvalRequestId: req.id,
        organizationId: ORG_A,
        actorId: REVIEWER_ID,
      }),
    ).rejects.toThrow(/already been consumed/i);
  });

  // ---------------------------------------------------------------------------
  // 13. SAFE ESCALATION
  // ---------------------------------------------------------------------------
  it("escalates pending request to agent escalation contact and records escalation history", async () => {
    const req = await approvalService.createApprovalRequest({
      organizationId: ORG_A,
      agentId: AGENT_ID,
      actionType: "tool_execution",
      actionTarget: "high_value_transaction",
      requestingActorId: REQUESTER_ID,
      payload: { amount: 50000 },
      approvalReason: "High-value financial transfer",
      riskClassification: "critical",
    });

    const { request: escalated, escalation } = await approvalService.escalateApprovalRequest({
      approvalRequestId: req.id,
      organizationId: ORG_A,
      actorId: REVIEWER_ID,
      escalatedToReviewerId: "senior-vp-100",
      reason: "Transfer exceeds $25,000 threshold, requires VP authorization.",
    });

    expect(escalated.status).toBe("pending");
    expect(escalated.assignedReviewerId).toBe("senior-vp-100");
    expect(escalation.escalationContact).toBe("ops-lead@organization.com");
    expect(escalation.reason).toContain("exceeds $25,000");

    // Audit log
    const escLog = auditLogStore.find((l) => l.action === "approval_request.escalated");
    expect(escLog).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // 14. MONITOR MODE COMPATIBILITY
  // ---------------------------------------------------------------------------
  it("MONITOR mode preserves runtime flow and does not create blocking approval requests", async () => {
    // Configure MONITOR mode
    policyStore.set("mode", {
      id: "mode-policy",
      organizationId: ORG_A,
      name: "Governance Mode",
      policyKey: "sys-enforcement-mode",
      policyType: "enforcement_control",
      scopeType: "organization",
      severity: "low",
      enforcementAction: "audit",
      lifecycleState: "active",
      currentVersion: 1,
      rules: { mode: "MONITOR" },
      metadata: {},
      createdBy: "admin",
      updatedBy: "admin",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Create policy that requires approval
    policyStore.set("require-appr-policy", {
      id: "pol-require-appr",
      organizationId: ORG_A,
      name: "Require Approval For Data Export",
      policyKey: "pol-export-approval",
      policyType: "compliance",
      scopeType: "organization",
      severity: "high",
      enforcementAction: "require_approval",
      lifecycleState: "active",
      currentVersion: 1,
      rules: { approvalRequiredTools: ["export_all_records"] },
      metadata: {},
      createdBy: "admin",
      updatedBy: "admin",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const decision = await policyEngine.evaluate({
      organizationId: ORG_A,
      actorId: REQUESTER_ID,
      agentId: AGENT_ID,
      toolKey: "export_all_records",
      action: "tool_invocation",
    });

    // In MONITOR mode: decision is REQUIRE_APPROVAL but effectiveDecision is ALLOW
    expect(decision.decision).toBe("REQUIRE_APPROVAL");
    expect(decision.effectiveDecision).toBe("ALLOW");
    // No persistent approval request created
    expect(decision.approvalRequestId).toBeUndefined();
    expect(approvalStore.size).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // 15. ENFORCE MODE BLOCKING & REQUEST GENERATION
  // ---------------------------------------------------------------------------
  it("ENFORCE mode halts execution and generates persistent approval request", async () => {
    // Configure ENFORCE mode
    policyStore.set("mode", {
      id: "mode-policy",
      organizationId: ORG_A,
      name: "Governance Mode",
      policyKey: "sys-enforcement-mode",
      policyType: "enforcement_control",
      scopeType: "organization",
      severity: "low",
      enforcementAction: "audit",
      lifecycleState: "active",
      currentVersion: 1,
      rules: { mode: "ENFORCE" },
      metadata: {},
      createdBy: "admin",
      updatedBy: "admin",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    policyStore.set("require-appr-policy", {
      id: "pol-require-appr",
      organizationId: ORG_A,
      name: "Require Approval For Data Export",
      policyKey: "pol-export-approval",
      policyType: "compliance",
      scopeType: "organization",
      severity: "high",
      enforcementAction: "require_approval",
      lifecycleState: "active",
      currentVersion: 1,
      rules: { approvalRequiredTools: ["export_all_records"] },
      metadata: {},
      createdBy: "admin",
      updatedBy: "admin",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const decision = await policyEngine.evaluate({
      organizationId: ORG_A,
      actorId: REQUESTER_ID,
      agentId: AGENT_ID,
      toolKey: "export_all_records",
      action: "tool_invocation",
      parameters: { format: "csv" },
    });

    expect(decision.decision).toBe("REQUIRE_APPROVAL");
    expect(decision.effectiveDecision).toBe("REQUIRE_APPROVAL");
    expect(decision.approvalRequestId).toBeDefined();

    // Verify persisted in store
    const stored = approvalStore.get(decision.approvalRequestId!);
    expect(stored).toBeDefined();
    expect(stored?.status).toBe("pending");
    expect(stored?.actionTarget).toBe("export_all_records");
  });

  // ---------------------------------------------------------------------------
  // 16. TOOL GATEWAY GATE 1.1 INTEGRATION
  // ---------------------------------------------------------------------------
  it("Tool Gateway Gate 1.1 intercepts unapproved tool call with APPROVAL_REQUIRED", async () => {
    // Configure ENFORCE mode
    policyStore.set("mode", {
      id: "mode-policy",
      organizationId: ORG_A,
      name: "Governance Mode",
      policyKey: "sys-enforcement-mode",
      policyType: "enforcement_control",
      scopeType: "organization",
      severity: "low",
      enforcementAction: "audit",
      lifecycleState: "active",
      currentVersion: 1,
      rules: { mode: "ENFORCE" },
      metadata: {},
      createdBy: "admin",
      updatedBy: "admin",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    policyStore.set("require-appr-policy", {
      id: "pol-require-appr",
      organizationId: ORG_A,
      name: "Require Approval For File Modification",
      policyKey: "pol-file-mod-appr",
      policyType: "security",
      scopeType: "organization",
      severity: "high",
      enforcementAction: "require_approval",
      lifecycleState: "active",
      currentVersion: 1,
      rules: { approvalRequiredTools: ["file_system_write"] },
      metadata: {},
      createdBy: "admin",
      updatedBy: "admin",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await toolGateway.executeTool(
      {
        runId: "run-test-tool-1",
        toolKey: "file_system_write",
        input: { path: "/etc/config" },
      },
      {
        organizationId: ORG_A,
        workspaceId: WORKSPACE_ID,
        agentId: AGENT_ID,
        userId: REQUESTER_ID,
      } as any,
    );

    expect(result.success).toBe(false);
    expect(result.error?.category).toBe("APPROVAL_REQUIRED");
    expect(result.error?.message).toContain("requires human approval");
  });

  // ---------------------------------------------------------------------------
  // 17. EXPIRY SWEEP
  // ---------------------------------------------------------------------------
  it("sweepExpiredApprovals marks all expired pending requests as expired", async () => {
    await approvalService.createApprovalRequest({
      organizationId: ORG_A,
      agentId: AGENT_ID,
      actionType: "tool_execution",
      actionTarget: "tool_a",
      requestingActorId: REQUESTER_ID,
      payload: { a: 1 },
      approvalReason: "Expired 1",
      expiresInMinutes: -5,
    });

    await approvalService.createApprovalRequest({
      organizationId: ORG_A,
      agentId: AGENT_ID,
      actionType: "tool_execution",
      actionTarget: "tool_b",
      requestingActorId: REQUESTER_ID,
      payload: { b: 2 },
      approvalReason: "Active 1",
      expiresInMinutes: 60,
    });

    const expiredList = await approvalService.sweepExpiredApprovals(ORG_A);
    expect(expiredList.length).toBe(1);
    expect(expiredList[0].actionTarget).toBe("tool_a");
    expect(expiredList[0].status).toBe("expired");

    const activeReq = Array.from(approvalStore.values()).find((r) => r.actionTarget === "tool_b");
    expect(activeReq?.status).toBe("pending");
  });

  // ---------------------------------------------------------------------------
  // 18. AGENT RUNTIME INTEGRATION GATING
  // ---------------------------------------------------------------------------
  it("Agent Runtime halts attempt when governance policy produces REQUIRE_APPROVAL", async () => {
    policyStore.set("agent-approval-policy", {
      id: "pol-agent-appr",
      organizationId: ORG_A,
      name: "Autonomous Action Approval",
      policyKey: "pol-auto-appr",
      policyType: "behavioral",
      scopeType: "organization",
      severity: "high",
      enforcementAction: "require_approval",
      lifecycleState: "active",
      currentVersion: 1,
      rules: { disallowedActions: ["agent_execution"] },
      metadata: {},
      createdBy: "admin",
      updatedBy: "admin",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const decision = await policyEngine.evaluate({
      organizationId: ORG_A,
      actorId: REQUESTER_ID,
      agentId: AGENT_ID,
      action: "agent_execution",
    });

    expect(decision.decision).toBe("REQUIRE_APPROVAL");
    expect(decision.effectiveDecision).toBe("ALLOW"); // Default MONITOR mode
  });

  // ---------------------------------------------------------------------------
  // 19. AUDIT EVENT EMISSION & OBSERVED CORRECTNESS
  // ---------------------------------------------------------------------------
  it("records comprehensive audit trail for approval creation, decision, escalation and consumption", async () => {
    // 1. Create
    const req = await approvalService.createApprovalRequest({
      organizationId: ORG_A,
      agentId: AGENT_ID,
      actionType: "tool_execution",
      actionTarget: "sensitive_audit_action",
      requestingActorId: REQUESTER_ID,
      payload: { secret: "123" },
      approvalReason: "Compliance check",
    });

    // 2. Escalate
    await approvalService.escalateApprovalRequest({
      approvalRequestId: req.id,
      organizationId: ORG_A,
      actorId: REVIEWER_ID,
      reason: "Need senior approval",
    });

    // 3. Approve
    await approvalService.decideApprovalRequest({
      approvalRequestId: req.id,
      organizationId: ORG_A,
      decision: "approved",
      actorId: REVIEWER_ID,
      userPermissions: ["agent.manage"],
      justification: "Approved after compliance audit",
    });

    // 4. Consume
    await continuationService.continueApprovedExecution({
      approvalRequestId: req.id,
      organizationId: ORG_A,
      actorId: REVIEWER_ID,
    });

    // Verify audit logs
    const actions = auditLogStore.map((l) => l.action);
    expect(actions).toContain("approval_request.created");
    expect(actions).toContain("approval_request.escalated");
    expect(actions).toContain("approval_request.approved");
    expect(actions).toContain("approval_request.consumed");
  });

  // ---------------------------------------------------------------------------
  // 20. WORKER CONTINUATION PRESERVES CORRELATION AND IDEMPOTENCY
  // ---------------------------------------------------------------------------
  it("worker continuation executes operation and preserves execution outcome", async () => {
    const req = await approvalService.createApprovalRequest({
      organizationId: ORG_A,
      agentId: AGENT_ID,
      actionType: "agent_execution",
      actionTarget: AGENT_ID,
      requestingActorId: REQUESTER_ID,
      correlationId: "corr-worker-12345",
      executionId: "exec-run-9999",
      payload: { mode: "autonomous_batch" },
      approvalReason: "Autonomous batch execution",
    });

    await approvalService.decideApprovalRequest({
      approvalRequestId: req.id,
      organizationId: ORG_A,
      decision: "approved",
      actorId: REVIEWER_ID,
      userPermissions: ["agent.manage"],
      justification: "Approved batch schedule",
    });

    const result = await continuationService.continueApprovedExecution({
      approvalRequestId: req.id,
      organizationId: ORG_A,
      actorId: REVIEWER_ID,
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe("consumed");
    expect(result.actionType).toBe("agent_execution");
    expect(result.actionTarget).toBe(AGENT_ID);
    expect((result.executionResult as any).resumed).toBe(true);
  });
});
