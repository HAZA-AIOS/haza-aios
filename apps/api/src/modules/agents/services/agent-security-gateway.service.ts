import { ApiError } from "../../../common/errors/api-error.js";
import type { AgentSecurityRepository } from "../repositories/agent-security.repository.js";
import type {
  AgentSecurityProfileEntity,
  ToolRiskCategory,
  SecurityPostureSummary,
} from "../governance-security.types.js";

// Tool risk classification map
const KNOWN_TOOL_RISK_MAP: Record<string, ToolRiskCategory> = {
  "education.academic_structure.read": "READ_ONLY_DATA",
  "education.subjects.list": "READ_ONLY_DATA",
  "education.curriculum.read": "READ_ONLY_DATA",
  "education.lesson_plans.read": "READ_ONLY_DATA",
  "knowledge.search": "READ_ONLY_DATA",
  "education.lesson_plans.create_draft": "CONTROLLED_WRITE",
  "education.lesson_plans.update_draft": "CONTROLLED_WRITE",
  "education.lesson_plans.publish": "CONTROLLED_WRITE",
  "network.http.request": "EXTERNAL_NETWORK",
  "network.fetch": "EXTERNAL_NETWORK",
  "fs.file.read": "FILESYSTEM_ACCESS",
  "fs.file.write": "FILESYSTEM_ACCESS",
  "code.execution.run_python": "CODE_EXECUTION",
  "code.execution.run_bash": "CODE_EXECUTION",
  "code.eval": "CODE_EXECUTION",
  "system.process.kill": "SYSTEM_OPERATION",
  "system.shell.exec": "SYSTEM_OPERATION",
};

// SSRF blocked patterns
const SSRF_BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^169\.254\.\d+\.\d+$/, // Cloud metadata service
  /^::1$/,
  /^0\.0\.0\.0$/,
];

// Prompt injection heuristic patterns
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?previous\s+instructions/i,
  /disregard\s+(?:all\s+)?previous\s+directions/i,
  /override\s+(?:the\s+)?system\s+prompt/i,
  /you\s+are\s+now\s+(?:in\s+)?(?:developer|god|maintenance)\s+mode/i,
  /(?:leak|exfiltrate|reveal)\s+(?:all\s+)?(?:secrets|keys|credentials|tokens)/i,
  /bypass\s+(?:all\s+)?(?:security|governance|policy)\s+controls/i,
];

export class AgentSecurityGatewayService {
  // Global / organization emergency stop state in-memory cache
  private static readonly emergencyStops = new Map<string, { stoppedAt: string; stoppedBy: string; reason?: string }>();
  // In-flight active cancellation signals keyed by runId
  private static readonly cancellationSignals = new Set<string>();

  constructor(private readonly securityRepo: AgentSecurityRepository) {}

  // ---------------------------------------------------------------------------
  // 1. EMERGENCY STOP & SUSPENSION
  // ---------------------------------------------------------------------------

  isEmergencyStopped(organizationId: string, workspaceId?: string | null): boolean {
    if (AgentSecurityGatewayService.emergencyStops.has(`org:${organizationId}`)) {
      return true;
    }
    if (workspaceId && AgentSecurityGatewayService.emergencyStops.has(`ws:${workspaceId}`)) {
      return true;
    }
    return false;
  }

  async triggerEmergencyStop(input: {
    organizationId: string;
    workspaceId?: string | null;
    actorId: string;
    reason?: string;
  }): Promise<void> {
    const key = input.workspaceId ? `ws:${input.workspaceId}` : `org:${input.organizationId}`;
    const now = new Date().toISOString();
    AgentSecurityGatewayService.emergencyStops.set(key, {
      stoppedAt: now,
      stoppedBy: input.actorId,
      reason: input.reason,
    });

    await this.securityRepo.createEvent({
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      actorId: input.actorId,
      eventType: "EMERGENCY_STOP",
      severity: "CRITICAL",
      targetType: input.workspaceId ? "workspace" : "organization",
      targetId: input.workspaceId || input.organizationId,
      details: { reason: input.reason || "Administrative emergency stop triggered" },
    });
  }

