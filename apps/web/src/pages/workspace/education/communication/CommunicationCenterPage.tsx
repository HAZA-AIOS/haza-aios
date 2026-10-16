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
  AnnouncementStatus,
  AudienceType,
  CommunicationAudience,
  CommunicationChannel,
  CommunicationMessage,
  CommunicationPriority,
  CommunicationTemplate,
  DeliveryAttempt,
  Grade,
  ResolvedRecipient,
  Section,
  SisNotification,
  Staff,
  Student,
} from "@/modules/education/sis/sis.types";
import {
  AdminPageHeader,
  AnnouncementPriorityBadge,
  AnnouncementStatusBadge,
  AudienceTypeBadge,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CommunicationStatCard,
  DeliveryStatusBadge,
  Input,
  Select,
  Textarea,
} from "@haza-aios/ui";
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  Bell,
  CheckCircle,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  Filter,
  Inbox,
  Layers,
  Mail,
  Megaphone,
  PenSquare,
  Plus,
  Radio,
  Search,
  Send,
  Trash2,
  Users,
  X,
} from "lucide-react";

export type CommunicationTab = "overview" | "announcements" | "compose" | "notifications" | "templates" | "delivery";

interface CommunicationCenterPageProps {
  initialTab?: CommunicationTab;
}

const audienceTypes: Array<{ label: string; value: AudienceType }> = [
  { label: "Whole School (Everyone)", value: "organization" },
  { label: "All Students", value: "all_students" },
  { label: "All Parents / Guardians", value: "all_guardians" },
  { label: "All Teachers", value: "all_teachers" },
  { label: "All Staff Members", value: "all_staff" },
  { label: "Specific Class / Grade", value: "class" },
  { label: "Specific Section", value: "section" },
  { label: "Selected Student", value: "selected_students" },
  { label: "Selected Guardian", value: "selected_guardians" },
  { label: "Selected Staff", value: "selected_staff" },
];

const announcementCategories = [
  "General",
  "Academic",
  "Examinations",
  "School Events",
  "Fees & Finance",
  "Administrative",
  "Emergency",
];

const templateCategories = [
  "General announcements",
  "Attendance",
  "Examinations",
  "Results",
  "Fees",
  "School events",
  "Administrative notices",
];

const priorities: CommunicationPriority[] = ["normal", "important", "urgent"];

const supportedPlaceholders = [
  { key: "student_name", label: "Student Name", example: "Amina Khan" },
  { key: "guardian_name", label: "Guardian Name", example: "Sara Khan" },
  { key: "class_name", label: "Class / Grade", example: "Grade 5" },
  { key: "section_name", label: "Section", example: "Section A" },
  { key: "exam_name", label: "Exam Name", example: "Mid-Term Examination" },
  { key: "due_date", label: "Due Date", example: "2026-11-15" },
  { key: "amount", label: "Amount", example: "$250.00" },
  { key: "school_name", label: "School Name", example: "HAZA AIOS Academy" },
  { key: "staff_name", label: "Staff Name", example: "Tariq Ali" },
];

function nowDate() {
  return new Date().toISOString().split("T")[0];
}

