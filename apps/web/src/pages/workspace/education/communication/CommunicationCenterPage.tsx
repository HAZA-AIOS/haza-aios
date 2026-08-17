import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { AcademicService } from "@/modules/education/sis/academic.service";
import { CommunicationService } from "@/modules/education/sis/communication.service";
import { StudentService } from "@/modules/education/sis/student.service";
import { StaffService } from "@/modules/education/sis/staff.service";
import { useOrganization } from "@/org/use-organization";
import { navigate } from "@/routes/navigation";
import { Link } from "@/routes/router";
import type {
  AcademicYear,
  Announcement,
  AudienceType,
  CommunicationAudience,
  CommunicationChannel,
  CommunicationMessage,
  CommunicationPriority,
  CommunicationTemplate,
  DeliveryAttempt,
  Grade,
  Section,
  SisNotification,
  Staff,
  Student,
} from "@/modules/education/sis/sis.types";
import { AdminPageHeader, Badge, Button, Card, CardContent, Input, Select } from "@haza-aios/ui";
import { ArrowLeft, Bell, Mail, Megaphone, Send, Users } from "lucide-react";

type CommunicationTab = "overview" | "announcements" | "compose" | "notifications" | "templates" | "delivery";

interface CommunicationCenterPageProps {
  initialTab?: CommunicationTab;
}

const audienceTypes: Array<{ label: string; value: AudienceType }> = [
  { label: "Entire Organization", value: "organization" },
  { label: "All Students", value: "all_students" },
  { label: "All Parents / Guardians", value: "all_guardians" },
  { label: "All Teachers", value: "all_teachers" },
  { label: "All Staff", value: "all_staff" },
  { label: "Specific Class", value: "class" },
  { label: "Specific Section", value: "section" },
  { label: "Selected Student", value: "selected_students" },
  { label: "Selected Guardian", value: "selected_guardians" },
  { label: "Selected Staff", value: "selected_staff" },
];

const priorities: CommunicationPriority[] = ["normal", "important", "urgent"];

function nowDate() {
  return new Date().toISOString().split("T")[0];
}

