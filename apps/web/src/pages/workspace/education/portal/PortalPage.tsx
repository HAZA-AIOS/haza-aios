import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { useCurrentUser } from "@/auth/use-auth";
import { useOrganization } from "@/org/use-organization";
import { navigate } from "@/routes/navigation";
import { Link } from "@/routes/router";
import { PortalService } from "@/modules/education/sis/portal.service";
import { CommunicationService } from "@/modules/education/sis/communication.service";
import type {
  ParentPortalDashboard,
  PortalActor,
  PortalStudentDashboard,
  PortalUpdateRequest,
  PortalUpdateRequestType,
  StudentPortalDashboard,
} from "@/modules/education/sis/sis.types";
import {
  AdminPageHeader,
  AnnouncementPriorityBadge,
  AttendanceStatusBadge,
  Badge,
  Button,
  Card,
  CardContent,
  GradeBadge,
  Input,
  InvoiceStatusBadge,
  PortalChildSelectorCard,
  ResultStatusBadge,
  Select,
} from "@haza-aios/ui";
import {
  ArrowLeft,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  Filter,
  GraduationCap,
  MessageSquare,
  ShieldCheck,
  UserRound,
} from "lucide-react";

type PortalMode = "parent" | "student";
type PortalTab = "home" | "academics" | "attendance" | "timetable" | "results" | "fees" | "messages" | "notifications" | "requests";

interface PortalPageProps {
  mode: PortalMode;
}

