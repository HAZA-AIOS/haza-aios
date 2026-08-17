import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from "@haza-aios/ui";
import { StudentService } from "@/modules/education/sis/student.service";
import { EnrollmentService } from "@/modules/education/sis/enrollment.service";
import type { Student, Enrollment } from "@/modules/education/sis/sis.types";
import { useOrganization } from "@/org/use-organization";
import { usePathname } from "@/routes/navigation";
import { Link } from "@/routes/router";
import { AppShell } from "@/components/AppShell";
import { 
  ArrowLeft, User, GraduationCap, Users, 
  FileText, Activity, Clock, ShieldAlert, UploadCloud, File, Calendar 
} from "lucide-react";
import { EnrollmentDialog } from "./components/EnrollmentDialog";
import { AttendanceService } from "@/modules/education/sis/attendance.service";
import type { AttendanceSummary, AttendanceSession, AttendanceRecord } from "@/modules/education/sis/sis.types";

const TABS = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "personal", label: "Personal Info", icon: User },
  { id: "guardians", label: "Guardians", icon: Users },
  { id: "enrollment", label: "Enrollment & Class", icon: GraduationCap },
  { id: "status", label: "Status", icon: ShieldAlert },
  { id: "attendance", label: "Attendance", icon: Calendar },
  { id: "records", label: "Records", icon: FileText },
  { id: "documents", label: "Documents", icon: File },
  { id: "history", label: "History", icon: Clock },
];

