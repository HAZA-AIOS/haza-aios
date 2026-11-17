import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  agentBehavioralRiskAlerts,
  agentRiskAssessments,
  agentRiskConfigurations,
  agentRiskExceptions,
  agentRiskMitigations,
  agentRiskRegister,
  agentRiskReviewHistory,
  agentTrustAssessmentHistory,
  agentTrustProfiles,
} from "../../../database/schema.js";
import type {
  BehavioralAlertStatus,
  BehavioralDetectionRule,
  MitigationPlanStatus,
  RiskCategory,
  RiskExceptionStatus,
  RiskMitigationStatus,
  RiskTier,
  TrustConfidence,
  TrustTier,
} from "../risk-trust.types.js";

type WithOptionalId<T> = Omit<T, "id"> & { id?: string };

export class AgentRiskRepository {
  constructor(private readonly db: MySql2Database<any>) {}

  // -------------------------------------------------------------------------
  // 1. Risk Configurations
  // -------------------------------------------------------------------------

  async getConfiguration(organizationId: string) {
    const rows = await this.db
      .select()
      .from(agentRiskConfigurations)
      .where(eq(agentRiskConfigurations.organizationId, organizationId))
      .limit(1);

    if (rows.length > 0) return rows[0];

    // Seed default configuration if none exists
    const defaultId = randomUUID();
    const newConfig = {
      id: defaultId,
      organizationId,
      riskScoringModel: "INHERENT_LIKELIHOOD_IMPACT_V1",
      lowThresholdMax: 5,
      mediumThresholdMax: 11,
      highThresholdMax: 19,
      criticalThresholdMin: 20,
      riskEnforcementEnabled: false,
      riskEnforcementMode: "MONITOR",
      trustEvaluationWindowDays: 30,
      minOperationsForConfidence: 5,
      behavioralDetectionEnabled: true,
    };

    await this.db.insert(agentRiskConfigurations).values(newConfig);
    return newConfig;
  }

  async upsertConfiguration(organizationId: string, data: Partial<typeof agentRiskConfigurations.$inferInsert>) {
    await this.getConfiguration(organizationId);
    await this.db
      .update(agentRiskConfigurations)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(agentRiskConfigurations.organizationId, organizationId));

