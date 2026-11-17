import { and, desc, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  agentSecurityProfiles,
  agentSecretReferences,
  agentSecurityEvents,
  agentContinuationRecords,
} from "../../../database/schema.js";
import type {
  AgentSecurityProfileEntity,
  AgentSecretReferenceEntity,
  AgentSecurityEventEntity,
  AgentContinuationRecordEntity,
  ResourceClassification,
  NetworkAccessMode,
  StorageAccessMode,
  DatabaseOperation,
  AutonomyLevel,
  SecretReferenceStatus,
  ContinuationStatus,
  ReconciliationStatus,
  SecurityEventType,
  SecuritySeverity,
} from "../governance-security.types.js";

export class AgentSecurityRepository {
  constructor(private readonly context: { db: any }) {}

  // ---------------------------------------------------------------------------
  // 1. SECURITY PROFILES
  // ---------------------------------------------------------------------------

  async getProfile(
    organizationId: string,
    agentId: string,
  ): Promise<AgentSecurityProfileEntity | null> {
    const [row] = await this.context.db
      .select()
      .from(agentSecurityProfiles)
      .where(
        and(
          eq(agentSecurityProfiles.organizationId, organizationId),
          eq(agentSecurityProfiles.agentId, agentId),
        ),
      )
      .limit(1);

    if (!row) return null;
    return this.mapProfile(row);
  }