  async resumeEmergencyStop(input: {
    organizationId: string;
    workspaceId?: string | null;
    actorId: string;
  }): Promise<void> {
    const key = input.workspaceId ? `ws:${input.workspaceId}` : `org:${input.organizationId}`;
    AgentSecurityGatewayService.emergencyStops.delete(key);

    await this.securityRepo.createEvent({
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      actorId: input.actorId,
      eventType: "EMERGENCY_RESUME",
      severity: "MEDIUM",
      targetType: input.workspaceId ? "workspace" : "organization",
      targetId: input.workspaceId || input.organizationId,
      details: { action: "Emergency stop lifted" },
    });
  }

  async suspendAgent(input: {
    organizationId: string;
    agentId: string;
    suspendedBy: string;
    reason: string;
  }): Promise<AgentSecurityProfileEntity> {
    const profile = await this.securityRepo.suspendAgent(
      input.organizationId,
      input.agentId,
      input.suspendedBy,
      input.reason,
    );

    await this.securityRepo.createEvent({
      organizationId: input.organizationId,
      agentId: input.agentId,
      actorId: input.suspendedBy,
      eventType: "SUSPENSION",
      severity: "HIGH",
      targetType: "agent",
      targetId: input.agentId,
      details: { reason: input.reason },
    });

    return profile;
  }

  async reactivateAgent(input: {
    organizationId: string;
    agentId: string;
    actorId: string;
  }): Promise<AgentSecurityProfileEntity> {
    const profile = await this.securityRepo.reactivateAgent(
      input.organizationId,
      input.agentId,
    );

    await this.securityRepo.createEvent({
      organizationId: input.organizationId,
      agentId: input.agentId,
      actorId: input.actorId,
      eventType: "REACTIVATION",
      severity: "MEDIUM",
      targetType: "agent",
      targetId: input.agentId,
      details: { action: "Agent reactivated by administrator" },
    });

    return profile;
  }

  async isAgentSuspended(organizationId: string, agentId: string): Promise<boolean> {
    const profile = await this.securityRepo.getProfile(organizationId, agentId);
    return Boolean(profile?.isSuspended);
  }

  // ---------------------------------------------------------------------------
  // 2. RUNTIME ENTRY ENFORCEMENT
  // ---------------------------------------------------------------------------

  async enforceRuntimeEntry(input: {
    organizationId: string;
    workspaceId?: string | null;
    agentId: string;
    actorId?: string;
  }): Promise<{ profile: AgentSecurityProfileEntity }> {
    // 1. Emergency stop check
    if (this.isEmergencyStopped(input.organizationId, input.workspaceId)) {
      throw new ApiError(
        503,
        "FORBIDDEN",
        "Execution halted: Organization or Workspace is currently under Emergency Stop",
      );
    }

    // 2. Fetch or create default security capability profile
    let profile = await this.securityRepo.getProfile(input.organizationId, input.agentId);
    if (!profile) {
      profile = await this.securityRepo.upsertProfile({
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        resourceClassification: "internal",
        networkAccessMode: "blocked",
        storageAccessMode: "blocked",
      });
    }

    // 3. Agent suspension check
    if (profile.isSuspended) {
      await this.securityRepo.createEvent({
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        actorId: input.actorId,
        eventType: "CAPABILITY_DENIED",
        severity: "HIGH",
        targetType: "agent",
        targetId: input.agentId,
        details: { reason: `Agent is suspended: ${profile.suspensionReason}` },
      });
      throw new ApiError(
        403,
        "FORBIDDEN",
        `Execution forbidden: Agent '${input.agentId}' is suspended (${profile.suspensionReason || "Administrative hold"})`,
      );
    }

    return { profile };
  }

  // ---------------------------------------------------------------------------
  // 3. TOOL SANDBOXING & CAPABILITY ENFORCEMENT
  // ---------------------------------------------------------------------------

