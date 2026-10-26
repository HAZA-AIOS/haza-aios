import { sql } from "drizzle-orm";
import type { DatabaseClient } from "../client.js";

export interface BackfillIdentifiersResult {
  totalScanned: number;
  enquiriesBackfilled: number;
  applicationsBackfilled: number;
  enquiriesSkippedDuplicate: number;
  applicationsSkippedDuplicate: number;
  enquiriesSkippedMissing: number;
  applicationsSkippedMissing: number;
  alreadyPopulated: number;
  conflicts: Array<{ id: string; workspaceId: string; type: string; identifier: string; reason: string }>;
}

/**
 * Repeatable, idempotent data backfill procedure for portal update requests.
 * Safely extracts reference_number and application_number from JSON payload and
 * populates the dedicated columns while detecting duplicates and protecting
 * against unique constraint collisions.
 */
export async function backfillPortalRequestIdentifiers(
  database: DatabaseClient,
  options?: { workspaceId?: string }
): Promise<BackfillIdentifiersResult> {
  const client = database.db;
  const whereClause = options?.workspaceId
    ? sql`WHERE workspace_id = ${options.workspaceId}`
    : sql``;

  // 1. Scan rows
  const [rows] = (await client.execute(
    sql`SELECT id, workspace_id as workspaceId, request_type as requestType, reference_number as referenceNumber, application_number as applicationNumber, payload FROM portal_update_requests ${whereClause}`
  )) as unknown as [Array<{
    id: string;
    workspaceId: string;
    requestType: string;
    referenceNumber: string | null;
    applicationNumber: string | null;
    payload: unknown;
  }>];

  const result: BackfillIdentifiersResult = {
    totalScanned: rows.length,
    enquiriesBackfilled: 0,
    applicationsBackfilled: 0,
    enquiriesSkippedDuplicate: 0,
    applicationsSkippedDuplicate: 0,
    enquiriesSkippedMissing: 0,
    applicationsSkippedMissing: 0,
    alreadyPopulated: 0,
    conflicts: [],
  };

  // Group by workspace and identifier to detect conflicts before writing
  const enquiryCounts = new Map<string, number>();
  const appCounts = new Map<string, number>();

  for (const row of rows) {
    const payload = typeof row.payload === "string" ? JSON.parse(row.payload) : (row.payload || {});
    if (row.requestType === "admission_enquiry") {
      const ref = row.referenceNumber || payload.referenceNumber;
      if (ref && String(ref).trim() !== "" && String(ref).trim().toLowerCase() !== "null") {
        const key = `${row.workspaceId}::${String(ref).trim()}`;
        enquiryCounts.set(key, (enquiryCounts.get(key) || 0) + 1);
      }
    } else if (row.requestType === "admission_application") {
      const appNum = row.applicationNumber || payload.applicationNumber;
      if (appNum && String(appNum).trim() !== "" && String(appNum).trim().toLowerCase() !== "null") {
        const key = `${row.workspaceId}::${String(appNum).trim()}`;
        appCounts.set(key, (appCounts.get(key) || 0) + 1);
      }
    }
  }

  // Execute backfills row by row safely
  for (const row of rows) {
    const payload = typeof row.payload === "string" ? JSON.parse(row.payload) : (row.payload || {});

    if (row.requestType === "admission_enquiry") {
      if (row.referenceNumber) {
        result.alreadyPopulated++;
        continue;
      }
      const ref = payload.referenceNumber ? String(payload.referenceNumber).trim() : "";
      if (!ref || ref.toLowerCase() === "null") {
        result.enquiriesSkippedMissing++;
        continue;
      }
      const key = `${row.workspaceId}::${ref}`;
      if ((enquiryCounts.get(key) || 0) > 1) {
        result.enquiriesSkippedDuplicate++;
        result.conflicts.push({
          id: row.id,
          workspaceId: row.workspaceId,
          type: "admission_enquiry",
          identifier: ref,
          reason: "Duplicate reference number in same workspace",
        });
        continue;
      }

      await client.execute(
        sql`UPDATE portal_update_requests SET reference_number = ${ref} WHERE id = ${row.id} AND reference_number IS NULL`
      );
      result.enquiriesBackfilled++;
    } else if (row.requestType === "admission_application") {
      if (row.applicationNumber) {
        result.alreadyPopulated++;
        continue;
      }
      const appNum = payload.applicationNumber ? String(payload.applicationNumber).trim() : "";
      if (!appNum || appNum.toLowerCase() === "null") {
        result.applicationsSkippedMissing++;
        continue;
      }
      const key = `${row.workspaceId}::${appNum}`;
      if ((appCounts.get(key) || 0) > 1) {
        result.applicationsSkippedDuplicate++;
        result.conflicts.push({
          id: row.id,
          workspaceId: row.workspaceId,
          type: "admission_application",
          identifier: appNum,
          reason: "Duplicate application number in same workspace",
        });
        continue;
      }

      await client.execute(
        sql`UPDATE portal_update_requests SET application_number = ${appNum} WHERE id = ${row.id} AND application_number IS NULL`
      );
      result.applicationsBackfilled++;
    }
  }

  return result;
}
