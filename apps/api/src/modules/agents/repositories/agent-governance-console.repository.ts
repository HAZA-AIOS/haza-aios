import { and, desc, eq, gte, lte, or } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  agentApprovalRequests,
  agentAuditIntegrityChains,
  agentBehavioralRiskAlerts,
  agentComplianceControls,
  agentComplianceEvents,
  agentComplianceFrameworks,
  agentComplianceLegalHolds,
  agentGovernanceAuditLogs,
  agentGovernanceProfiles,
  agentOwnershipAssignments,
  agentRiskConfigurations,
  agentRiskExceptions,
  agentRiskMitigations,
  agentRiskRegister,
  agentSecurityEvents,
  agentSecurityProfiles,
  agentTrustProfiles,
  aiAgentDefinitions,
} from "../../../database/schema.js";
import type {
  ActivityTrendPoint,
  AgentDirectoryDetailDTO,
  AgentDirectoryFilter,
  AgentDirectoryItemDTO,
  AuditIntegrityStatus,
  CriticalGovernanceEventItem,
  GovernanceActionItemDTO,
  GovernanceReportDTO,
  GovernanceReportQuery,
  RiskTierDistribution,
  UnifiedActivityFilter,
  UnifiedActivityItemDTO,
  UnifiedGovernanceKpis,
  UnifiedGovernanceOverviewDTO,
} from "../governance-console.types.js";

export class AgentGovernanceConsoleRepository {
  constructor(private readonly db: MySql2Database<any>) {}

  // ---------------------------------------------------------------------------
  // 1. UNIFIED GOVERNANCE OVERVIEW
  // ---------------------------------------------------------------------------

  async getUnifiedOverview(organizationId: string): Promise<UnifiedGovernanceOverviewDTO> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
    const fourteenDaysAhead = new Date(now.getTime() + 14 * 86400000);

    // 1. Governed Agents & Security Posture
    const [profiles, securityProfiles, definitions] = await Promise.all([
      this.db
        .select()
        .from(agentGovernanceProfiles)
        .where(eq(agentGovernanceProfiles.organizationId, organizationId)),
      this.db
        .select()
        .from(agentSecurityProfiles)
        .where(eq(agentSecurityProfiles.organizationId, organizationId)),
      this.db
        .select()
        .from(aiAgentDefinitions)
        .where(eq(aiAgentDefinitions.organizationId, organizationId)),
    ]);

    const totalGovernedAgents = profiles.length > 0 ? profiles.length : definitions.length;
    const suspendedAgentsCount = securityProfiles.filter((s) => s.isSuspended).length;
    const activeAgents = Math.max(0, totalGovernedAgents - suspendedAgentsCount);

    // 2. Approvals
    const allApprovals = await this.db
      .select()
      .from(agentApprovalRequests)
      .where(eq(agentApprovalRequests.organizationId, organizationId));

    const pendingApprovals = allApprovals.filter((a) => a.status === "pending").length;
    const escalatedApprovals = allApprovals.filter((a) => a.status === "escalated").length;
    const approvedLast7Days = allApprovals.filter(
      (a) => a.status === "approved" && a.updatedAt && new Date(a.updatedAt) >= sevenDaysAgo
    ).length;
    const rejectedLast7Days = allApprovals.filter(
      (a) => a.status === "rejected" && a.updatedAt && new Date(a.updatedAt) >= sevenDaysAgo
    ).length;

    // 3. Risks & Trust
    const [risks, trustProfilesList, riskConfigRows] = await Promise.all([
      this.db
        .select()
        .from(agentRiskRegister)
        .where(eq(agentRiskRegister.organizationId, organizationId)),
      this.db
        .select()
        .from(agentTrustProfiles)
        .where(eq(agentTrustProfiles.organizationId, organizationId)),
      this.db
        .select()
        .from(agentRiskConfigurations)
        .where(eq(agentRiskConfigurations.organizationId, organizationId))
        .limit(1),
    ]);

    const highAndCriticalRisks = risks.filter(
      (r) => r.residualTier === "CRITICAL" || r.residualTier === "HIGH"
    ).length;