const allTabLabels: Array<{ id: PortalTab; label: string }> = [
  { id: "home", label: "Home" },
  { id: "academics", label: "Academics" },
  { id: "attendance", label: "Attendance" },
  { id: "timetable", label: "Timetable" },
  { id: "results", label: "Results" },
  { id: "fees", label: "Fees" },
  { id: "messages", label: "Messages" },
  { id: "notifications", label: "Notifications" },
  { id: "requests", label: "Requests" },
];

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatCurrency(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export function PortalPage({ mode }: PortalPageProps) {
  const user = useCurrentUser();
  const { currentOrganization } = useOrganization();
  const [activeTab, setActiveTab] = useState<PortalTab>("home");
  const [parentDashboard, setParentDashboard] = useState<ParentPortalDashboard | null>(null);
  const [studentDashboard, setStudentDashboard] = useState<StudentPortalDashboard | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [requests, setRequests] = useState<PortalUpdateRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestForm, setRequestForm] = useState({
    type: "contact_update" as PortalUpdateRequestType,
    subject: "Contact update request",
    details: "Please review this requested profile/contact change.",
  });

  const actor = useMemo<PortalActor | null>(() => {
    if (!currentOrganization || !user) return null;
    return { organizationId: currentOrganization.id, userId: user.id, role: mode };
  }, [currentOrganization, mode, user]);

  const dashboard = mode === "parent" ? parentDashboard?.selectedStudent : studentDashboard;
  const linkedStudents = parentDashboard?.linkedStudents || [];

  const loadPortal = useCallback(async () => {
    if (!actor) return;
    setIsLoading(true);
    setError(null);
    try {
      if (mode === "parent") {
        const data = await PortalService.getParentDashboard(actor, selectedStudentId || undefined);
        setParentDashboard(data);
        if (!selectedStudentId && data.linkedStudents[0]) setSelectedStudentId(data.linkedStudents[0].id);
      } else {
        setStudentDashboard(await PortalService.getStudentDashboard(actor));
      }
      setRequests(await PortalService.getUpdateRequests(actor));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Portal access is not available for this account.");
      setParentDashboard(null);
      setStudentDashboard(null);
    } finally {
      setIsLoading(false);
    }
  }, [actor, mode, selectedStudentId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPortal();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadPortal]);

  // If student portal and finance is not visible by policy, hide the Fees tab completely
  const availableTabs = useMemo(() => {
    if (mode === "student" && (!dashboard || !dashboard.finance?.visible)) {
      return allTabLabels.filter((tab) => tab.id !== "fees");
    }
    return allTabLabels;
  }, [mode, dashboard]);

  useEffect(() => {
    if (!availableTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab("home");
    }
  }, [availableTabs, activeTab]);

  async function submitRequest() {
    if (!actor) return;
    setMessage(null);
    setError(null);
    try {
      await PortalService.submitUpdateRequest(actor, {
        studentId: dashboard?.student.id,
        type: requestForm.type,
        subject: requestForm.subject,
        details: requestForm.details,
      });
      setMessage("Update request submitted for school review.");
      await loadPortal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit request.");
    }
  }

  const handleNotificationRead = useCallback(() => {
    void loadPortal();
  }, [loadPortal]);

  return (
    <AppShell>
      <div className="max-w-7xl space-y-6">
        <AdminPageHeader
          title={mode === "parent" ? "Parent Portal" : "Student Portal"}
          description={
            mode === "parent"
              ? "Secure self-service access for verified linked children, attendance summaries, timetables, published results, and school communication."
              : "Secure self-service access to your verified academic records, class timetable, published examination results, and notifications."
          }
          breadcrumbs={[
            { label: "Workspace", onClick: () => navigate("/workspace") },
            { label: "Education" },
            { label: mode === "parent" ? "Parent Portal" : "Student Portal" },
          ]}
          actions={
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                Backend Verified
              </Badge>
            </div>
          }
        />

        <Link to="/workspace" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Workspace
        </Link>

        {message && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{message}</span>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <span>{error}</span>
          </div>
        )}

        {mode === "parent" && linkedStudents.length > 0 && (
          <Card className="border-white/5 bg-[#0f141f]">
            <CardContent className="space-y-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-red-400" />
                  <span className="text-sm font-semibold uppercase tracking-wider text-slate-300">Linked Children</span>
                </div>
                <Badge variant="secondary">{linkedStudents.length} verified</Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {linkedStudents.map((child) => (
                  <PortalChildSelectorCard
                    key={child.id}
                    student={child}
                    isSelected={selectedStudentId === child.id}
                    onSelect={() => setSelectedStudentId(child.id)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap gap-2">
          {availableTabs.map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? "default" : "outline"}
              onClick={() => setActiveTab(tab.id)}
              className="transition-all"
            >
              {tab.label}
              {tab.id === "notifications" && dashboard && dashboard.communication.unreadNotifications > 0 && (
                <span className="ml-1.5 rounded-full bg-red-500 px-1.5 py-0.2 text-[10px] font-bold text-white">
                  {dashboard.communication.unreadNotifications}
                </span>
              )}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <Card className="border-white/5 bg-[#0f141f]">
            <CardContent className="p-12 text-center text-slate-400">
              <div className="inline-block size-6 animate-spin rounded-full border-2 border-red-500 border-t-transparent mb-3" />
              <p>Loading portal information...</p>
            </CardContent>
          </Card>
        ) : !dashboard ? (
          <Card className="border-white/5 bg-[#0f141f]">
            <CardContent className="p-12 text-center text-slate-400">
              <UserRound className="mx-auto h-10 w-10 text-slate-600 mb-3" />
              <p className="text-base font-medium text-slate-300">
                {mode === "parent"
                  ? "No linked children are currently authorized for this guardian account."
                  : "No student academic record is linked to this account."}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Contact your school administrator to link and verify your student account.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {activeTab === "home" && <HomeTab dashboard={dashboard} mode={mode} onNavigateTab={setActiveTab} />}
            {activeTab === "academics" && <AcademicsTab dashboard={dashboard} />}
            {activeTab === "attendance" && <AttendanceTab dashboard={dashboard} />}
            {activeTab === "timetable" && <TimetableTab dashboard={dashboard} />}
            {activeTab === "results" && <ResultsTab dashboard={dashboard} />}
            {activeTab === "fees" && <FeesTab dashboard={dashboard} />}
            {activeTab === "messages" && <MessagesTab dashboard={dashboard} />}
            {activeTab === "notifications" && (
              <NotificationsTab
                dashboard={dashboard}
                actor={actor}
                onNotificationRead={handleNotificationRead}
              />
            )}
            {activeTab === "requests" && (
              <RequestsTab
                form={requestForm}
                requests={requests}
                onChange={setRequestForm}
                onSubmit={submitRequest}
              />
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function HomeTab({
  dashboard,
  mode,
  onNavigateTab,
}: {
  dashboard: PortalStudentDashboard;
  mode: PortalMode;
  onNavigateTab: (tab: PortalTab) => void;
}) {
  const latestResult = dashboard.results[0] || dashboard.assessments[0];
  const upcomingTimetable = dashboard.timetable.slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={<UserRound className="h-5 w-5" />}
          label={mode === "parent" ? "Selected Child" : "Student Name"}
          value={dashboard.student.displayName}
          subtext={`#${dashboard.student.admissionNumber}`}
        />
        <SummaryCard
          icon={<GraduationCap className="h-5 w-5" />}
          label="Class & Section"
          value={[dashboard.student.gradeName, dashboard.student.sectionName].filter(Boolean).join(" - ") || "Not Enrolled"}
          subtext={dashboard.student.academicYear || "Active Year"}
        />
        <SummaryCard
          icon={<CalendarDays className="h-5 w-5" />}
          label="Attendance Rate"
          value={`${dashboard.attendance.attendancePercentage}%`}
          subtext={`${dashboard.attendance.present} Present / ${dashboard.attendance.absent} Absent`}
        />
        <SummaryCard
          icon={<Bell className="h-5 w-5" />}
          label="Notifications"
          value={dashboard.communication.unreadNotifications}
          subtext="Unread Messages"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-white/5 bg-[#0f141f]">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-white">
                <Clock className="h-5 w-5 text-red-400" />
                Next Timetable Classes
              </h2>
              <Button variant="ghost" size="sm" onClick={() => onNavigateTab("timetable")} className="text-xs text-slate-400 hover:text-white">
                View Full
              </Button>
            </div>
            {upcomingTimetable.length === 0 ? (
              <div className="rounded-xl border border-white/5 py-8 text-center text-sm text-slate-500">
                No scheduled classes for this student.
              </div>
            ) : (
              <div className="divide-y divide-white/5 rounded-xl border border-white/5 bg-slate-950/40">
                {upcomingTimetable.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-4 p-3.5">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-white">{item.subjectName}</p>
                      <p className="truncate text-xs text-slate-400">
                        {dayNames[item.dayOfWeek]} • {item.periodName} ({item.startTime}-{item.endTime})
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-medium text-slate-300">{item.teacherName}</p>
                      <p className="text-[10px] text-slate-500">{item.roomId || "Room TBA"}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/5 bg-[#0f141f]">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-white">
                <GraduationCap className="h-5 w-5 text-red-400" />
                Recent Academic Results
              </h2>
              <Button variant="ghost" size="sm" onClick={() => onNavigateTab("results")} className="text-xs text-slate-400 hover:text-white">
                All Results
              </Button>
            </div>
            {!latestResult ? (
              <div className="rounded-xl border border-white/5 py-8 text-center text-sm text-slate-500">
                No published examination results available yet.
              </div>
            ) : (
              <div className="rounded-xl border border-white/5 bg-slate-950/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase text-slate-500">{latestResult.sourceName}</span>
                  {latestResult.grade && <GradeBadge grade={latestResult.grade} />}
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-semibold text-white">{latestResult.subjectName}</span>
                  <span className="text-sm font-semibold text-emerald-400">
                    {latestResult.obtainedMarks} / {latestResult.maximumMarks} ({latestResult.percentage}%)
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-white/5">
                  <span>Status:</span>
                  <ResultStatusBadge status={latestResult.passed ? "passed" : "review"} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AcademicsTab({ dashboard }: { dashboard: PortalStudentDashboard }) {
  const student = dashboard.student;
  return (
    <Card className="border-white/5 bg-[#0f141f]">
      <CardContent className="space-y-6 p-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Academic Profile</h2>
          <p className="text-xs text-slate-400">Verified student enrollment and institutional record details.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          <Info label="Full Name" value={student.displayName} />
          <Info label="Admission Number" value={student.admissionNumber} />
          <Info label="Enrollment Status" value={student.status} highlight />
          <Info label="Academic Year" value={student.academicYear || "Not Assigned"} />
          <Info label="Class / Grade" value={student.gradeName || "Not Assigned"} />
          <Info label="Section" value={student.sectionName || "Not Assigned"} />
          <Info label="Registered Email" value={student.email || "None on file"} />
          <Info label="Contact Phone" value={student.phone || "None on file"} />
          <Info label="Security Protocol" value="Encrypted Central RBAC" />
        </div>
      </CardContent>
    </Card>
  );
}

function AttendanceTab({ dashboard }: { dashboard: PortalStudentDashboard }) {
  const summary = dashboard.attendance;
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const filteredHistory = useMemo(() => {
    return dashboard.attendanceHistory.filter(({ session, record }) => {
      if (statusFilter !== "all" && record.status !== statusFilter) return false;
      if (fromDate && session.date < fromDate) return false;
      if (toDate && session.date > toDate) return false;
      return true;
    });
  }, [dashboard.attendanceHistory, statusFilter, fromDate, toDate]);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard icon={<CalendarDays className="h-5 w-5" />} label="Present" value={summary.present} />
        <SummaryCard icon={<CalendarDays className="h-5 w-5" />} label="Absent" value={summary.absent} />
        <SummaryCard icon={<CalendarDays className="h-5 w-5" />} label="Late" value={summary.late} />
        <SummaryCard icon={<CalendarDays className="h-5 w-5" />} label="Excused" value={summary.excused} />
        <SummaryCard icon={<CalendarDays className="h-5 w-5" />} label="Percentage" value={`${summary.attendancePercentage}%`} />
      </div>

      <Card className="border-white/5 bg-[#0f141f]">
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-4">
            <div>
              <h2 className="text-base font-semibold text-white">Attendance History</h2>
              <p className="text-xs text-slate-400">Verified attendance session entries. Read-only record.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Filter className="h-3.5 w-3.5 text-slate-400" />
                <span>Filter:</span>
              </div>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-8 text-xs max-w-[130px]"
              >
                <option value="all">All Statuses</option>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="late">Late</option>
                <option value="excused">Excused</option>
              </Select>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                placeholder="From Date"
                className="h-8 text-xs max-w-[140px]"
              />
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                placeholder="To Date"
                className="h-8 text-xs max-w-[140px]"
              />
              {(statusFilter !== "all" || fromDate || toDate) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStatusFilter("all");
                    setFromDate("");
                    setToDate("");
                  }}
                  className="h-8 text-xs text-slate-400 hover:text-white"
                >
                  Reset
                </Button>
              )}
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="rounded-xl border border-white/5 py-12 text-center text-sm text-slate-500">
              No attendance records found matching the selected filters.
            </div>
          ) : (
            <div className="divide-y divide-white/5 rounded-xl border border-white/5 bg-slate-950/40">
              {filteredHistory.map(({ session, record }) => (
                <div key={record.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-white">{session.date}</p>
                    <p className="text-xs text-slate-400 capitalize">
                      {session.sessionType} session {record.note ? `• ${record.note}` : ""}
                    </p>
                  </div>
                  <AttendanceStatusBadge status={record.status as "present" | "absent" | "late" | "excused"} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TimetableTab({ dashboard }: { dashboard: PortalStudentDashboard }) {
  const [selectedDay, setSelectedDay] = useState<string>("all");

  const filteredEntries = useMemo(() => {
    if (selectedDay === "all") return dashboard.timetable;
    return dashboard.timetable.filter((item) => String(item.dayOfWeek) === selectedDay);
  }, [dashboard.timetable, selectedDay]);

  return (
    <Card className="border-white/5 bg-[#0f141f]">
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-4">
          <div>
            <h2 className="text-base font-semibold text-white">Class Timetable</h2>
            <p className="text-xs text-slate-400">Current schedule based on verified class and section enrollment.</p>
          </div>
          <Select
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
            className="h-8 text-xs max-w-[150px]"
          >
            <option value="all">All Days</option>
            <option value="1">Monday</option>
            <option value="2">Tuesday</option>
            <option value="3">Wednesday</option>
            <option value="4">Thursday</option>
            <option value="5">Friday</option>
            <option value="6">Saturday</option>
            <option value="0">Sunday</option>
          </Select>
        </div>

        {filteredEntries.length === 0 ? (
          <div className="rounded-xl border border-white/5 py-12 text-center text-sm text-slate-500">
            No timetable entries scheduled for this selection.
          </div>
        ) : (
          <div className="divide-y divide-white/5 rounded-xl border border-white/5 bg-slate-950/40">
            {filteredEntries.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{item.subjectName}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {dayNames[item.dayOfWeek]}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {item.periodName} • {item.startTime} - {item.endTime} • Teacher: {item.teacherName}
                  </p>
                </div>
                <Badge variant="default" className="border-white/10 text-slate-300">
                  {item.roomId || "Room TBA"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ResultsTab({ dashboard }: { dashboard: PortalStudentDashboard }) {
  return (
    <div className="space-y-6">
      <Card className="border-white/5 bg-[#0f141f]">
        <CardContent className="space-y-4 p-6">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-white">
              <FileText className="h-5 w-5 text-red-400" />
              Published Examination Results
            </h2>
            <p className="text-xs text-slate-400">
              Only verified results published by school administration are displayed. Draft records are excluded.
            </p>
          </div>

          {dashboard.results.length === 0 ? (
            <div className="rounded-xl border border-white/5 py-10 text-center text-sm text-slate-500">
              No published examination results available.
            </div>
          ) : (
            <div className="divide-y divide-white/5 rounded-xl border border-white/5 bg-slate-950/40">
              {dashboard.results.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-white">{item.subjectName}</p>
                      {item.grade && <GradeBadge grade={item.grade} />}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {item.sourceName} • {item.obtainedMarks} / {item.maximumMarks} marks ({item.percentage}%)
                      {item.remarks ? ` • ${item.remarks}` : ""}
                    </p>
                  </div>
                  <ResultStatusBadge status={item.passed ? "passed" : "review"} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-white/5 bg-[#0f141f]">
        <CardContent className="space-y-4 p-6">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-white">
              <GraduationCap className="h-5 w-5 text-red-400" />
              Published Assessments
            </h2>
            <p className="text-xs text-slate-400">Class quizzes, assignments and term assessments published for review.</p>
          </div>

          {dashboard.assessments.length === 0 ? (
            <div className="rounded-xl border border-white/5 py-10 text-center text-sm text-slate-500">
              No published assessments available.
            </div>
          ) : (
            <div className="divide-y divide-white/5 rounded-xl border border-white/5 bg-slate-950/40">
              {dashboard.assessments.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-white">{item.subjectName}</p>
                      {item.grade && <GradeBadge grade={item.grade} />}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {item.sourceName} • {item.obtainedMarks} / {item.maximumMarks} ({item.percentage}%)
                      {item.remarks ? ` • ${item.remarks}` : ""}
                    </p>
                  </div>
                  <Badge variant="secondary">Assessment</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FeesTab({ dashboard }: { dashboard: PortalStudentDashboard }) {
  if (!dashboard.finance.visible) {
    return (
      <Card className="border-white/5 bg-[#0f141f]">
        <CardContent className="p-8 text-center text-slate-400">
          Fee visibility is restricted by organization policy for this portal account.
        </CardContent>
      </Card>
    );
  }

  const totalPaidCents = dashboard.finance.invoices.reduce((sum, inv) => sum + (inv.paidAmountCents || 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          icon={<CreditCard className="h-5 w-5" />}
          label="Outstanding Balance"
          value={formatCurrency(dashboard.finance.outstandingCents, dashboard.finance.invoices[0]?.currency)}
          subtext="Total pending fees"
        />
        <SummaryCard
          icon={<CreditCard className="h-5 w-5" />}
          label="Overdue Balance"
          value={formatCurrency(dashboard.finance.overdueCents, dashboard.finance.invoices[0]?.currency)}
          subtext="Past due date"
        />
        <SummaryCard
          icon={<CreditCard className="h-5 w-5" />}
          label="Total Paid"
          value={formatCurrency(totalPaidCents, dashboard.finance.invoices[0]?.currency)}
          subtext="Verified receipts"
        />
      </div>

      <RecordList
        title="Invoices & Statements"
        rows={dashboard.finance.invoices.map((invoice) => ({
          id: invoice.id,
          title: invoice.invoiceNumber,
          meta: `Total ${formatCurrency(invoice.totalCents, invoice.currency)} • Balance ${formatCurrency(invoice.balanceCents, invoice.currency)} • Due ${invoice.dueDate}`,
          statusComponent: <InvoiceStatusBadge status={invoice.status} />,
        }))}
        empty="No issued invoices on record."
      />

      <RecordList
        title="Payment History"
        rows={dashboard.finance.payments.map((payment) => ({
          id: payment.id,
          title: payment.referenceNumber || `Payment #${payment.id.slice(0, 8)}`,
          meta: `${formatCurrency(payment.amountCents)} on ${payment.paymentDate} via ${payment.paymentMethod}`,
          statusComponent: <Badge variant="secondary">{payment.status}</Badge>,
        }))}
        empty="No recorded payment transactions."
      />

      <RecordList
        title="Receipts"
        rows={dashboard.finance.receipts.map((receipt) => ({
          id: receipt.id,
          title: receipt.receiptNumber,
          meta: `${formatCurrency(receipt.amountCents)} issued on ${receipt.receiptDate} (${receipt.paymentMethod})`,
          statusComponent: <Badge variant="secondary">Verified</Badge>,
        }))}
        empty="No receipts available."
      />

      <div className="rounded-xl border border-white/5 bg-slate-950/40 p-4 text-xs text-slate-500">
        Financial records in the portal are strictly read-only. Online payment processing is managed by institution accounts.
      </div>
    </div>
  );
}

function MessagesTab({ dashboard }: { dashboard: PortalStudentDashboard }) {
  return (
    <div className="space-y-6">
      <Card className="border-white/5 bg-[#0f141f]">
        <CardContent className="space-y-4 p-6">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-white">
              <MessageSquare className="h-5 w-5 text-red-400" />
              School Announcements
            </h2>
            <p className="text-xs text-slate-400">Institutional announcements broadcast to your academic scope.</p>
          </div>
          {dashboard.communication.announcements.length === 0 ? (
            <div className="rounded-xl border border-white/5 py-8 text-center text-sm text-slate-500">
              No announcements for this portal.
            </div>
          ) : (
            <div className="divide-y divide-white/5 rounded-xl border border-white/5 bg-slate-950/40">
              {dashboard.communication.announcements.map((item) => (
                <div key={item.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-white">{item.title}</p>
                    <AnnouncementPriorityBadge priority={item.priority} />
                  </div>
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">{item.content}</p>
                  {item.publishedAt && (
                    <p className="text-[10px] text-slate-500">Published {item.publishedAt.slice(0, 10)}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <RecordList
        title="Direct Messages"
        rows={dashboard.communication.messages.map((item) => ({
          id: item.id,
          title: item.subject,
          meta: item.body,
          statusComponent: <Badge variant="secondary">{item.priority}</Badge>,
        }))}
        empty="No direct message history available."
      />
    </div>
  );
}

function NotificationsTab({
  dashboard,
  actor,
  onNotificationRead,
}: {
  dashboard: PortalStudentDashboard;
  actor: PortalActor | null;
  onNotificationRead: () => void;
}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const notifications = dashboard.communication.notifications;
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  async function markOneRead(id: string) {
    if (!actor) return;
    setIsProcessing(true);
    try {
      const recipient = actor.role === "student"
        ? { kind: "student" as const, id: dashboard.student.id }
        : { kind: "guardian" as const, id: actor.userId };
      await CommunicationService.markNotificationRead(actor.organizationId, id, recipient);
      onNotificationRead();
    } catch {
      // error handled silently
    } finally {
      setIsProcessing(false);
    }
  }

  async function markAllRead() {
    if (!actor) return;
    setIsProcessing(true);
    try {
      const recipient = actor.role === "student"
        ? { kind: "student" as const, id: dashboard.student.id }
        : { kind: "guardian" as const, id: actor.userId };
      await CommunicationService.markAllNotificationsRead(actor.organizationId, recipient);
      onNotificationRead();
    } catch {
      // error handled silently
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <Card className="border-white/5 bg-[#0f141f]">
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-white">
              <Bell className="h-5 w-5 text-red-400" />
              Notifications
            </h2>
            <p className="text-xs text-slate-400">Important alerts and notices for your account.</p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              disabled={isProcessing}
              onClick={markAllRead}
              className="text-xs"
            >
              Mark All Read ({unreadCount})
            </Button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="rounded-xl border border-white/5 py-12 text-center text-sm text-slate-500">
            No notifications available.
          </div>
        ) : (
          <div className="divide-y divide-white/5 rounded-xl border border-white/5 bg-slate-950/40">
            {notifications.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-white">{item.title}</p>
                    {!item.isRead && (
                      <span className="size-2 rounded-full bg-red-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-slate-300 mt-1">{item.message}</p>
                  {item.createdAt && (
                    <p className="text-[10px] text-slate-500 mt-1">{item.createdAt.slice(0, 10)}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={item.isRead ? "default" : "secondary"}>
                    {item.isRead ? "Read" : "Unread"}
                  </Badge>
                  {!item.isRead && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isProcessing}
                      onClick={() => markOneRead(item.id)}
                      className="h-7 text-xs text-slate-400 hover:text-white"
                    >
                      Mark Read
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RequestsTab({
  form,
  requests,
  onChange,
  onSubmit,
}: {
  form: { type: PortalUpdateRequestType; subject: string; details: string };
  requests: PortalUpdateRequest[];
  onChange: (form: { type: PortalUpdateRequestType; subject: string; details: string }) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="border-white/5 bg-[#0f141f]">
        <CardContent className="space-y-4 p-6">
          <div>
            <h2 className="text-base font-semibold text-white">Submit Update Request</h2>
            <p className="text-xs text-slate-400">Request contact or profile changes for administration review.</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400">Request Type</label>
            <Select
              value={form.type}
              onChange={(event) => onChange({ ...form, type: event.target.value as PortalUpdateRequestType })}
            >
              <option value="contact_update">Contact Update</option>
              <option value="profile_update">Profile Update</option>
              <option value="communication_preference">Communication Preference</option>
              <option value="other">Other</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400">Subject</label>
            <Input
              value={form.subject}
              onChange={(event) => onChange({ ...form, subject: event.target.value })}
              placeholder="Brief summary of request"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400">Details</label>
            <textarea
              className="min-h-32 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500"
              value={form.details}
              onChange={(event) => onChange({ ...form, details: event.target.value })}
              placeholder="Provide exact details of the requested change..."
            />
          </div>
          <Button onClick={onSubmit} className="w-full">
            Submit Request
          </Button>
        </CardContent>
      </Card>

      <div className="lg:col-span-2">
        <RecordList
          title="Submitted Requests"
          rows={requests.map((request) => ({
            id: request.id,
            title: request.subject,
            meta: `Type: ${request.type} • Details: ${request.details}`,
            statusComponent: <Badge variant="secondary">{request.status}</Badge>,
          }))}
          empty="No update requests submitted yet."
        />
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  subtext,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
}) {
  return (
    <Card className="border-white/5 bg-[#0f141f] transition-all hover:border-white/10">
      <CardContent className="flex min-h-28 items-center justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-1 truncate text-xl font-bold text-white">{value}</p>
          {subtext && <p className="text-xs text-slate-400 mt-0.5 truncate">{subtext}</p>}
        </div>
        <div className="shrink-0 rounded-xl bg-red-500/10 p-3 text-red-400 border border-red-500/20">{icon}</div>
      </CardContent>
    </Card>
  );
}

function Info({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-slate-950/40 p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${highlight ? "text-emerald-400" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}

function RecordList({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Array<{ id: string; title: string; meta: string; statusComponent?: ReactNode }>;
  empty: string;
}) {
  return (
    <Card className="border-white/5 bg-[#0f141f]">
      <CardContent className="space-y-4 p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold text-white">
          <FileText className="h-5 w-5 text-red-400" />
          {title}
        </h2>
        {rows.length === 0 ? (
          <div className="rounded-xl border border-white/5 py-8 text-center text-sm text-slate-500">{empty}</div>
        ) : (
          <div className="divide-y divide-white/5 rounded-xl border border-white/5 bg-slate-950/40">
            {rows.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">{row.title}</p>
                  <p className="truncate text-xs text-slate-400 mt-0.5">{row.meta}</p>
                </div>
                {row.statusComponent}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ParentPortalPage() {
  return <PortalPage mode="parent" />;
}

export function StudentSelfServicePortalPage() {
  return <PortalPage mode="student" />;
}
