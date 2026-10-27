import type { SchoolSchedule, TimePeriod, TimetableEntry } from "./sis.types";
import { fetchCompleteSisDataset, jsonBody, sisRequest } from "./sis-api";

type TimetableEntryFilters = Partial<
  Pick<
    TimetableEntry,
    "academicYearId" | "termId" | "gradeId" | "sectionId" | "teacherId" | "dayOfWeek" | "periodId"
  >
>;

function query(filters: Record<string, string | number | undefined>, defaultAll = true): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const hasPage = params.has("page") || params.has("pageSize") || params.has("limit") || params.has("offset");
  if (!hasPage && defaultAll && !params.has("all")) {
    params.set("all", "true");
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

export class TimetableConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimetableConflictError";
  }
}

async function translateConflict<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Timetable conflict";
    if (message.toLowerCase().includes("conflict") || message.includes("already has")) {
      throw new TimetableConflictError(message);
    }
    throw error;
  }
}

class TimetableService {
  async getSchoolSchedule(organizationId: string, academicYearId: string): Promise<SchoolSchedule | null> {
    const response = await sisRequest<{ schedule: SchoolSchedule | null }>(organizationId, `/timetable/schedules/${academicYearId}`);
    return response.schedule;
  }

  async saveSchoolSchedule(
    organizationId: string,
    data: Omit<SchoolSchedule, "id" | "organizationId" | "createdAt" | "updatedAt"> &
      Partial<Pick<SchoolSchedule, "id" | "organizationId" | "createdAt" | "updatedAt">>,
  ): Promise<SchoolSchedule> {
    const response = await sisRequest<{ schedule: SchoolSchedule }>(organizationId, "/timetable/schedules", {
      method: "PUT",
      ...jsonBody(data),
    });
    return response.schedule;
  }

  async getPeriods(organizationId: string): Promise<TimePeriod[]> {
    const response = await sisRequest<{ periods: TimePeriod[] }>(organizationId, "/timetable/periods");
    return response.periods;
  }

  async savePeriod(
    organizationId: string,
    data: Omit<TimePeriod, "id" | "organizationId" | "createdAt" | "updatedAt"> &
      Partial<Pick<TimePeriod, "id" | "organizationId" | "createdAt" | "updatedAt">>,
  ): Promise<TimePeriod> {
    const response = await sisRequest<{ period: TimePeriod }>(organizationId, "/timetable/periods", {
      method: "PUT",
      ...jsonBody(data),
    });
    return response.period;
  }

  async deletePeriod(organizationId: string, id: string): Promise<void> {
    await sisRequest<{ ok: true }>(organizationId, `/timetable/periods/${id}`, { method: "DELETE" });
  }

  async getTimetableEntries(
    organizationId: string,
    filters: TimetableEntryFilters = {},
  ): Promise<TimetableEntry[]> {
    return fetchCompleteSisDataset<TimetableEntry>(organizationId, `/timetable/entries${query(filters, false)}`);
  }

  async saveTimetableEntry(
    organizationId: string,
    data: Omit<TimetableEntry, "id" | "organizationId" | "createdAt" | "updatedAt"> &
      Partial<Pick<TimetableEntry, "id" | "organizationId" | "createdAt" | "updatedAt">>,
  ): Promise<TimetableEntry> {
    return translateConflict(async () => {
      const response = await sisRequest<{ entry: TimetableEntry }>(organizationId, "/timetable/entries", {
        method: "PUT",
        ...jsonBody(data),
      });
      return response.entry;
    });
  }

  async deleteTimetableEntry(organizationId: string, id: string): Promise<void> {
    await sisRequest<{ ok: true }>(organizationId, `/timetable/entries/${id}`, { method: "DELETE" });
  }
}

export const timetableService = new TimetableService();