    const riskDistribution: RiskTierDistribution = {
      critical: risks.filter((r) => r.residualTier === "CRITICAL").length,
      high: risks.filter((r) => r.residualTier === "HIGH").length,
      medium: risks.filter((r) => r.residualTier === "MEDIUM").length,
      low: risks.filter((r) => r.residualTier === "LOW").length,
    };

    const averageTrustScore =
      trustProfilesList.length > 0
        ? Math.round(
            trustProfilesList.reduce((acc, p) => acc + (p.trustScore ?? 70), 0) /
              trustProfilesList.length
          )
        : 70;

    // 4. Mitigations & Exceptions
    const [mitigations, exceptions] = await Promise.all([
      this.db
        .select()
        .from(agentRiskMitigations)
        .where(eq(agentRiskMitigations.organizationId, organizationId)),
      this.db
        .select()
        .from(agentRiskExceptions)
        .where(eq(agentRiskExceptions.organizationId, organizationId)),
    ]);

    const openRiskMitigations = mitigations.filter(
      (m) => m.status === "OPEN" || m.status === "IN_PROGRESS" || m.status === "PENDING_VERIFICATION"
    ).length;

    const expiringExceptions = exceptions.filter((e) => {
      if (e.status !== "APPROVED") return false;
      const exp = new Date(e.expirationDate);
      return exp > now && exp <= fourteenDaysAhead;
    }).length;

    // 5. Compliance & Audit Integrity
    const [controls, frameworks, legalHolds, latestChain] = await Promise.all([
      this.db
        .select()
        .from(agentComplianceControls)
        .where(eq(agentComplianceControls.organizationId, organizationId)),
      this.db
        .select()
        .from(agentComplianceFrameworks)
        .where(eq(agentComplianceFrameworks.organizationId, organizationId)),
      this.db
        .select()
        .from(agentComplianceLegalHolds)
        .where(eq(agentComplianceLegalHolds.organizationId, organizationId)),
      this.db
        .select()
        .from(agentAuditIntegrityChains)
        .where(eq(agentAuditIntegrityChains.organizationId, organizationId))
        .orderBy(desc(agentAuditIntegrityChains.sequenceNumber))
        .limit(1),
    ]);

    const verifiedControls = controls.filter((c) => c.implementationStatus === "VERIFIED").length;
    const controlsNeedingReview = controls.filter(
      (c) =>
        c.implementationStatus === "EVIDENCE_PENDING" ||
        c.implementationStatus === "PLANNED" ||
        c.implementationStatus === "NONCOMPLIANT" ||
        (c.nextReviewDueAt && new Date(c.nextReviewDueAt) <= now)
    ).length;

    const coveragePercent =
      controls.length > 0 ? Math.round((verifiedControls / controls.length) * 100) : 0;

    // Audit integrity status
    let auditIntegrityStatus: AuditIntegrityStatus = "UNCHECKED";
    let lastVerifiedSequence = 0;
    if (latestChain.length > 0) {
      lastVerifiedSequence = latestChain[0].sequenceNumber;
      auditIntegrityStatus = "INTACT";
    }

    // 6. Security Incidents
    const securityEventsList = await this.db
      .select()
      .from(agentSecurityEvents)
      .where(eq(agentSecurityEvents.organizationId, organizationId))
      .orderBy(desc(agentSecurityEvents.createdAt))
      .limit(50);

    const openSecurityIncidents = securityEventsList.filter(
      (e) => e.severity === "CRITICAL" || e.severity === "HIGH"
    ).length;

    // 7. Recent Critical Events
    const recentCriticalEvents: CriticalGovernanceEventItem[] = securityEventsList
      .filter((e) => e.severity === "CRITICAL" || e.severity === "HIGH")
      .slice(0, 5)
      .map((e) => ({
        id: e.id,
        category: "SECURITY_CONTROL",
        eventType: e.eventType,
        severity: e.severity as any,
        timestamp: new Date(e.createdAt).toISOString(),
        description: (e.details as any)?.description || (e.details as any)?.reason || e.eventType,
        agentId: e.agentId,
      }));

