import { describe, it, expect, beforeEach } from 'vitest';
import { timetableService, TimetableConflictError } from '../timetable.service';

describe('TimetableService', () => {
  const orgId = 'org-1';
  const academicYearId = 'year-1';

  beforeEach(async () => {
    // Reset internal state for clean testing by creating a new instance context if possible, 
    // or we'll just use unique IDs for testing to avoid pollution if singleton.
  });

  it('should save and retrieve school schedule', async () => {
    const schedule = await timetableService.saveSchoolSchedule(orgId, {
      academicYearId,
      workingDays: [1, 2, 3, 4, 5],
      scheduleStartTime: "08:00",
      scheduleEndTime: "15:00"
    });

    expect(schedule).toBeDefined();
    expect(schedule.workingDays).toEqual([1, 2, 3, 4, 5]);

    const retrieved = await timetableService.getSchoolSchedule(orgId, academicYearId);
    expect(retrieved?.id).toBe(schedule.id);
  });

  it('should keep period writes scoped by organization', async () => {
    const period = await timetableService.savePeriod(orgId, {
      name: 'Period 1',
      startTime: '08:00',
      endTime: '08:45',
      type: 'teaching',
      displayOrder: 1
    });

    const org2Period = await timetableService.savePeriod('org-2', { ...period, organizationId: 'org-2' });
    const org1Periods = await timetableService.getPeriods(orgId);
    const org2Periods = await timetableService.getPeriods('org-2');

    expect(org2Period.organizationId).toBe('org-2');
    expect(org1Periods.some((item) => item.id === period.id && item.organizationId === orgId)).toBe(true);
    expect(org2Periods.some((item) => item.id === period.id && item.organizationId === orgId)).toBe(false);
  });

  it('should detect teacher conflicts', async () => {
    // Setup
    const entryData = {
      academicYearId,
      gradeId: 'grade-1',
      sectionId: 'section-A',
      subjectId: 'sub-1',
      teacherId: 'teacher-1',
      dayOfWeek: 1,
      periodId: 'period-1'
    };

    // First entry should succeed
    const entry1 = await timetableService.saveTimetableEntry(orgId, entryData);
    expect(entry1).toBeDefined();

    // Second entry for the SAME teacher, SAME period, DIFFERENT class should fail
    const conflictData = {
      ...entryData,
      gradeId: 'grade-2',
      sectionId: 'section-B'
    };

    await expect(timetableService.saveTimetableEntry(orgId, conflictData))
      .rejects.toThrow(TimetableConflictError);
  });

  it('should detect class/section conflicts', async () => {
    const orgId2 = 'org-test-class-conflict';
    
    // First entry
    await timetableService.saveTimetableEntry(orgId2, {
      academicYearId,
      gradeId: 'grade-1',
      sectionId: 'section-A',
      subjectId: 'sub-1',
      teacherId: 'teacher-1',
      dayOfWeek: 1,
      periodId: 'period-1'
    });

    // Second entry for the SAME class, SAME period, DIFFERENT teacher/subject should fail
    await expect(timetableService.saveTimetableEntry(orgId2, {
      academicYearId,
      gradeId: 'grade-1',
      sectionId: 'section-A',
      subjectId: 'sub-2',
      teacherId: 'teacher-2',
      dayOfWeek: 1,
      periodId: 'period-1'
    })).rejects.toThrow(TimetableConflictError);
  });
});
