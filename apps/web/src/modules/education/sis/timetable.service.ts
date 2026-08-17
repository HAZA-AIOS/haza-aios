import type { SchoolSchedule, TimePeriod, TimetableEntry } from "./sis.types";

const SIS_SCHOOL_SCHEDULES_KEY = "haza-aios.sis.school-schedules";
const SIS_TIME_PERIODS_KEY = "haza-aios.sis.time-periods";
const SIS_TIMETABLE_ENTRIES_KEY = "haza-aios.sis.timetable-entries";

type TimetableEntryFilters = Partial<
  Pick<
    TimetableEntry,
    "academicYearId" | "termId" | "gradeId" | "sectionId" | "teacherId" | "dayOfWeek" | "periodId"
  >
>;

function readCollection<T>(key: string): T[] {
  const data = localStorage.getItem(key);
  if (!data) return [];

  try {
    return JSON.parse(data) as T[];
  } catch {
    return [];
  }
}

function writeCollection<T>(key: string, values: T[]): void {
  localStorage.setItem(key, JSON.stringify(values));
}

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function assertSameOrganization(
  organizationId: string,
  record: { organizationId?: string; id?: string },
): void {
  if (record.organizationId && record.organizationId !== organizationId) {
    throw new Error("Organization isolation violation");
  }
}

export class TimetableConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimetableConflictError";
  }
}

class TimetableService {
  private getSchedulesDb(): SchoolSchedule[] {
    return readCollection<SchoolSchedule>(SIS_SCHOOL_SCHEDULES_KEY);
  }

  private saveSchedulesDb(schedules: SchoolSchedule[]): void {
    writeCollection(SIS_SCHOOL_SCHEDULES_KEY, schedules);
  }

  private getPeriodsDb(): TimePeriod[] {
    return readCollection<TimePeriod>(SIS_TIME_PERIODS_KEY);
  }

  private savePeriodsDb(periods: TimePeriod[]): void {
    writeCollection(SIS_TIME_PERIODS_KEY, periods);
  }

  private getEntriesDb(): TimetableEntry[] {
    return readCollection<TimetableEntry>(SIS_TIMETABLE_ENTRIES_KEY);
  }

  private saveEntriesDb(entries: TimetableEntry[]): void {
    writeCollection(SIS_TIMETABLE_ENTRIES_KEY, entries);
  }

  async getSchoolSchedule(
    organizationId: string,
    academicYearId: string,
  ): Promise<SchoolSchedule | null> {
    return (
      this.getSchedulesDb().find(
        (schedule) =>
          schedule.organizationId === organizationId && schedule.academicYearId === academicYearId,
      ) || null
    );
  }

  async saveSchoolSchedule(
    organizationId: string,
    data: Omit<SchoolSchedule, "id" | "organizationId" | "createdAt" | "updatedAt"> &
      Partial<Pick<SchoolSchedule, "id" | "organizationId" | "createdAt" | "updatedAt">>,
  ): Promise<SchoolSchedule> {
    assertSameOrganization(organizationId, data);

    if (data.scheduleStartTime >= data.scheduleEndTime) {
      throw new Error("Schedule start time must be before end time.");
    }

    if (data.workingDays.length === 0) {
      throw new Error("At least one working day must be selected.");
    }

    const schedules = this.getSchedulesDb();
    const index = data.id
      ? schedules.findIndex((schedule) => schedule.id === data.id && schedule.organizationId === organizationId)
      : schedules.findIndex(
          (schedule) =>
            schedule.organizationId === organizationId &&
            schedule.academicYearId === data.academicYearId,
        );
    const now = new Date().toISOString();

    const saved: SchoolSchedule = {
      id: data.id || (index >= 0 ? schedules[index].id : createId("schedule")),
      organizationId,
      academicYearId: data.academicYearId,
      workingDays: [...new Set(data.workingDays)].sort((a, b) => a - b),
      scheduleStartTime: data.scheduleStartTime,
      scheduleEndTime: data.scheduleEndTime,
      createdAt: data.createdAt || (index >= 0 ? schedules[index].createdAt : now),
      updatedAt: now,
    };

    if (index >= 0) {
      schedules[index] = saved;
    } else {
      schedules.push(saved);
    }

    this.saveSchedulesDb(schedules);
    return saved;
  }

  async getPeriods(organizationId: string): Promise<TimePeriod[]> {
    return this.getPeriodsDb()
      .filter((period) => period.organizationId === organizationId)
      .sort((a, b) => a.displayOrder - b.displayOrder || a.startTime.localeCompare(b.startTime));
  }