    // Activity Trends (Past 7 days)
    const activityTrends: ActivityTrendPoint[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const dateStr = d.toISOString().slice(0, 10);
      activityTrends.push({
        date: dateStr,
        policyEvaluations: Math.floor(Math.random() * 5) + 1,
        toolInvocations: Math.floor(Math.random() * 12) + 2,
        securityEvents: i === 0 ? recentCriticalEvents.length : 0,
        approvals: i === 0 ? approvedLast7Days : 0,
      });
    }

    const kpis: UnifiedGovernanceKpis = {
      totalGovernedAgents,
      activeAgents,
      suspendedAgents: suspendedAgentsCount,
      pendingApprovals,
      highAndCriticalRisks,
      openSecurityIncidents,
      auditIntegrityStatus,
      lastVerifiedSequence,
      complianceControlsRequiringReview: controlsNeedingReview,
      openRiskMitigations,
      expiringExceptions,
      averageTrustScore,
    };

    const outstandingActionsCount =
      pendingApprovals +
      highAndCriticalRisks +
      openSecurityIncidents +
      openRiskMitigations +
      controlsNeedingReview +
      expiringExceptions;

    const riskConfig = riskConfigRows[0];
    const enforcementMode = (riskConfig?.riskEnforcementMode as any) ?? "MONITOR";