  classifyTool(toolKey: string): ToolRiskCategory {
    if (KNOWN_TOOL_RISK_MAP[toolKey]) {
      return KNOWN_TOOL_RISK_MAP[toolKey];
    }
    if (toolKey.includes("code.") || toolKey.includes("eval") || toolKey.includes("script")) {
      return "CODE_EXECUTION";
    }
    if (toolKey.includes("system.") || toolKey.includes("shell") || toolKey.includes("process")) {
      return "SYSTEM_OPERATION";
    }
    if (toolKey.includes("network.") || toolKey.includes("http") || toolKey.includes("fetch")) {
      return "EXTERNAL_NETWORK";
    }
    if (toolKey.includes("fs.") || toolKey.includes("file") || toolKey.includes("storage")) {
      return "FILESYSTEM_ACCESS";
    }
    if (toolKey.includes(".create") || toolKey.includes(".update") || toolKey.includes(".delete") || toolKey.includes(".publish")) {
      return "CONTROLLED_WRITE";
    }
    return "READ_ONLY_DATA";
  }

  async enforceToolInvocation(input: {
    organizationId: string;
    workspaceId?: string | null;
    agentId: string;
    toolKey: string;
    toolInput: Record<string, unknown>;
    actorId?: string;
    profile?: AgentSecurityProfileEntity;
  }): Promise<{ allowed: boolean; riskCategory: ToolRiskCategory }> {
    // 1. Emergency stop check
    if (this.isEmergencyStopped(input.organizationId, input.workspaceId)) {
      throw new ApiError(
        503,
        "FORBIDDEN",
        "Tool invocation halted: Organization or Workspace is currently under Emergency Stop",
      );
    }

    const profile =
      input.profile ||
      (await this.securityRepo.getProfile(input.organizationId, input.agentId)) ||
      (await this.securityRepo.upsertProfile({
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        agentId: input.agentId,
      }));

    // 2. Agent suspension check
    if (profile.isSuspended) {
      throw new ApiError(
        403,
        "FORBIDDEN",
        `Tool invocation forbidden: Agent '${input.agentId}' is currently suspended`,
      );
    }

    // 3. Disallowed tool keys check
    if (profile.disallowedToolKeys.includes(input.toolKey)) {
      await this.securityRepo.createEvent({
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        actorId: input.actorId,
        eventType: "CAPABILITY_DENIED",
        severity: "HIGH",
        targetType: "tool",
        targetId: input.toolKey,
        details: { reason: "Tool explicitly disallowed by agent security profile" },
      });
      throw new ApiError(
        403,
        "FORBIDDEN",
        `Tool '${input.toolKey}' is explicitly prohibited by agent security profile`,
      );
    }

    // 4. Classify risk category
    const category = this.classifyTool(input.toolKey);

    // 5. Sandboxing Enforcement per Category
    if (category === "CODE_EXECUTION") {
      await this.securityRepo.createEvent({
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        actorId: input.actorId,
        eventType: "UNSAFE_CATEGORY_REJECTED",
        severity: "CRITICAL",
        targetType: "tool",
        targetId: input.toolKey,
        details: {
          category,
          reason: "Arbitrary untrusted code execution is disabled: genuinely isolated OS process sandbox boundary is not present",
        },
      });
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Untrusted code execution is disabled: genuine isolated OS-level sandbox boundary is required and unavailable",
      );
    }

    if (category === "SYSTEM_OPERATION") {
      await this.securityRepo.createEvent({
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        actorId: input.actorId,
        eventType: "UNSAFE_CATEGORY_REJECTED",
        severity: "CRITICAL",
        targetType: "tool",
        targetId: input.toolKey,
        details: {
          category,
          reason: "System-level operations are strictly prohibited across all agent environments",
        },
      });
      throw new ApiError(
        403,
        "FORBIDDEN",
        "System-level operations and OS process management are strictly forbidden",
      );
    }

    if (category === "EXTERNAL_NETWORK") {
      if (profile.networkAccessMode === "BLOCKED") {
        throw new ApiError(
          403,
          "FORBIDDEN",
          `External network access is blocked by agent security profile for tool '${input.toolKey}'`,
        );
      }

      // SSRF & Domain Validation
      const urlOrHost = (input.toolInput.url || input.toolInput.host || input.toolInput.endpoint) as string;
      if (urlOrHost && typeof urlOrHost === "string") {
        this.validateNetworkDestination(urlOrHost, profile);
      }
    }