  async savePeriod(
    organizationId: string,
    data: Omit<TimePeriod, "id" | "organizationId" | "createdAt" | "updatedAt"> &
      Partial<Pick<TimePeriod, "id" | "organizationId" | "createdAt" | "updatedAt">>,
  ): Promise<TimePeriod> {
    assertSameOrganization(organizationId, data);

    if (data.startTime >= data.endTime) {
      throw new Error("Period start time must be before end time.");
    }

    const periods = this.getPeriodsDb();
    const index = data.id
      ? periods.findIndex((period) => period.id === data.id && period.organizationId === organizationId)
      : -1;
    const now = new Date().toISOString();

    const saved: TimePeriod = {
      id: data.id || createId("period"),
      organizationId,
      name: data.name.trim(),
      startTime: data.startTime,
      endTime: data.endTime,
      type: data.type,
      displayOrder: data.displayOrder,
      createdAt: data.createdAt || (index >= 0 ? periods[index].createdAt : now),
      updatedAt: now,
    };

    if (!saved.name) {
      throw new Error("Period name is required.");
    }

    if (index >= 0) {
      periods[index] = saved;
    } else {
      periods.push(saved);
    }

    this.savePeriodsDb(periods);
    return saved;
  }

  async deletePeriod(organizationId: string, id: string): Promise<void> {
    const periods = this.getPeriodsDb();
    const period = periods.find((item) => item.id === id);
    if (period) {
      assertSameOrganization(organizationId, period);
    }

    this.savePeriodsDb(periods.filter((item) => !(item.id === id && item.organizationId === organizationId)));
    this.saveEntriesDb(
      this.getEntriesDb().filter(
        (entry) => !(entry.periodId === id && entry.organizationId === organizationId),
      ),
    );
  }

  async getTimetableEntries(
    organizationId: string,
    filters: TimetableEntryFilters = {},
  ): Promise<TimetableEntry[]> {
    return this.getEntriesDb()
      .filter((entry) => {
        if (entry.organizationId !== organizationId) return false;
        if (filters.academicYearId && entry.academicYearId !== filters.academicYearId) return false;
        if (filters.termId && entry.termId !== filters.termId) return false;
        if (filters.gradeId && entry.gradeId !== filters.gradeId) return false;
        if (filters.sectionId && entry.sectionId !== filters.sectionId) return false;
        if (filters.teacherId && entry.teacherId !== filters.teacherId) return false;
        if (filters.dayOfWeek !== undefined && entry.dayOfWeek !== filters.dayOfWeek) return false;
        if (filters.periodId && entry.periodId !== filters.periodId) return false;
        return true;
      })
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.periodId.localeCompare(b.periodId));
  }

  async saveTimetableEntry(
    organizationId: string,
    data: Omit<TimetableEntry, "id" | "organizationId" | "createdAt" | "updatedAt"> &
      Partial<Pick<TimetableEntry, "id" | "organizationId" | "createdAt" | "updatedAt">>,
  ): Promise<TimetableEntry> {
    assertSameOrganization(organizationId, data);

    const entries = this.getEntriesDb();
    const index = data.id
      ? entries.findIndex((entry) => entry.id === data.id && entry.organizationId === organizationId)
      : -1;

    const sameSlot = entries.filter(
      (entry) =>
        entry.organizationId === organizationId &&
        entry.academicYearId === data.academicYearId &&
        entry.dayOfWeek === data.dayOfWeek &&
        entry.periodId === data.periodId &&
        entry.id !== data.id,
    );

    const teacherConflict = sameSlot.find((entry) => entry.teacherId === data.teacherId);
    if (teacherConflict) {
      throw new TimetableConflictError("Teacher already has a class in this period.");
    }

    const classConflict = sameSlot.find(
      (entry) => entry.gradeId === data.gradeId && entry.sectionId === data.sectionId,
    );
    if (classConflict) {
      throw new TimetableConflictError("Class section already has a timetable entry in this period.");
    }

    const now = new Date().toISOString();
    const saved: TimetableEntry = {
      id: data.id || createId("timetable"),
      organizationId,
      academicYearId: data.academicYearId,
      termId: data.termId,
      gradeId: data.gradeId,
      sectionId: data.sectionId,
      subjectId: data.subjectId,
      teacherId: data.teacherId,
      roomId: data.roomId,
      dayOfWeek: data.dayOfWeek,
      periodId: data.periodId,
      createdAt: data.createdAt || (index >= 0 ? entries[index].createdAt : now),
      updatedAt: now,
    };

    if (index >= 0) {
      entries[index] = saved;
    } else {
      entries.push(saved);
    }

    this.saveEntriesDb(entries);
    return saved;
  }

  async deleteTimetableEntry(organizationId: string, id: string): Promise<void> {
    const entries = this.getEntriesDb();
    const entry = entries.find((item) => item.id === id);
    if (entry) {
      assertSameOrganization(organizationId, entry);
    }

    this.saveEntriesDb(entries.filter((item) => !(item.id === id && item.organizationId === organizationId)));
  }
}

export const timetableService = new TimetableService();