  async upsertProfile(input: {
    organizationId: string;
    workspaceId?: string | null;
    agentId: string;
    resourceClassification?: ResourceClassification;
    networkAccessMode?: NetworkAccessMode;
    allowedNetworkDomains?: string[];
    disallowedNetworkDomains?: string[];
    storageAccessMode?: StorageAccessMode;
    allowedStoragePaths?: string[];
    disallowedStoragePaths?: string[];
    databaseOperations?: DatabaseOperation[];
    maxExecutionDurationMs?: number;
    maxToolInvocations?: number;
    maxMemoryBytes?: number;
    maxAutonomyLevel?: AutonomyLevel;
    allowAutonomousExecution?: boolean;
    delegationAttenuation?: boolean;
    allowedToolKeys?: string[];
    disallowedToolKeys?: string[];
    allowedSecretReferenceIds?: string[];
    isSuspended?: boolean;
    suspendedAt?: Date | null;
    suspendedBy?: string | null;
    suspensionReason?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<AgentSecurityProfileEntity> {
    const existing = await this.getProfile(input.organizationId, input.agentId);
    const id = existing?.id || randomUUID();
    const now = new Date();

    if (existing) {
      await this.context.db
        .update(agentSecurityProfiles)
        .set({
          workspaceId: input.workspaceId !== undefined ? input.workspaceId : existing.workspaceId,
          resourceClassification: input.resourceClassification ?? existing.resourceClassification,
          networkAccessMode: input.networkAccessMode ?? existing.networkAccessMode,
          allowedNetworkDomains: input.allowedNetworkDomains ?? existing.allowedNetworkDomains,
          disallowedNetworkDomains: input.disallowedNetworkDomains ?? existing.disallowedNetworkDomains,
          storageAccessMode: input.storageAccessMode ?? existing.storageAccessMode,
          allowedStoragePaths: input.allowedStoragePaths ?? existing.allowedStoragePaths,
          disallowedStoragePaths: input.disallowedStoragePaths ?? existing.disallowedStoragePaths,
          databaseOperations: input.databaseOperations ?? existing.databaseOperations,
          maxExecutionDurationMs: input.maxExecutionDurationMs ?? existing.maxExecutionDurationMs,
          maxToolInvocations: input.maxToolInvocations ?? existing.maxToolInvocations,
          maxMemoryBytes: input.maxMemoryBytes ?? existing.maxMemoryBytes,
          maxAutonomyLevel: input.maxAutonomyLevel ?? existing.maxAutonomyLevel,
          allowAutonomousExecution: input.allowAutonomousExecution ?? existing.allowAutonomousExecution,
          delegationAttenuation: input.delegationAttenuation ?? existing.delegationAttenuation,
          allowedToolKeys: input.allowedToolKeys ?? existing.allowedToolKeys,
          disallowedToolKeys: input.disallowedToolKeys ?? existing.disallowedToolKeys,
          allowedSecretReferenceIds: input.allowedSecretReferenceIds ?? existing.allowedSecretReferenceIds,
          isSuspended: input.isSuspended !== undefined ? input.isSuspended : existing.isSuspended,
          suspendedAt: input.suspendedAt !== undefined ? input.suspendedAt : (existing.suspendedAt ? new Date(existing.suspendedAt) : null),
          suspendedBy: input.suspendedBy !== undefined ? input.suspendedBy : existing.suspendedBy,
          suspensionReason: input.suspensionReason !== undefined ? input.suspensionReason : existing.suspensionReason,
          metadata: input.metadata ?? existing.metadata,
          updatedAt: now,
        })
        .where(eq(agentSecurityProfiles.id, id));
    } else {
      await this.context.db.insert(agentSecurityProfiles).values({
        id,
        organizationId: input.organizationId,
        workspaceId: input.workspaceId ?? null,
        agentId: input.agentId,
        resourceClassification: input.resourceClassification ?? "internal",
        networkAccessMode: input.networkAccessMode ?? "blocked",
        allowedNetworkDomains: input.allowedNetworkDomains ?? [],
        disallowedNetworkDomains: input.disallowedNetworkDomains ?? [],
        storageAccessMode: input.storageAccessMode ?? "blocked",
        allowedStoragePaths: input.allowedStoragePaths ?? [],
        disallowedStoragePaths: input.disallowedStoragePaths ?? [],
        databaseOperations: input.databaseOperations ?? ["read"],
        maxExecutionDurationMs: input.maxExecutionDurationMs ?? 30000,
        maxToolInvocations: input.maxToolInvocations ?? 10,
        maxMemoryBytes: input.maxMemoryBytes ?? 536870912,
        maxAutonomyLevel: input.maxAutonomyLevel ?? "L1",
        allowAutonomousExecution: input.allowAutonomousExecution ?? false,
        delegationAttenuation: input.delegationAttenuation ?? true,
        allowedToolKeys: input.allowedToolKeys ?? [],
        disallowedToolKeys: input.disallowedToolKeys ?? [],
        allowedSecretReferenceIds: input.allowedSecretReferenceIds ?? [],
        isSuspended: input.isSuspended ?? false,
        suspendedAt: input.suspendedAt ?? null,
        suspendedBy: input.suspendedBy ?? null,
        suspensionReason: input.suspensionReason ?? null,
        metadata: input.metadata ?? {},
        createdAt: now,
        updatedAt: now,
      });
    }

    const updated = await this.getProfile(input.organizationId, input.agentId);
    return updated!;
  }

  async suspendAgent(
    organizationId: string,
    agentId: string,
    suspendedBy: string,
    reason: string,
  ): Promise<AgentSecurityProfileEntity> {
    const profile = await this.getProfile(organizationId, agentId);
    if (!profile) {
      return this.upsertProfile({
        organizationId,
        agentId,
        isSuspended: true,
        suspendedAt: new Date(),
        suspendedBy,
        suspensionReason: reason,
      });
    }

    await this.context.db
      .update(agentSecurityProfiles)
      .set({
        isSuspended: true,
        suspendedAt: new Date(),
        suspendedBy,
        suspensionReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(agentSecurityProfiles.id, profile.id));

    return (await this.getProfile(organizationId, agentId))!;
  }

  async reactivateAgent(
    organizationId: string,
    agentId: string,
  ): Promise<AgentSecurityProfileEntity> {
    const profile = await this.getProfile(organizationId, agentId);
    if (!profile) {
      return this.upsertProfile({
        organizationId,
        agentId,
        isSuspended: false,
        suspendedAt: null,
        suspendedBy: null,
        suspensionReason: null,
      });
    }

    await this.context.db
      .update(agentSecurityProfiles)
      .set({
        isSuspended: false,
        suspendedAt: null,
        suspendedBy: null,
        suspensionReason: null,
        updatedAt: new Date(),
      })
      .where(eq(agentSecurityProfiles.id, profile.id));

    return (await this.getProfile(organizationId, agentId))!;
  }

  async listProfiles(
    organizationId: string,
    filters?: { isSuspended?: boolean },
  ): Promise<AgentSecurityProfileEntity[]> {
    const conditions = [eq(agentSecurityProfiles.organizationId, organizationId)];
    if (filters?.isSuspended !== undefined) {
      conditions.push(eq(agentSecurityProfiles.isSuspended, filters.isSuspended));
    }

    const rows = await this.context.db
      .select()
      .from(agentSecurityProfiles)
      .where(and(...conditions))
      .orderBy(desc(agentSecurityProfiles.updatedAt));

    return rows.map((r: any) => this.mapProfile(r));
  }

  // ---------------------------------------------------------------------------
  // 2. SECRET REFERENCES
  // ---------------------------------------------------------------------------

  async createSecretReference(input: {
    organizationId: string;
    workspaceId?: string | null;
    secretIdentifier: string;
    name: string;
    description?: string | null;
    allowedAgentIds?: string[];
    allowedToolKeys?: string[];
    createdBy?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<AgentSecretReferenceEntity> {
    const id = randomUUID();
    const now = new Date();

    await this.context.db.insert(agentSecretReferences).values({
      id,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId ?? null,
      secretIdentifier: input.secretIdentifier,
      name: input.name,
      description: input.description ?? null,
      allowedAgentIds: input.allowedAgentIds ?? [],
      allowedToolKeys: input.allowedToolKeys ?? [],
      status: "active",
      version: 1,
      lastRotatedAt: now,
      createdBy: input.createdBy ?? null,
      metadata: input.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    });

    const [row] = await this.context.db
      .select()
      .from(agentSecretReferences)
      .where(eq(agentSecretReferences.id, id))
      .limit(1);

    return this.mapSecretRef(row);
  }

  async getSecretReference(
    organizationId: string,
    idOrIdentifier: string,
  ): Promise<AgentSecretReferenceEntity | null> {
    const [row] = await this.context.db
      .select()
      .from(agentSecretReferences)
      .where(
        and(
          eq(agentSecretReferences.organizationId, organizationId),
          sql`(${agentSecretReferences.id} = ${idOrIdentifier} OR ${agentSecretReferences.secretIdentifier} = ${idOrIdentifier})`,
        ),
      )
      .limit(1);

    if (!row) return null;
    return this.mapSecretRef(row);
  }

  async listSecretReferences(
    organizationId: string,
    filters?: { status?: SecretReferenceStatus; agentId?: string },
  ): Promise<AgentSecretReferenceEntity[]> {
    const conditions = [eq(agentSecretReferences.organizationId, organizationId)];
    if (filters?.status) {
      conditions.push(eq(agentSecretReferences.status, filters.status));
    }

    const rows = await this.context.db
      .select()
      .from(agentSecretReferences)
      .where(and(...conditions))
      .orderBy(desc(agentSecretReferences.createdAt));

    let results = rows.map((r: any) => this.mapSecretRef(r));
    if (filters?.agentId) {
      results = results.filter((r: AgentSecretReferenceEntity) => r.allowedAgentIds.includes(filters.agentId!));
    }

    return results;
  }

  async revokeSecretReference(
    organizationId: string,
    id: string,
  ): Promise<AgentSecretReferenceEntity | null> {
    const existing = await this.getSecretReference(organizationId, id);
    if (!existing) return null;

    await this.context.db
      .update(agentSecretReferences)
      .set({
        status: "revoked",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(agentSecretReferences.organizationId, organizationId),
          eq(agentSecretReferences.id, existing.id),
        ),
      );

    return this.getSecretReference(organizationId, existing.id);
  }

  async rotateSecretReference(
    organizationId: string,
    id: string,
  ): Promise<AgentSecretReferenceEntity | null> {
    const existing = await this.getSecretReference(organizationId, id);
    if (!existing) return null;

    const newVersion = existing.version + 1;
    await this.context.db
      .update(agentSecretReferences)
      .set({
        version: newVersion,
        status: "active",
        lastRotatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(agentSecretReferences.organizationId, organizationId),
          eq(agentSecretReferences.id, existing.id),
        ),
      );

    return this.getSecretReference(organizationId, existing.id);
  }

  // ---------------------------------------------------------------------------
  // 3. SECURITY EVENTS
  // ---------------------------------------------------------------------------

  async createEvent(input: {
    organizationId: string;
    workspaceId?: string | null;
    agentId?: string | null;
    actorId?: string | null;
    eventType: SecurityEventType;
    severity?: SecuritySeverity;
    targetType: string;
    targetId: string;
    details?: Record<string, unknown>;
  }): Promise<AgentSecurityEventEntity> {
    const id = randomUUID();
    const now = new Date();

    await this.context.db.insert(agentSecurityEvents).values({
      id,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId ?? null,
      agentId: input.agentId ?? null,
      actorId: input.actorId ?? null,
      eventType: input.eventType,
      severity: input.severity ?? "medium",
      targetType: input.targetType,
      targetId: input.targetId,
      details: input.details ?? {},
      createdAt: now,
    });

    const [row] = await this.context.db
      .select()
      .from(agentSecurityEvents)
      .where(eq(agentSecurityEvents.id, id))
      .limit(1);

    return this.mapEvent(row);
  }

  async listEvents(
    organizationId: string,
    filters?: {
      agentId?: string;
      eventType?: SecurityEventType;
      severity?: SecuritySeverity;
      limit?: number;
    },
  ): Promise<AgentSecurityEventEntity[]> {
    const conditions = [eq(agentSecurityEvents.organizationId, organizationId)];
    if (filters?.agentId) conditions.push(eq(agentSecurityEvents.agentId, filters.agentId));
    if (filters?.eventType) conditions.push(eq(agentSecurityEvents.eventType, filters.eventType));
    if (filters?.severity) conditions.push(eq(agentSecurityEvents.severity, filters.severity));

    const rows = await this.context.db
      .select()
      .from(agentSecurityEvents)
      .where(and(...conditions))
      .orderBy(desc(agentSecurityEvents.createdAt))
      .limit(filters?.limit ?? 50);

    return rows.map((r: any) => this.mapEvent(r));
  }

  // ---------------------------------------------------------------------------
  // 4. CONTINUATION DURABLE RECORDS
  // ---------------------------------------------------------------------------

  async createContinuationRecord(input: {
    approvalRequestId: string;
    organizationId: string;
    canonicalPayloadFingerprint: string;
    executionId?: string | null;
    actorId: string;
    metadata?: Record<string, unknown>;
  }): Promise<AgentContinuationRecordEntity> {
    const id = randomUUID();
    const now = new Date();

    await this.context.db.insert(agentContinuationRecords).values({
      id,
      approvalRequestId: input.approvalRequestId,
      organizationId: input.organizationId,
      status: "claimed",
      reconciliationStatus: "pending_execution",
      canonicalPayloadFingerprint: input.canonicalPayloadFingerprint,
      executionId: input.executionId ?? null,
      actorId: input.actorId,
      attempts: 1,
      errorDetails: null,
      startedAt: now,
      completedAt: null,
      metadata: input.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    });

    const [row] = await this.context.db
      .select()
      .from(agentContinuationRecords)
      .where(eq(agentContinuationRecords.id, id))
      .limit(1);

    return this.mapContinuationRecord(row);
  }

  async updateContinuationRecord(
    id: string,
    updates: {
      status?: ContinuationStatus;
      reconciliationStatus?: ReconciliationStatus;
      errorDetails?: string | null;
      completedAt?: Date | null;
      executionId?: string | null;
      attemptsIncrement?: boolean;
    },
  ): Promise<AgentContinuationRecordEntity | null> {
    const setPayload: Record<string, any> = { updatedAt: new Date() };
    if (updates.status !== undefined) setPayload.status = updates.status;
    if (updates.reconciliationStatus !== undefined) setPayload.reconciliationStatus = updates.reconciliationStatus;
    if (updates.errorDetails !== undefined) setPayload.errorDetails = updates.errorDetails;
    if (updates.completedAt !== undefined) setPayload.completedAt = updates.completedAt;
    if (updates.executionId !== undefined) setPayload.executionId = updates.executionId;
    if (updates.attemptsIncrement) {
      setPayload.attempts = sql`${agentContinuationRecords.attempts} + 1`;
    }

    await this.context.db
      .update(agentContinuationRecords)
      .set(setPayload)
      .where(eq(agentContinuationRecords.id, id));

    const [row] = await this.context.db
      .select()
      .from(agentContinuationRecords)
      .where(eq(agentContinuationRecords.id, id))
      .limit(1);

    if (!row) return null;
    return this.mapContinuationRecord(row);
  }

  async getContinuationRecordByApprovalId(
    organizationId: string,
    approvalRequestId: string,
  ): Promise<AgentContinuationRecordEntity | null> {
    const [row] = await this.context.db
      .select()
      .from(agentContinuationRecords)
      .where(
        and(
          eq(agentContinuationRecords.organizationId, organizationId),
          eq(agentContinuationRecords.approvalRequestId, approvalRequestId),
        ),
      )
      .limit(1);

    if (!row) return null;
    return this.mapContinuationRecord(row);
  }

  // ---------------------------------------------------------------------------
  // MAPPERS
  // ---------------------------------------------------------------------------

  private mapProfile(row: any): AgentSecurityProfileEntity {
    return {
      id: row.id,
      organizationId: row.organizationId,
      workspaceId: row.workspaceId,
      agentId: row.agentId,
      resourceClassification: row.resourceClassification,
      networkAccessMode: row.networkAccessMode,
      allowedNetworkDomains: Array.isArray(row.allowedNetworkDomains) ? row.allowedNetworkDomains : [],
      disallowedNetworkDomains: Array.isArray(row.disallowedNetworkDomains) ? row.disallowedNetworkDomains : [],
      storageAccessMode: row.storageAccessMode,
      allowedStoragePaths: Array.isArray(row.allowedStoragePaths) ? row.allowedStoragePaths : [],
      disallowedStoragePaths: Array.isArray(row.disallowedStoragePaths) ? row.disallowedStoragePaths : [],
      databaseOperations: Array.isArray(row.databaseOperations) ? row.databaseOperations : ["read"],
      maxExecutionDurationMs: Number(row.maxExecutionDurationMs),
      maxToolInvocations: Number(row.maxToolInvocations),
      maxMemoryBytes: Number(row.maxMemoryBytes),
      maxAutonomyLevel: row.maxAutonomyLevel,
      allowAutonomousExecution: Boolean(row.allowAutonomousExecution),
      delegationAttenuation: Boolean(row.delegationAttenuation),
      allowedToolKeys: Array.isArray(row.allowedToolKeys) ? row.allowedToolKeys : [],
      disallowedToolKeys: Array.isArray(row.disallowedToolKeys) ? row.disallowedToolKeys : [],
      allowedSecretReferenceIds: Array.isArray(row.allowedSecretReferenceIds) ? row.allowedSecretReferenceIds : [],
      isSuspended: Boolean(row.isSuspended),
      suspendedAt: row.suspendedAt ? new Date(row.suspendedAt).toISOString() : null,
      suspendedBy: row.suspendedBy,
      suspensionReason: row.suspensionReason,
      metadata: (row.metadata as Record<string, unknown>) || {},
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    };
  }

  private mapSecretRef(row: any): AgentSecretReferenceEntity {
    return {
      id: row.id,
      organizationId: row.organizationId,
      workspaceId: row.workspaceId,
      secretIdentifier: row.secretIdentifier,
      name: row.name,
      description: row.description,
      allowedAgentIds: Array.isArray(row.allowedAgentIds) ? row.allowedAgentIds : [],
      allowedToolKeys: Array.isArray(row.allowedToolKeys) ? row.allowedToolKeys : [],
      status: row.status,
      version: Number(row.version),
      lastRotatedAt: row.lastRotatedAt ? new Date(row.lastRotatedAt).toISOString() : null,
      createdBy: row.createdBy,
      metadata: (row.metadata as Record<string, unknown>) || {},
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    };
  }

  private mapEvent(row: any): AgentSecurityEventEntity {
    return {
      id: row.id,
      organizationId: row.organizationId,
      workspaceId: row.workspaceId,
      agentId: row.agentId,
      actorId: row.actorId,
      eventType: row.eventType,
      severity: row.severity,
      targetType: row.targetType,
      targetId: row.targetId,
      details: (row.details as Record<string, unknown>) || {},
      createdAt: new Date(row.createdAt).toISOString(),
    };
  }

  private mapContinuationRecord(row: any): AgentContinuationRecordEntity {
    return {
      id: row.id,
      approvalRequestId: row.approvalRequestId,
      organizationId: row.organizationId,
      status: row.status,
      reconciliationStatus: row.reconciliationStatus,
      canonicalPayloadFingerprint: row.canonicalPayloadFingerprint,
      executionId: row.executionId,
      actorId: row.actorId,
      attempts: Number(row.attempts),
      errorDetails: row.errorDetails,
      startedAt: new Date(row.startedAt).toISOString(),
      completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
      metadata: (row.metadata as Record<string, unknown>) || {},
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    };
  }
}

