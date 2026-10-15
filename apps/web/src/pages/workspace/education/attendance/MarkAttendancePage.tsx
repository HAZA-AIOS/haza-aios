import { useEffect, useState, useMemo } from "react";
import { useOrganization } from "@/org/use-organization";
import { useAuth } from "@/auth/use-auth";
import { AppShell } from "@/components/AppShell";
import { Link } from "@/routes/router";
import { navigate } from "@/routes/navigation";
import {
  Card,
  CardContent,
  Button,
  Input,
  Badge,
  AttendanceSummaryCard,
  AttendanceStatusBadge,
} from "@haza-aios/ui";
import {
  ArrowLeft,
  Check,
  Save,
  Users,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Clock,
  RotateCcw,
} from "lucide-react";
import { AcademicService } from "@/modules/education/sis/academic.service";
import { AttendanceService } from "@/modules/education/sis/attendance.service";
import { EnrollmentService } from "@/modules/education/sis/enrollment.service";
import { StudentService } from "@/modules/education/sis/student.service";
import type {
  AcademicYear,
  Grade,
  Section,
  Student,
  AttendanceSession,
  AttendanceStatus,
} from "@/modules/education/sis/sis.types";

export function MarkAttendancePage() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const searchParams = new URLSearchParams(window.location.search);
  const sessionId = searchParams.get("sessionId");

  // Selection state
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [academicYearId, setAcademicYearId] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [sectionId, setSectionId] = useState("");

  // Data
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<Student[]>([]);

  // Attendance state
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [attendance, setAttendance] = useState<
    Record<string, { status: AttendanceStatus; note?: string }>
  >({});

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    if (currentOrganization) {
      void loadInitialData();
    }
  }, [currentOrganization, sessionId]);

  const loadInitialData = async () => {
    if (!currentOrganization) return;
    setIsLoading(true);
    setError(null);
    try {
      const orgId = currentOrganization.id;
      const [ays, gs, ss] = await Promise.all([
        AcademicService.getAcademicYears(orgId),
        AcademicService.getGrades(orgId),
        AcademicService.getSections(orgId),
      ]);

      setAcademicYears(ays);
      setGrades(gs);
      setSections(ss);

      if (sessionId) {
        const existingSession = await AttendanceService.getSessionById(orgId, sessionId);
        if (existingSession) {
          setSession(existingSession);
          setDate(existingSession.date);
          setAcademicYearId(existingSession.academicYearId);
          setGradeId(existingSession.gradeId);
          setSectionId(existingSession.sectionId);
          await loadStudentsAndRecords(existingSession);
        } else {
          setError("Requested attendance session was not found.");
        }
      } else {
        const activeYear = ays.find((ay) => ay.status === "active") || ays[0];
        if (activeYear) setAcademicYearId(activeYear.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load attendance setup data.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadStudentsAndRecords = async (currentSession: AttendanceSession) => {
    if (!currentOrganization) return;
    const orgId = currentOrganization.id;

    // Load active enrollments specifically for this session's class and section
    const [enrollments, allStudents, existingRecords] = await Promise.all([
      EnrollmentService.getEnrollments(orgId, {
        gradeId: currentSession.gradeId,
        sectionId: currentSession.sectionId,
        status: "active",
      }),
      StudentService.getStudents(orgId),
      AttendanceService.getSessionRecords(orgId, currentSession.id),
    ]);

    const activeStudentIds = new Set(enrollments.map((e) => e.studentId));
    // Filter to only enrolled active students matching this section
    const eligibleStudents = allStudents.filter(
      (s) => s.status === "active" && activeStudentIds.has(s.id)
    );

    setEnrolledStudents(eligibleStudents);

    // Map existing attendance records or initialize to default
    const attendanceMap: Record<string, { status: AttendanceStatus; note?: string }> = {};
    for (const student of eligibleStudents) {
      const existing = existingRecords.find((r) => r.studentId === student.id);
      if (existing) {
        attendanceMap[student.id] = {
          status: existing.status,
          note: existing.note || "",
        };
      } else {
        attendanceMap[student.id] = { status: "present", note: "" };
      }
    }

    setAttendance(attendanceMap);
  };

  const handleStartSession = async () => {
    if (!currentOrganization) return;
    if (!academicYearId || !gradeId || !sectionId || !date) {
      setError("Please select Academic Year, Class, Section, and Date before starting.");
      return;
    }
    setError(null);
    setSuccessMessage(null);
    setInfoMessage(null);
    setIsLoading(true);

    try {
      const orgId = currentOrganization.id;

      // Prevent accidental duplicate sessions: Check if an attendance session already exists
      const existingSessions = await AttendanceService.getSessions(orgId, {
        academicYearId,
        date,
        gradeId,
        sectionId,
      });

      const duplicate = existingSessions.find((s) => s.sessionType === "daily");
      if (duplicate) {
        setSession(duplicate);
        setInfoMessage(
          `Existing ${duplicate.status === "completed" ? "completed" : "draft"} session found for this class and date. Reopening session.`
        );
        navigate(`/workspace/education/attendance/mark?sessionId=${duplicate.id}`);
        await loadStudentsAndRecords(duplicate);
        return;
      }

      // Create new session
      const newSession = await AttendanceService.createSession(orgId, {
        academicYearId,
        date,
        gradeId,
        sectionId,
        sessionType: "daily",
        status: "draft",
        markedBy: user?.displayName || user?.email || "user",
      });

      setSession(newSession);
      navigate(`/workspace/education/attendance/mark?sessionId=${newSession.id}`);
      await loadStudentsAndRecords(newSession);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start attendance session.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAttendance = async () => {
    if (!session || !currentOrganization) return;
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const orgId = currentOrganization.id;
      const recordsToSave = Object.entries(attendance).map(([studentId, data]) => ({
        studentId,
        status: data.status,
        note: data.note?.trim() || undefined,
      }));

      const markedBy = user?.displayName || user?.email || "authorized-staff";
      await AttendanceService.saveAttendanceRecords(orgId, session.id, recordsToSave, markedBy);

      // Update local session status to completed
      setSession((prev) => (prev ? { ...prev, status: "completed", markedBy } : null));
      setSuccessMessage("Attendance records saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save attendance records.");
    } finally {
      setIsSaving(false);
    }
  };

  const markAll = (status: AttendanceStatus) => {
    setAttendance((prev) => {
      const updated: Record<string, { status: AttendanceStatus; note?: string }> = {};
      for (const student of enrolledStudents) {
        updated[student.id] = {
          status,
          note: prev[student.id]?.note || "",
        };
      }
      return updated;
    });
  };

  const updateStudentStatus = (studentId: string, status: AttendanceStatus) => {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], status },
    }));
  };

  const updateStudentNote = (studentId: string, note: string) => {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], note },
    }));
  };

  const handleResetSessionSelection = () => {
    setSession(null);
    setEnrolledStudents([]);
    setAttendance({});
    setError(null);
    setSuccessMessage(null);
    setInfoMessage(null);
    navigate("/workspace/education/attendance/mark");
  };

  // Live session statistics
  const sessionStats = useMemo(() => {
    const total = enrolledStudents.length;
    let present = 0;
    let absent = 0;
    let late = 0;
    let excused = 0;

    for (const student of enrolledStudents) {
      const status = attendance[student.id]?.status || "present";
      if (status === "present") present += 1;
      else if (status === "absent") absent += 1;
      else if (status === "late") late += 1;
      else if (status === "excused") excused += 1;
    }

    const counted = present + late + absent;
    const rate = counted > 0 ? Math.round(((present + late) / counted) * 100) : 100;

    return { total, present, absent, late, excused, rate };
  }, [enrolledStudents, attendance]);

  const selectedGrade = grades.find((g) => g.id === gradeId);
  const selectedSection = sections.find((s) => s.id === sectionId);

  if (!currentOrganization) return null;

  return (
    <AppShell>
      <div className="space-y-6 pb-24">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              to="/workspace/education/attendance"
              className="text-slate-400 hover:text-white transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-slate-800/60 flex items-center justify-center border border-white/5 hover:bg-slate-800">
                <ArrowLeft className="w-4 h-4" />
              </div>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Mark Attendance</h1>
              <p className="text-sm text-slate-400">
                Record and manage student attendance by session, class, and section
              </p>
            </div>
          </div>

          {session && (
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetSessionSelection}
                className="border-white/10 text-slate-300 hover:text-white"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Change Class
              </Button>
              <Badge
                variant={session.status === "completed" ? "success" : "warning"}
                className="px-3 py-1 text-sm uppercase tracking-wide"
              >
                {session.status === "completed" ? "Completed" : "Draft"}
              </Badge>
              <Button
                onClick={handleSaveAttendance}
                disabled={isSaving || enrolledStudents.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/20"
              >
                {isSaving ? (
                  "Saving..."
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Attendance
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Alerts */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {infoMessage && (
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-3 text-blue-400">
            <Clock className="w-5 h-5 shrink-0" />
            <p className="text-sm">{infoMessage}</p>
          </div>
        )}

        {successMessage && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3 text-emerald-400">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <p className="text-sm">{successMessage}</p>
          </div>
        )}

        {/* Selection Configuration Card */}
        <Card className="bg-[#0f141f] border-white/5">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Academic Year
                </label>
                <select
                  aria-label="Academic Year"
                  className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 disabled:opacity-50 text-sm"
                  value={academicYearId}
                  onChange={(e) => setAcademicYearId(e.target.value)}
                  disabled={!!session || isLoading}
                >
                  <option value="">Select Academic Year</option>
                  {academicYears.map((ay) => (
                    <option key={ay.id} value={ay.id}>
                      {ay.name} {ay.status === "active" ? "(Active)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Class / Grade
                </label>
                <select
                  aria-label="Class or Grade"
                  className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 disabled:opacity-50 text-sm"
                  value={gradeId}
                  onChange={(e) => {
                    setGradeId(e.target.value);
                    setSectionId("");
                  }}
                  disabled={!!session || isLoading}
                >
                  <option value="">Select Class</option>
                  {grades.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Section
                </label>
                <select
                  aria-label="Section"
                  className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 disabled:opacity-50 text-sm"
                  value={sectionId}
                  onChange={(e) => setSectionId(e.target.value)}
                  disabled={!!session || isLoading || !gradeId}
                >
                  <option value="">Select Section</option>
                  {sections
                    .filter((s) => !gradeId || s.gradeId === gradeId)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Date
                </label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    aria-label="Attendance Date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    disabled={!!session || isLoading}
                    className="flex-1 bg-slate-900/50 border-white/10 text-white rounded-xl"
                  />
                  {!session && (
                    <Button
                      onClick={handleStartSession}
                      disabled={isLoading || !academicYearId || !gradeId || !sectionId || !date}
                      className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                    >
                      {isLoading ? "Loading..." : "Start Session"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live Session Statistics Banner */}
        {session && enrolledStudents.length > 0 && (
          <AttendanceSummaryCard
            totalStudents={sessionStats.total}
            presentCount={sessionStats.present}
            absentCount={sessionStats.absent}
            lateCount={sessionStats.late}
            excusedCount={sessionStats.excused}
            attendancePercentage={sessionStats.rate}
          />
        )}

        {/* Student Roster Card */}
        {session && (
          <Card className="bg-[#0f141f] border-white/5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-6 border-b border-white/5 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-white">
                    {selectedGrade?.name || "Class"} — Section {selectedSection?.name || ""} Student Roster
                  </h3>
                  <p className="text-sm text-slate-400">
                    {enrolledStudents.length} eligible enrolled student{enrolledStudents.length === 1 ? "" : "s"} for date: {date}
                  </p>
                </div>
              </div>

              {/* Bulk Actions */}
              {enrolledStudents.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/60 p-1.5 rounded-xl border border-white/5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => markAll("present")}
                    className="text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 h-8"
                  >
                    Mark All Present
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => markAll("absent")}
                    className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8"
                  >
                    Mark All Absent
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => markAll("late")}
                    className="text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 h-8"
                  >
                    Mark All Late
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => markAll("excused")}
                    className="text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 h-8"
                  >
                    Mark All Excused
                  </Button>
                </div>
              )}
            </div>

            <CardContent className="p-0">
              {enrolledStudents.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  <Users className="w-10 h-10 mx-auto text-slate-600 mb-3" />
                  <p className="text-base font-medium text-white">No active enrollments found</p>
                  <p className="text-sm text-slate-500 mt-1">
                    There are no students with active enrollments in {selectedGrade?.name || "this grade"}{" "}
                    {selectedSection?.name ? `Section ${selectedSection.name}` : ""}.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-slate-300">
                    <thead className="text-xs uppercase bg-slate-900/50 text-slate-400 tracking-wider">
                      <tr>
                        <th className="px-6 py-4 font-semibold">Student Name</th>
                        <th className="px-6 py-4 font-semibold text-center">Status</th>
                        <th className="px-6 py-4 font-semibold">Notes / Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {enrolledStudents.map((student) => {
                        const record = attendance[student.id] || { status: "present" };
                        return (
                          <tr key={student.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                {student.photoUrl ? (
                                  <img
                                    src={student.photoUrl}
                                    alt=""
                                    className="w-9 h-9 rounded-full object-cover border border-white/10"
                                  />
                                ) : (
                                  <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-semibold text-xs border border-white/5">
                                    {student.firstName[0]}
                                    {student.lastName[0]}
                                  </div>
                                )}
                                <div>
                                  <div className="font-medium text-white">
                                    {student.firstName} {student.lastName}
                                  </div>
                                  <div className="text-xs text-slate-400">
                                    {student.admissionNumber}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="px-6 py-4">
                              <div className="flex justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => updateStudentStatus(student.id, "present")}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                    record.status === "present"
                                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-950"
                                      : "bg-slate-900/60 text-slate-400 border border-white/5 hover:bg-slate-800 hover:text-white"
                                  }`}
                                >
                                  {record.status === "present" && (
                                    <Check className="w-3.5 h-3.5 inline-block mr-1" />
                                  )}
                                  Present
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateStudentStatus(student.id, "absent")}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                    record.status === "absent"
                                      ? "bg-red-500/20 text-red-400 border border-red-500/40 shadow-sm shadow-red-950"
                                      : "bg-slate-900/60 text-slate-400 border border-white/5 hover:bg-slate-800 hover:text-white"
                                  }`}
                                >
                                  Absent
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateStudentStatus(student.id, "late")}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                    record.status === "late"
                                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm shadow-amber-950"
                                      : "bg-slate-900/60 text-slate-400 border border-white/5 hover:bg-slate-800 hover:text-white"
                                  }`}
                                >
                                  Late
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateStudentStatus(student.id, "excused")}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                    record.status === "excused"
                                      ? "bg-blue-500/20 text-blue-400 border border-blue-500/40 shadow-sm shadow-blue-950"
                                      : "bg-slate-900/60 text-slate-400 border border-white/5 hover:bg-slate-800 hover:text-white"
                                  }`}
                                >
                                  Excused
                                </button>
                              </div>
                            </td>

                            <td className="px-6 py-4 w-72">
                              <Input
                                placeholder="Add note or remark..."
                                value={record.note || ""}
                                onChange={(e) => updateStudentNote(student.id, e.target.value)}
                                className="h-8 text-xs bg-slate-900/50 border-white/10 text-white rounded-lg"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