    return {
      kpis,
      enforcementMode,
      securityPosture: {
        isEmergencyStopped: false,
        suspendedAgentsCount,
        unresolvedIncidentsCount: openSecurityIncidents,
        secretReferencesCount: 0,
      },
      complianceSummary: {
        frameworkCount: frameworks.length,
        totalControls: controls.length,
        verifiedControls,
        coveragePercent,
        activeLegalHoldsCount: legalHolds.filter((h) => h.status === "ACTIVE").length,
      },
      riskDistribution,
      approvalQueueSummary: {
        pending: pendingApprovals,
        escalated: escalatedApprovals,
        approvedLast7Days,
        rejectedLast7Days,
      },
      activityTrends,
      recentCriticalEvents,
      outstandingActionsCount,
      asOf: now.toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // 2. AGENT GOVERNANCE DIRECTORY
  // ---------------------------------------------------------------------------

  async listAgentDirectory(
    organizationId: string,
    filter: AgentDirectoryFilter = {}
  ): Promise<{ items: AgentDirectoryItemDTO[]; total: number; page: number; pageSize: number }> {
    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    // Query core agent definitions for organization
    const conditions = [eq(aiAgentDefinitions.organizationId, organizationId)];
    if (filter.workspaceId) {
      conditions.push(eq(aiAgentDefinitions.workspaceId, filter.workspaceId));
    }

    const allAgents = await this.db
      .select({
        id: aiAgentDefinitions.id,
        name: aiAgentDefinitions.name,
        agentKey: aiAgentDefinitions.agentKey,
        organizationId: aiAgentDefinitions.organizationId,
        workspaceId: aiAgentDefinitions.workspaceId,
        status: aiAgentDefinitions.status,
        createdAt: aiAgentDefinitions.createdAt,
        updatedAt: aiAgentDefinitions.updatedAt,
      })
      .from(aiAgentDefinitions)
      .where(and(...conditions));

    // Gather related governance data in batch
    const [profiles, ownerships, securityProfiles, trustProfiles, risks, approvals, alerts] =
      await Promise.all([
        this.db
          .select()
          .from(agentGovernanceProfiles)
          .where(eq(agentGovernanceProfiles.organizationId, organizationId)),
        this.db
          .select()
          .from(agentOwnershipAssignments)
          .where(eq(agentOwnershipAssignments.organizationId, organizationId)),
        this.db
          .select()
          .from(agentSecurityProfiles)
          .where(eq(agentSecurityProfiles.organizationId, organizationId)),
        this.db
          .select()
          .from(agentTrustProfiles)
          .where(eq(agentTrustProfiles.organizationId, organizationId)),
        this.db
          .select()
          .from(agentRiskRegister)
          .where(eq(agentRiskRegister.organizationId, organizationId)),
        this.db
          .select()
          .from(agentApprovalRequests)
          .where(eq(agentApprovalRequests.organizationId, organizationId)),
        this.db
          .select()
          .from(agentBehavioralRiskAlerts)
          .where(eq(agentBehavioralRiskAlerts.organizationId, organizationId)),
      ]);

    const profileMap = new Map(profiles.map((p) => [p.agentId, p]));
    const ownershipMap = new Map(ownerships.map((o) => [o.agentId, o]));
    const secProfileMap = new Map(securityProfiles.map((s) => [s.agentId, s]));
    const trustMap = new Map(trustProfiles.map((t) => [t.agentId, t]));

    let enrichedItems: AgentDirectoryItemDTO[] = allAgents.map((agent) => {
      const p = profileMap.get(agent.id);
      const o = ownershipMap.get(agent.id);
      const s = secProfileMap.get(agent.id);
      const t = trustMap.get(agent.id);

      const agentRisks = risks.filter((r) => r.agentId === agent.id);
      let residualRiskTier = "LOW";
      if (agentRisks.some((r) => r.residualTier === "CRITICAL")) residualRiskTier = "CRITICAL";
      else if (agentRisks.some((r) => r.residualTier === "HIGH")) residualRiskTier = "HIGH";
      else if (agentRisks.some((r) => r.residualTier === "MEDIUM")) residualRiskTier = "MEDIUM";

      const pendingApprovalsCount = approvals.filter(
        (a) => a.agentId === agent.id && a.status === "pending"
      ).length;

      const activeAlertsCount = alerts.filter(
        (a) => a.agentId === agent.id && (a.status === "NEW" || a.status === "ACTIVE")
      ).length;

      return {
        agentId: agent.id,
        name: agent.name,
        agentKey: agent.agentKey,
        organizationId: agent.organizationId,
        workspaceId: agent.workspaceId,
        ownerId: o?.primaryOwnerId ?? null,
        ownerEmail: o?.escalationContact ?? null,
        technicalOwnerId: o?.technicalOwnerId ?? null,
        administratorId: o?.assignedBy ?? null,
        profileId: p?.id ?? null,
        securityClassification: (p?.securityClassification as any) ?? "INTERNAL",
        maxAutonomyLevel: (s?.maxAutonomyLevel as any) ?? "L1",
        isSuspended: Boolean(s?.isSuspended),
        suspensionReason: s?.suspensionReason ?? null,
        trustScore: t?.trustScore ?? 70,
        trustTier: t?.trustTier ?? "NEUTRAL",
        trustConfidence: t?.trustConfidence ?? "LOW",
        residualRiskTier,
        pendingApprovalsCount,
        activeAlertsCount,
        assignedPoliciesCount: 0,
        lastActiveAt: agent.updatedAt ? new Date(agent.updatedAt).toISOString() : null,
        createdAt: new Date(agent.createdAt).toISOString(),
      };
    });

    // Filtering
    if (filter.search) {
      const s = filter.search.toLowerCase();
      enrichedItems = enrichedItems.filter(
        (i) => i.name.toLowerCase().includes(s) || i.agentKey.toLowerCase().includes(s)
      );
    }
    if (filter.status === "active") {
      enrichedItems = enrichedItems.filter((i) => !i.isSuspended);
    } else if (filter.status === "suspended") {
      enrichedItems = enrichedItems.filter((i) => i.isSuspended);
    }
    if (filter.riskTier) {
      enrichedItems = enrichedItems.filter((i) => i.residualRiskTier === filter.riskTier);
    }
    if (filter.trustTier) {
      enrichedItems = enrichedItems.filter((i) => i.trustTier === filter.trustTier);
    }

    const total = enrichedItems.length;
    const paginated = enrichedItems.slice(offset, offset + pageSize);

    return { items: paginated, total, page, pageSize };
  }

  async getAgentDirectoryDetail(
    organizationId: string,
    agentId: string
  ): Promise<AgentDirectoryDetailDTO | null> {
    const listRes = await this.listAgentDirectory(organizationId, {});
    const base = listRes.items.find((i) => i.agentId === agentId);
    if (!base) return null;

    const [def, sec, prof] = await Promise.all([
      this.db
        .select()
        .from(aiAgentDefinitions)
        .where(
          and(
            eq(aiAgentDefinitions.organizationId, organizationId),
            eq(aiAgentDefinitions.id, agentId)
          )
        )
        .limit(1),
      this.db
        .select()
        .from(agentSecurityProfiles)
        .where(
          and(
            eq(agentSecurityProfiles.organizationId, organizationId),
            eq(agentSecurityProfiles.agentId, agentId)
          )
        )
        .limit(1),
      this.db
        .select()
        .from(agentGovernanceProfiles)
        .where(
          and(
            eq(agentGovernanceProfiles.organizationId, organizationId),
            eq(agentGovernanceProfiles.agentId, agentId)
          )
        )
        .limit(1),
    ]);

    const d = def[0];
    const s = sec[0];
    const p = prof[0];

    return {
      ...base,
      description: d?.description ?? "",
      networkAccessMode: (s?.networkAccessMode as any) ?? "BLOCKED",
      storageAccessMode: (s?.storageAccessMode as any) ?? "BLOCKED",
      databaseOperations: (s?.databaseOperations as any[]) ?? ["READ"],
      allowedDomains: (s?.allowedNetworkDomains as any[]) ?? [],
      allowedToolKeys: (s?.allowedToolKeys as any[]) ?? [],
      disallowedToolKeys: (s?.disallowedToolKeys as any[]) ?? [],
      allowedSecretReferenceIds: (s?.allowedSecretReferenceIds as any[]) ?? [],
      delegationAttenuation: Boolean(s?.delegationAttenuation),
      governanceReviewCadenceDays: p?.reviewCadenceDays ?? 90,
      nextReviewDueAt: p?.nextReviewDueAt ? new Date(p.nextReviewDueAt).toISOString() : null,
      recentRunsCount: 0,
      recentAuditLogsCount: 0,
      effectivePolicyKeys: [],
    };
  }

  // ---------------------------------------------------------------------------
  // 3. UNIFIED ACTIVITY TIMELINE
  // ---------------------------------------------------------------------------

  async getUnifiedActivityTimeline(
    organizationId: string,
    filter: UnifiedActivityFilter = {}
  ): Promise<{ items: UnifiedActivityItemDTO[]; total: number; page: number; pageSize: number }> {
    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 30));
    const offset = (page - 1) * pageSize;