export function CommunicationCenterPage({ initialTab = "overview" }: CommunicationCenterPageProps) {
  const { currentOrganization } = useOrganization();
  const [activeTab, setActiveTab] = useState<CommunicationTab>(initialTab);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Core entities
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);

  // Communication records
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [communications, setCommunications] = useState<CommunicationMessage[]>([]);
  const [notifications, setNotifications] = useState<SisNotification[]>([]);
  const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryAttempt[]>([]);
  const [resolvedRecipients, setResolvedRecipients] = useState<ResolvedRecipient[]>([]);
  const [isResolvingAudience, setIsResolvingAudience] = useState(false);

  // Real API summary
  const [summary, setSummary] = useState({
    totalAnnouncements: 0,
    publishedAnnouncements: 0,
    scheduledAnnouncements: 0,
    communicationsSent: 0,
    pendingDeliveries: 0,
    failedDeliveries: 0,
    unreadNotifications: 0,
  });

  // Audience State for Composition & Announcements
  const [audience, setAudience] = useState<CommunicationAudience>({ type: "organization" });

  // Announcements UI State
  const [announcementSearch, setAnnouncementSearch] = useState("");
  const [announcementStatusFilter, setAnnouncementStatusFilter] = useState<string>("all");
  const [announcementCategoryFilter, setAnnouncementCategoryFilter] = useState<string>("all");
  const [announcementPriorityFilter, setAnnouncementPriorityFilter] = useState<string>("all");
  const [announcementPage, setAnnouncementPage] = useState(1);
  const announcementsPerPage = 6;

  // Announcement Modal State
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);
  const [previewingAnnouncement, setPreviewingAnnouncement] = useState<Announcement | null>(null);
  const [announcementForm, setAnnouncementForm] = useState({
    title: "",
    content: "",
    category: "General",
    priority: "normal" as CommunicationPriority,
    publishAt: nowDate(),
    expiresAt: "",
    status: "draft" as AnnouncementStatus,
    campusId: "",
  });

  // Message Composer UI State
  const [composeForm, setComposeForm] = useState({
    subject: "",
    body: "",
    channels: ["in_app", "email"] as CommunicationChannel[],
    priority: "normal" as CommunicationPriority,
    templateId: "",
  });

  // Notification Inbox State
  const [notificationSearch, setNotificationSearch] = useState("");
  const [notificationStatusFilter, setNotificationStatusFilter] = useState<"all" | "unread" | "read">("all");
  const [notificationCategoryFilter, setNotificationCategoryFilter] = useState<string>("all");
  const [selectedNotification, setSelectedNotification] = useState<SisNotification | null>(null);

  // Template Modal State
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: "",
    category: "General announcements",
    subject: "",
    content: "",
    supportedVariables: ["school_name", "student_name", "guardian_name"],
    status: "active" as "active" | "inactive",
  });

  // Delivery History Filter State
  const [deliveryChannelFilter, setDeliveryChannelFilter] = useState<string>("all");
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<string>("all");
  const [deliverySearch, setDeliverySearch] = useState("");

  useEffect(() => {
    void loadData();
  }, [currentOrganization]);

  useEffect(() => {
    void resolveTargetAudience();
  }, [currentOrganization, audience]);

  async function loadData() {
    if (!currentOrganization) return;
    setIsLoading(true);
    setActionError(null);
    try {
      const orgId = currentOrganization.id;
      const [
        yearsData,
        gradesData,
        sectionsData,
        studentsData,
        staffData,
        announcementData,
        communicationData,
        notificationData,
        templateData,
        deliveryData,
        summaryData,
      ] = await Promise.all([
        AcademicService.getAcademicYears(orgId).catch(() => []),
        AcademicService.getGrades(orgId).catch(() => []),
        AcademicService.getSections(orgId).catch(() => []),
        StudentService.getStudents(orgId).catch(() => []),
        StaffService.getStaffList(orgId).catch(() => []),
        CommunicationService.getAnnouncements(orgId).catch(() => []),
        CommunicationService.getCommunications(orgId).catch(() => []),
        CommunicationService.getNotifications(orgId).catch(() => []),
        CommunicationService.getTemplates(orgId).catch(() => []),
        CommunicationService.getDeliveryHistory(orgId).catch(() => []),
        CommunicationService.getSummary(orgId).catch(() => ({
          totalAnnouncements: 0,
          publishedAnnouncements: 0,
          scheduledAnnouncements: 0,
          communicationsSent: 0,
          pendingDeliveries: 0,
          failedDeliveries: 0,
          unreadNotifications: 0,
        })),
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

      setSummary({
        totalAnnouncements: summaryData.totalAnnouncements ?? announcementData.length,
        publishedAnnouncements: summaryData.publishedAnnouncements ?? announcementData.filter((a) => a.status === "published").length,
        scheduledAnnouncements: summaryData.scheduledAnnouncements ?? announcementData.filter((a) => a.status === "scheduled").length,
        communicationsSent: summaryData.communicationsSent ?? communicationData.filter((c) => c.status === "sent").length,
        pendingDeliveries: summaryData.pendingDeliveries ?? deliveryData.filter((d) => d.status === "pending" || d.status === "queued").length,
        failedDeliveries: summaryData.failedDeliveries ?? deliveryData.filter((d) => d.status === "failed").length,
        unreadNotifications: summaryData.unreadNotifications ?? notificationData.filter((n) => !n.isRead).length,
      });

      const activeYear = yearsData.find((year) => year.status === "active") || yearsData[0];
      setAudience((current) => ({
        ...current,
        academicYear: current.academicYear || activeYear?.name,
        gradeId: current.gradeId || gradesData[0]?.id,
        sectionId: current.sectionId || sectionsData[0]?.id,
      }));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to load communication workspace.");
    } finally {
      setIsLoading(false);
    }
  }

  async function resolveTargetAudience() {
    if (!currentOrganization) return;
    setIsResolvingAudience(true);
    try {
      const recipients = await CommunicationService.resolveAudience(currentOrganization.id, audience);
      setResolvedRecipients(recipients);
    } catch {
      setResolvedRecipients([]);
    } finally {
      setIsResolvingAudience(false);
    }
  }

  function handleAudienceTypeChange(type: AudienceType) {
    const defaultStudent = students[0];
    const defaultGuardian = defaultStudent?.guardians[0];
    const defaultStaff = staff[0];
    setAudience((current) => ({
      ...current,
      type,
      studentIds: type === "selected_students" && defaultStudent ? [defaultStudent.id] : undefined,
      guardianIds: type === "selected_guardians" && defaultGuardian ? [defaultGuardian.id] : undefined,
      staffIds: type === "selected_staff" && defaultStaff ? [defaultStaff.id] : undefined,
    }));
  }

  // --- ANNOUNCEMENT HANDLERS ---
  function openCreateAnnouncementModal() {
    setEditingAnnouncementId(null);
    setAnnouncementForm({
      title: "",
      content: "",
      category: "General",
      priority: "normal",
      publishAt: nowDate(),
      expiresAt: "",
      status: "draft",
      campusId: "",
    });
    setIsAnnouncementModalOpen(true);
  }

  function openEditAnnouncementModal(announcement: Announcement) {
    setEditingAnnouncementId(announcement.id);
    setAnnouncementForm({
      title: announcement.title,
      content: announcement.content,
      category: announcement.category || "General",
      priority: announcement.priority,
      publishAt: announcement.publishAt ? announcement.publishAt.split("T")[0] : nowDate(),
      expiresAt: announcement.expiresAt ? announcement.expiresAt.split("T")[0] : "",
      status: announcement.status,
      campusId: announcement.campusId || "",
    });
    setAudience(announcement.audience);
    setIsAnnouncementModalOpen(true);
  }

  async function handleSaveAnnouncement() {
    if (!currentOrganization) return;
    if (!announcementForm.title.trim() || !announcementForm.content.trim()) {
      setActionError("Title and announcement message body are required.");
      return;
    }
    setIsSubmitting(true);
    setActionError(null);
    try {
      if (editingAnnouncementId) {
        await CommunicationService.updateAnnouncement(currentOrganization.id, editingAnnouncementId, {
          title: announcementForm.title,
          content: announcementForm.content,
          category: announcementForm.category,
          priority: announcementForm.priority,
          publishAt: announcementForm.publishAt || undefined,
          expiresAt: announcementForm.expiresAt || undefined,
          status: announcementForm.status,
          campusId: announcementForm.campusId || undefined,
          audience,
        });
        setActionSuccess("Announcement updated successfully.");
      } else {
        await CommunicationService.createAnnouncement(currentOrganization.id, {
          title: announcementForm.title,
          content: announcementForm.content,
          category: announcementForm.category,
          priority: announcementForm.priority,
          publishAt: announcementForm.publishAt || undefined,
          expiresAt: announcementForm.expiresAt || undefined,
          status: announcementForm.status,
          campusId: announcementForm.campusId || undefined,
          audience,
        });
        setActionSuccess("Announcement created successfully.");
      }
      setIsAnnouncementModalOpen(false);
      await loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to save announcement.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePublishAnnouncement(id: string) {
    if (!currentOrganization) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      await CommunicationService.publishAnnouncement(currentOrganization.id, id);
      setActionSuccess("Announcement published. In-app notifications dispatched to intended recipients.");
      await loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to publish announcement.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleArchiveAnnouncement(id: string) {
    if (!currentOrganization) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      await CommunicationService.archiveAnnouncement(currentOrganization.id, id);
      setActionSuccess("Announcement archived.");
      await loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to archive announcement.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteAnnouncement(id: string) {
    if (!currentOrganization) return;
    if (!confirm("Are you sure you want to delete this announcement?")) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      await CommunicationService.deleteAnnouncement(currentOrganization.id, id);
      setActionSuccess("Announcement deleted.");
      await loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete announcement.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // --- MESSAGE COMPOSITION HANDLERS ---
  function handleSelectTemplate(templateId: string) {
    const template = templates.find((t) => t.id === templateId);
    if (!template) {
      setComposeForm((prev) => ({ ...prev, templateId: "" }));
      return;
    }
    setComposeForm((prev) => ({
      ...prev,
      templateId,
      subject: template.subject,
      body: template.content,
    }));
  }

  function insertVariablePlaceholder(key: string) {
    const placeholder = `{{${key}}}`;
    setComposeForm((prev) => ({
      ...prev,
      body: `${prev.body}${prev.body ? " " : ""}${placeholder}`,
    }));
  }

  async function handleSendCommunication() {
    if (!currentOrganization) return;
    if (!composeForm.subject.trim() || !composeForm.body.trim()) {
      setActionError("Subject and message body are required.");
      return;
    }
    if (composeForm.channels.length === 0) {
      setActionError("Please select at least one delivery channel.");
      return;
    }
    if (resolvedRecipients.length === 0) {
      setActionError("No recipients matched the selected audience. Please adjust target audience.");
      return;
    }
    setIsSubmitting(true);
    setActionError(null);
    try {
      const activeStudent = students[0];
      const activeGuardian = activeStudent?.guardians[0];
      const activeStaff = staff[0];

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
          student_name: activeStudent ? `${activeStudent.firstName} ${activeStudent.lastName}` : "Student",
          guardian_name: activeGuardian ? `${activeGuardian.firstName} ${activeGuardian.lastName}` : "Parent / Guardian",
          class_name: grades.find((g) => g.id === audience.gradeId)?.name || "Class",
          section_name: sections.find((s) => s.id === audience.sectionId)?.name || "Section A",
          staff_name: activeStaff ? `${activeStaff.firstName} ${activeStaff.lastName}` : "Staff Member",
          due_date: "2026-11-15",
          amount: "$150.00",
          exam_name: "Mid-Term Assessment",
        },
        idempotencyKey: `comm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      });

      setActionSuccess(`Targeted communication sent to ${resolvedRecipients.length} resolved recipient(s).`);
      setComposeForm({
        subject: "",
        body: "",
        channels: ["in_app", "email"],
        priority: "normal",
        templateId: "",
      });
      await loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to send communication.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // --- NOTIFICATION HANDLERS ---
  async function handleMarkRead(id: string) {
    if (!currentOrganization) return;
    try {
      await CommunicationService.markNotificationRead(currentOrganization.id, id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
      );
      setSummary((prev) => ({ ...prev, unreadNotifications: Math.max(0, prev.unreadNotifications - 1) }));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to mark notification as read.");
    }
  }

  async function handleMarkAllRead() {
    if (!currentOrganization || notifications.length === 0) return;
    const first = notifications[0];
    setIsSubmitting(true);
    setActionError(null);
    try {
      await CommunicationService.markAllNotificationsRead(currentOrganization.id, {
        kind: first.recipientKind,
        id: first.recipientId,
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() })));
      setSummary((prev) => ({ ...prev, unreadNotifications: 0 }));
      setActionSuccess("All notifications marked as read.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to mark all as read.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // --- TEMPLATE HANDLERS ---
  function openCreateTemplateModal() {
    setEditingTemplateId(null);
    setTemplateForm({
      name: "",
      category: "General announcements",
      subject: "",
      content: "",
      supportedVariables: ["school_name", "student_name", "guardian_name"],
      status: "active",
    });
    setIsTemplateModalOpen(true);
  }

  function openEditTemplateModal(template: CommunicationTemplate) {
    setEditingTemplateId(template.id);
    setTemplateForm({
      name: template.name,
      category: template.category,
      subject: template.subject,
      content: template.content,
      supportedVariables: template.supportedVariables || [],
      status: template.status === "active" ? "active" : "inactive",
    });
    setIsTemplateModalOpen(true);
  }

  async function handleSaveTemplate() {
    if (!currentOrganization) return;
    if (!templateForm.name.trim() || !templateForm.subject.trim() || !templateForm.content.trim()) {
      setActionError("Template name, subject, and content are required.");
      return;
    }
    setIsSubmitting(true);
    setActionError(null);
    try {
      if (editingTemplateId) {
        await CommunicationService.updateTemplate(currentOrganization.id, editingTemplateId, {
          name: templateForm.name,
          category: templateForm.category,
          subject: templateForm.subject,
          content: templateForm.content,
          supportedVariables: templateForm.supportedVariables,
          status: templateForm.status,
        });
        setActionSuccess("Template updated.");
      } else {
        await CommunicationService.createTemplate(currentOrganization.id, {
          name: templateForm.name,
          category: templateForm.category,
          subject: templateForm.subject,
          content: templateForm.content,
          supportedVariables: templateForm.supportedVariables,
          status: templateForm.status,
        });
        setActionSuccess("Template created.");
      }
      setIsTemplateModalOpen(false);
      await loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to save template.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteTemplate(id: string) {
    if (!currentOrganization) return;
    if (!confirm("Are you sure you want to delete this template?")) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      await CommunicationService.deleteTemplate(currentOrganization.id, id);
      setActionSuccess("Template deleted.");
      await loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete template.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // --- FILTERED ANNOUNCEMENTS LIST ---
  const filteredAnnouncements = useMemo(() => {
    return announcements.filter((item) => {
      if (announcementStatusFilter !== "all" && item.status !== announcementStatusFilter) return false;
      if (announcementCategoryFilter !== "all" && item.category !== announcementCategoryFilter) return false;
      if (announcementPriorityFilter !== "all" && item.priority !== announcementPriorityFilter) return false;
      if (announcementSearch.trim()) {
        const q = announcementSearch.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesContent = item.content.toLowerCase().includes(q);
        if (!matchesTitle && !matchesContent) return false;
      }
      return true;
    });
  }, [announcements, announcementStatusFilter, announcementCategoryFilter, announcementPriorityFilter, announcementSearch]);

  const totalAnnouncementPages = Math.ceil(filteredAnnouncements.length / announcementsPerPage) || 1;
  const paginatedAnnouncements = filteredAnnouncements.slice(
    (announcementPage - 1) * announcementsPerPage,
    announcementPage * announcementsPerPage
  );

  // --- FILTERED NOTIFICATIONS LIST ---
  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      if (notificationStatusFilter === "unread" && item.isRead) return false;
      if (notificationStatusFilter === "read" && !item.isRead) return false;
      if (notificationCategoryFilter !== "all" && item.type !== notificationCategoryFilter) return false;
      if (notificationSearch.trim()) {
        const q = notificationSearch.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesMsg = item.message.toLowerCase().includes(q);
        if (!matchesTitle && !matchesMsg) return false;
      }
      return true;
    });
  }, [notifications, notificationStatusFilter, notificationCategoryFilter, notificationSearch]);

  // --- FILTERED DELIVERIES LIST ---
  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((item) => {
      if (deliveryChannelFilter !== "all" && item.channel !== deliveryChannelFilter) return false;
      if (deliveryStatusFilter !== "all" && item.status !== deliveryStatusFilter) return false;
      if (deliverySearch.trim()) {
        const q = deliverySearch.toLowerCase();
        const matchesRecipient = item.recipientId.toLowerCase().includes(q);
        const matchesKind = item.recipientKind.toLowerCase().includes(q);
        if (!matchesRecipient && !matchesKind) return false;
      }
      return true;
    });
  }, [deliveries, deliveryChannelFilter, deliveryStatusFilter, deliverySearch]);

  return (
    <AppShell>
      <div className="max-w-7xl space-y-6 pb-12">
        <AdminPageHeader
          title="Communication & Notifications"
          description="Manage whole-school announcements, targeted role and class messaging, in-app notifications, and reusable templates."
          breadcrumbs={[
            { label: "Workspace", onClick: () => navigate("/workspace") },
            { label: "Education SIS", onClick: () => navigate("/workspace/education") },
            { label: "Communication" },
          ]}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActiveTab("compose");
                }}
                className="border-white/10 text-slate-300 hover:text-white"
              >
                <PenSquare className="mr-2 h-4 w-4 text-emerald-400" />
                Compose
              </Button>
              <Button
                size="sm"
                onClick={openCreateAnnouncementModal}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
              >
                <Plus className="mr-2 h-4 w-4" />
                New Announcement
              </Button>
            </div>
          }
        />

        <Link to="/workspace/education" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Education SIS
        </Link>

        {actionSuccess && (
          <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
            <button onClick={() => setActionSuccess(null)} className="text-emerald-400 hover:text-emerald-200">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {actionError && (
          <div className="flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-200">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Global KPI Cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <CommunicationStatCard
            icon={<Megaphone className="h-5 w-5" />}
            label="Announcements"
            value={summary.publishedAnnouncements}
            subtext={`${summary.totalAnnouncements} total (${summary.scheduledAnnouncements} scheduled)`}
            variant="purple"
          />
          <CommunicationStatCard
            icon={<Send className="h-5 w-5" />}
            label="Messages Sent"
            value={summary.communicationsSent}
            subtext="Targeted communications"
            variant="blue"
          />
          <CommunicationStatCard
            icon={<Bell className="h-5 w-5" />}
            label="Unread Inbox"
            value={summary.unreadNotifications}
            subtext="In-app notifications"
            variant="amber"
          />
          <CommunicationStatCard
            icon={<Users className="h-5 w-5" />}
            label="Active Audience"
            value={resolvedRecipients.length}
            subtext="Deduplicated recipients"
            variant="emerald"
          />
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-white/5 pb-2 overflow-x-auto gap-2">
          {(
            [
              { id: "overview", label: "Overview", icon: Layers },
              { id: "announcements", label: "Announcements", icon: Megaphone, count: announcements.length },
              { id: "compose", label: "Targeted Messaging", icon: PenSquare },
              { id: "notifications", label: "Notification Inbox", icon: Inbox, count: summary.unreadNotifications },
              { id: "templates", label: "Templates", icon: Clock, count: templates.length },
              { id: "delivery", label: "Delivery History", icon: Mail, count: deliveries.length },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as CommunicationTab)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all shrink-0 ${
                  isActive
                    ? "bg-slate-800 text-white shadow-sm border border-white/10"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-emerald-400" : "text-slate-500"}`} />
                <span>{tab.label}</span>
                {"count" in tab && typeof tab.count === "number" && tab.count > 0 && (
                  <span
                    className={`ml-1 text-xs px-2 py-0.5 rounded-full ${
                      tab.id === "notifications" && summary.unreadNotifications > 0
                        ? "bg-amber-500/20 text-amber-300 font-bold"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {isLoading ? (
          <Card className="bg-[#0f141f] border-white/5">
            <CardContent className="p-12 text-center text-slate-400 space-y-2">
              <div className="animate-spin size-6 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto" />
              <p>Loading communication workspace...</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* ==================== TAB 1: OVERVIEW ==================== */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Delivery Channels Status Banner */}
                <Card className="bg-[#0f141f] border-white/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <Radio className="h-4 w-4 text-emerald-400" />
                      Delivery Infrastructure & Channel Readiness
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-white">In-App Notifications</span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-300">
                            Operational
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">Database-backed notification inbox with instant state persistence.</p>
                      </div>

                      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3.5 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-white">Email Delivery</span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/20 text-blue-300">
                            Staging Mock Active
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">Queued through safe mock transport. Zero external email leakage.</p>
                      </div>

                      <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-3.5 space-y-1 opacity-75">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-300">SMS Gateway</span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-700 text-slate-400">
                            Provider Not Configured
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">Safely kept unavailable per production governance requirements.</p>
                      </div>

                      <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-3.5 space-y-1 opacity-75">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-300">WhatsApp Gateway</span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-700 text-slate-400">
                            Provider Not Configured
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">Disabled until approved WhatsApp Business provider credentials exist.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Dashboard Dual Panel */}
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Recent Announcements */}
                  <Card className="bg-[#0f141f] border-white/5">
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                      <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                        <Megaphone className="h-4 w-4 text-emerald-400" />
                        Recent Announcements
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActiveTab("announcements")}
                        className="text-xs text-emerald-400 hover:text-emerald-300 p-0 h-auto"
                      >
                        View all ({announcements.length}) →
                      </Button>
                    </CardHeader>
                    <CardContent>
                      {announcements.length === 0 ? (
                        <div className="rounded-xl border border-white/5 py-10 text-center text-sm text-slate-500">
                          No announcements created yet.
                        </div>
                      ) : (
                        <div className="divide-y divide-white/5">
                          {announcements.slice(0, 5).map((item) => (
                            <div key={item.id} className="py-3.5 flex items-start justify-between gap-3">
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium text-white truncate text-sm">{item.title}</p>
                                  <AnnouncementStatusBadge status={item.status} />
                                  <AnnouncementPriorityBadge priority={item.priority} />
                                </div>
                                <p className="text-xs text-slate-400 line-clamp-1">{item.content}</p>
                                <div className="flex items-center gap-3 text-xs text-slate-500">
                                  <span>{item.recipientCount} recipients</span>
                                  <span>•</span>
                                  <AudienceTypeBadge type={item.audience.type} />
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPreviewingAnnouncement(item)}
                                className="border-white/10 text-slate-300 hover:text-white h-7 px-2 text-xs shrink-0"
                              >
                                <Eye className="h-3.5 w-3.5 mr-1" />
                                Preview
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Recent Targeted Messages */}
                  <Card className="bg-[#0f141f] border-white/5">
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                      <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                        <Send className="h-4 w-4 text-blue-400" />
                        Recent Targeted Communications
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActiveTab("delivery")}
                        className="text-xs text-blue-400 hover:text-blue-300 p-0 h-auto"
                      >
                        Delivery history ({deliveries.length}) →
                      </Button>
                    </CardHeader>
                    <CardContent>
                      {communications.length === 0 ? (
                        <div className="rounded-xl border border-white/5 py-10 text-center text-sm text-slate-500">
                          No targeted communications dispatched yet.
                        </div>
                      ) : (
                        <div className="divide-y divide-white/5">
                          {communications.slice(0, 5).map((msg) => (
                            <div key={msg.id} className="py-3.5 flex items-start justify-between gap-3">
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium text-white truncate text-sm">{msg.subject}</p>
                                  <span className="text-xs px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 capitalize font-medium">
                                    {msg.status}
                                  </span>
                                  <AnnouncementPriorityBadge priority={msg.priority} />
                                </div>
                                <p className="text-xs text-slate-400 line-clamp-1">{msg.body}</p>
                                <div className="flex items-center gap-3 text-xs text-slate-500">
                                  <span>{msg.recipientCount} recipients</span>
                                  <span>•</span>
                                  <span>via {msg.channels.join(", ")}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* ==================== TAB 2: ANNOUNCEMENTS MANAGEMENT ==================== */}
            {activeTab === "announcements" && (
              <div className="space-y-4">
                {/* Search and Filters Bar */}
                <Card className="bg-[#0f141f] border-white/5">
                  <CardContent className="p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                    <div className="flex flex-1 flex-col sm:flex-row gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder="Search announcements by title or content..."
                          value={announcementSearch}
                          onChange={(e) => {
                            setAnnouncementSearch(e.target.value);
                            setAnnouncementPage(1);
                          }}
                          className="pl-9 bg-slate-900 border-white/10 text-white"
                        />
                      </div>
                      <Select
                        value={announcementStatusFilter}
                        onChange={(e) => {
                          setAnnouncementStatusFilter(e.target.value);
                          setAnnouncementPage(1);
                        }}
                        className="w-full sm:w-36 bg-slate-900 border-white/10 text-white"
                      >
                        <option value="all">All Statuses</option>
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="archived">Archived</option>
                      </Select>
                      <Select
                        value={announcementCategoryFilter}
                        onChange={(e) => {
                          setAnnouncementCategoryFilter(e.target.value);
                          setAnnouncementPage(1);
                        }}
                        className="w-full sm:w-40 bg-slate-900 border-white/10 text-white"
                      >
                        <option value="all">All Categories</option>
                        {announcementCategories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </Select>
                      <Select
                        value={announcementPriorityFilter}
                        onChange={(e) => {
                          setAnnouncementPriorityFilter(e.target.value);
                          setAnnouncementPage(1);
                        }}
                        className="w-full sm:w-36 bg-slate-900 border-white/10 text-white"
                      >
                        <option value="all">All Priorities</option>
                        {priorities.map((p) => (
                          <option key={p} value={p}>
                            {p.charAt(0).toUpperCase() + p.slice(1)}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <Button onClick={openCreateAnnouncementModal} className="bg-emerald-600 hover:bg-emerald-500 text-white shrink-0">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Announcement
                    </Button>
                  </CardContent>
                </Card>

                {/* Announcements Table */}
                <Card className="bg-[#0f141f] border-white/5">
                  <CardContent className="p-0">
                    {paginatedAnnouncements.length === 0 ? (
                      <div className="py-16 text-center text-slate-500 space-y-2">
                        <Megaphone className="h-8 w-8 mx-auto text-slate-600" />
                        <p className="text-base font-medium text-slate-400">No announcements found</p>
                        <p className="text-xs text-slate-500">Create a new announcement or adjust filter criteria.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-300">
                          <thead className="border-b border-white/10 bg-slate-900/50 text-xs uppercase tracking-wider text-slate-400">
                            <tr>
                              <th className="px-6 py-3.5 font-semibold">Title & Content</th>
                              <th className="px-4 py-3.5 font-semibold">Category</th>
                              <th className="px-4 py-3.5 font-semibold">Audience</th>
                              <th className="px-4 py-3.5 font-semibold">Priority</th>
                              <th className="px-4 py-3.5 font-semibold">Status</th>
                              <th className="px-4 py-3.5 font-semibold">Recipients</th>
                              <th className="px-4 py-3.5 font-semibold">Dates</th>
                              <th className="px-6 py-3.5 font-semibold text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {paginatedAnnouncements.map((item) => (
                              <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="font-semibold text-white max-w-xs truncate">{item.title}</div>
                                  <div className="text-xs text-slate-400 max-w-xs truncate">{item.content}</div>
                                </td>
                                <td className="px-4 py-4">
                                  <span className="text-xs px-2 py-0.5 rounded bg-slate-800 border border-white/10 text-slate-300">
                                    {item.category || "General"}
                                  </span>
                                </td>
                                <td className="px-4 py-4">
                                  <AudienceTypeBadge type={item.audience.type} />
                                </td>
                                <td className="px-4 py-4">
                                  <AnnouncementPriorityBadge priority={item.priority} />
                                </td>
                                <td className="px-4 py-4">
                                  <AnnouncementStatusBadge status={item.status} />
                                </td>
                                <td className="px-4 py-4 font-mono text-xs">{item.recipientCount}</td>
                                <td className="px-4 py-4 text-xs text-slate-400 space-y-0.5">
                                  {item.publishedAt ? (
                                    <div>Pub: {item.publishedAt.split("T")[0]}</div>
                                  ) : item.publishAt ? (
                                    <div>Sched: {item.publishAt.split("T")[0]}</div>
                                  ) : null}
                                  {item.expiresAt && <div>Exp: {item.expiresAt.split("T")[0]}</div>}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setPreviewingAnnouncement(item)}
                                      className="h-8 px-2 text-slate-400 hover:text-white"
                                      title="Preview Announcement"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>

                                    {item.status !== "published" && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => openEditAnnouncementModal(item)}
                                        className="h-8 px-2 text-slate-400 hover:text-white"
                                        title="Edit Announcement"
                                      >
                                        <PenSquare className="h-4 w-4" />
                                      </Button>
                                    )}

                                    {item.status === "draft" && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handlePublishAnnouncement(item.id)}
                                        disabled={isSubmitting}
                                        className="h-8 px-2 text-emerald-400 hover:text-emerald-300"
                                        title="Publish Now"
                                      >
                                        <Send className="h-4 w-4" />
                                      </Button>
                                    )}

                                    {item.status === "published" && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleArchiveAnnouncement(item.id)}
                                        disabled={isSubmitting}
                                        className="h-8 px-2 text-amber-400 hover:text-amber-300"
                                        title="Archive Announcement"
                                      >
                                        <Archive className="h-4 w-4" />
                                      </Button>
                                    )}

                                    {item.status !== "published" && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteAnnouncement(item.id)}
                                        disabled={isSubmitting}
                                        className="h-8 px-2 text-red-400 hover:text-red-300"
                                        title="Delete"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Pagination */}
                    {totalAnnouncementPages > 1 && (
                      <div className="flex items-center justify-between border-t border-white/5 px-6 py-3 text-xs text-slate-400">
                        <span>
                          Showing page {announcementPage} of {totalAnnouncementPages} ({filteredAnnouncements.length} announcements)
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={announcementPage <= 1}
                            onClick={() => setAnnouncementPage((p) => p - 1)}
                            className="border-white/10 h-7 w-7 p-0"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={announcementPage >= totalAnnouncementPages}
                            onClick={() => setAnnouncementPage((p) => p + 1)}
                            className="border-white/10 h-7 w-7 p-0"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ==================== TAB 3: TARGETED MESSAGING COMPOSER ==================== */}
            {activeTab === "compose" && (
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Message Composition Form */}
                <div className="lg:col-span-2 space-y-4">
                  <Card className="bg-[#0f141f] border-white/5">
                    <CardHeader className="pb-3 border-b border-white/5">
                      <CardTitle className="text-base font-semibold text-white flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <PenSquare className="h-4 w-4 text-emerald-400" />
                          Compose Targeted Message
                        </span>
                        {templates.length > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">Template:</span>
                            <Select
                              value={composeForm.templateId}
                              onChange={(e) => handleSelectTemplate(e.target.value)}
                              className="text-xs bg-slate-900 border-white/10 text-white h-8"
                            >
                              <option value="">Blank message</option>
                              {templates.map((tpl) => (
                                <option key={tpl.id} value={tpl.id}>
                                  {tpl.name}
                                </option>
                              ))}
                            </Select>
                          </div>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="sm:col-span-2 space-y-1">
                          <label className="text-xs font-medium text-slate-300">Subject</label>
                          <Input
                            placeholder="e.g. Important Attendance & Term Updates"
                            value={composeForm.subject}
                            onChange={(e) => setComposeForm({ ...composeForm, subject: e.target.value })}
                            className="bg-slate-900 border-white/10 text-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-300">Priority</label>
                          <Select
                            value={composeForm.priority}
                            onChange={(e) => setComposeForm({ ...composeForm, priority: e.target.value as CommunicationPriority })}
                            className="bg-slate-900 border-white/10 text-white"
                          >
                            {priorities.map((p) => (
                              <option key={p} value={p}>
                                {p.charAt(0).toUpperCase() + p.slice(1)}
                              </option>
                            ))}
                          </Select>
                        </div>
                      </div>

                      {/* Variable Insertion Chips */}
                      <div className="space-y-1.5 rounded-xl border border-white/5 bg-slate-900/60 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                            <Layers className="h-3.5 w-3.5 text-emerald-400" />
                            Insert dynamic placeholders (Click to insert)
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {supportedPlaceholders.map((ph) => (
                            <button
                              key={ph.key}
                              type="button"
                              onClick={() => insertVariablePlaceholder(ph.key)}
                              className="px-2 py-1 rounded-md text-xs font-mono bg-slate-800 hover:bg-emerald-950/60 hover:text-emerald-300 hover:border-emerald-500/30 text-slate-300 border border-white/10 transition-colors"
                              title={`Click to insert {{${ph.key}}} (e.g. ${ph.example})`}
                            >
                              +{`{{${ph.key}}}`}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-300">Message Content</label>
                        <Textarea
                          placeholder="Compose your message here. Dynamic placeholders like {{student_name}} will be safely populated per recipient."
                          value={composeForm.body}
                          onChange={(e) => setComposeForm({ ...composeForm, body: e.target.value })}
                          className="min-h-40 bg-slate-900 border-white/10 text-white leading-relaxed"
                        />
                      </div>

                      {/* Delivery Channels Selector */}
                      <div className="space-y-2 pt-2 border-t border-white/5">
                        <label className="text-xs font-medium text-slate-300">Delivery Channels</label>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {/* In-App Channel */}
                          <label className="flex items-center gap-3 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={composeForm.channels.includes("in_app")}
                              onChange={(e) => {
                                setComposeForm((prev) => ({
                                  ...prev,
                                  channels: e.target.checked
                                    ? [...prev.channels, "in_app"]
                                    : prev.channels.filter((c) => c !== "in_app"),
                                }));
                              }}
                              className="rounded border-white/20 bg-slate-900 text-emerald-600 focus:ring-emerald-500"
                            />
                            <div>
                              <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                                <Inbox className="h-3.5 w-3.5 text-emerald-400" />
                                In-App Notification Inbox
                              </div>
                              <p className="text-[11px] text-slate-400">Instant delivery to student & parent workspace</p>
                            </div>
                          </label>

                          {/* Email Channel */}
                          <label className="flex items-center gap-3 p-3 rounded-xl border border-blue-500/20 bg-blue-500/5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={composeForm.channels.includes("email")}
                              onChange={(e) => {
                                setComposeForm((prev) => ({
                                  ...prev,
                                  channels: e.target.checked
                                    ? [...prev.channels, "email"]
                                    : prev.channels.filter((c) => c !== "email"),
                                }));
                              }}
                              className="rounded border-white/20 bg-slate-900 text-blue-600 focus:ring-blue-500"
                            />
                            <div>
                              <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                                <Mail className="h-3.5 w-3.5 text-blue-400" />
                                Email Notification
                              </div>
                              <p className="text-[11px] text-blue-300/80">Staging: Mock Email Transport active</p>
                            </div>
                          </label>

                          {/* SMS Channel (Disabled per spec) */}
                          <div className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-slate-900/40 opacity-50 cursor-not-allowed">
                            <input type="checkbox" disabled checked={false} className="rounded border-white/10" />
                            <div>
                              <div className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                                SMS Notification
                                <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded">Disabled</span>
                              </div>
                              <p className="text-[11px] text-slate-500">Provider not configured</p>
                            </div>
                          </div>

                          {/* WhatsApp Channel (Disabled per spec) */}
                          <div className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-slate-900/40 opacity-50 cursor-not-allowed">
                            <input type="checkbox" disabled checked={false} className="rounded border-white/10" />
                            <div>
                              <div className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                                WhatsApp Notification
                                <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded">Disabled</span>
                              </div>
                              <p className="text-[11px] text-slate-500">Provider not configured</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end pt-3">
                        <Button
                          onClick={handleSendCommunication}
                          disabled={isSubmitting || resolvedRecipients.length === 0}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-6"
                        >
                          {isSubmitting ? "Dispatching..." : `Send to ${resolvedRecipients.length} Recipient(s)`}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Audience Targeting Sidebar */}
                <div className="space-y-4">
                  <Card className="bg-[#0f141f] border-white/5">
                    <CardHeader className="pb-3 border-b border-white/5">
                      <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                        <Users className="h-4 w-4 text-emerald-400" />
                        Target Audience
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-4">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-300">Audience Scope</label>
                        <Select
                          value={audience.type}
                          onChange={(e) => handleAudienceTypeChange(e.target.value as AudienceType)}
                          className="bg-slate-900 border-white/10 text-white text-xs"
                        >
                          {audienceTypes.map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </Select>
                      </div>

                      {/* Class / Section Targeting Dropdowns */}
                      {(audience.type === "class" || audience.type === "section") && (
                        <div className="space-y-2 rounded-xl bg-slate-900/60 p-3 border border-white/5">
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-400">Academic Year</label>
                            <Select
                              value={audience.academicYear || ""}
                              onChange={(e) => setAudience({ ...audience, academicYear: e.target.value })}
                              className="bg-slate-900 border-white/10 text-white text-xs"
                            >
                              {academicYears.map((y) => (
                                <option key={y.id} value={y.name}>
                                  {y.name}
                                </option>
                              ))}
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-400">Grade / Class</label>
                            <Select
                              value={audience.gradeId || ""}
                              onChange={(e) => setAudience({ ...audience, gradeId: e.target.value })}
                              className="bg-slate-900 border-white/10 text-white text-xs"
                            >
                              {grades.map((g) => (
                                <option key={g.id} value={g.id}>
                                  {g.name}
                                </option>
                              ))}
                            </Select>
                          </div>

                          {audience.type === "section" && (
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-slate-400">Section</label>
                              <Select
                                value={audience.sectionId || ""}
                                onChange={(e) => setAudience({ ...audience, sectionId: e.target.value })}
                                className="bg-slate-900 border-white/10 text-white text-xs"
                              >
                                {sections
                                  .filter((s) => !audience.gradeId || s.gradeId === audience.gradeId)
                                  .map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.name}
                                    </option>
                                  ))}
                              </Select>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Specific Student Targeting */}
                      {audience.type === "selected_students" && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-300">Select Student</label>
                          <Select
                            value={audience.studentIds?.[0] || ""}
                            onChange={(e) => setAudience({ ...audience, studentIds: [e.target.value] })}
                            className="bg-slate-900 border-white/10 text-white text-xs"
                          >
                            {students.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.firstName} {s.lastName} ({s.admissionNumber})
                              </option>
                            ))}
                          </Select>
                        </div>
                      )}

                      {/* Specific Staff Targeting */}
                      {audience.type === "selected_staff" && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-300">Select Staff Member</label>
                          <Select
                            value={audience.staffIds?.[0] || ""}
                            onChange={(e) => setAudience({ ...audience, staffIds: [e.target.value] })}
                            className="bg-slate-900 border-white/10 text-white text-xs"
                          >
                            {staff.map((st) => (
                              <option key={st.id} value={st.id}>
                                {st.firstName} {st.lastName} ({st.staffType})
                              </option>
                            ))}
                          </Select>
                        </div>
                      )}

                      {/* Live Audience Preview Box */}
                      <div className="rounded-xl border border-white/5 bg-slate-900/80 p-3 space-y-2 mt-3">
                        <div className="flex items-center justify-between text-xs font-medium text-slate-300">
                          <span>Resolved Recipients</span>
                          <span className="font-bold text-emerald-400 font-mono text-sm">
                            {isResolvingAudience ? "..." : resolvedRecipients.length}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Cross-tenant protection and recipient deduplication active.
                        </p>

                        {resolvedRecipients.length > 0 && (
                          <div className="pt-2 border-t border-white/5 space-y-1 max-h-48 overflow-y-auto">
                            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                              Preview (first {Math.min(5, resolvedRecipients.length)})
                            </span>
                            {resolvedRecipients.slice(0, 5).map((r) => (
                              <div key={`${r.kind}-${r.id}`} className="flex items-center justify-between text-xs py-1">
                                <span className="text-slate-300 truncate max-w-[140px]">{r.displayName}</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 capitalize">
                                  {r.kind}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* ==================== TAB 4: NOTIFICATION INBOX ==================== */}
            {activeTab === "notifications" && (
              <div className="space-y-4">
                {/* Notification Controls Bar */}
                <Card className="bg-[#0f141f] border-white/5">
                  <CardContent className="p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                    <div className="flex flex-1 flex-col sm:flex-row gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder="Search notifications..."
                          value={notificationSearch}
                          onChange={(e) => setNotificationSearch(e.target.value)}
                          className="pl-9 bg-slate-900 border-white/10 text-white"
                        />
                      </div>
                      <Select
                        value={notificationStatusFilter}
                        onChange={(e) => setNotificationStatusFilter(e.target.value as "all" | "unread" | "read")}
                        className="w-full sm:w-36 bg-slate-900 border-white/10 text-white"
                      >
                        <option value="all">All States</option>
                        <option value="unread">Unread Only</option>
                        <option value="read">Read Only</option>
                      </Select>
                    </div>
                    {summary.unreadNotifications > 0 && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleMarkAllRead}
                        disabled={isSubmitting}
                        className="shrink-0 text-xs"
                      >
                        <CheckCheck className="mr-1.5 h-4 w-4 text-emerald-400" />
                        Mark All as Read ({summary.unreadNotifications})
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {/* Notifications List */}
                <Card className="bg-[#0f141f] border-white/5">
                  <CardContent className="p-0">
                    {filteredNotifications.length === 0 ? (
                      <div className="py-16 text-center text-slate-500 space-y-2">
                        <Inbox className="h-8 w-8 mx-auto text-slate-600" />
                        <p className="text-base font-medium text-slate-400">Inbox is empty</p>
                        <p className="text-xs text-slate-500">No notifications match your current filter.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-white/5">
                        {filteredNotifications.map((n) => (
                          <div
                            key={n.id}
                            className={`p-4 flex items-start justify-between gap-4 transition-colors ${
                              !n.isRead ? "bg-emerald-950/10 hover:bg-emerald-950/20" : "hover:bg-slate-800/30"
                            }`}
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="pt-1 shrink-0">
                                {!n.isRead ? (
                                  <span className="block size-2.5 rounded-full bg-emerald-400 ring-4 ring-emerald-500/20" />
                                ) : (
                                  <span className="block size-2 rounded-full bg-slate-600" />
                                )}
                              </div>
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className={`text-sm font-semibold ${!n.isRead ? "text-white" : "text-slate-300"}`}>
                                    {n.title}
                                  </p>
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-white/5 font-mono">
                                    {n.type}
                                  </span>
                                  <AnnouncementPriorityBadge priority={n.priority} />
                                </div>
                                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{n.message}</p>
                                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                  <span>{n.createdAt.split("T")[0]}</span>
                                  {n.actionPath && (
                                    <>
                                      <span>•</span>
                                      <Link
                                        to={n.actionPath}
                                        className="text-emerald-400 hover:underline flex items-center gap-0.5"
                                      >
                                        View SIS Record <ExternalLink className="h-2.5 w-2.5" />
                                      </Link>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {!n.isRead && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleMarkRead(n.id)}
                                  className="h-7 px-2 text-xs text-slate-400 hover:text-white"
                                >
                                  Mark read
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedNotification(n)}
                                className="h-7 px-2 text-xs border-white/10 text-slate-300 hover:text-white"
                              >
                                View
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ==================== TAB 5: TEMPLATES MANAGEMENT ==================== */}
            {activeTab === "templates" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-slate-400">
                    Create reusable, parameterized message templates with safe placeholder validation.
                  </p>
                  <Button onClick={openCreateTemplateModal} className="bg-emerald-600 hover:bg-emerald-500 text-white shrink-0">
                    <Plus className="mr-2 h-4 w-4" />
                    New Template
                  </Button>
                </div>

                <Card className="bg-[#0f141f] border-white/5">
                  <CardContent className="p-0">
                    {templates.length === 0 ? (
                      <div className="py-16 text-center text-slate-500 space-y-2">
                        <Clock className="h-8 w-8 mx-auto text-slate-600" />
                        <p className="text-base font-medium text-slate-400">No message templates</p>
                        <p className="text-xs text-slate-500">Create a template for attendance, exam results, or fee notices.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-300">
                          <thead className="border-b border-white/10 bg-slate-900/50 text-xs uppercase tracking-wider text-slate-400">
                            <tr>
                              <th className="px-6 py-3.5 font-semibold">Template Name</th>
                              <th className="px-4 py-3.5 font-semibold">Category</th>
                              <th className="px-4 py-3.5 font-semibold">Subject</th>
                              <th className="px-4 py-3.5 font-semibold">Supported Placeholders</th>
                              <th className="px-4 py-3.5 font-semibold">Status</th>
                              <th className="px-6 py-3.5 font-semibold text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {templates.map((tpl) => (
                              <tr key={tpl.id} className="hover:bg-slate-800/30 transition-colors">
                                <td className="px-6 py-4 font-semibold text-white">{tpl.name}</td>
                                <td className="px-4 py-4">
                                  <span className="text-xs px-2 py-0.5 rounded bg-slate-800 border border-white/10 text-slate-300">
                                    {tpl.category}
                                  </span>
                                </td>
                                <td className="px-4 py-4 text-xs text-slate-300 max-w-xs truncate">{tpl.subject}</td>
                                <td className="px-4 py-4">
                                  <div className="flex flex-wrap gap-1 max-w-xs">
                                    {tpl.supportedVariables.map((v) => (
                                      <span key={v} className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-emerald-400 font-mono">
                                        {`{{${v}}}`}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="px-4 py-4">
                                  <Badge variant={tpl.status === "active" ? "default" : "secondary"}>{tpl.status}</Badge>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openEditTemplateModal(tpl)}
                                      className="h-8 px-2 text-slate-400 hover:text-white"
                                    >
                                      <PenSquare className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteTemplate(tpl.id)}
                                      disabled={isSubmitting}
                                      className="h-8 px-2 text-red-400 hover:text-red-300"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ==================== TAB 6: DELIVERY HISTORY ==================== */}
            {activeTab === "delivery" && (
              <div className="space-y-4">
                <Card className="bg-[#0f141f] border-white/5">
                  <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                    <div className="flex flex-1 flex-col sm:flex-row gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder="Search delivery logs by recipient..."
                          value={deliverySearch}
                          onChange={(e) => setDeliverySearch(e.target.value)}
                          className="pl-9 bg-slate-900 border-white/10 text-white"
                        />
                      </div>
                      <Select
                        value={deliveryChannelFilter}
                        onChange={(e) => setDeliveryChannelFilter(e.target.value)}
                        className="w-full sm:w-36 bg-slate-900 border-white/10 text-white"
                      >
                        <option value="all">All Channels</option>
                        <option value="in_app">In-App</option>
                        <option value="email">Email</option>
                        <option value="sms">SMS</option>
                        <option value="whatsapp">WhatsApp</option>
                      </Select>
                      <Select
                        value={deliveryStatusFilter}
                        onChange={(e) => setDeliveryStatusFilter(e.target.value)}
                        className="w-full sm:w-36 bg-slate-900 border-white/10 text-white"
                      >
                        <option value="all">All Statuses</option>
                        <option value="sent">Sent</option>
                        <option value="delivered">Delivered</option>
                        <option value="queued">Queued</option>
                        <option value="failed">Failed</option>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-[#0f141f] border-white/5">
                  <CardContent className="p-0">
                    {filteredDeliveries.length === 0 ? (
                      <div className="py-16 text-center text-slate-500 space-y-2">
                        <Mail className="h-8 w-8 mx-auto text-slate-600" />
                        <p className="text-base font-medium text-slate-400">No delivery logs recorded</p>
                        <p className="text-xs text-slate-500">Delivery records appear here when communications are dispatched.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-300">
                          <thead className="border-b border-white/10 bg-slate-900/50 text-xs uppercase tracking-wider text-slate-400">
                            <tr>
                              <th className="px-6 py-3.5 font-semibold">Channel</th>
                              <th className="px-4 py-3.5 font-semibold">Recipient Kind</th>
                              <th className="px-4 py-3.5 font-semibold">Recipient ID</th>
                              <th className="px-4 py-3.5 font-semibold">Status</th>
                              <th className="px-4 py-3.5 font-semibold">Dispatched Date</th>
                              <th className="px-6 py-3.5 font-semibold">Provider / Failure Detail</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {filteredDeliveries.map((item) => (
                              <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                                <td className="px-6 py-4">
                                  <span className="font-mono text-xs uppercase font-semibold text-white px-2 py-0.5 rounded bg-slate-800 border border-white/10">
                                    {item.channel}
                                  </span>
                                </td>
                                <td className="px-4 py-4 capitalize">{item.recipientKind}</td>
                                <td className="px-4 py-4 font-mono text-xs text-slate-400 truncate max-w-[120px]">
                                  {item.recipientId}
                                </td>
                                <td className="px-4 py-4">
                                  <DeliveryStatusBadge status={item.status} />
                                </td>
                                <td className="px-4 py-4 text-xs text-slate-400">
                                  {item.sentAt?.split("T")[0] || item.queuedAt.split("T")[0]}
                                </td>
                                <td className="px-6 py-4 text-xs">
                                  {item.status === "failed" ? (
                                    <span className="text-red-400">
                                      {item.errorCategory || "PROVIDER_UNAVAILABLE: Provider not configured"}
                                    </span>
                                  ) : item.channel === "email" ? (
                                    <span className="text-slate-400">mock-email-transport</span>
                                  ) : (
                                    <span className="text-emerald-400">In-app inbox delivered</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}

        {/* ==================== MODALS ==================== */}

        {/* 1. Create / Edit Announcement Modal */}
        {isAnnouncementModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0f141f] border border-white/10 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <h3 className="text-lg font-semibold text-white">
                  {editingAnnouncementId ? "Edit Announcement" : "Create New Announcement"}
                </h3>
                <button
                  onClick={() => setIsAnnouncementModalOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Title *</label>
                  <Input
                    placeholder="e.g. End of Term Examination Schedule"
                    value={announcementForm.title}
                    onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                    className="bg-slate-900 border-white/10 text-white"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-300">Category</label>
                    <Select
                      value={announcementForm.category}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, category: e.target.value })}
                      className="bg-slate-900 border-white/10 text-white text-xs"
                    >
                      {announcementCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-300">Priority</label>
                    <Select
                      value={announcementForm.priority}
                      onChange={(e) =>
                        setAnnouncementForm({ ...announcementForm, priority: e.target.value as CommunicationPriority })
                      }
                      className="bg-slate-900 border-white/10 text-white text-xs"
                    >
                      {priorities.map((p) => (
                        <option key={p} value={p}>
                          {p.charAt(0).toUpperCase() + p.slice(1)}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Target Audience Scope</label>
                  <Select
                    value={audience.type}
                    onChange={(e) => handleAudienceTypeChange(e.target.value as AudienceType)}
                    className="bg-slate-900 border-white/10 text-white text-xs"
                  >
                    {audienceTypes.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Announcement Body *</label>
                  <Textarea
                    placeholder="Write the full announcement message here..."
                    value={announcementForm.content}
                    onChange={(e) => setAnnouncementForm({ ...announcementForm, content: e.target.value })}
                    className="min-h-32 bg-slate-900 border-white/10 text-white"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-300">Publication Date</label>
                    <Input
                      type="date"
                      value={announcementForm.publishAt}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, publishAt: e.target.value })}
                      className="bg-slate-900 border-white/10 text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-300">Expiration Date (Optional)</label>
                    <Input
                      type="date"
                      value={announcementForm.expiresAt}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, expiresAt: e.target.value })}
                      className="bg-slate-900 border-white/10 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Initial Status</label>
                  <Select
                    value={announcementForm.status}
                    onChange={(e) =>
                      setAnnouncementForm({ ...announcementForm, status: e.target.value as AnnouncementStatus })
                    }
                    className="bg-slate-900 border-white/10 text-white text-xs"
                  >
                    <option value="draft">Draft (Save for review)</option>
                    <option value="published">Published (Dispatch notifications now)</option>
                    <option value="scheduled">Scheduled (Publish on designated date)</option>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/5">
                <Button variant="ghost" onClick={() => setIsAnnouncementModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveAnnouncement} disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                  {isSubmitting ? "Saving..." : editingAnnouncementId ? "Update Announcement" : "Create Announcement"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 2. Announcement Preview Modal */}
        {previewingAnnouncement && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0f141f] border border-white/10 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-start justify-between pb-3 border-b border-white/5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <AnnouncementStatusBadge status={previewingAnnouncement.status} />
                    <AnnouncementPriorityBadge priority={previewingAnnouncement.priority} />
                    <AudienceTypeBadge type={previewingAnnouncement.audience.type} />
                  </div>
                  <h3 className="text-xl font-bold text-white pt-1">{previewingAnnouncement.title}</h3>
                </div>
                <button onClick={() => setPreviewingAnnouncement(null)} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap py-2">
                {previewingAnnouncement.content}
              </div>

              <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3 space-y-1 text-xs text-slate-400">
                <div className="flex justify-between">
                  <span>Category:</span>
                  <span className="text-white font-medium">{previewingAnnouncement.category || "General"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Audience Scope:</span>
                  <span className="text-white font-medium">{previewingAnnouncement.audience.type}</span>
                </div>
                <div className="flex justify-between">
                  <span>Recipients Count:</span>
                  <span className="text-white font-medium">{previewingAnnouncement.recipientCount}</span>
                </div>
                {previewingAnnouncement.publishedAt && (
                  <div className="flex justify-between">
                    <span>Published Date:</span>
                    <span className="text-white font-medium">{previewingAnnouncement.publishedAt.split("T")[0]}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button variant="outline" onClick={() => setPreviewingAnnouncement(null)} className="border-white/10 text-white">
                  Close Preview
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 3. Notification Detail Modal */}
        {selectedNotification && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0f141f] border border-white/10 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-start justify-between pb-3 border-b border-white/5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                      {selectedNotification.type}
                    </span>
                    <AnnouncementPriorityBadge priority={selectedNotification.priority} />
                  </div>
                  <h3 className="text-lg font-bold text-white pt-1">{selectedNotification.title}</h3>
                </div>
                <button onClick={() => setSelectedNotification(null)} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap py-2">
                {selectedNotification.message}
              </div>

              <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3 space-y-1 text-xs text-slate-400">
                <div className="flex justify-between">
                  <span>Received:</span>
                  <span className="text-white">{selectedNotification.createdAt}</span>
                </div>
                <div className="flex justify-between">
                  <span>Recipient Kind:</span>
                  <span className="text-white capitalize">{selectedNotification.recipientKind}</span>
                </div>
                {selectedNotification.relatedResourceType && (
                  <div className="flex justify-between">
                    <span>Related Resource:</span>
                    <span className="text-white font-mono">{selectedNotification.relatedResourceType}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center pt-2">
                {selectedNotification.actionPath ? (
                  <Link to={selectedNotification.actionPath}>
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white">
                      Navigate to SIS Record
                      <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  </Link>
                ) : (
                  <div />
                )}
                <Button variant="outline" onClick={() => setSelectedNotification(null)} className="border-white/10 text-white">
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 4. Create / Edit Template Modal */}
        {isTemplateModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0f141f] border border-white/10 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <h3 className="text-lg font-semibold text-white">
                  {editingTemplateId ? "Edit Template" : "Create New Template"}
                </h3>
                <button onClick={() => setIsTemplateModalOpen(false)} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Template Name *</label>
                  <Input
                    placeholder="e.g. Attendance Absence Notice"
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                    className="bg-slate-900 border-white/10 text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Category</label>
                  <Select
                    value={templateForm.category}
                    onChange={(e) => setTemplateForm({ ...templateForm, category: e.target.value })}
                    className="bg-slate-900 border-white/10 text-white text-xs"
                  >
                    {templateCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Subject *</label>
                  <Input
                    placeholder="e.g. Absence notification for {{student_name}}"
                    value={templateForm.subject}
                    onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })}
                    className="bg-slate-900 border-white/10 text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Message Body *</label>
                  <Textarea
                    placeholder="Dear {{guardian_name}}, this is to inform you that {{student_name}} was marked absent from {{class_name}} today."
                    value={templateForm.content}
                    onChange={(e) => setTemplateForm({ ...templateForm, content: e.target.value })}
                    className="min-h-32 bg-slate-900 border-white/10 text-white"
                  />
                </div>

                {/* Variable Selector */}
                <div className="space-y-1.5 rounded-xl border border-white/5 bg-slate-900/60 p-3">
                  <label className="text-xs font-medium text-slate-300">Supported Variables</label>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {supportedPlaceholders.map((ph) => {
                      const isSelected = templateForm.supportedVariables.includes(ph.key);
                      return (
                        <button
                          key={ph.key}
                          type="button"
                          onClick={() => {
                            setTemplateForm((prev) => ({
                              ...prev,
                              supportedVariables: isSelected
                                ? prev.supportedVariables.filter((k) => k !== ph.key)
                                : [...prev.supportedVariables, ph.key],
                            }));
                          }}
                          className={`px-2 py-0.5 rounded text-xs font-mono transition-colors border ${
                            isSelected
                              ? "bg-emerald-950/60 text-emerald-300 border-emerald-500/30 font-bold"
                              : "bg-slate-800 text-slate-400 border-white/10"
                          }`}
                        >
                          {isSelected ? "✓ " : "+ "}{`{{${ph.key}}}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/5">
                <Button variant="ghost" onClick={() => setIsTemplateModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveTemplate} disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                  {isSubmitting ? "Saving..." : editingTemplateId ? "Update Template" : "Create Template"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