    return this.getConfiguration(organizationId);
  }

  // -------------------------------------------------------------------------
  // 2. Risk Register
  // -------------------------------------------------------------------------

  async listRisks(
    organizationId: string,
    filters?: {
      category?: RiskCategory;
      residualTier?: RiskTier;
      agentId?: string;
      status?: RiskMitigationStatus;
      limit?: number;
      offset?: number;
    }
  ) {
    const conditions = [eq(agentRiskRegister.organizationId, organizationId)];

    if (filters?.category) {
      conditions.push(eq(agentRiskRegister.riskCategory, filters.category));
    }
    if (filters?.residualTier) {
      conditions.push(eq(agentRiskRegister.residualTier, filters.residualTier));
    }
    if (filters?.agentId) {
      conditions.push(eq(agentRiskRegister.agentId, filters.agentId));
    }
    if (filters?.status) {
      conditions.push(eq(agentRiskRegister.mitigationStatus, filters.status));
    }

    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;

    return this.db
      .select()
      .from(agentRiskRegister)
      .where(and(...conditions))
      .orderBy(desc(agentRiskRegister.residualScore), desc(agentRiskRegister.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getRiskById(organizationId: string, riskId: string) {
    const rows = await this.db
      .select()
      .from(agentRiskRegister)
      .where(and(eq(agentRiskRegister.organizationId, organizationId), eq(agentRiskRegister.id, riskId)))
      .limit(1);

    return rows.length > 0 ? rows[0] : null;
  }

  async getRiskByIdentifier(organizationId: string, riskIdentifier: string) {
    const rows = await this.db
      .select()
      .from(agentRiskRegister)
      .where(
        and(
          eq(agentRiskRegister.organizationId, organizationId),
          eq(agentRiskRegister.riskIdentifier, riskIdentifier)
        )
      )
      .limit(1);

    return rows.length > 0 ? rows[0] : null;
  }

  async createRisk(data: WithOptionalId<typeof agentRiskRegister.$inferInsert>) {
    const id = data.id ?? randomUUID();
    const toInsert = {
      ...data,
      id,
    };
    await this.db.insert(agentRiskRegister).values(toInsert as any);
    return this.getRiskById(data.organizationId, id);
  }

  async updateRisk(
    organizationId: string,
    riskId: string,
    data: Partial<typeof agentRiskRegister.$inferInsert>
  ) {
    await this.db
      .update(agentRiskRegister)
      .set({
        ...data,
        updatedAt: new Date(),
      } as any)
      .where(and(eq(agentRiskRegister.organizationId, organizationId), eq(agentRiskRegister.id, riskId)));

    return this.getRiskById(organizationId, riskId);
  }

  async deleteRisk(organizationId: string, riskId: string) {
    await this.db
      .delete(agentRiskRegister)
      .where(and(eq(agentRiskRegister.organizationId, organizationId), eq(agentRiskRegister.id, riskId)));
    return { success: true };
  }

  // -------------------------------------------------------------------------
  // 3. Risk Assessments
  // -------------------------------------------------------------------------

  async createAssessment(data: WithOptionalId<typeof agentRiskAssessments.$inferInsert>) {
    const id = data.id ?? randomUUID();
    const toInsert = {
      ...data,
      id,
    };
    await this.db.insert(agentRiskAssessments).values(toInsert as any);

    // Also update current risk register scores if riskId is provided
    if (data.riskId) {
      await this.db
        .update(agentRiskRegister)
        .set({
          likelihood: data.likelihood,
          impact: data.impact,
          inherentScore: data.inherentScore,
          inherentTier: data.inherentTier,
          residualScore: data.residualScore,
          residualTier: data.residualTier,
          existingControls: (data.controlsEvaluated as any) ?? [],
          updatedAt: new Date(),
        })
        .where(and(eq(agentRiskRegister.organizationId, data.organizationId), eq(agentRiskRegister.id, data.riskId)));
    }

    const rows = await this.db
      .select()
      .from(agentRiskAssessments)
      .where(and(eq(agentRiskAssessments.organizationId, data.organizationId), eq(agentRiskAssessments.id, id)))
      .limit(1);

    return rows[0];
  }

  async listAssessmentsByRiskId(organizationId: string, riskId: string) {
    return this.db
      .select()
      .from(agentRiskAssessments)
      .where(and(eq(agentRiskAssessments.organizationId, organizationId), eq(agentRiskAssessments.riskId, riskId)))
      .orderBy(desc(agentRiskAssessments.assessedAt));
  }

  async listAssessmentsByAgentId(organizationId: string, agentId: string) {
    return this.db
      .select()
      .from(agentRiskAssessments)
      .where(and(eq(agentRiskAssessments.organizationId, organizationId), eq(agentRiskAssessments.agentId, agentId)))
      .orderBy(desc(agentRiskAssessments.assessedAt));
  }

  // -------------------------------------------------------------------------
  // 4. Agent Trust Profiles
  // -------------------------------------------------------------------------

  async getTrustProfile(organizationId: string, agentId: string) {
    const rows = await this.db
      .select()
      .from(agentTrustProfiles)
      .where(and(eq(agentTrustProfiles.organizationId, organizationId), eq(agentTrustProfiles.agentId, agentId)))
      .limit(1);

    return rows.length > 0 ? rows[0] : null;
  }

  async listTrustProfiles(
    organizationId: string,
    filters?: { tier?: TrustTier; confidence?: TrustConfidence; limit?: number; offset?: number }
  ) {
    const conditions = [eq(agentTrustProfiles.organizationId, organizationId)];

    if (filters?.tier) {
      conditions.push(eq(agentTrustProfiles.trustTier, filters.tier));
    }
    if (filters?.confidence) {
      conditions.push(eq(agentTrustProfiles.trustConfidence, filters.confidence));
    }

    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;

    return this.db
      .select()
      .from(agentTrustProfiles)
      .where(and(...conditions))
      .orderBy(desc(agentTrustProfiles.trustScore))
      .limit(limit)
      .offset(offset);
  }

  async upsertTrustProfile(organizationId: string, agentId: string, data: Partial<typeof agentTrustProfiles.$inferInsert>) {
    const existing = await this.getTrustProfile(organizationId, agentId);

    if (existing) {
      await this.db
        .update(agentTrustProfiles)
        .set({
          ...data,
          updatedAt: new Date(),
        } as any)
        .where(and(eq(agentTrustProfiles.organizationId, organizationId), eq(agentTrustProfiles.agentId, agentId)));
    } else {
      const id = randomUUID();
      await this.db.insert(agentTrustProfiles).values({
        id,
        organizationId,
        agentId,
        trustScore: data.trustScore ?? 70,
        trustConfidence: data.trustConfidence ?? "LOW",
        trustTier: data.trustTier ?? "NEUTRAL",
        dimensionScores: (data.dimensionScores as any) ?? {},
        evidenceCount: data.evidenceCount ?? 0,
        isInsufficientEvidence: data.isInsufficientEvidence ?? true,
        contributingFactors: (data.contributingFactors as any) ?? [],
        modelVersion: data.modelVersion ?? "v1.0.0",
        lastEvaluatedAt: new Date(),
      });
    }

    return this.getTrustProfile(organizationId, agentId);
  }

  async recordTrustAssessmentHistory(data: WithOptionalId<typeof agentTrustAssessmentHistory.$inferInsert>) {
    const id = data.id ?? randomUUID();
    await this.db.insert(agentTrustAssessmentHistory).values({
      ...data,
      id,
    } as any);

    const rows = await this.db
      .select()
      .from(agentTrustAssessmentHistory)
      .where(and(eq(agentTrustAssessmentHistory.organizationId, data.organizationId), eq(agentTrustAssessmentHistory.id, id)))
      .limit(1);

    return rows[0];
  }

  async listTrustAssessmentHistory(organizationId: string, agentId: string, limit: number = 20) {
    return this.db
      .select()
      .from(agentTrustAssessmentHistory)
      .where(and(eq(agentTrustAssessmentHistory.organizationId, organizationId), eq(agentTrustAssessmentHistory.agentId, agentId)))
      .orderBy(desc(agentTrustAssessmentHistory.evaluatedAt))
      .limit(limit);
  }

  // -------------------------------------------------------------------------
  // 5. Behavioral Risk Alerts
  // -------------------------------------------------------------------------

  async listAlerts(
    organizationId: string,
    filters?: {
      agentId?: string;
      status?: BehavioralAlertStatus;
      severity?: RiskTier;
      rule?: BehavioralDetectionRule;
      limit?: number;
      offset?: number;
    }
  ) {
    const conditions = [eq(agentBehavioralRiskAlerts.organizationId, organizationId)];

    if (filters?.agentId) {
      conditions.push(eq(agentBehavioralRiskAlerts.agentId, filters.agentId));
    }
    if (filters?.status) {
      conditions.push(eq(agentBehavioralRiskAlerts.status, filters.status));
    }
    if (filters?.severity) {
      conditions.push(eq(agentBehavioralRiskAlerts.severity, filters.severity));
    }
    if (filters?.rule) {
      conditions.push(eq(agentBehavioralRiskAlerts.detectionRule, filters.rule));
    }

    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;

    return this.db
      .select()
      .from(agentBehavioralRiskAlerts)
      .where(and(...conditions))
      .orderBy(desc(agentBehavioralRiskAlerts.lastDetectedAt))
      .limit(limit)
      .offset(offset);
  }

  async getAlertById(organizationId: string, alertId: string) {
    const rows = await this.db
      .select()
      .from(agentBehavioralRiskAlerts)
      .where(and(eq(agentBehavioralRiskAlerts.organizationId, organizationId), eq(agentBehavioralRiskAlerts.id, alertId)))
      .limit(1);

    return rows.length > 0 ? rows[0] : null;
  }

  async findAlertByFingerprint(organizationId: string, fingerprint: string) {
    const rows = await this.db
      .select()
      .from(agentBehavioralRiskAlerts)
      .where(
        and(
          eq(agentBehavioralRiskAlerts.organizationId, organizationId),
          eq(agentBehavioralRiskAlerts.fingerprint, fingerprint)
        )
      )
      .limit(1);

    return rows.length > 0 ? rows[0] : null;
  }

  async createAlert(data: WithOptionalId<typeof agentBehavioralRiskAlerts.$inferInsert>) {
    const id = data.id ?? randomUUID();
    await this.db.insert(agentBehavioralRiskAlerts).values({
      ...data,
      id,
    } as any);

    return this.getAlertById(data.organizationId, id);
  }

  async updateAlert(
    organizationId: string,
    alertId: string,
    data: Partial<typeof agentBehavioralRiskAlerts.$inferInsert>
  ) {
    await this.db
      .update(agentBehavioralRiskAlerts)
      .set(data as any)
      .where(
        and(eq(agentBehavioralRiskAlerts.organizationId, organizationId), eq(agentBehavioralRiskAlerts.id, alertId))
      );

    return this.getAlertById(organizationId, alertId);
  }

  async resolveAlert(organizationId: string, alertId: string, resolvedBy: string, notes?: string) {
    await this.db
      .update(agentBehavioralRiskAlerts)
      .set({
        status: "RESOLVED",
        resolvedBy,
        resolvedAt: new Date(),
        resolutionNotes: notes,
      })
      .where(
        and(eq(agentBehavioralRiskAlerts.organizationId, organizationId), eq(agentBehavioralRiskAlerts.id, alertId))
      );

    return this.getAlertById(organizationId, alertId);
  }

  async acknowledgeAlert(organizationId: string, alertId: string, acknowledgedBy: string) {
    await this.db
      .update(agentBehavioralRiskAlerts)
      .set({
        status: "ACKNOWLEDGED",
        acknowledgedBy,
        acknowledgedAt: new Date(),
      })
      .where(
        and(eq(agentBehavioralRiskAlerts.organizationId, organizationId), eq(agentBehavioralRiskAlerts.id, alertId))
      );

    return this.getAlertById(organizationId, alertId);
  }

  // -------------------------------------------------------------------------
  // 6. Risk Mitigations
  // -------------------------------------------------------------------------

  async listMitigations(
    organizationId: string,
    filters?: { riskId?: string; status?: MitigationPlanStatus; ownerId?: string }
  ) {
    const conditions = [eq(agentRiskMitigations.organizationId, organizationId)];

    if (filters?.riskId) {
      conditions.push(eq(agentRiskMitigations.riskId, filters.riskId));
    }
    if (filters?.status) {
      conditions.push(eq(agentRiskMitigations.status, filters.status));
    }
    if (filters?.ownerId) {
      conditions.push(eq(agentRiskMitigations.ownerId, filters.ownerId));
    }

    return this.db
      .select()
      .from(agentRiskMitigations)
      .where(and(...conditions))
      .orderBy(desc(agentRiskMitigations.createdAt));
  }

  async getMitigationById(organizationId: string, mitigationId: string) {
    const rows = await this.db
      .select()
      .from(agentRiskMitigations)
      .where(and(eq(agentRiskMitigations.organizationId, organizationId), eq(agentRiskMitigations.id, mitigationId)))
      .limit(1);

    return rows.length > 0 ? rows[0] : null;
  }

  async createMitigation(data: WithOptionalId<typeof agentRiskMitigations.$inferInsert>) {
    const id = data.id ?? randomUUID();
    await this.db.insert(agentRiskMitigations).values({
      ...data,
      id,
    } as any);

    return this.getMitigationById(data.organizationId, id);
  }

  async updateMitigation(
    organizationId: string,
    mitigationId: string,
    data: Partial<typeof agentRiskMitigations.$inferInsert>
  ) {
    await this.db
      .update(agentRiskMitigations)
      .set({
        ...data,
        updatedAt: new Date(),
      } as any)
      .where(
        and(eq(agentRiskMitigations.organizationId, organizationId), eq(agentRiskMitigations.id, mitigationId))
      );

    return this.getMitigationById(organizationId, mitigationId);
  }

  async verifyMitigation(
    organizationId: string,
    mitigationId: string,
    verifiedBy: string,
    notes?: string
  ) {
    await this.db
      .update(agentRiskMitigations)
      .set({
        status: "VERIFIED",
        verifiedBy,
        verifiedAt: new Date(),
        verificationNotes: notes,
        updatedAt: new Date(),
      })
      .where(
        and(eq(agentRiskMitigations.organizationId, organizationId), eq(agentRiskMitigations.id, mitigationId))
      );

    return this.getMitigationById(organizationId, mitigationId);
  }

  // -------------------------------------------------------------------------
  // 7. Risk Exceptions
  // -------------------------------------------------------------------------

  async listExceptions(
    organizationId: string,
    filters?: { riskId?: string; status?: RiskExceptionStatus; scopeTarget?: string }
  ) {
    const conditions = [eq(agentRiskExceptions.organizationId, organizationId)];

    if (filters?.riskId) {
      conditions.push(eq(agentRiskExceptions.riskId, filters.riskId));
    }
    if (filters?.status) {
      conditions.push(eq(agentRiskExceptions.status, filters.status));
    }
    if (filters?.scopeTarget) {
      conditions.push(eq(agentRiskExceptions.scopeTarget, filters.scopeTarget));
    }

    return this.db
      .select()
      .from(agentRiskExceptions)
      .where(and(...conditions))
      .orderBy(desc(agentRiskExceptions.requestedAt));
  }

  async getExceptionById(organizationId: string, exceptionId: string) {
    const rows = await this.db
      .select()
      .from(agentRiskExceptions)
      .where(and(eq(agentRiskExceptions.organizationId, organizationId), eq(agentRiskExceptions.id, exceptionId)))
      .limit(1);

    return rows.length > 0 ? rows[0] : null;
  }

  async createException(data: WithOptionalId<typeof agentRiskExceptions.$inferInsert>) {
    const id = data.id ?? randomUUID();
    await this.db.insert(agentRiskExceptions).values({
      ...data,
      id,
    } as any);

    return this.getExceptionById(data.organizationId, id);
  }

  async approveException(
    organizationId: string,
    exceptionId: string,
    approvedBy: string,
    notes?: string
  ) {
    await this.db
      .update(agentRiskExceptions)
      .set({
        status: "APPROVED",
        approvedBy,
        approvedAt: new Date(),
        approvalNotes: notes,
      })
      .where(
        and(eq(agentRiskExceptions.organizationId, organizationId), eq(agentRiskExceptions.id, exceptionId))
      );

    return this.getExceptionById(organizationId, exceptionId);
  }

  async revokeException(
    organizationId: string,
    exceptionId: string,
    revokedBy: string,
    reason: string
  ) {
    await this.db
      .update(agentRiskExceptions)
      .set({
        status: "REVOKED",
        revokedBy,
        revokedAt: new Date(),
        revocationReason: reason,
      })
      .where(
        and(eq(agentRiskExceptions.organizationId, organizationId), eq(agentRiskExceptions.id, exceptionId))
      );

    return this.getExceptionById(organizationId, exceptionId);
  }

  // -------------------------------------------------------------------------
  // 8. Review History
  // -------------------------------------------------------------------------

  async createReviewHistory(data: WithOptionalId<typeof agentRiskReviewHistory.$inferInsert>) {
    const id = data.id ?? randomUUID();
    await this.db.insert(agentRiskReviewHistory).values({
      ...data,
      id,
    } as any);

    const rows = await this.db
      .select()
      .from(agentRiskReviewHistory)
      .where(
        and(eq(agentRiskReviewHistory.organizationId, data.organizationId), eq(agentRiskReviewHistory.id, id))
      )
      .limit(1);

    return rows[0];
  }

  async listReviewHistory(organizationId: string, riskId: string) {
    return this.db
      .select()
      .from(agentRiskReviewHistory)
      .where(
        and(eq(agentRiskReviewHistory.organizationId, organizationId), eq(agentRiskReviewHistory.riskId, riskId))
      )
      .orderBy(desc(agentRiskReviewHistory.reviewedAt));
  }

  // -------------------------------------------------------------------------
  // 9. Aggregations & Overview
  // -------------------------------------------------------------------------

  async getRiskOverview(organizationId: string) {
    const risks = await this.db
      .select({
        id: agentRiskRegister.id,
        residualTier: agentRiskRegister.residualTier,
        residualScore: agentRiskRegister.residualScore,
        category: agentRiskRegister.riskCategory,
        status: agentRiskRegister.mitigationStatus,
      })
      .from(agentRiskRegister)
      .where(eq(agentRiskRegister.organizationId, organizationId));

    let lowCount = 0;
    let mediumCount = 0;
    let highCount = 0;
    let criticalCount = 0;

    for (const r of risks) {
      if (r.residualTier === "LOW") lowCount++;
      else if (r.residualTier === "MEDIUM") mediumCount++;
      else if (r.residualTier === "HIGH") highCount++;
      else if (r.residualTier === "CRITICAL") criticalCount++;
    }

    const trustProfiles = await this.db
      .select({
        trustScore: agentTrustProfiles.trustScore,
        trustTier: agentTrustProfiles.trustTier,
      })
      .from(agentTrustProfiles)
      .where(eq(agentTrustProfiles.organizationId, organizationId));

    const totalTrust = trustProfiles.reduce((acc, p) => acc + p.trustScore, 0);
    const averageTrustScore = trustProfiles.length > 0 ? Math.round(totalTrust / trustProfiles.length) : 70;

    const alerts = await this.db
      .select({
        id: agentBehavioralRiskAlerts.id,
        severity: agentBehavioralRiskAlerts.severity,
      })
      .from(agentBehavioralRiskAlerts)
      .where(
        and(
          eq(agentBehavioralRiskAlerts.organizationId, organizationId),
          eq(agentBehavioralRiskAlerts.status, "ACTIVE")
        )
      );

    const activeAlertCount = alerts.length;
    const criticalAlertCount = alerts.filter((a) => a.severity === "CRITICAL").length;

    const mitigations = await this.db
      .select({ id: agentRiskMitigations.id })
      .from(agentRiskMitigations)
      .where(
        and(
          eq(agentRiskMitigations.organizationId, organizationId),
          sql`${agentRiskMitigations.status} IN ('OPEN', 'IN_PROGRESS', 'PENDING_VERIFICATION')`
        )
      );

    const now = new Date();
    const exceptions = await this.db
      .select({ id: agentRiskExceptions.id })
      .from(agentRiskExceptions)
      .where(
        and(
          eq(agentRiskExceptions.organizationId, organizationId),
          eq(agentRiskExceptions.status, "APPROVED"),
          gte(agentRiskExceptions.expirationDate, now)
        )
      );

    const config = await this.getConfiguration(organizationId);

    return {
      totalRisks: risks.length,
      lowCount,
      mediumCount,
      highCount,
      criticalCount,
      averageTrustScore,
      totalAgentsEvaluated: trustProfiles.length,
      activeAlertCount,
      criticalAlertCount,
      pendingMitigationsCount: mitigations.length,
      activeExceptionsCount: exceptions.length,
      riskEnforcementEnabled: Boolean(config.riskEnforcementEnabled),
      riskEnforcementMode: config.riskEnforcementMode,
    };
  }

  async getRiskMatrix(organizationId: string) {
    const risks = await this.db
      .select({
        id: agentRiskRegister.id,
        likelihood: agentRiskRegister.likelihood,
        impact: agentRiskRegister.impact,
        residualTier: agentRiskRegister.residualTier,
        title: agentRiskRegister.title,
      })
      .from(agentRiskRegister)
      .where(eq(agentRiskRegister.organizationId, organizationId));

    const matrix: Array<{
      likelihood: number;
      impact: number;
      inherentScore: number;
      count: number;
      risks: Array<{ id: string; title: string; tier: string }>;
    }> = [];

    for (let l = 1; l <= 5; l++) {
      for (let i = 1; i <= 5; i++) {
        const matching = risks.filter((r) => r.likelihood === l && r.impact === i);
        matrix.push({
          likelihood: l,
          impact: i,
          inherentScore: l * i,
          count: matching.length,
          risks: matching.map((m) => ({ id: m.id, title: m.title, tier: m.residualTier })),
        });
      }
    }

    return matrix;
  }
}
