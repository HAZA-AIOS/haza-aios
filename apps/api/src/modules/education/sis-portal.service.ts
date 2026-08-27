import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { ApiError } from '../../common/errors/api-error.js';
import type { DatabaseClient } from '../../database/client.js';
import { portalPolicies, portalUpdateRequests } from '../../database/schema.js';

type JsonRecord = Record<string, unknown>;
type Tenant = { organizationId: string; workspaceId: string };
function payloadOf(value: unknown): JsonRecord { if (typeof value === 'string') { try { return JSON.parse(value) as JsonRecord; } catch { return {}; } } return value && typeof value === 'object' ? value as JsonRecord : {}; }
function uuid() { return randomUUID(); }
function now() { return new Date().toISOString(); }
function dto<T extends JsonRecord>(tenant: Tenant, row: { payload: JsonRecord }): T { return { ...payloadOf(row.payload), organizationId: tenant.organizationId } as unknown as T; }

export class SisPortalService {
  constructor(private readonly database: DatabaseClient) {}
  async getPolicy(tenant: Tenant) {
    const row = (await this.database.db.select().from(portalPolicies).where(eq(portalPolicies.workspaceId, tenant.workspaceId)).limit(1))[0];
    return row ? dto(tenant, row) : { organizationId: tenant.organizationId, studentFinanceVisible: false, studentMessagingEnabled: false, parentMessagingEnabled: true };
  }
  async savePolicy(tenant: Tenant, data: JsonRecord) {
    const existing = (await this.database.db.select().from(portalPolicies).where(eq(portalPolicies.workspaceId, tenant.workspaceId)).limit(1))[0];
    const record = { ...(existing ? payloadOf(existing.payload) : await this.getPolicy(tenant)), ...data, organizationId: tenant.organizationId, updatedAt: now(), createdAt: existing ? (existing.payload as JsonRecord).createdAt : now() };
    if (existing) await this.database.db.update(portalPolicies).set({ payload: record, updatedAt: new Date() }).where(eq(portalPolicies.id, existing.id));
    else await this.database.db.insert(portalPolicies).values({ id: uuid(), workspaceId: tenant.workspaceId, payload: record });
    return record;
  }
  async submitRequest(tenant: Tenant, actor: JsonRecord, input: JsonRecord) {
    if (!String(input.subject ?? '').trim() || !String(input.details ?? '').trim()) throw new ApiError(400, 'VALIDATION_FAILED', 'Update request subject and details are required.');
    const record = { id: uuid(), organizationId: tenant.organizationId, requesterUserId: String(actor.userId ?? ''), requesterRole: String(actor.role ?? ''), studentId: input.studentId as string | undefined, type: String(input.type), subject: String(input.subject).trim(), details: String(input.details).trim(), status: 'submitted', createdAt: now(), updatedAt: now() };
    await this.database.db.insert(portalUpdateRequests).values({ id: record.id, workspaceId: tenant.workspaceId, requesterUserId: record.requesterUserId, requesterRole: record.requesterRole, studentId: record.studentId, requestType: record.type, status: record.status, payload: record });
    return record;
  }
  async listRequests(tenant: Tenant, actor: JsonRecord) {
    const rows = await this.database.db.select().from(portalUpdateRequests).where(and(eq(portalUpdateRequests.workspaceId, tenant.workspaceId), eq(portalUpdateRequests.requesterUserId, String(actor.userId ?? '')), eq(portalUpdateRequests.requesterRole, String(actor.role ?? ''))));
    return rows.map((r) => dto(tenant, r));
  }
}
