import { useEffect, useState } from "react";
import { useOrganization } from "@/org/use-organization";
import { AppShell } from "@/components/AppShell";
import { Link } from "@/routes/router";
import { navigate } from "@/routes/navigation";
import { Card, CardContent, Button, Input, Badge } from "@haza-aios/ui";
import { ArrowLeft, Check, CheckCircle2, Save, Users, AlertCircle } from "lucide-react";
import { AcademicService } from "@/modules/education/sis/academic.service";
import { AttendanceService } from "@/modules/education/sis/attendance.service";
import { StudentService } from "@/modules/education/sis/student.service";
import type { 
  AcademicYear, Grade, Section, Student, 
  AttendanceSession, AttendanceRecord, AttendanceStatus 
} from "@/modules/education/sis/sis.types";

export function MarkAttendancePage() {
  const { currentOrganization } = useOrganization();
  const searchParams = new URLSearchParams(window.location.search);
  const sessionId = searchParams.get("sessionId");

  // Selection state
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [academicYearId, setAcademicYearId] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [sectionId, setSectionId] = useState("");

  // Data
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  
  // Attendance state
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [attendance, setAttendance] = useState<Record<string, { status: AttendanceStatus, note?: string }>>({});
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentOrganization) {
      loadInitialData();
    }
  }, [currentOrganization, sessionId]);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const orgId = currentOrganization!.id;
      const [ays, gs, ss] = await Promise.all([
        AcademicService.getAcademicYears(orgId),
        AcademicService.getGrades(orgId),
        AcademicService.getSections(orgId)
      ]);
      
      setAcademicYears(ays);
      setGrades(gs);
      setSections(ss);

      if (sessionId) {
        // Load existing session
        const existingSession = await AttendanceService.getSessionById(orgId, sessionId);
        if (existingSession) {
          setSession(existingSession);
          setDate(existingSession.date);
          setAcademicYearId(existingSession.academicYearId);
          setGradeId(existingSession.gradeId);
          setSectionId(existingSession.sectionId);
          
          await loadStudentsAndRecords(existingSession);
        }
      } else {
        // Default to active year
        const activeYear = ays.find(ay => ay.status === "active") || ays[0];
        if (activeYear) setAcademicYearId(activeYear.id);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load attendance data.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadStudentsAndRecords = async (currentSession: AttendanceSession) => {
    const orgId = currentOrganization!.id;
    // For simplicity, we just fetch all students and filter locally if a backend isn't robust
    const allStudents = await StudentService.getStudents(orgId);
    // In a real app, we'd query by enrollment: studentService.getStudentsBySection(sectionId, academicYear)
    // We will just show all active students for this mock
    const activeStudents = allStudents.filter(s => s.status === 'active');
    setStudents(activeStudents);
    
    // Load existing records
    const records = await AttendanceService.getSessionRecords(orgId, currentSession.id);
    const attendanceMap: Record<string, { status: AttendanceStatus, note?: string }> = {};
    
    // Default everyone to present if no record exists
    activeStudents.forEach(student => {
      const existing = records.find(r => r.studentId === student.id);
      if (existing) {
        attendanceMap[student.id] = { status: existing.status, note: existing.note };
      } else {
        attendanceMap[student.id] = { status: 'present' };
      }
    });
    
    setAttendance(attendanceMap);
  };

  const handleStartSession = async () => {
    if (!academicYearId || !gradeId || !sectionId || !date) {
      setError("Please select all required fields.");
      return;
    }
    setError(null);
    setIsLoading(true);
    
    try {
      const orgId = currentOrganization!.id;
      const newSession = await AttendanceService.createSession(orgId, {
        academicYearId,
        date,
        gradeId,
        sectionId,
        sessionType: "daily",
        status: "draft"
      });
      
      setSession(newSession);
      // Update URL to match this session
      navigate(`/workspace/education/attendance/mark?sessionId=${newSession.id}`);
      await loadStudentsAndRecords(newSession);
    } catch (err) {
      console.error(err);
      setError("Failed to start session.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAttendance = async () => {
    if (!session || !currentOrganization) return;
    
    setIsSaving(true);
    setError(null);
    try {
      const orgId = currentOrganization.id;
      const recordsToSave = Object.entries(attendance).map(([studentId, data]) => ({
        studentId,
        status: data.status,
        note: data.note
      }));
      
      await AttendanceService.saveAttendanceRecords(orgId, session.id, recordsToSave, "admin"); // hardcode markedBy for now
      
      // Update local session status
      setSession({ ...session, status: "completed" });
    } catch (err) {
      console.error(err);
      setError("Failed to save attendance.");
    } finally {
      setIsSaving(false);
    }
  };

  const markAll = (status: AttendanceStatus) => {
    const newMap = { ...attendance };
    Object.keys(newMap).forEach(id => {
      newMap[id].status = status;
    });
    setAttendance(newMap);
  };

  const updateStudentStatus = (studentId: string, status: AttendanceStatus) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], status }
    }));
  };

  const updateStudentNote = (studentId: string, note: string) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], note }
    }));
  };

  if (!currentOrganization) return null;

  return (
    <AppShell>
      <div className="space-y-6 pb-24">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/workspace/education/attendance" className="text-slate-400 hover:text-white transition-colors">
              <div className="w-8 h-8 rounded-lg bg-slate-800/50 flex items-center justify-center border border-white/5 hover:bg-slate-800">
                <ArrowLeft className="w-4 h-4" />
              </div>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Mark Attendance</h1>
              <p className="text-sm text-slate-400">Record student attendance for a specific class and date</p>
            </div>
          </div>
          
          {session && (
            <div className="flex items-center gap-3">
              <Badge variant={session.status === "completed" ? "success" : "warning"} className="px-3 py-1 text-sm">
                {session.status === "completed" ? "Completed" : "Draft"}
              </Badge>
              <Button 
                onClick={handleSaveAttendance} 
                disabled={isSaving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/20"
              >
                {isSaving ? "Saving..." : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Attendance
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Selection Configuration */}
        <Card className="bg-[#0f141f] border-white/5">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Academic Year</label>
                <select 
                  className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                  value={academicYearId}
                  onChange={e => setAcademicYearId(e.target.value)}
                  disabled={!!session || isLoading}
                >
                  <option value="">Select Year</option>
                  {academicYears.map(ay => (
                    <option key={ay.id} value={ay.id}>{ay.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Class / Grade</label>
                <select 
                  className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                  value={gradeId}
                  onChange={e => setGradeId(e.target.value)}
                  disabled={!!session || isLoading}
                >
                  <option value="">Select Class</option>
                  {grades.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Section</label>
                <select 
                  className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                  value={sectionId}
                  onChange={e => setSectionId(e.target.value)}
                  disabled={!!session || isLoading}
                >
                  <option value="">Select Section</option>
                  {sections.filter(s => !gradeId || s.gradeId === gradeId).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Date</label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    disabled={!!session || isLoading}
                    className="flex-1"
                  />
                  {!session && (
                    <Button 
                      onClick={handleStartSession}
                      disabled={isLoading || !academicYearId || !gradeId || !sectionId || !date}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Start
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Student List */}
        {session && (
          <Card className="bg-[#0f141f] border-white/5">
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-white">Student Roster</h3>
                  <p className="text-sm text-slate-400">{students.length} students enrolled</p>
                </div>
              </div>
              
              <div className="flex gap-2 bg-slate-900/50 p-1 rounded-lg border border-white/5">
                <Button variant="ghost" size="sm" onClick={() => markAll('present')} className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10">
                  Mark All Present
                </Button>
                <div className="w-px bg-white/10 my-1 mx-1"></div>
                <Button variant="ghost" size="sm" onClick={() => markAll('absent')} className="text-red-400 hover:text-red-300 hover:bg-red-400/10">
                  Mark All Absent
                </Button>
              </div>
            </div>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-300">
                  <thead className="text-xs uppercase bg-slate-900/50 text-slate-400">
                    <tr>
                      <th className="px-6 py-4 font-medium">Student Name</th>
                      <th className="px-6 py-4 font-medium text-center">Status</th>
                      <th className="px-6 py-4 font-medium">Notes (Optional)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {students.map(student => {
                      const record = attendance[student.id] || { status: 'present' };
                      return (
                        <tr key={student.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {student.photoUrl ? (
                                <img src={student.photoUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 font-medium text-xs">
                                  {student.firstName[0]}{student.lastName[0]}
                                </div>
                              )}
                              <div>
                                <div className="font-medium text-white">{student.firstName} {student.lastName}</div>
                                <div className="text-xs text-slate-500">{student.admissionNumber}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => updateStudentStatus(student.id, 'present')}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                  record.status === 'present' 
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                    : 'bg-slate-800 text-slate-400 border border-transparent hover:bg-slate-700'
                                }`}
                              >
                                {record.status === 'present' && <Check className="w-3 h-3 inline-block mr-1" />}
                                Present
                              </button>
                              <button
                                onClick={() => updateStudentStatus(student.id, 'absent')}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                  record.status === 'absent' 
                                    ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                                    : 'bg-slate-800 text-slate-400 border border-transparent hover:bg-slate-700'
                                }`}
                              >
                                Absent
                              </button>
                              <button
                                onClick={() => updateStudentStatus(student.id, 'late')}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                  record.status === 'late' 
                                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                                    : 'bg-slate-800 text-slate-400 border border-transparent hover:bg-slate-700'
                                }`}
                              >
                                Late
                              </button>
                              <button
                                onClick={() => updateStudentStatus(student.id, 'excused')}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                  record.status === 'excused' 
                                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                                    : 'bg-slate-800 text-slate-400 border border-transparent hover:bg-slate-700'
                                }`}
                              >
                                Excused
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4 w-64">
                            <Input 
                              placeholder="Add note..." 
                              value={record.note || ""} 
                              onChange={e => updateStudentNote(student.id, e.target.value)}
                              className="h-8 text-sm"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
