import type { 
  AttendanceSession, 
  AttendanceRecord, 
  AttendanceSummary,
  AttendanceSessionType,
  AttendanceSessionStatus,
  AttendanceStatus
} from "./sis.types";
import { StudentService } from "./student.service";

// In-memory mock data store for attendance
let MOCK_ATTENDANCE_SESSIONS: AttendanceSession[] = [];
let MOCK_ATTENDANCE_RECORDS: AttendanceRecord[] = [];

// Seed some initial data for demonstration purposes
const initializeMockData = () => {
  if (MOCK_ATTENDANCE_SESSIONS.length > 0) return;
  
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // Assuming an org-id "org-1" and academicYear "ay-2025-2026" and some grade/section
  const orgId = "org-1";
  const ayId = "ay-1"; // Assuming ay-1 is the active one
  
  MOCK_ATTENDANCE_SESSIONS.push(
    {
      id: "sess-1",
      organizationId: orgId,
      academicYearId: ayId,
      date: yesterday,
      gradeId: "g-1",
      sectionId: "sec-1",
      sessionType: "daily",
      status: "completed",
      markedBy: "admin",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "sess-2",
      organizationId: orgId,
      academicYearId: ayId,
      date: today,
      gradeId: "g-1",
      sectionId: "sec-1",
      sessionType: "daily",
      status: "draft",
      markedBy: "admin",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  );

  // Add some records for sess-1
  // (We'll assume student IDs from StudentService, but for mock sake we just put dummy ones)
  MOCK_ATTENDANCE_RECORDS.push(
    {
      id: "rec-1",
      organizationId: orgId,
      sessionId: "sess-1",
      studentId: "student-1",
      status: "present",
      markedAt: new Date().toISOString(),
      markedBy: "admin",
      updatedAt: new Date().toISOString()
    },
    {
      id: "rec-2",
      organizationId: orgId,
      sessionId: "sess-1",
      studentId: "student-2",
      status: "absent",
      note: "Sick",
      markedAt: new Date().toISOString(),
      markedBy: "admin",
      updatedAt: new Date().toISOString()
    },
    {
      id: "rec-3",
      organizationId: orgId,
      sessionId: "sess-1",
      studentId: "student-3",
      status: "late",
      markedAt: new Date().toISOString(),
      markedBy: "admin",
      updatedAt: new Date().toISOString()
    }
  );
};

initializeMockData();

const generateId = () => Math.random().toString(36).substring(2, 9);

export const AttendanceService = {
  // === SESSIONS ===

  async getSessions(
    organizationId: string, 
    filters?: { 
      academicYearId?: string, 
      date?: string, 
      gradeId?: string, 
      sectionId?: string 
    }
  ): Promise<AttendanceSession[]> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return MOCK_ATTENDANCE_SESSIONS.filter(s => {
      if (s.organizationId !== organizationId) return false;
      if (filters?.academicYearId && s.academicYearId !== filters.academicYearId) return false;
      if (filters?.date && s.date !== filters.date) return false;
      if (filters?.gradeId && s.gradeId !== filters.gradeId) return false;
      if (filters?.sectionId && s.sectionId !== filters.sectionId) return false;
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  async getSessionById(organizationId: string, id: string): Promise<AttendanceSession | undefined> {
    await new Promise(resolve => setTimeout(resolve, 100));
    return MOCK_ATTENDANCE_SESSIONS.find(s => s.id === id && s.organizationId === organizationId);
  },

  async createSession(
    organizationId: string,
    data: Omit<AttendanceSession, "id" | "organizationId" | "createdAt" | "updatedAt">
  ): Promise<AttendanceSession> {
    await new Promise(resolve => setTimeout(resolve, 400));
    
    // Check if session already exists for this date/grade/section/type
    const existing = MOCK_ATTENDANCE_SESSIONS.find(s => 
      s.organizationId === organizationId &&
      s.academicYearId === data.academicYearId &&
      s.date === data.date &&
      s.gradeId === data.gradeId &&
      s.sectionId === data.sectionId &&
      s.sessionType === data.sessionType
    );
    
    if (existing) {
      return existing; // Return existing session instead of duplicating
    }
    
    const newSession: AttendanceSession = {
      ...data,
      id: `sess-${generateId()}`,
      organizationId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    MOCK_ATTENDANCE_SESSIONS.push(newSession);
    return newSession;
  },

  async updateSession(
    organizationId: string,
    id: string,
    updates: Partial<AttendanceSession>
  ): Promise<AttendanceSession> {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const index = MOCK_ATTENDANCE_SESSIONS.findIndex(s => s.id === id && s.organizationId === organizationId);
    if (index === -1) throw new Error("Attendance session not found");
    
    MOCK_ATTENDANCE_SESSIONS[index] = {
      ...MOCK_ATTENDANCE_SESSIONS[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    return MOCK_ATTENDANCE_SESSIONS[index];
  },

  // === RECORDS ===

  async getSessionRecords(organizationId: string, sessionId: string): Promise<AttendanceRecord[]> {
    await new Promise(resolve => setTimeout(resolve, 200));
    return MOCK_ATTENDANCE_RECORDS.filter(r => r.sessionId === sessionId && r.organizationId === organizationId);
  },

  /**
   * Bulk save attendance records for a session
   */
  async saveAttendanceRecords(
    organizationId: string,
    sessionId: string,
    records: Array<{ studentId: string; status: AttendanceStatus; note?: string }>,
    markedBy: string
  ): Promise<AttendanceRecord[]> {
    await new Promise(resolve => setTimeout(resolve, 600));
    
    const session = await this.getSessionById(organizationId, sessionId);
    if (!session) throw new Error("Attendance session not found");
    
    // In a real DB, this would be wrapped in a transaction
    const savedRecords: AttendanceRecord[] = [];
    const now = new Date().toISOString();
    
    for (const recordData of records) {
      // Find if record already exists for this student in this session
      const existingIndex = MOCK_ATTENDANCE_RECORDS.findIndex(r => 
        r.organizationId === organizationId && 
        r.sessionId === sessionId && 
        r.studentId === recordData.studentId
      );
      
      if (existingIndex >= 0) {
        // Update
        MOCK_ATTENDANCE_RECORDS[existingIndex] = {
          ...MOCK_ATTENDANCE_RECORDS[existingIndex],
          status: recordData.status,
          note: recordData.note,
          updatedAt: now,
          markedBy: markedBy // track who last modified it
        };
        savedRecords.push(MOCK_ATTENDANCE_RECORDS[existingIndex]);
      } else {
        // Insert
        const newRecord: AttendanceRecord = {
          id: `rec-${generateId()}`,
          organizationId,
          sessionId,
          studentId: recordData.studentId,
          status: recordData.status,
          note: recordData.note,
          markedAt: now,
          markedBy,
          updatedAt: now
        };
        MOCK_ATTENDANCE_RECORDS.push(newRecord);
        savedRecords.push(newRecord);
      }
    }
    
    // Update session status to completed if we saved records
    if (session.status === "draft") {
      await this.updateSession(organizationId, sessionId, { status: "completed" });
    }
    
    return savedRecords;
  },

  // === ANALYTICS & HISTORY ===

  async getStudentAttendanceHistory(
    organizationId: string,
    studentId: string,
    academicYearId?: string
  ): Promise<{ session: AttendanceSession, record: AttendanceRecord }[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const studentRecords = MOCK_ATTENDANCE_RECORDS.filter(r => 
      r.organizationId === organizationId && r.studentId === studentId
    );
    
    const history = [];
    for (const record of studentRecords) {
      const session = MOCK_ATTENDANCE_SESSIONS.find(s => s.id === record.sessionId);
      if (session) {
        if (!academicYearId || session.academicYearId === academicYearId) {
          history.push({ session, record });
        }
      }
    }
    
    // Sort by date descending
    return history.sort((a, b) => new Date(b.session.date).getTime() - new Date(a.session.date).getTime());
  },

  async getStudentAttendanceSummary(
    organizationId: string,
    studentId: string,
    academicYearId?: string
  ): Promise<AttendanceSummary> {
    const history = await this.getStudentAttendanceHistory(organizationId, studentId, academicYearId);
    
    const summary: AttendanceSummary = {
      totalSessions: history.length,
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      attendancePercentage: 0
    };
    
    history.forEach(({ record }) => {
      if (record.status === 'present') summary.present++;
      else if (record.status === 'absent') summary.absent++;
      else if (record.status === 'late') summary.late++;
      else if (record.status === 'excused') summary.excused++;
    });
    
    // Valid days for calculation = present + late + absent
    // Excused absences usually don't penalize the attendance %
    const validDays = summary.present + summary.late + summary.absent;
    
    if (validDays > 0) {
      // Typically, late might count as partial or full present depending on policy.
      // Here we count Present and Late as "attended" for percentage purposes, or 
      // you could configure it to weigh late differently. We'll count Late as Present for %.
      summary.attendancePercentage = Math.round(((summary.present + summary.late) / validDays) * 100);
    } else {
      summary.attendancePercentage = 100;
    }
    
    return summary;
  }
};