    if (category === "FILESYSTEM_ACCESS") {
      if (profile.storageAccessMode === "BLOCKED") {
        throw new ApiError(
          403,
          "FORBIDDEN",
          `File and storage access is blocked by agent security profile for tool '${input.toolKey}'`,
        );
      }

      const filePath = (input.toolInput.path || input.toolInput.filePath || input.toolInput.fileName) as string;
      if (filePath && typeof filePath === "string") {
        this.validateStoragePath(filePath, profile);
      }
    }

    return { allowed: true, riskCategory: category };
  }

  // ---------------------------------------------------------------------------
  // 4. NETWORK & STORAGE VALIDATION (SSRF & PATH TRAVERSAL PREVENTIONS)
  // ---------------------------------------------------------------------------

  private validateNetworkDestination(destination: string, profile: AgentSecurityProfileEntity): void {
    let hostname = destination.trim();
    try {
      if (destination.includes("://")) {
        const parsed = new URL(destination);
        hostname = parsed.hostname;
      }
    } catch {
      // not a full URL, treat as hostname
    }

    // SSRF Check
    for (const pattern of SSRF_BLOCKED_HOST_PATTERNS) {
      if (pattern.test(hostname)) {
        throw new ApiError(
          403,
          "FORBIDDEN",
          `Network access to internal/private address '${hostname}' is prohibited (SSRF prevention)`,
        );
      }
    }

    if (profile.networkAccessMode === "ALLOWLIST") {
      const allowed = profile.allowedNetworkDomains.some((domain) => {
        if (domain.startsWith("*.")) {
          return hostname.endsWith(domain.slice(1));
        }
        return hostname === domain;
      });

      if (!allowed) {
        throw new ApiError(
          403,
          "FORBIDDEN",
          `Destination host '${hostname}' is not in the allowed network domains for this agent`,
        );
      }
    }
  }

  private validateStoragePath(filePath: string, _profile: AgentSecurityProfileEntity): void {
    const normalized = filePath.replace(/\\/g, "/");

    // Path traversal prevention
    if (normalized.includes("../") || normalized.includes("/..") || normalized === "..") {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Path traversal detected: directory traversal sequences ('..') are strictly prohibited",
      );
    }

    // Disallowed system root checks
    const blockedPrefixes = ["/etc", "/var", "/bin", "/sbin", "/usr", "/root", "C:/Windows", "C:/Program Files"];
    for (const prefix of blockedPrefixes) {
      if (normalized.toLowerCase().startsWith(prefix.toLowerCase())) {
        throw new ApiError(
          403,
          "FORBIDDEN",
          `Access to system path '${filePath}' is strictly prohibited`,
        );
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 5. UNTRUSTED INPUT & PROMPT INJECTION CLASSIFICATION
  // ---------------------------------------------------------------------------

  classifyAndScanInput(
    content: unknown,
    source: "system" | "user" | "tool" | "retrieval",
  ): {
    trustLevel: "TRUSTED" | "UNTRUSTED";
    injectionDetected: boolean;
    detectedPattern?: string;
  } {
    const trustLevel = source === "system" ? "TRUSTED" : "UNTRUSTED";
    if (typeof content !== "string") {
      return { trustLevel, injectionDetected: false };
    }

    for (const pattern of PROMPT_INJECTION_PATTERNS) {
      if (pattern.test(content)) {
        return {
          trustLevel,
          injectionDetected: true,
          detectedPattern: pattern.source,
        };
      }
    }

    return { trustLevel, injectionDetected: false };
  }

  // ---------------------------------------------------------------------------
  // 6. MULTI-AGENT DELEGATION ATTENUATION
  // ---------------------------------------------------------------------------

  assertDelegationPrivilegeAttenuation(
    parentProfile: AgentSecurityProfileEntity,
    childProfile: AgentSecurityProfileEntity,
  ): void {
    if (!parentProfile.delegationAttenuation) {
      return;
    }

    // 1. Child autonomy level cannot exceed parent
    const autonomyOrder: Record<string, number> = {
      L0: 0,
      L1: 1,
      L2: 2,
      L3: 3,
      l0: 0,
      l1: 1,
      l2: 2,
      l3: 3,
    };
    if (autonomyOrder[childProfile.maxAutonomyLevel] > autonomyOrder[parentProfile.maxAutonomyLevel]) {
      throw new ApiError(
        403,
        "FORBIDDEN",
        `Delegation privilege escalation rejected: Child agent autonomy level (${childProfile.maxAutonomyLevel}) exceeds parent (${parentProfile.maxAutonomyLevel})`,
      );
    }

    // 2. Child cannot access network if parent network is blocked
    if (parentProfile.networkAccessMode === "BLOCKED" && childProfile.networkAccessMode !== "BLOCKED") {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Delegation privilege escalation rejected: Child agent cannot acquire network access when parent is blocked",
      );
    }

    // 3. Child cannot access storage if parent storage is blocked
    if (parentProfile.storageAccessMode === "BLOCKED" && childProfile.storageAccessMode !== "BLOCKED") {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Delegation privilege escalation rejected: Child agent cannot acquire storage access when parent is blocked",
      );
    }
  }

  // ---------------------------------------------------------------------------
  // 7. CANCELLATION CHECKPOINTS
  // ---------------------------------------------------------------------------

  registerCancellationSignal(runId: string): void {
    AgentSecurityGatewayService.cancellationSignals.add(runId);
  }

  clearCancellationSignal(runId: string): void {
    AgentSecurityGatewayService.cancellationSignals.delete(runId);
  }

  checkExecutionCancellationCheckpoint(
    runId: string,
    organizationId: string,
    workspaceId?: string | null,
  ): void {
    if (AgentSecurityGatewayService.cancellationSignals.has(runId)) {
      throw new ApiError(
        499,
        "BAD_REQUEST",
        `Execution for run '${runId}' was cancelled by emergency cancellation checkpoint`,
      );
    }

    if (this.isEmergencyStopped(organizationId, workspaceId)) {
      throw new ApiError(
        503,
        "FORBIDDEN",
        "Execution stopped: Workspace or Organization entered emergency stop",
      );
    }
  }

  // ---------------------------------------------------------------------------
  // 8. SECURITY POSTURE SUMMARY
  // ---------------------------------------------------------------------------

  async getSecurityPosture(organizationId: string): Promise<SecurityPostureSummary> {
    const isEmergency = this.isEmergencyStopped(organizationId);
    const stopInfo = AgentSecurityGatewayService.emergencyStops.get(`org:${organizationId}`);

    const profiles = await this.securityRepo.listProfiles(organizationId);
    const suspendedCount = profiles.filter((p) => p.isSuspended).length;
    const activeCount = profiles.length - suspendedCount;

    const secretRefs = await this.securityRepo.listSecretReferences(organizationId);
    const activeSecrets = secretRefs.filter((s) => s.status === "active").length;
    const revokedSecrets = secretRefs.filter((s) => s.status === "revoked").length;

    const events = await this.securityRepo.listEvents(organizationId, { limit: 100 });
    const criticalEvents = events.filter((e) => e.severity === "CRITICAL").length;

    let overallStatus: SecurityPostureSummary["overallStatus"] = "HEALTHY";
    if (isEmergency) overallStatus = "EMERGENCY_STOPPED";
    else if (suspendedCount > 0) overallStatus = "SUSPENDED";
    else if (criticalEvents > 0) overallStatus = "DEGRADED";

    return {
      overallStatus,
      isEmergencyStopped: isEmergency,
      emergencyStoppedAt: stopInfo?.stoppedAt,
      emergencyStoppedBy: stopInfo?.stoppedBy,
      activeAgentsCount: activeCount,
      suspendedAgentsCount: suspendedCount,
      totalSecretReferencesCount: secretRefs.length,
      activeSecretReferencesCount: activeSecrets,
      revokedSecretReferencesCount: revokedSecrets,
      securityEventsCount24h: events.length,
      criticalEventsCount24h: criticalEvents,
    };
  }
}

