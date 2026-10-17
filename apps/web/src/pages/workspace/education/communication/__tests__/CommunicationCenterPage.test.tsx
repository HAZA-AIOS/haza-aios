import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { AuthContext } from "@/auth/AuthProvider";
import { OrgContext } from "@/org/OrgContext";
import { CommunicationCenterPage } from "../CommunicationCenterPage";
import { AcademicService } from "@/modules/education/sis/academic.service";
import { CommunicationService } from "@/modules/education/sis/communication.service";
import { StudentService } from "@/modules/education/sis/student.service";
import { StaffService } from "@/modules/education/sis/staff.service";

vi.mock("@/modules/education/sis/academic.service");
vi.mock("@/modules/education/sis/communication.service");
vi.mock("@/modules/education/sis/student.service");
vi.mock("@/modules/education/sis/staff.service");
vi.mock("@/routes/router", () => ({
  Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

const mockUser = {
  id: "user-1",
  firstName: "Admin",
  lastName: "User",
  displayName: "Admin User",
  email: "admin@test.com",
  emailVerified: true,
  status: "active" as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockAuthContextValue = {
  status: "authenticated" as const,
  user: mockUser,
  session: null,
  error: null,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  forgotPassword: async () => {},
  resetPassword: async () => {},
  verifyEmail: async () => {},
  clearError: () => {},
};

const mockOrg = {
  id: "org-1",
  name: "HAZA AIOS Academy",
  legalName: "HAZA AIOS Academy Inc.",
  slug: "haza-academy",
  industry: "Education",
  organizationType: "School",
  email: "school@haza.edu",
  country: "United States",
  timezone: "America/New_York",
  currency: "USD",
  status: "active" as const,
  ownerId: "user-1",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockMembership = {
  id: "membership-1",
  organizationId: "org-1",
  userId: "user-1",
  role: "Admin" as const,
  status: "active" as const,
  joinedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

import type { CommunicationTab } from "../CommunicationCenterPage";

function renderPage(initialTab?: CommunicationTab) {
  const orgContextValue = {
    currentOrganization: mockOrg,
    currentMembership: mockMembership,
    organizations: [mockOrg],
    isLoading: false,
    error: null,
    createOrg: async () => ({ organization: {} as never, membership: {} as never }),
    switchOrg: async () => {},
    refresh: async () => {},
  };

  return render(
    React.createElement(
      AuthContext.Provider,
      { value: mockAuthContextValue },
      React.createElement(
        OrgContext.Provider,
        { value: orgContextValue },
        React.createElement(CommunicationCenterPage, { initialTab })
      )
    )
  );
}

describe("CommunicationCenterPage", { timeout: 30000 }, () => {
  const mockAnnouncements = [
    {
      id: "ann-1",
      organizationId: "org-1",
      title: "End of Term Examinations",
      content: "All final examinations will commence on Monday.",
      category: "Examinations",
      priority: "important" as const,
      status: "published" as const,
      audience: { type: "organization" as const },
      recipientCount: 150,
      createdAt: "2026-10-10T10:00:00Z",
      updatedAt: "2026-10-10T10:00:00Z",
      publishedAt: "2026-10-10T10:00:00Z",
    },
    {
      id: "ann-2",
      organizationId: "org-1",
      title: "Science Fair Registration",
      content: "Register your projects with the department head.",
      category: "School Events",
      priority: "normal" as const,
      status: "draft" as const,
      audience: { type: "class" as const, gradeId: "grade-1", academicYear: "2026-2027" },
      recipientCount: 35,
      createdAt: "2026-10-12T10:00:00Z",
      updatedAt: "2026-10-12T10:00:00Z",
    },
  ];

  const mockCommunications = [
    {
      id: "msg-1",
      organizationId: "org-1",
      subject: "Fee Payment Reminder",
      body: "Please remit term fees before the due date.",
      senderId: "user-1",
      audience: { type: "organization" as const },
      channels: ["in_app" as const, "email" as const],
      priority: "urgent" as const,
      status: "sent" as const,
      recipientCount: 150,
      createdAt: "2026-10-14T09:00:00Z",
      updatedAt: "2026-10-14T09:00:00Z",
      sentAt: "2026-10-14T09:00:00Z",
    },
  ];

  const mockNotifications = [
    {
      id: "notif-1",
      organizationId: "org-1",
      recipientKind: "student" as const,
      recipientId: "student-1",
      type: "exam.scheduled",
      title: "Examination Scheduled",
      message: "Math exam scheduled for Friday.",
      priority: "important" as const,
      isRead: false,
      createdAt: "2026-10-15T08:00:00Z",
      actionPath: "/workspace/education/examinations",
    },
  ];

  const mockTemplates = [
    {
      id: "tpl-1",
      organizationId: "org-1",
      name: "Attendance Absence Notice",
      category: "Attendance",
      subject: "Absence notice for {{student_name}}",
      content: "Dear {{guardian_name}}, {{student_name}} was absent today.",
      supportedVariables: ["student_name", "guardian_name", "school_name"],
      status: "active" as const,
      createdAt: "2026-10-01T00:00:00Z",
      updatedAt: "2026-10-01T00:00:00Z",
    },
  ];

  const mockDeliveries = [
    {
      id: "del-1",
      organizationId: "org-1",
      communicationId: "msg-1",
      recipientId: "student-1",
      recipientKind: "student" as const,
      channel: "in_app" as const,
      status: "sent" as const,
      queuedAt: "2026-10-14T09:00:00Z",
      sentAt: "2026-10-14T09:00:01Z",
      retryCount: 0,
    },
    {
      id: "del-2",
      organizationId: "org-1",
      communicationId: "msg-1",
      recipientId: "student-1",
      recipientKind: "student" as const,
      channel: "sms" as const,
      status: "failed" as const,
      queuedAt: "2026-10-14T09:00:00Z",
      failedAt: "2026-10-14T09:00:01Z",
      errorCategory: "PROVIDER_UNAVAILABLE: SMS provider is not configured.",
      retryCount: 0,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(AcademicService.getAcademicYears).mockResolvedValue([
      { id: "year-1", organizationId: "org-1", name: "2026-2027", startDate: "2026-01-01", endDate: "2026-12-31", status: "active", createdAt: "now", updatedAt: "now" },
    ]);
    vi.mocked(AcademicService.getGrades).mockResolvedValue([
      { id: "grade-1", organizationId: "org-1", name: "Grade 5", level: 5, order: 5, status: "active", createdAt: "now", updatedAt: "now" },
    ]);
    vi.mocked(AcademicService.getSections).mockResolvedValue([
      { id: "sec-1", organizationId: "org-1", gradeId: "grade-1", name: "Section A", capacity: 30, status: "active", createdAt: "now", updatedAt: "now" },
    ]);
    vi.mocked(StudentService.getStudents).mockResolvedValue([
      {
        id: "student-1",
        organizationId: "org-1",
        admissionNumber: "ADM-001",
        firstName: "Amina",
        lastName: "Khan",
        dateOfBirth: "2014-01-01",
        gender: "female",
        admissionDate: "2026-08-01",
        status: "active",
        guardians: [
          {
            id: "guard-1",
            firstName: "Sara",
            lastName: "Khan",
            relationship: "mother",
            isEmergencyContact: true,
            isPrimaryContact: true,
          },
        ],
        createdAt: "now",
        updatedAt: "now",
      },
    ]);
    vi.mocked(StaffService.getStaffList).mockResolvedValue([
      {
        id: "staff-1",
        organizationId: "org-1",
        firstName: "Tariq",
        lastName: "Ali",
        email: "tariq@test.com",
        hireDate: "2026-08-01",
        staffType: "teacher",
        employmentStatus: "full_time",
        status: "active",
        createdAt: "now",
        updatedAt: "now",
      },
    ]);

    vi.mocked(CommunicationService.getAnnouncements).mockResolvedValue(mockAnnouncements);
    vi.mocked(CommunicationService.getCommunications).mockResolvedValue(mockCommunications);
    vi.mocked(CommunicationService.getNotifications).mockResolvedValue(mockNotifications);
    vi.mocked(CommunicationService.getTemplates).mockResolvedValue(mockTemplates);
    vi.mocked(CommunicationService.getDeliveryHistory).mockResolvedValue(mockDeliveries);
    vi.mocked(CommunicationService.getSummary).mockResolvedValue({
      totalAnnouncements: 2,
      publishedAnnouncements: 1,
      scheduledAnnouncements: 0,
      communicationsSent: 1,
      pendingDeliveries: 0,
      failedDeliveries: 1,
      unreadNotifications: 1,
    });
    vi.mocked(CommunicationService.resolveAudience).mockResolvedValue([
      { id: "student-1", organizationId: "org-1", kind: "student", displayName: "Amina Khan" },
      { id: "guard-1", organizationId: "org-1", kind: "guardian", displayName: "Sara Khan" },
      { id: "staff-1", organizationId: "org-1", kind: "teacher", displayName: "Tariq Ali" },
    ]);
    vi.mocked(CommunicationService.getConversations).mockResolvedValue([
      {
        conversationId: "conv-1",
        participantUserId: "user-2",
        participantName: "Sara Khan",
        participantRole: "parent",
        lastMessage: "Thank you for the update on Amina's progress.",
        lastMessageAt: "2026-10-15T10:00:00Z",
        unreadCount: 1,
        totalMessages: 2,
        archived: false,
      },
    ]);
    vi.mocked(CommunicationService.getDirectMessageContacts).mockResolvedValue([
      {
        id: "contact-1",
        userId: "user-2",
        name: "Sara Khan",
        displayName: "Sara Khan",
        role: "parent",
        context: "Mother of Amina Khan (Grade 5)",
      },
    ]);
    vi.mocked(CommunicationService.getPreferences).mockResolvedValue({
      id: "pref-1",
      organizationId: "org-1",
      recipientKind: "staff",
      recipientId: "user-1",
      inAppEnabled: true,
      emailEnabled: true,
      smsEnabled: false,
      academicEnabled: true,
      financeEnabled: true,
      generalEnabled: true,
      attendanceEnabled: true,
      examEnabled: true,
      quietHoursEnabled: false,
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
      createdAt: "now",
      updatedAt: "now",
    });
    vi.mocked(CommunicationService.getConversationMessages).mockResolvedValue([
      {
        id: "dm-1",
        type: "direct_message",
        conversationId: "conv-1",
        senderUserId: "user-2",
        senderName: "Sara Khan",
        senderRole: "parent",
        recipientUserId: "user-1",
        recipientName: "Admin User",
        recipientRole: "admin",
        subject: "Homework Inquiry",
        body: "Thank you for the update on Amina's progress.",
        read: false,
        status: "delivered",
        createdAt: "2026-10-15T10:00:00Z",
        updatedAt: "2026-10-15T10:00:00Z",
      },
    ]);
    vi.mocked(CommunicationService.retryDelivery).mockResolvedValue({
      id: "del-2",
      organizationId: "org-1",
      communicationId: "msg-1",
      recipientId: "student-1",
      recipientKind: "student",
      channel: "sms",
      status: "pending",
      queuedAt: "2026-10-16T10:00:00Z",
      retryCount: 1,
    });
    vi.mocked(CommunicationService.replyToConversation).mockResolvedValue({
      id: "dm-2",
      type: "direct_message",
      conversationId: "conv-1",
      senderUserId: "user-1",
      senderName: "Admin User",
      senderRole: "admin",
      recipientUserId: "user-2",
      recipientName: "Sara Khan",
      recipientRole: "parent",
      body: "You are very welcome! Let us know if you need anything else.",
      read: true,
      status: "delivered",
      createdAt: "2026-10-15T10:05:00Z",
      updatedAt: "2026-10-15T10:05:00Z",
    });
    vi.mocked(CommunicationService.savePreference).mockResolvedValue({
      id: "pref-1",
      organizationId: "org-1",
      recipientKind: "staff",
      recipientId: "user-1",
      inAppEnabled: true,
      emailEnabled: true,
      smsEnabled: false,
      academicEnabled: true,
      financeEnabled: true,
      generalEnabled: true,
      attendanceEnabled: true,
      examEnabled: true,
      quietHoursEnabled: true,
      quietHoursStart: "21:00",
      quietHoursEnd: "06:00",
      createdAt: "now",
      updatedAt: "now",
    });
  });

  it("renders the communication workspace header and overview KPIs", async () => {
    renderPage("overview");

    expect(await screen.findByText("Communication & Notifications")).toBeInTheDocument();
    expect(screen.getByText("Delivery Infrastructure & Channel Readiness")).toBeInTheDocument();
    expect(screen.getByText("In-App Notifications")).toBeInTheDocument();
    expect(screen.getByText("Email Delivery")).toBeInTheDocument();
    expect(screen.getByText("SMS Gateway")).toBeInTheDocument();
    expect(screen.getByText("WhatsApp Gateway")).toBeInTheDocument();

    // Verify announcements list loaded in overview
    expect(screen.getByText("End of Term Examinations")).toBeInTheDocument();
    expect(screen.getByText("Fee Payment Reminder")).toBeInTheDocument();
  });

  it("switches tabs and displays announcement management table", async () => {
    renderPage("announcements");

    expect(await screen.findByText("End of Term Examinations")).toBeInTheDocument();
    expect(screen.getByText("Science Fair Registration")).toBeInTheDocument();
    expect(screen.getByText("Create Announcement")).toBeInTheDocument();

    // Verify filter dropdowns exist
    expect(screen.getByPlaceholderText("Search announcements by title or content...")).toBeInTheDocument();
  });

  it("opens announcement modal and creates a new announcement", async () => {
    renderPage("announcements");

    const newBtn = await screen.findByText("New Announcement");
    fireEvent.click(newBtn);

    expect(screen.getByText("Create New Announcement")).toBeInTheDocument();

    const titleInput = screen.getByPlaceholderText("e.g. End of Term Examination Schedule");
    fireEvent.change(titleInput, { target: { value: "Winter Sports Day" } });

    const bodyInput = screen.getByPlaceholderText("Write the full announcement message here...");
    fireEvent.change(bodyInput, { target: { value: "Sports day events will be held on the sports ground." } });

    vi.mocked(CommunicationService.createAnnouncement).mockResolvedValueOnce({
      id: "ann-3",
      organizationId: "org-1",
      title: "Winter Sports Day",
      content: "Sports day events will be held on the sports ground.",
      priority: "normal",
      status: "draft",
      recipientCount: 3,
      audience: { type: "organization" },
      createdAt: "now",
      updatedAt: "now",
    });

    const createButtons = screen.getAllByRole("button", { name: "Create Announcement" });
    fireEvent.click(createButtons[createButtons.length - 1]);

    await waitFor(() => {
      expect(CommunicationService.createAnnouncement).toHaveBeenCalledWith(
        "org-1",
        expect.objectContaining({
          title: "Winter Sports Day",
          content: "Sports day events will be held on the sports ground.",
        })
      );
    });
  });

  it("handles targeted messaging with template selection and audience preview", async () => {
    renderPage("compose");

    expect(await screen.findByText("Compose Targeted Message")).toBeInTheDocument();
    expect(screen.getByText("Target Audience")).toBeInTheDocument();

    // Template selection populates fields
    const templateSelect = screen.getByDisplayValue("Blank message");
    fireEvent.change(templateSelect, { target: { value: "tpl-1" } });

    // Verify delivery channels UI
    expect(screen.getByText("In-App Notification Inbox")).toBeInTheDocument();
    expect(screen.getByText("Email Notification")).toBeInTheDocument();
  });

  it("displays notification inbox and allows marking notifications read", async () => {
    renderPage("notifications");

    expect(await screen.findByText("Examination Scheduled")).toBeInTheDocument();
    expect(screen.getByText("Math exam scheduled for Friday.")).toBeInTheDocument();

    const markReadBtn = screen.getByRole("button", { name: "Mark read" });
    fireEvent.click(markReadBtn);

    await waitFor(() => {
      expect(CommunicationService.markNotificationRead).toHaveBeenCalledWith("org-1", "notif-1");
    });
  });

  it("displays templates tab and delivery history with accurate statuses", async () => {
    renderPage("delivery");

    expect(await screen.findByText("Delivery History")).toBeInTheDocument();
    expect(screen.getByText("PROVIDER_UNAVAILABLE: SMS provider is not configured.")).toBeInTheDocument();
  });

  it("switches to direct messages tab, displays conversation thread, and allows sending reply", async () => {
    renderPage("messages");

    expect(await screen.findByText("Conversations (1)")).toBeInTheDocument();
    expect((await screen.findAllByText("Sara Khan")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Thank you for the update on Amina's progress.")).length).toBeGreaterThan(0);

    const replyInput = screen.getByPlaceholderText("Type your authenticated reply...");
    fireEvent.change(replyInput, { target: { value: "You are very welcome! Let us know if you need anything else." } });

    const sendReplyBtn = screen.getByRole("button", { name: /Send Reply/i });
    fireEvent.click(sendReplyBtn);

    await waitFor(() => {
      expect(CommunicationService.replyToConversation).toHaveBeenCalledWith(
        "org-1",
        "conv-1",
        "You are very welcome! Let us know if you need anything else."
      );
    });
  });

  it("allows retrying failed delivery from delivery history tab", async () => {
    renderPage("delivery");

    expect(await screen.findByText("Delivery History")).toBeInTheDocument();
    expect(screen.getByText("PROVIDER_UNAVAILABLE: SMS provider is not configured.")).toBeInTheDocument();

    const retryBtn = screen.getByRole("button", { name: /Retry/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(CommunicationService.retryDelivery).toHaveBeenCalledWith("org-1", "del-2");
    });
  });

  it("displays user notification preferences tab and saves updated preferences", async () => {
    renderPage("preferences");

    expect(await screen.findByText("Notification Preferences")).toBeInTheDocument();
    expect(screen.getByText("In-App Notification Inbox")).toBeInTheDocument();
    expect(screen.getByText("Subscribed SIS Event Categories")).toBeInTheDocument();

    const saveBtn = screen.getByRole("button", { name: "Save Preferences" });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(CommunicationService.savePreference).toHaveBeenCalled();
    });
  });

  it("displays settings tab with channel readiness and allows triggering test event", async () => {
    renderPage("settings");

    expect(await screen.findByText("Communication Settings & Operational Policies")).toBeInTheDocument();
    expect(screen.getByText("Channel Operational Readiness")).toBeInTheDocument();
    expect(screen.getByText("Automated SIS Event Notification Tester")).toBeInTheDocument();

    const triggerBtn = screen.getByRole("button", { name: "Dispatch Test Event Notification" });
    fireEvent.click(triggerBtn);

    await waitFor(() => {
      expect(CommunicationService.emitDomainNotification).toHaveBeenCalledWith(
        "org-1",
        "attendance.absence",
        { type: "organization" },
        expect.objectContaining({
          title: "Attendance Alert: Student Absent",
        })
      );
    });
  });
});