export function CommunicationCenterPage({ initialTab = "overview" }: CommunicationCenterPageProps) {
  const { currentOrganization } = useOrganization();
  const [activeTab, setActiveTab] = useState<CommunicationTab>(initialTab);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [communications, setCommunications] = useState<CommunicationMessage[]>([]);
  const [notifications, setNotifications] = useState<SisNotification[]>([]);
  const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryAttempt[]>([]);
  const [recipientCount, setRecipientCount] = useState(0);

  const [audience, setAudience] = useState<CommunicationAudience>({ type: "organization" });
  const [announcementForm, setAnnouncementForm] = useState({
    title: "School Announcement",
    content: "Please review the latest school update.",
    priority: "normal" as CommunicationPriority,
    publishAt: nowDate(),
  });
  const [composeForm, setComposeForm] = useState({
    subject: "Parent Communication",
    body: "Hello, this is an update from school.",
    channels: ["in_app"] as CommunicationChannel[],
    priority: "normal" as CommunicationPriority,
    templateId: "",
    idempotencyKey: "",
  });
  const [templateForm, setTemplateForm] = useState({
    name: "General Parent Communication",
    category: "general",
    subject: "Update from {{school_name}}",
    content: "Dear {{guardian_name}}, {{school_name}} has an update for {{student_name}}.",
    supportedVariables: "school_name,guardian_name,student_name",
  });

  const summary = useMemo(() => ({
    publishedAnnouncements: announcements.filter((item) => item.status === "published").length,
    communicationsSent: communications.filter((item) => item.status === "sent").length,
    pendingDeliveries: deliveries.filter((item) => item.status === "pending" || item.status === "queued").length,
    failedDeliveries: deliveries.filter((item) => item.status === "failed").length,
    unreadNotifications: notifications.filter((item) => !item.isRead).length,
  }), [announcements, communications, deliveries, notifications]);

  useEffect(() => {
    void loadData();
  }, [currentOrganization]);

  useEffect(() => {
    void previewRecipients();
  }, [currentOrganization, audience]);

  async function loadData() {
    if (!currentOrganization) return;
    setIsLoading(true);
    setError(null);
    try {
      const orgId = currentOrganization.id;
      const [yearsData, gradesData, sectionsData, studentsData, staffData, announcementData, communicationData, notificationData, templateData, deliveryData] =
        await Promise.all([
          AcademicService.getAcademicYears(orgId),
          AcademicService.getGrades(orgId),
          AcademicService.getSections(orgId),
          StudentService.getStudents(orgId),
          StaffService.getStaffList(orgId),
          CommunicationService.getAnnouncements(orgId),
          CommunicationService.getCommunications(orgId),
          CommunicationService.getNotifications(orgId),
          CommunicationService.getTemplates(orgId),
          CommunicationService.getDeliveryHistory(orgId),
        ]);
      setAcademicYears(yearsData);
      setGrades(gradesData);
      setSections(sectionsData);
      setStudents(studentsData);
      setStaff(staffData);
      setAnnouncements(announcementData);
      setCommunications(communicationData);
      setNotifications(notificationData);
      setTemplates(templateData);
      setDeliveries(deliveryData);
      const activeYear = yearsData.find((year) => year.status === "active") || yearsData[0];
      setAudience((current) => ({ ...current, academicYear: current.academicYear || activeYear?.name, gradeId: current.gradeId || gradesData[0]?.id, sectionId: current.sectionId || sectionsData[0]?.id }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load communication data.");
    } finally {
      setIsLoading(false);
    }
  }

  async function previewRecipients() {
    if (!currentOrganization) return;
    try {
      const recipients = await CommunicationService.resolveAudience(currentOrganization.id, audience);
      setRecipientCount(recipients.length);
    } catch {
      setRecipientCount(0);
    }
  }

  async function runAction(action: () => Promise<void>) {
    setMessage(null);
    setError(null);
    try {
      await action();
      await loadData();
      await previewRecipients();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Communication action failed.");
    }
  }

  async function handleCreateAnnouncement() {
    if (!currentOrganization) return;
    await runAction(async () => {
      await CommunicationService.createAnnouncement(currentOrganization.id, {
        title: announcementForm.title,
        content: announcementForm.content,
        authorId: "system",
        audience,
        priority: announcementForm.priority,
        publishAt: announcementForm.publishAt,
        status: "draft",
      });
      setMessage("Announcement draft created.");
    });
  }

  async function handlePublishLatestAnnouncement() {
    if (!currentOrganization || announcements.length === 0) return;
    await runAction(async () => {
      const draft = announcements.find((item) => item.status === "draft") || announcements[0];
      await CommunicationService.publishAnnouncement(currentOrganization.id, draft.id);
      setMessage("Announcement published and in-app notifications created.");
    });
  }

  async function handleSendCommunication() {
    if (!currentOrganization) return;
    await runAction(async () => {
      await CommunicationService.sendCommunication(currentOrganization.id, {
        subject: composeForm.subject,
        body: composeForm.body,
        senderId: "system",
        audience,
        channels: composeForm.channels,
        priority: composeForm.priority,
        templateId: composeForm.templateId || undefined,
        variables: {
          school_name: currentOrganization.name,
          student_name: students[0] ? `${students[0].firstName} ${students[0].lastName}` : "",
          guardian_name: students[0]?.guardians[0] ? `${students[0].guardians[0].firstName} ${students[0].guardians[0].lastName}` : "",
        },
        idempotencyKey: composeForm.idempotencyKey || `ui-${Date.now()}`,
      });
      setMessage("Communication sent.");
    });
  }

  async function handleCreateTemplate() {
    if (!currentOrganization) return;
    await runAction(async () => {
      await CommunicationService.createTemplate(currentOrganization.id, {
        name: templateForm.name,
        category: templateForm.category,
        subject: templateForm.subject,
        content: templateForm.content,
        supportedVariables: templateForm.supportedVariables.split(",").map((item) => item.trim()).filter(Boolean),
        status: "active",
      });
      setMessage("Template created.");
    });
  }

  async function handleMarkAllRead() {
    if (!currentOrganization || notifications.length === 0) return;
    const first = notifications[0];
    await runAction(async () => {
      await CommunicationService.markAllNotificationsRead(currentOrganization.id, { kind: first.recipientKind, id: first.recipientId });
      setMessage("Notifications marked read for selected recipient.");
    });
  }

  function updateAudienceType(type: AudienceType) {
    const selectedStudent = students[0];
    const selectedGuardian = selectedStudent?.guardians[0];
    const selectedStaff = staff[0];
    setAudience((current) => ({
      ...current,
      type,
      studentIds: type === "selected_students" && selectedStudent ? [selectedStudent.id] : undefined,
      guardianIds: type === "selected_guardians" && selectedGuardian ? [selectedGuardian.id] : undefined,
      staffIds: type === "selected_staff" && selectedStaff ? [selectedStaff.id] : undefined,
    }));
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <AdminPageHeader
          title="Communication Center"
          description="Manage announcements, communications, in-app notifications, templates, delivery history, and provider-ready channels."
          breadcrumbs={[{ label: "Workspace", onClick: () => navigate("/workspace") }, { label: "Education" }, { label: "Communication" }]}
          actions={<Badge variant="secondary">Provider Ready</Badge>}
        />

        <Link to="/workspace" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to Workspace
        </Link>

        {message && <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{message}</div>}
        {error && <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}

        <div className="grid gap-4 md:grid-cols-5">
          <SummaryCard icon={<Megaphone className="h-5 w-5" />} label="Announcements" value={summary.publishedAnnouncements} />
          <SummaryCard icon={<Send className="h-5 w-5" />} label="Sent" value={summary.communicationsSent} />
          <SummaryCard icon={<Mail className="h-5 w-5" />} label="Pending" value={summary.pendingDeliveries} />
          <SummaryCard icon={<Bell className="h-5 w-5" />} label="Unread" value={summary.unreadNotifications} />
          <SummaryCard icon={<Users className="h-5 w-5" />} label="Audience Preview" value={recipientCount} />
        </div>

        <AudiencePanel audience={audience} years={academicYears} grades={grades} sections={sections} onType={updateAudienceType} onChange={setAudience} />

        <div className="flex flex-wrap gap-2">
          {(["overview", "announcements", "compose", "notifications", "templates", "delivery"] as CommunicationTab[]).map((tab) => (
            <Button key={tab} variant={activeTab === tab ? "default" : "outline"} onClick={() => setActiveTab(tab)}>
              {tab === "overview" ? "Overview" : tab === "announcements" ? "Announcements" : tab === "compose" ? "Compose" : tab === "notifications" ? "Notifications" : tab === "templates" ? "Templates" : "Delivery History"}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <Card className="bg-[#0f141f] border-white/5"><CardContent className="p-8 text-slate-400">Loading communication center...</CardContent></Card>
        ) : (
          <>
            {activeTab === "overview" && (
              <div className="grid gap-4 lg:grid-cols-2">
                <RecordList title="Recent Announcements" rows={announcements.slice(0, 6).map((item) => ({ id: item.id, title: item.title, meta: `${item.recipientCount} recipients`, status: item.status }))} empty="No announcements yet." />
                <RecordList title="Recent Communications" rows={communications.slice(0, 6).map((item) => ({ id: item.id, title: item.subject, meta: `${item.recipientCount} recipients via ${item.channels.join(", ")}`, status: item.status }))} empty="No communications sent yet." />
              </div>
            )}

            {activeTab === "announcements" && (
              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="bg-[#0f141f] border-white/5">
                  <CardContent className="space-y-3 p-6">
                    <h2 className="text-lg font-semibold text-white">Announcement</h2>
                    <Input value={announcementForm.title} onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })} />
                    <textarea className="min-h-32 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" value={announcementForm.content} onChange={(e) => setAnnouncementForm({ ...announcementForm, content: e.target.value })} />
                    <Select value={announcementForm.priority} onChange={(e) => setAnnouncementForm({ ...announcementForm, priority: e.target.value as CommunicationPriority })}>{priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</Select>
                    <div className="flex gap-2"><Button onClick={handleCreateAnnouncement}>Create Draft</Button><Button variant="secondary" onClick={handlePublishLatestAnnouncement}>Publish Latest</Button></div>
                  </CardContent>
                </Card>
                <div className="lg:col-span-2"><RecordList title="Announcements" rows={announcements.map((item) => ({ id: item.id, title: item.title, meta: `${item.recipientCount} recipients`, status: item.status }))} empty="No announcements yet." /></div>
              </div>
            )}

            {activeTab === "compose" && (
              <Card className="bg-[#0f141f] border-white/5">
                <CardContent className="space-y-3 p-6">
                  <h2 className="text-lg font-semibold text-white">Message Composer</h2>
                  <div className="grid gap-3 md:grid-cols-3">
                    <Input value={composeForm.subject} onChange={(e) => setComposeForm({ ...composeForm, subject: e.target.value })} />
                    <Select value={composeForm.priority} onChange={(e) => setComposeForm({ ...composeForm, priority: e.target.value as CommunicationPriority })}>{priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</Select>
                    <Select value={composeForm.templateId} onChange={(e) => setComposeForm({ ...composeForm, templateId: e.target.value })}><option value="">No template</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</Select>
                  </div>
                  <textarea className="min-h-36 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" value={composeForm.body} onChange={(e) => setComposeForm({ ...composeForm, body: e.target.value })} />
                  <div className="flex flex-wrap gap-2">
                    {(["in_app", "email", "sms", "whatsapp"] as CommunicationChannel[]).map((channel) => (
                      <Button key={channel} variant={composeForm.channels.includes(channel) ? "default" : "outline"} onClick={() => setComposeForm((current) => ({ ...current, channels: current.channels.includes(channel) ? current.channels.filter((item) => item !== channel) : [...current.channels, channel] }))}>{channel}</Button>
                    ))}
                  </div>
                  <Button onClick={handleSendCommunication}>Send Communication</Button>
                </CardContent>
              </Card>
            )}

            {activeTab === "notifications" && (
              <Card className="bg-[#0f141f] border-white/5">
                <CardContent className="space-y-3 p-6">
                  <div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-white">Notification Center</h2><Button variant="secondary" onClick={handleMarkAllRead}>Mark Recipient Read</Button></div>
                  <RecordList title="Notifications" rows={notifications.map((item) => ({ id: item.id, title: item.title, meta: `${item.recipientKind} - ${item.message}`, status: item.isRead ? "read" : "unread" }))} empty="No notifications yet." />
                </CardContent>
              </Card>
            )}

            {activeTab === "templates" && (
              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="bg-[#0f141f] border-white/5">
                  <CardContent className="space-y-3 p-6">
                    <h2 className="text-lg font-semibold text-white">Template</h2>
                    <Input value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} />
                    <Input value={templateForm.category} onChange={(e) => setTemplateForm({ ...templateForm, category: e.target.value })} />
                    <Input value={templateForm.subject} onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })} />
                    <textarea className="min-h-28 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" value={templateForm.content} onChange={(e) => setTemplateForm({ ...templateForm, content: e.target.value })} />
                    <Input value={templateForm.supportedVariables} onChange={(e) => setTemplateForm({ ...templateForm, supportedVariables: e.target.value })} />
                    <Button onClick={handleCreateTemplate}>Create Template</Button>
                  </CardContent>
                </Card>
                <div className="lg:col-span-2"><RecordList title="Templates" rows={templates.map((item) => ({ id: item.id, title: item.name, meta: item.category, status: item.status }))} empty="No templates yet." /></div>
              </div>
            )}

            {activeTab === "delivery" && (
              <RecordList title="Delivery History" rows={deliveries.map((item) => ({ id: item.id, title: `${item.channel} to ${item.recipientKind}`, meta: item.recipientId, status: item.status }))} empty="No delivery attempts yet." />
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function AudiencePanel({ audience, years, grades, sections, onType, onChange }: { audience: CommunicationAudience; years: AcademicYear[]; grades: Grade[]; sections: Section[]; onType: (type: AudienceType) => void; onChange: (audience: CommunicationAudience) => void }) {
  return (
    <Card className="bg-[#0f141f] border-white/5">
      <CardContent className="grid gap-3 p-4 md:grid-cols-4">
        <Select value={audience.type} onChange={(e) => onType(e.target.value as AudienceType)}>{audienceTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select>
        <Select value={audience.academicYear || ""} onChange={(e) => onChange({ ...audience, academicYear: e.target.value })}>{years.map((year) => <option key={year.id} value={year.name}>{year.name}</option>)}</Select>
        <Select value={audience.gradeId || ""} onChange={(e) => onChange({ ...audience, gradeId: e.target.value })}>{grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</Select>
        <Select value={audience.sectionId || ""} onChange={(e) => onChange({ ...audience, sectionId: e.target.value })}>{sections.filter((section) => !audience.gradeId || section.gradeId === audience.gradeId).map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}</Select>
      </CardContent>
    </Card>
  );
}

function SummaryCard({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <Card className="bg-[#0f141f] border-white/5">
      <CardContent className="flex items-center justify-between p-5">
        <div><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-white">{value}</p></div>
        <div className="rounded-xl bg-red-500/10 p-3 text-red-400">{icon}</div>
      </CardContent>
    </Card>
  );
}

function RecordList({ title, rows, empty }: { title: string; rows: Array<{ id: string; title: string; meta: string; status?: string }>; empty: string }) {
  return (
    <Card className="bg-[#0f141f] border-white/5">
      <CardContent className="space-y-3 p-6">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {rows.length === 0 ? <div className="rounded-xl border border-white/5 py-8 text-center text-sm text-slate-500">{empty}</div> : (
          <div className="divide-y divide-white/5 rounded-xl border border-white/5">
            {rows.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div><p className="font-medium text-white">{row.title}</p><p className="text-sm text-slate-400">{row.meta}</p></div>
                {row.status && <Badge variant="secondary">{row.status}</Badge>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
