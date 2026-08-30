import type { AttendanceRecord, AttendanceSession, AttendanceStatus, AttendanceSummary } from "./sis.types";
import { jsonBody, sisRequest } from "./sis-api";

type AttendanceSessionFilters = {
  academicYearId?: string;
  date?: string;
  gradeId?: string;
  sectionId?: string;
};

function query(filters: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

export const AttendanceService = {
  async getSessions(organizationId: string, filters: AttendanceSessionFilters = {}): Promise<AttendanceSession[]> {
    const response = await sisRequest<{ sessions: AttendanceSession[] }>(organizationId, `/attendance/sessions${query(filters)}`);
    return response.sessions;
  },

  async getSessionById(organizationId: string, id: string): Promise<AttendanceSession | undefined> {
    const response = await sisRequest<{ session: AttendanceSession | null }>(organizationId, `/attendance/sessions/${id}`);
    return response.session ?? undefined;
  },

  async createSession(
    organizationId: string,
    data: Omit<AttendanceSession, "id" | "organizationId" | "createdAt" | "updatedAt">,
  ): Promise<AttendanceSession> {
    const response = await sisRequest<{ session: AttendanceSession }>(organizationId, "/attendance/sessions", {
      method: "POST",
      ...jsonBody(data),
    });
    return response.session;
  },

  async updateSession(
    organizationId: string,
    id: string,
    updates: Partial<AttendanceSession>,
  ): Promise<AttendanceSession> {
    const response = await sisRequest<{ session: AttendanceSession }>(organizationId, `/attendance/sessions/${id}`, {
      method: "PATCH",
      ...jsonBody(updates),
    });
    return response.session;
  },

  async getSessionRecords(organizationId: string, sessionId: string): Promise<AttendanceRecord[]> {
    const response = await sisRequest<{ records: AttendanceRecord[] }>(organizationId, `/attendance/sessions/${sessionId}/records`);
    return response.records;
  },

  async saveAttendanceRecords(
    organizationId: string,
    sessionId: string,
    records: Array<{ studentId: string; status: AttendanceStatus; note?: string }>,
    markedBy: string,
  ): Promise<AttendanceRecord[]> {
    const response = await sisRequest<{ records: AttendanceRecord[] }>(organizationId, `/attendance/sessions/${sessionId}/records`, {
      method: "POST",
      ...jsonBody({ records, markedBy }),
    });
    return response.records;
  },

  async getStudentAttendanceHistory(
    organizationId: string,
    studentId: string,
    academicYearId?: string,
  ): Promise<{ session: AttendanceSession; record: AttendanceRecord }[]> {
    const response = await sisRequest<{ history: { session: AttendanceSession; record: AttendanceRecord }[] }>(
      organizationId,
      `/attendance/students/${studentId}/history${query({ academicYearId })}`,
    );
    return response.history;
  },

  async getStudentAttendanceSummary(
    organizationId: string,
    studentId: string,
    academicYearId?: string,
  ): Promise<AttendanceSummary> {
    const response = await sisRequest<{ summary: AttendanceSummary }>(
      organizationId,
      `/attendance/students/${studentId}/summary${query({ academicYearId })}`,
    );
    return response.summary;
  },
};