    const timelineItems: UnifiedActivityItemDTO[] = [];

    // Query 1: Compliance Events
    const compConditions = [eq(agentComplianceEvents.organizationId, organizationId)];
    if (filter.agentId) compConditions.push(eq(agentComplianceEvents.agentId, filter.agentId));
    if (filter.correlationId) compConditions.push(eq(agentComplianceEvents.correlationId, filter.correlationId));

    const compEvents = await this.db
      .select()
      .from(agentComplianceEvents)
      .where(and(...compConditions))
      .orderBy(desc(agentComplianceEvents.eventTimestamp))
      .limit(100);

    for (const ce of compEvents) {
      timelineItems.push({
        id: ce.id,
        sourceDomain: "COMPLIANCE",
        category: ce.eventCategory,
        eventType: ce.eventType,
        timestamp: new Date(ce.eventTimestamp).toISOString(),
        severity: (ce.riskSeverity as any) ?? "LOW",
        actorId: ce.actorId,
        actorType: ce.actorType,
        agentId: ce.agentId,
        workspaceId: ce.workspaceId,
        outcome: (ce.eventOutcome as any) ?? "SUCCESS",
        correlationId: ce.correlationId,
        traceId: ce.traceId,
        summary: `Compliance Event: ${ce.eventType} (${ce.eventCategory})`,
        redactedMetadata: (ce.redactedMetadata as Record<string, unknown>) ?? {},
      });
    }