export const StudentProfilePage: React.FC = () => {
  const { currentOrganization } = useOrganization();
  const pathname = usePathname();
  const studentId = pathname.split("/").pop(); // /workspace/education/students/:id

  const [student, setStudent] = useState<Student | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<{session: AttendanceSession, record: AttendanceRecord}[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  const fetchProfile = async () => {
    if (!currentOrganization || !studentId) return;
    setLoading(true);
    
    const [studentData, enrollmentsData, attSummary, attHistory] = await Promise.all([
      StudentService.getStudent(studentId, currentOrganization.id),
      EnrollmentService.getEnrollmentsByStudent(studentId, currentOrganization.id),
      AttendanceService.getStudentAttendanceSummary(currentOrganization.id, studentId),
      AttendanceService.getStudentAttendanceHistory(currentOrganization.id, studentId)
    ]);
    
    setStudent(studentData);
    setEnrollments(enrollmentsData);
    setAttendanceSummary(attSummary);
    setAttendanceHistory(attHistory);
    setLoading(false);
  };

  useEffect(() => {
    fetchProfile();
  }, [currentOrganization, studentId]);

  if (loading) return (
    <AppShell>
      <div className="flex h-64 items-center justify-center">
        <div className="relative flex h-8 w-8 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>
          <span className="relative inline-flex h-4 w-4 rounded-full bg-blue-500"></span>
        </div>
      </div>
    </AppShell>
  );

  if (!student) return (
    <AppShell>
      <div className="p-12 text-center text-red-400">Student not found.</div>
    </AppShell>
  );

  const activeEnrollment = enrollments.find(e => e.status === "active");

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-start gap-4 mb-2">
          <Link to="/workspace/education/students" className="text-slate-400 hover:text-white transition-colors mt-2">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              {student.firstName} {student.lastName}
              <Badge variant="secondary" className="border-white/10">{student.admissionNumber}</Badge>
              <Badge variant={student.status === "active" ? "default" : "secondary" as any}>{student.status}</Badge>
            </h1>
            <p className="text-slate-400 flex items-center gap-2 mt-2">
              <GraduationCap className="w-4 h-4" /> 
              {activeEnrollment ? `Grade: ${activeEnrollment.gradeId} | Section: ${activeEnrollment.sectionId}` : "Not actively enrolled"}
            </p>
          </div>
          <div className="flex gap-3">
            <EnrollmentDialog 
              student={student} 
              activeEnrollment={activeEnrollment} 
              onSuccess={fetchProfile}
            />
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-white/10 overflow-x-auto no-scrollbar">
          <nav className="flex space-x-1" aria-label="Tabs">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    whitespace-nowrap flex items-center py-4 px-4 text-sm font-medium border-b-2 transition-colors
                    ${isActive 
                      ? 'border-blue-500 text-blue-400 bg-blue-500/5' 
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-white/20 hover:bg-white/5'}
                  `}
                >
                  <Icon className={`w-4 h-4 mr-2 ${isActive ? 'text-blue-500' : 'text-slate-500'}`} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content Area */}
        <div className="mt-6">

          {/* 1. OVERVIEW TAB */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-[#0f141f] border-white/5">
                <CardHeader>
                  <CardTitle className="text-lg font-medium flex items-center gap-2">
                    <User className="w-5 h-5 text-blue-400" /> Student Snapshot
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-slate-400">Full Name</span>
                    <span className="text-slate-200 font-medium">{student.firstName} {student.middleName} {student.lastName}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-slate-400">Admission No.</span>
                    <span className="text-slate-200 font-medium font-mono">{student.admissionNumber}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-slate-400">Date of Birth</span>
                    <span className="text-slate-200 font-medium">{new Date(student.dateOfBirth).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-slate-400">Gender</span>
                    <span className="text-slate-200 font-medium capitalize">{student.gender.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="flex justify-between pb-2">
                    <span className="text-slate-400">Admission Date</span>
                    <span className="text-slate-200 font-medium">{new Date(student.admissionDate).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#0f141f] border-white/5">
                <CardHeader>
                  <CardTitle className="text-lg font-medium flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-purple-400" /> Current Enrollment
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  {activeEnrollment ? (
                    <div className="space-y-4">
                      <div className="flex justify-between border-b border-white/5 pb-2">
                        <span className="text-slate-400">Academic Year</span>
                        <span className="text-slate-200 font-medium">{activeEnrollment.academicYear}</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-2">
                        <span className="text-slate-400">Grade</span>
                        <span className="text-slate-200 font-medium">{activeEnrollment.gradeId}</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-2">
                        <span className="text-slate-400">Section</span>
                        <span className="text-slate-200 font-medium">{activeEnrollment.sectionId}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-slate-500">
                      <p>Student is not actively enrolled in any class.</p>
                      <p className="mt-2 text-xs">Use the Enroll action in the header to assign a class.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* 2. PERSONAL INFO TAB */}
          {activeTab === "personal" && (
            <Card className="bg-[#0f141f] border-white/5">
              <CardHeader>
                <CardTitle className="text-lg font-medium">Demographics & Medical</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 text-sm">
                <div>
                  <h4 className="text-slate-400 text-xs uppercase tracking-wider mb-3 border-b border-white/5 pb-1">Contact Details</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Email Address</span>
                      <span className="text-slate-200">{student.email || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Phone Number</span>
                      <span className="text-slate-200">Not provided</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Residential Address</span>
                      <span className="text-slate-200 text-right max-w-[200px]">123 School Lane, Cityville, Country</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="text-slate-400 text-xs uppercase tracking-wider mb-3 border-b border-white/5 pb-1">Medical & Special Needs</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Blood Group</span>
                      <span className="text-slate-200">O+</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Allergies</span>
                      <span className="text-slate-200">Peanuts</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Special Needs</span>
                      <span className="text-slate-200">None</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 3. GUARDIANS TAB */}
          {activeTab === "guardians" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {student.guardians.map(g => (
                <Card key={g.id} className="bg-[#0f141f] border-white/5">
                  <CardHeader>
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                      <Users className="w-4 h-4 text-emerald-400" /> {g.firstName} {g.lastName}
                      {g.isPrimaryContact && <Badge variant="default" className="ml-2 text-xs py-0 h-5">Primary</Badge>}
                      {g.isEmergencyContact && <Badge variant="destructive" className="ml-2 text-xs py-0 h-5">Emergency</Badge>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-slate-500 text-xs mb-1">Relationship</div>
                      <div className="capitalize text-slate-200">{g.relationship}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-xs mb-1">Phone</div>
                      <div className="text-slate-200">{g.phone}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-slate-500 text-xs mb-1">Email</div>
                      <div className="text-slate-200">{g.email}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button variant="outline" className="h-full min-h-[150px] border-dashed border-white/10 text-slate-400 hover:text-white bg-transparent hover:bg-white/5">
                + Add Guardian
              </Button>
            </div>
          )}

          {/* 4. ENROLLMENT & CLASS TAB */}
          {activeTab === "enrollment" && (
            <div className="space-y-6">
              <Card className="bg-[#0f141f] border-white/5">
                <CardHeader>
                  <CardTitle className="text-lg font-medium">Academic Enrollments</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm text-left text-slate-300">
                    <thead className="text-xs uppercase bg-slate-900/50 text-slate-400">
                      <tr>
                        <th className="px-6 py-4 font-medium">Academic Year</th>
                        <th className="px-6 py-4 font-medium">Grade & Section</th>
                        <th className="px-6 py-4 font-medium">Status</th>
                        <th className="px-6 py-4 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {enrollments.map(enr => (
                        <tr key={enr.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-6 py-4 font-medium text-slate-200">{enr.academicYear}</td>
                          <td className="px-6 py-4">Grade {enr.gradeId} - {enr.sectionId}</td>
                          <td className="px-6 py-4">
                            <Badge variant={enr.status === "active" ? "default" : "secondary" as any}>{enr.status}</Badge>
                          </td>
                          <td className="px-6 py-4">{new Date(enr.enrollmentDate).toLocaleDateString()}</td>
                        </tr>
                      ))}
                      {enrollments.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-slate-500">No enrollment history found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 5. STATUS TAB */}
          {activeTab === "status" && (
            <Card className="bg-[#0f141f] border-white/5 max-w-2xl">
              <CardHeader>
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-amber-500" /> Lifecycle Status Management
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-slate-900 rounded-xl border border-white/5">
                  <div>
                    <p className="text-sm font-medium text-white">Current Status</p>
                    <p className="text-xs text-slate-400 mt-1">Determine if the student has access to the portal and active classes.</p>
                  </div>
                  <Badge variant={student.status === "active" ? "default" : "secondary" as any} className="text-sm px-3 py-1">
                    {student.status.toUpperCase()}
                  </Badge>
                </div>
                <div className="space-y-3 pt-4 border-t border-white/10">
                  <h4 className="text-sm font-medium text-slate-300">Change Status</h4>
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1 bg-transparent hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30">Suspend</Button>
                    <Button variant="outline" className="flex-1 bg-transparent hover:bg-blue-500/10 hover:text-blue-400 hover:border-blue-500/30">Mark as Alumni</Button>
                    <Button variant="outline" className="flex-1 bg-transparent hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/30">Activate</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 6. RECORDS TAB */}
          {activeTab === "records" && (
            <Card className="bg-[#0f141f] border-white/5">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-medium">Behavioral & Academic Records</CardTitle>
                <Button size="sm">Add Record</Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="py-12 flex flex-col items-center justify-center text-slate-500 border-t border-white/5">
                  <FileText className="w-12 h-12 mb-3 text-slate-700" />
                  <p>No records have been filed for this student.</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ATTENDANCE TAB */}
          {activeTab === "attendance" && (
            <div className="space-y-6">
              <Card className="bg-[#0f141f] border-white/5">
                <CardHeader>
                  <CardTitle className="text-lg font-medium">Attendance Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5 text-center">
                      <div className="text-3xl font-bold text-white mb-1">
                        {attendanceSummary?.attendancePercentage ?? 0}%
                      </div>
                      <div className="text-xs text-slate-400 uppercase tracking-wider">Overall</div>
                    </div>
                    <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20 text-center">
                      <div className="text-3xl font-bold text-emerald-400 mb-1">
                        {attendanceSummary?.present ?? 0}
                      </div>
                      <div className="text-xs text-emerald-500/70 uppercase tracking-wider">Present</div>
                    </div>
                    <div className="bg-red-500/10 p-4 rounded-xl border border-red-500/20 text-center">
                      <div className="text-3xl font-bold text-red-400 mb-1">
                        {attendanceSummary?.absent ?? 0}
                      </div>
                      <div className="text-xs text-red-500/70 uppercase tracking-wider">Absent</div>
                    </div>
                    <div className="bg-amber-500/10 p-4 rounded-xl border border-amber-500/20 text-center">
                      <div className="text-3xl font-bold text-amber-400 mb-1">
                        {attendanceSummary?.late ?? 0}
                      </div>
                      <div className="text-xs text-amber-500/70 uppercase tracking-wider">Late</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#0f141f] border-white/5">
                <CardHeader>
                  <CardTitle className="text-lg font-medium">Recent History</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {attendanceHistory.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">No attendance records found.</div>
                  ) : (
                    <table className="w-full text-sm text-left text-slate-300">
                      <thead className="text-xs uppercase bg-slate-900/50 text-slate-400">
                        <tr>
                          <th className="px-6 py-4 font-medium">Date</th>
                          <th className="px-6 py-4 font-medium">Class / Session</th>
                          <th className="px-6 py-4 font-medium">Status</th>
                          <th className="px-6 py-4 font-medium">Note</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {attendanceHistory.slice(0, 10).map((item, i) => (
                          <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                            <td className="px-6 py-4 font-medium text-white">
                              {new Date(item.session.date).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4">
                              {item.session.gradeId} / {item.session.sectionId} ({item.session.sessionType})
                            </td>
                            <td className="px-6 py-4">
                              <Badge variant={
                                item.record.status === 'present' ? 'success' :
                                item.record.status === 'absent' ? 'destructive' :
                                item.record.status === 'late' ? 'warning' : 'secondary'
                              } className="capitalize">
                                {item.record.status}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 text-slate-400">
                              {item.record.note || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* 7. DOCUMENTS TAB */}
          {activeTab === "documents" && (
            <Card className="bg-[#0f141f] border-white/5">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-medium">Document Repository</CardTitle>
                <Button size="sm" variant="secondary" className="flex items-center gap-2">
                  <UploadCloud className="w-4 h-4" /> Upload
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {/* Mock Document Card */}
                  <div className="flex items-start gap-3 p-4 bg-slate-900 rounded-xl border border-white/5 hover:bg-slate-800 transition-colors cursor-pointer group">
                    <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg group-hover:scale-110 transition-transform">
                      <File className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200">Birth Certificate</p>
                      <p className="text-xs text-slate-500 mt-1">PDF • 2.4 MB</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-slate-900 rounded-xl border border-white/5 hover:bg-slate-800 transition-colors cursor-pointer group">
                    <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg group-hover:scale-110 transition-transform">
                      <File className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200">Previous Transcript</p>
                      <p className="text-xs text-slate-500 mt-1">PDF • 1.1 MB</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 8. HISTORY TAB */}
          {activeTab === "history" && (
            <Card className="bg-[#0f141f] border-white/5">
              <CardHeader>
                <CardTitle className="text-lg font-medium">Audit History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
                  <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white/10 bg-slate-900 text-emerald-400 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl bg-slate-900/50 border border-white/5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-200 text-sm">Student Admitted</span>
                        <time className="text-xs text-slate-500">Today</time>
                      </div>
                      <p className="text-xs text-slate-400">Profile created and admission number assigned.</p>
                    </div>
                  </div>
                  
                  {activeEnrollment && (
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white/10 bg-slate-900 text-blue-400 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl bg-slate-900/50 border border-white/5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-slate-200 text-sm">Enrolled in Class</span>
                          <time className="text-xs text-slate-500">Today</time>
                        </div>
                        <p className="text-xs text-slate-400">Enrolled into Grade {activeEnrollment.gradeId} Section {activeEnrollment.sectionId}.</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </AppShell>
  );
};

