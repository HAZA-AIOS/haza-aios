import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { useCurrentUser } from "@/auth/use-auth";
import { useOrganization } from "@/org/use-organization";
import { navigate } from "@/routes/navigation";
import { Link } from "@/routes/router";
import { PortalService } from "@/modules/education/sis/portal.service";
import type {
  ParentPortalDashboard,
  PortalActor,
  PortalStudentDashboard,
  PortalUpdateRequest,
  PortalUpdateRequestType,
  StudentPortalDashboard,
} from "@/modules/education/sis/sis.types";
import { AdminPageHeader, Badge, Button, Card, CardContent, Input, Select } from "@haza-aios/ui";
import { ArrowLeft, Bell, CalendarDays, CreditCard, FileText, GraduationCap, UserRound } from "lucide-react";

type PortalMode = "parent" | "student";
type PortalTab = "home" | "academics" | "attendance" | "timetable" | "results" | "fees" | "messages" | "notifications" | "requests";

interface PortalPageProps {
  mode: PortalMode;
}

const tabLabels: Array<{ id: PortalTab; label: string }> = [
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

  return (
    <AppShell>
      <div className="max-w-7xl space-y-6">
        <AdminPageHeader
          title={mode === "parent" ? "Parent Portal" : "Student Portal"}
          description={mode === "parent" ? "Secure self-service access for linked children, school updates, fees, and academic progress." : "Secure self-service access to your own academic profile, timetable, results, and notifications."}
          breadcrumbs={[{ label: "Workspace", onClick: () => navigate("/workspace") }, { label: "Education" }, { label: mode === "parent" ? "Parent Portal" : "Student Portal" }]}
          actions={<Badge variant="secondary">Relationship Protected</Badge>}
        />

        <Link to="/workspace" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to Workspace
        </Link>

        {message && <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{message}</div>}
        {error && <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}

        {mode === "parent" && linkedStudents.length > 0 && (
          <Card className="border-white/5 bg-[#0f141f]">
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <span className="text-sm font-medium text-slate-300">Linked child</span>
              <Select value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)} className="max-w-xs">
                {linkedStudents.map((student) => <option key={student.id} value={student.id}>{student.displayName}</option>)}
              </Select>
              <Badge variant="secondary">{linkedStudents.length} authorized</Badge>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap gap-2">
          {tabLabels.map((tab) => (
            <Button key={tab.id} variant={activeTab === tab.id ? "default" : "outline"} onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <Card className="border-white/5 bg-[#0f141f]"><CardContent className="p-8 text-slate-400">Loading portal...</CardContent></Card>
        ) : !dashboard ? (
          <Card className="border-white/5 bg-[#0f141f]"><CardContent className="p-8 text-slate-400">{mode === "parent" ? "No linked students are authorized for this parent account." : "No student record is linked to this account."}</CardContent></Card>
        ) : (
          <>
            {activeTab === "home" && <HomeTab dashboard={dashboard} mode={mode} />}
            {activeTab === "academics" && <AcademicsTab dashboard={dashboard} />}
            {activeTab === "attendance" && <AttendanceTab dashboard={dashboard} />}
            {activeTab === "timetable" && <TimetableTab dashboard={dashboard} />}
            {activeTab === "results" && <ResultsTab dashboard={dashboard} />}
            {activeTab === "fees" && <FeesTab dashboard={dashboard} />}
            {activeTab === "messages" && <MessagesTab dashboard={dashboard} />}
            {activeTab === "notifications" && <NotificationsTab dashboard={dashboard} />}
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

function HomeTab({ dashboard, mode }: { dashboard: PortalStudentDashboard; mode: PortalMode }) {
  const latestResult = dashboard.results[0] || dashboard.assessments[0];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard icon={<UserRound className="h-5 w-5" />} label={mode === "parent" ? "Selected Child" : "Student"} value={dashboard.student.displayName} />
        <SummaryCard icon={<GraduationCap className="h-5 w-5" />} label="Class" value={[dashboard.student.gradeName, dashboard.student.sectionName].filter(Boolean).join(" / ") || "Not enrolled"} />
        <SummaryCard icon={<CalendarDays className="h-5 w-5" />} label="Attendance" value={`${dashboard.attendance.attendancePercentage}%`} />
        <SummaryCard icon={<Bell className="h-5 w-5" />} label="Unread" value={dashboard.communication.unreadNotifications} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <RecordList title="Next Timetable Items" rows={dashboard.timetable.slice(0, 5).map((item) => ({ id: item.id, title: `${dayNames[item.dayOfWeek]} - ${item.subjectName}`, meta: `${item.periodName} ${item.startTime}-${item.endTime}`, status: item.teacherName }))} empty="No timetable available." />
        <RecordList title="Recent Academic Result" rows={latestResult ? [{ id: latestResult.id, title: latestResult.sourceName, meta: `${latestResult.subjectName}: ${latestResult.obtainedMarks}/${latestResult.maximumMarks}`, status: latestResult.grade || `${latestResult.percentage}%` }] : []} empty="No published results yet." />
      </div>
    </div>
  );
}

function AcademicsTab({ dashboard }: { dashboard: PortalStudentDashboard }) {
  return (
    <Card className="border-white/5 bg-[#0f141f]">
      <CardContent className="grid gap-4 p-6 md:grid-cols-3">
        <Info label="Name" value={dashboard.student.displayName} />
        <Info label="Admission Number" value={dashboard.student.admissionNumber} />
        <Info label="Status" value={dashboard.student.status} />
        <Info label="Academic Year" value={dashboard.student.academicYear || "Not assigned"} />
        <Info label="Class" value={dashboard.student.gradeName || "Not assigned"} />
        <Info label="Section" value={dashboard.student.sectionName || "Not assigned"} />
      </CardContent>
    </Card>
  );
}

function AttendanceTab({ dashboard }: { dashboard: PortalStudentDashboard }) {
  const summary = dashboard.attendance;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-5">
        <SummaryCard icon={<CalendarDays className="h-5 w-5" />} label="Present" value={summary.present} />
        <SummaryCard icon={<CalendarDays className="h-5 w-5" />} label="Absent" value={summary.absent} />
        <SummaryCard icon={<CalendarDays className="h-5 w-5" />} label="Late" value={summary.late} />
        <SummaryCard icon={<CalendarDays className="h-5 w-5" />} label="Excused" value={summary.excused} />
        <SummaryCard icon={<CalendarDays className="h-5 w-5" />} label="Percentage" value={`${summary.attendancePercentage}%`} />
      </div>
      <RecordList title="Attendance History" rows={dashboard.attendanceHistory.map(({ session, record }) => ({ id: record.id, title: session.date, meta: session.sessionType, status: record.status }))} empty="No attendance history available." />
    </div>
  );
}

function TimetableTab({ dashboard }: { dashboard: PortalStudentDashboard }) {
  return <RecordList title="Class Timetable" rows={dashboard.timetable.map((item) => ({ id: item.id, title: `${dayNames[item.dayOfWeek]} - ${item.subjectName}`, meta: `${item.periodName} ${item.startTime}-${item.endTime} with ${item.teacherName}`, status: item.roomId || "Room TBA" }))} empty="No timetable available." />;
}

function ResultsTab({ dashboard }: { dashboard: PortalStudentDashboard }) {
  return (
    <div className="space-y-4">
      <RecordList title="Published Examination Results" rows={dashboard.results.map((item) => ({ id: item.id, title: `${item.sourceName} - ${item.subjectName}`, meta: `${item.obtainedMarks}/${item.maximumMarks} (${item.percentage}%)`, status: item.grade || (item.passed ? "Passed" : "Review") }))} empty="No published examination results." />
      <RecordList title="Published Assessments" rows={dashboard.assessments.map((item) => ({ id: item.id, title: `${item.sourceName} - ${item.subjectName}`, meta: `${item.obtainedMarks}/${item.maximumMarks} (${item.percentage}%)`, status: item.grade }))} empty="No published assessments." />
    </div>
  );
}

function FeesTab({ dashboard }: { dashboard: PortalStudentDashboard }) {
  if (!dashboard.finance.visible) {
    return <Card className="border-white/5 bg-[#0f141f]"><CardContent className="p-8 text-slate-400">Fee visibility is disabled by organization policy for this portal.</CardContent></Card>;
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard icon={<CreditCard className="h-5 w-5" />} label="Outstanding" value={formatCurrency(dashboard.finance.outstandingCents, dashboard.finance.invoices[0]?.currency)} />
        <SummaryCard icon={<CreditCard className="h-5 w-5" />} label="Overdue" value={formatCurrency(dashboard.finance.overdueCents, dashboard.finance.invoices[0]?.currency)} />
        <SummaryCard icon={<CreditCard className="h-5 w-5" />} label="Online Payment" value={dashboard.finance.providerConfigured ? "Configured" : "Provider Not Configured"} />
      </div>
      <RecordList title="Invoices" rows={dashboard.finance.invoices.map((invoice) => ({ id: invoice.id, title: invoice.invoiceNumber, meta: `${formatCurrency(invoice.balanceCents, invoice.currency)} due ${invoice.dueDate}`, status: invoice.status }))} empty="No issued invoices." />
      <RecordList title="Receipts" rows={dashboard.finance.receipts.map((receipt) => ({ id: receipt.id, title: receipt.receiptNumber, meta: `${formatCurrency(receipt.amountCents)} on ${receipt.receiptDate}`, status: receipt.paymentMethod }))} empty="No receipts available." />
    </div>
  );
}

function MessagesTab({ dashboard }: { dashboard: PortalStudentDashboard }) {
  return (
    <div className="space-y-4">
      <RecordList title="Announcements" rows={dashboard.communication.announcements.map((item) => ({ id: item.id, title: item.title, meta: item.content, status: item.priority }))} empty="No announcements for this portal." />
      <RecordList title="Messages" rows={dashboard.communication.messages.map((item) => ({ id: item.id, title: item.subject, meta: item.body, status: item.priority }))} empty="No message history available." />
    </div>
  );
}

function NotificationsTab({ dashboard }: { dashboard: PortalStudentDashboard }) {
  return <RecordList title="Notifications" rows={dashboard.communication.notifications.map((item) => ({ id: item.id, title: item.title, meta: item.message, status: item.isRead ? "read" : "unread" }))} empty="No notifications." />;
}

function RequestsTab({ form, requests, onChange, onSubmit }: { form: { type: PortalUpdateRequestType; subject: string; details: string }; requests: PortalUpdateRequest[]; onChange: (form: { type: PortalUpdateRequestType; subject: string; details: string }) => void; onSubmit: () => void }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="border-white/5 bg-[#0f141f]">
        <CardContent className="space-y-3 p-6">
          <h2 className="text-lg font-semibold text-white">Update Request</h2>
          <Select value={form.type} onChange={(event) => onChange({ ...form, type: event.target.value as PortalUpdateRequestType })}>
            <option value="contact_update">Contact Update</option>
            <option value="profile_update">Profile Update</option>
            <option value="communication_preference">Communication Preference</option>
            <option value="other">Other</option>
          </Select>
          <Input value={form.subject} onChange={(event) => onChange({ ...form, subject: event.target.value })} />
          <textarea className="min-h-32 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" value={form.details} onChange={(event) => onChange({ ...form, details: event.target.value })} />
          <Button onClick={onSubmit}>Submit Request</Button>
        </CardContent>
      </Card>
      <div className="lg:col-span-2">
        <RecordList title="My Requests" rows={requests.map((request) => ({ id: request.id, title: request.subject, meta: request.type, status: request.status }))} empty="No update requests submitted." />
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <Card className="border-white/5 bg-[#0f141f]">
      <CardContent className="flex min-h-28 items-center justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-xs uppercase text-slate-500">{label}</p>
          <p className="mt-1 truncate text-xl font-semibold text-white">{value}</p>
        </div>
        <div className="shrink-0 rounded-xl bg-red-500/10 p-3 text-red-400">{icon}</div>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-slate-950/40 p-4">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-white">{value}</p>
    </div>
  );
}

function RecordList({ title, rows, empty }: { title: string; rows: Array<{ id: string; title: string; meta: string; status?: string }>; empty: string }) {
  return (
    <Card className="border-white/5 bg-[#0f141f]">
      <CardContent className="space-y-3 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-white"><FileText className="h-5 w-5 text-red-400" />{title}</h2>
        {rows.length === 0 ? (
          <div className="rounded-lg border border-white/5 py-8 text-center text-sm text-slate-500">{empty}</div>
        ) : (
          <div className="divide-y divide-white/5 rounded-lg border border-white/5">
            {rows.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">{row.title}</p>
                  <p className="truncate text-sm text-slate-400">{row.meta}</p>
                </div>
                {row.status && <Badge variant="secondary">{row.status}</Badge>}
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