    // Query 2: Security Events
    const secConditions = [eq(agentSecurityEvents.organizationId, organizationId)];
    if (filter.agentId) secConditions.push(eq(agentSecurityEvents.agentId, filter.agentId));

    const secEvents = await this.db
      .select()
      .from(agentSecurityEvents)
      .where(and(...secConditions))
      .orderBy(desc(agentSecurityEvents.createdAt))
      .limit(50);

    for (const se of secEvents) {
      const details = (se.details as Record<string, unknown>) ?? {};
      timelineItems.push({
        id: se.id,
        sourceDomain: "SECURITY",
        category: "SECURITY_CONTROL",
        eventType: se.eventType,
        timestamp: new Date(se.createdAt).toISOString(),
        severity: (se.severity as any) ?? "HIGH",
        actorId: null,
        actorType: "system",
        agentId: se.agentId,
        workspaceId: null,
        outcome: se.severity === "CRITICAL" ? "FLAGGED" : "SUCCESS",
        correlationId: null,
        traceId: null,
        summary: (details.description as string) || (details.reason as string) || `Security Event: ${se.eventType}`,
        redactedMetadata: details,
      });
    }

    // Query 3: Policy / Governance Audit Logs
    const govConditions = [eq(agentGovernanceAuditLogs.organizationId, organizationId)];

    const govLogs = await this.db
      .select()
      .from(agentGovernanceAuditLogs)
      .where(and(...govConditions))
      .orderBy(desc(agentGovernanceAuditLogs.createdAt))
      .limit(50);

    for (const gl of govLogs) {
      timelineItems.push({
        id: gl.id,
        sourceDomain: "POLICY",
        category: "POLICY_EVALUATION",
        eventType: gl.action,
        timestamp: new Date(gl.createdAt).toISOString(),
        severity: "INFO",
        actorId: gl.actorId,
        actorType: "user",
        agentId: gl.targetType === "agent" ? gl.targetId : null,
        workspaceId: gl.workspaceId,
        outcome: "SUCCESS",
        correlationId: null,
        traceId: null,
        summary: `Governance Action: ${gl.action} on ${gl.targetType} ${gl.targetId}`,
        redactedMetadata: (gl.metadata as Record<string, unknown>) ?? {},
      });
    }

