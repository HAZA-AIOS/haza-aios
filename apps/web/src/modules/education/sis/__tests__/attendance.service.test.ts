import { beforeEach, describe, expect, it, vi } from "vitest";
import { AttendanceService } from "../attendance.service";
import { sisRequest } from "../sis-api";

vi.mock("../sis-api", () => ({
  jsonBody: (value: unknown) => ({ body: JSON.stringify(value) }),
  sisRequest: vi.fn(),
}));

const mockedSisRequest = vi.mocked(sisRequest);

describe("AttendanceService API adapter", () => {
  beforeEach(() => {
    mockedSisRequest.mockReset();
  });

  it("lists, gets, and creates attendance sessions", async () => {
    const mockSession = {
      id: "session-1",
      organizationId: "org-1",
      academicYearId: "year-1",
      date: "2026-10-15",
      gradeId: "grade-1",
      sectionId: "section-1",
      sessionType: "daily" as const,
      status: "draft" as const,
      createdAt: "now",
      updatedAt: "now",
    };

    mockedSisRequest
      .mockResolvedValueOnce({ sessions: [mockSession] })
      .mockResolvedValueOnce({ session: mockSession })
      .mockResolvedValueOnce({ session: mockSession });

    const sessions = await AttendanceService.getSessions("org-1", {
      date: "2026-10-15",
      gradeId: "grade-1",
      sectionId: "section-1",
    });
    expect(sessions).toHaveLength(1);
    expect(mockedSisRequest).toHaveBeenNthCalledWith(
      1,
      "org-1",
      "/attendance/sessions?date=2026-10-15&gradeId=grade-1&sectionId=section-1"
    );

    const session = await AttendanceService.getSessionById("org-1", "session-1");
    expect(session).toMatchObject({ id: "session-1" });
    expect(mockedSisRequest).toHaveBeenNthCalledWith(2, "org-1", "/attendance/sessions/session-1");

    const created = await AttendanceService.createSession("org-1", {
      academicYearId: "year-1",
      date: "2026-10-15",
      gradeId: "grade-1",
      sectionId: "section-1",
      sessionType: "daily",
      status: "draft",
    });
    expect(created).toMatchObject({ id: "session-1" });
    expect(mockedSisRequest).toHaveBeenNthCalledWith(
      3,
      "org-1",
      "/attendance/sessions",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("loads and saves attendance records for a session with bulk marking", async () => {
    const mockRecords = [
      {
        id: "rec-1",
        organizationId: "org-1",
        sessionId: "session-1",
        studentId: "student-1",
        status: "present" as const,
        note: "On time",
        markedAt: "now",
        markedBy: "teacher-1",
        updatedAt: "now",
      },
      {
        id: "rec-2",
        organizationId: "org-1",
        sessionId: "session-1",
        studentId: "student-2",
        status: "absent" as const,
        note: "Sick",
        markedAt: "now",
        markedBy: "teacher-1",
        updatedAt: "now",
      },
    ];

    mockedSisRequest
      .mockResolvedValueOnce({ records: mockRecords })
      .mockResolvedValueOnce({ records: mockRecords });

    const records = await AttendanceService.getSessionRecords("org-1", "session-1");
    expect(records).toHaveLength(2);
    expect(mockedSisRequest).toHaveBeenNthCalledWith(
      1,
      "org-1",
      "/attendance/sessions/session-1/records"
    );

    const saved = await AttendanceService.saveAttendanceRecords(
      "org-1",
      "session-1",
      [
        { studentId: "student-1", status: "present", note: "On time" },
        { studentId: "student-2", status: "absent", note: "Sick" },
      ],
      "teacher-1"
    );
    expect(saved).toHaveLength(2);
    expect(mockedSisRequest).toHaveBeenNthCalledWith(
      2,
      "org-1",
      "/attendance/sessions/session-1/records",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("retrieves student attendance history and summary statistics", async () => {
    const mockHistory = [
      {
        session: {
          id: "session-1",
          organizationId: "org-1",
          academicYearId: "year-1",
          date: "2026-10-15",
          gradeId: "grade-1",
          sectionId: "section-1",
          sessionType: "daily" as const,
          status: "completed" as const,
          createdAt: "now",
          updatedAt: "now",
        },
        record: {
          id: "rec-1",
          organizationId: "org-1",
          sessionId: "session-1",
          studentId: "student-1",
          status: "present" as const,
          markedAt: "now",
          markedBy: "teacher-1",
          updatedAt: "now",
        },
      },
    ];

    const mockSummary = {
      totalSessions: 10,
      present: 8,
      absent: 1,
      late: 1,
      excused: 0,
      attendancePercentage: 90,
    };

    mockedSisRequest
      .mockResolvedValueOnce({ history: mockHistory })
      .mockResolvedValueOnce({ summary: mockSummary });

    const history = await AttendanceService.getStudentAttendanceHistory(
      "org-1",
      "student-1",
      "year-1"
    );
    expect(history).toHaveLength(1);
    expect(history[0].record.status).toBe("present");
    expect(mockedSisRequest).toHaveBeenNthCalledWith(
      1,
      "org-1",
      "/attendance/students/student-1/history?academicYearId=year-1"
    );

    const summary = await AttendanceService.getStudentAttendanceSummary(
      "org-1",
      "student-1",
      "year-1"
    );
    expect(summary.attendancePercentage).toBe(90);
    expect(summary.present).toBe(8);
    expect(mockedSisRequest).toHaveBeenNthCalledWith(
      2,
      "org-1",
      "/attendance/students/student-1/summary?academicYearId=year-1"
    );
  });
});