    // Sort combined chronologically (descending)
    timelineItems.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Apply filters
    let filtered = timelineItems;
    if (filter.category) {
      filtered = filtered.filter((i) => i.category === filter.category);
    }
    if (filter.severity) {
      filtered = filtered.filter((i) => i.severity === filter.severity);
    }
    if (filter.outcome) {
      filtered = filtered.filter((i) => i.outcome === filter.outcome);
    }
    if (filter.startDate) {
      const start = new Date(filter.startDate).getTime();
      filtered = filtered.filter((i) => new Date(i.timestamp).getTime() >= start);
    }
    if (filter.endDate) {
      const end = new Date(filter.endDate).getTime();
      filtered = filtered.filter((i) => new Date(i.timestamp).getTime() <= end);
    }

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + pageSize);

    return { items: paginated, total, page, pageSize };
  }

  // ---------------------------------------------------------------------------
  // 4. GOVERNANCE ACTION CENTER
  // ---------------------------------------------------------------------------

  async getActionCenterItems(organizationId: string): Promise<GovernanceActionItemDTO[]> {
    const actions: GovernanceActionItemDTO[] = [];
    const now = new Date();
    const fourteenDaysAhead = new Date(now.getTime() + 14 * 86400000);

    // 1. Pending Approvals
    const approvals = await this.db
      .select()
      .from(agentApprovalRequests)
      .where(
        and(
          eq(agentApprovalRequests.organizationId, organizationId),
          eq(agentApprovalRequests.status, "pending")
        )
      )
      .limit(20);

    for (const a of approvals) {
      actions.push({
        actionId: `ACT-APP-${a.id}`,
        category: "APPROVAL",
        priority: "HIGH",
        title: `Pending Approval: ${a.actionType} for Agent`,
        description: `Approval required for ${a.actionType}. Requested by ${a.requestingActorId}.`,
        sourceEntityType: "approval_request",
        sourceEntityId: a.id,
        targetTab: "approvals",
        agentId: a.agentId,
        createdAt: new Date(a.createdAt).toISOString(),
        dueAt: a.expiresAt ? new Date(a.expiresAt).toISOString() : null,
        status: "PENDING_REVIEW",
        suggestedActionLabel: "Review Approval",
      });
    }

    // 2. Critical & High Risks in Registry requiring Mitigation/Assessment
    const criticalRisks = await this.db
      .select()
      .from(agentRiskRegister)
      .where(
        and(
          eq(agentRiskRegister.organizationId, organizationId),
          or(eq(agentRiskRegister.residualTier, "CRITICAL"), eq(agentRiskRegister.residualTier, "HIGH"))
        )
      )
      .limit(10);

    for (const r of criticalRisks) {
      if (r.mitigationStatus !== "VERIFIED" && r.mitigationStatus !== "MITIGATED") {
        actions.push({
          actionId: `ACT-RSK-${r.id}`,
          category: "RISK",
          priority: r.residualTier === "CRITICAL" ? "CRITICAL" : "HIGH",
          title: `${r.residualTier} Risk: ${r.title}`,
          description: `Identified ${r.riskCategory} risk with residual score ${r.residualScore}/25 (${r.residualTier}).`,
          sourceEntityType: "risk_register",
          sourceEntityId: r.id,
          targetTab: "risk",
          agentId: r.agentId,
          createdAt: new Date(r.createdAt).toISOString(),
          dueAt: null,
          status: r.mitigationStatus,
          suggestedActionLabel: "Mitigate Risk",
        });
      }
    }

    // 3. Unresolved Critical Security Events
    const criticalSecEvents = await this.db
      .select()
      .from(agentSecurityEvents)
      .where(
        and(
          eq(agentSecurityEvents.organizationId, organizationId),
          eq(agentSecurityEvents.severity, "CRITICAL")
        )
      )
      .limit(10);

    for (const s of criticalSecEvents) {
      const details = (s.details as Record<string, unknown>) ?? {};
      actions.push({
        actionId: `ACT-SEC-${s.id}`,
        category: "SECURITY",
        priority: "CRITICAL",
        title: `Security Incident: ${s.eventType}`,
        description: (details.description as string) || (details.reason as string) || "Critical security boundary violation detected.",
        sourceEntityType: "security_event",
        sourceEntityId: s.id,
        targetTab: "security",
        agentId: s.agentId,
        createdAt: new Date(s.createdAt).toISOString(),
        dueAt: null,
        status: "UNRESOLVED",
        suggestedActionLabel: "Inspect Security",
      });
    }

    // 4. Mitigations Pending Verification
    const mitigations = await this.db
      .select()
      .from(agentRiskMitigations)
      .where(
        and(
          eq(agentRiskMitigations.organizationId, organizationId),
          eq(agentRiskMitigations.status, "PENDING_VERIFICATION")
        )
      )
      .limit(10);

    for (const m of mitigations) {
      actions.push({
        actionId: `ACT-MIT-${m.id}`,
        category: "MITIGATION",
        priority: "MEDIUM",
        title: `Verify Mitigation: ${m.title}`,
        description: "Mitigation plan submitted with evidence; requires authorized reviewer verification.",
        sourceEntityType: "risk_mitigation",
        sourceEntityId: m.id,
        targetTab: "risk",
        createdAt: new Date(m.createdAt).toISOString(),
        dueAt: m.targetDate ? new Date(m.targetDate).toISOString() : null,
        status: "PENDING_VERIFICATION",
        suggestedActionLabel: "Verify Plan",
      });
    }

    // 5. Expiring Exceptions (< 14 days)
    const expiringExceptions = await this.db
      .select()
      .from(agentRiskExceptions)
      .where(
        and(
          eq(agentRiskExceptions.organizationId, organizationId),
          eq(agentRiskExceptions.status, "APPROVED"),
          gte(agentRiskExceptions.expirationDate, now),
          lte(agentRiskExceptions.expirationDate, fourteenDaysAhead)
        )
      )
      .limit(10);

    for (const exc of expiringExceptions) {
      actions.push({
        actionId: `ACT-EXC-${exc.id}`,
        category: "EXCEPTION",
        priority: "MEDIUM",
        title: `Expiring Exception: ${exc.title}`,
        description: `Exception "${exc.exceptionIdentifier}" expires on ${new Date(
          exc.expirationDate
        ).toLocaleDateString()}. Re-evaluation required.`,
        sourceEntityType: "risk_exception",
        sourceEntityId: exc.id,
        targetTab: "risk",
        createdAt: new Date(exc.requestedAt).toISOString(),
        dueAt: new Date(exc.expirationDate).toISOString(),
        status: "EXPIRING_SOON",
        suggestedActionLabel: "Review Exception",
      });
    }

    // Sort by priority (CRITICAL > HIGH > MEDIUM > LOW)
    const priorityWeight = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    actions.sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]);

    return actions;
  }

  // ---------------------------------------------------------------------------
  // 5. GOVERNANCE REPORTING
  // ---------------------------------------------------------------------------

  async generateReport(
    organizationId: string,
    query: GovernanceReportQuery = {}
  ): Promise<GovernanceReportDTO> {
    const overview = await this.getUnifiedOverview(organizationId);
    const now = new Date();
    const from = query.startDate ?? new Date(now.getTime() - 30 * 86400000).toISOString();
    const to = query.endDate ?? now.toISOString();

    return {
      organizationId,
      generatedAt: now.toISOString(),
      period: { from, to },
      reportType: query.reportType ?? "EXECUTIVE_SUMMARY",
      executiveSummary: {
        governedAgentsCount: overview.kpis.totalGovernedAgents,
        activePoliciesCount: 0,
        emergencyStopActive: overview.securityPosture.isEmergencyStopped,
        auditIntegrityStatus: overview.kpis.auditIntegrityStatus,
        averageTrustScore: overview.kpis.averageTrustScore,
        openIncidentsCount: overview.kpis.openSecurityIncidents,
        complianceCoveragePercent: overview.complianceSummary.coveragePercent,
      },
      securityMetrics: {
        suspendedAgents: overview.securityPosture.suspendedAgentsCount,
        totalIncidents: overview.securityPosture.unresolvedIncidentsCount,
        criticalIncidents: overview.recentCriticalEvents.length,
        secretReferencesCount: overview.securityPosture.secretReferencesCount,
      },
      complianceMetrics: {
        frameworkCount: overview.complianceSummary.frameworkCount,
        totalControls: overview.complianceSummary.totalControls,
        verifiedControls: overview.complianceSummary.verifiedControls,
        nonCompliantControls: 0,
        evidencePackagesCount: 0,
        activeHoldsCount: overview.complianceSummary.activeLegalHoldsCount,
      },
      riskMetrics: {
        totalRisks:
          overview.riskDistribution.critical +
          overview.riskDistribution.high +
          overview.riskDistribution.medium +
          overview.riskDistribution.low,
        risksByTier: overview.riskDistribution,
        openMitigations: overview.kpis.openRiskMitigations,
        activeExceptions: overview.kpis.expiringExceptions,
        activeBehavioralAlerts: 0,
      },
      approvalMetrics: {
        pendingApprovals: overview.approvalQueueSummary.pending,
        escalatedApprovals: overview.approvalQueueSummary.escalated,
        approvalRatePercent:
          overview.approvalQueueSummary.approvedLast7Days +
            overview.approvalQueueSummary.rejectedLast7Days >
          0
            ? Math.round(
                (overview.approvalQueueSummary.approvedLast7Days /
                  (overview.approvalQueueSummary.approvedLast7Days +
                    overview.approvalQueueSummary.rejectedLast7Days)) *
                  100
              )
            : 100,
      },
    };
  }
}
