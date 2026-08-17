import { AdvantageSection } from "./components/AdvantageSection";
import { CapabilitiesSection } from "./components/CapabilitiesSection";
import { DemoRequestSection } from "./components/DemoRequestSection";
import { FinalCTA } from "./components/FinalCTA";
import { Footer } from "./components/Footer";
import { GlobalFutureSection } from "./components/GlobalFutureSection";
import { Header } from "./components/Header";
import { HeroSection } from "./components/HeroSection";
import { IndustryShowcase } from "./components/IndustryShowcase";
import { IntelligenceSection } from "./components/IntelligenceSection";
import { TrustSection } from "./components/TrustSection";
import { PricingSection } from "./components/PricingSection";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage";
import { VerifyEmailPage } from "./pages/auth/VerifyEmailPage";
import { CreateOrganizationPage } from "./pages/org/CreateOrganizationPage";
import { AdminOverviewPage } from "./pages/admin/AdminOverviewPage";
import { AdminOrganizationsPage } from "./pages/admin/AdminOrganizationsPage";
import { AdminUsersPage } from "./pages/admin/AdminUsersPage";
import { AdminAuditLogPage } from "./pages/admin/AdminAuditLogPage";
import { AdminSystemHealthPage } from "./pages/admin/AdminSystemHealthPage";
import { AdminModulesPage } from "./pages/admin/AdminModulesPage";
import { AdminGuard } from "./admin/AdminGuard";
import { usePathname, navigate } from "./routes/navigation";
import { ProtectedRoute, PublicOnlyRoute } from "./routes/router";
import { WorkspaceGuard } from "./workspace/WorkspaceGuard";
import { WorkspaceOverviewPage } from "./pages/workspace/WorkspaceOverviewPage";
import { WorkspaceMembersPage } from "./pages/workspace/WorkspaceMembersPage";
import { WorkspaceModulesPage } from "./pages/workspace/WorkspaceModulesPage";
import { WorkspaceSettingsPage } from "./pages/workspace/WorkspaceSettingsPage";
import { WorkspaceDiscoverPage, WorkspaceActiveAgentsPage, AgentDetailsPage } from "./pages/workspace/agents";
import { AgentBuilderPage } from "./pages/workspace/agents/builder/AgentBuilderPage";
import { AgentRunPage } from "./pages/workspace/agents/run/AgentRunPage";
import { AgentRunHistory } from "./pages/workspace/agents/run/AgentRunHistory";
import { StudentDirectoryPage } from "./pages/workspace/education/students/StudentDirectoryPage";
import { StudentAdmissionPage } from "./pages/workspace/education/students/StudentAdmissionPage";
import { StudentProfilePage } from "./pages/workspace/education/students/StudentProfilePage";
import { StaffDirectoryPage } from "./pages/workspace/education/staff/StaffDirectoryPage";
import { TeacherDirectoryPage } from "./pages/workspace/education/staff/TeacherDirectoryPage";
import { AddStaffPage } from "./pages/workspace/education/staff/AddStaffPage";
import { StaffProfilePage } from "./pages/workspace/education/staff/StaffProfilePage";
import { DepartmentDirectoryPage } from "./pages/workspace/education/staff/DepartmentDirectoryPage";
import { AcademicOverviewPage } from "./pages/workspace/education/academic/AcademicOverviewPage";
import { AcademicYearsPage } from "./pages/workspace/education/academic/AcademicYearsPage";
import { TermsPage } from "./pages/workspace/education/academic/TermsPage";
import { ClassesPage } from "./pages/workspace/education/academic/ClassesPage";
import { SectionsPage } from "./pages/workspace/education/academic/SectionsPage";
import { SubjectsPage } from "./pages/workspace/education/academic/SubjectsPage";
import { AttendanceOverviewPage } from "./pages/workspace/education/attendance/AttendanceOverviewPage";
import { MarkAttendancePage } from "./pages/workspace/education/attendance/MarkAttendancePage";
import { AttendanceHistoryPage } from "./pages/workspace/education/attendance/AttendanceHistoryPage";
import { TimetableOverviewPage } from "./pages/workspace/education/timetable/TimetableOverviewPage";
import { ScheduleConfigPage } from "./pages/workspace/education/timetable/ScheduleConfigPage";
import { ClassTimetablePage } from "./pages/workspace/education/timetable/ClassTimetablePage";
import { TeacherTimetablePage } from "./pages/workspace/education/timetable/TeacherTimetablePage";
import { ExaminationsPage } from "./pages/workspace/education/examinations/ExaminationsPage";
import { AssessmentsPage } from "./pages/workspace/education/examinations/AssessmentsPage";
import { MarksEntryPage } from "./pages/workspace/education/examinations/MarksEntryPage";
import { ResultsPage } from "./pages/workspace/education/examinations/ResultsPage";
import { FeesOverviewPage } from "./pages/workspace/education/finance/FeesOverviewPage";
import { FeeStructuresPage } from "./pages/workspace/education/finance/FeeStructuresPage";
import { InvoicesPage } from "./pages/workspace/education/finance/InvoicesPage";
import { PaymentsPage } from "./pages/workspace/education/finance/PaymentsPage";
import { FinanceReportsPage } from "./pages/workspace/education/finance/FinanceReportsPage";
import { CommunicationOverviewPage } from "./pages/workspace/education/communication/CommunicationOverviewPage";
import { AnnouncementsPage } from "./pages/workspace/education/communication/AnnouncementsPage";
import { ComposeCommunicationPage } from "./pages/workspace/education/communication/ComposeCommunicationPage";
import { NotificationsPage } from "./pages/workspace/education/communication/NotificationsPage";
import { TemplatesPage } from "./pages/workspace/education/communication/TemplatesPage";
import { DeliveryHistoryPage } from "./pages/workspace/education/communication/DeliveryHistoryPage";
import { ParentPortalPage } from "./pages/workspace/education/portal/ParentPortalPage";
import { StudentPortalPage } from "./pages/workspace/education/portal/StudentPortalPage";
import { SisAnalyticsOverviewPage } from "./pages/workspace/education/analytics/SisAnalyticsOverviewPage";
import { SisReportsPage } from "./pages/workspace/education/analytics/SisReportsPage";
import { SisDataQualityPage } from "./pages/workspace/education/analytics/SisDataQualityPage";
import { SisHealthPage } from "./pages/workspace/education/analytics/SisHealthPage";
import { useEffect } from "react";

function WorkspaceRedirect() {
  useEffect(() => {
    navigate("/workspace");
  }, []);
  return null;
}


function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />

      <main>
        <HeroSection />
        <div id="solutions"><IntelligenceSection /></div>
        <AdvantageSection />
        <div id="industries"><IndustryShowcase /></div>
        <div id="products"><CapabilitiesSection /></div>
        <div id="company"><TrustSection /></div>
        <PricingSection />
        <GlobalFutureSection />
        <div id="resources"><DemoRequestSection /></div>
        <FinalCTA />
      </main>

      <Footer />
    </div>
  );
}

function App() {
  const pathname = usePathname();

  switch (pathname) {
    case "/login":
      return (
        <PublicOnlyRoute>
          <LoginPage />
        </PublicOnlyRoute>
      );
    case "/register":
      return (
        <PublicOnlyRoute>
          <RegisterPage />
        </PublicOnlyRoute>
      );
    case "/forgot-password":
      return (
        <PublicOnlyRoute>
          <ForgotPasswordPage />
        </PublicOnlyRoute>
      );
    case "/reset-password":
      return (
        <PublicOnlyRoute>
          <ResetPasswordPage />
        </PublicOnlyRoute>
      );
    case "/verify-email":
      return <VerifyEmailPage />;
    case "/organization/create":
      return (
        <ProtectedRoute>
          <CreateOrganizationPage />
        </ProtectedRoute>
      );
    case "/app":
    case "/dashboard":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <WorkspaceRedirect />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <WorkspaceOverviewPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/members":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <WorkspaceMembersPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/modules":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <WorkspaceModulesPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/settings":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <WorkspaceSettingsPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/education/students":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <StudentDirectoryPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/education/students/new":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <StudentAdmissionPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case (pathname.match(/^\/workspace\/education\/students\/[^/]+$/) || {}).input:
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <StudentProfilePage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/education/staff":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <StaffDirectoryPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/education/staff/teachers":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <TeacherDirectoryPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/education/staff/departments":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <DepartmentDirectoryPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/education/staff/new":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <AddStaffPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case (pathname.match(/^\/workspace\/education\/staff\/[^/]+$/) || {}).input:
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <StaffProfilePage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/education/academic":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <AcademicOverviewPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/education/academic/years":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <AcademicYearsPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/education/academic/terms":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <TermsPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/education/academic/classes":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <ClassesPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/education/academic/sections":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <SectionsPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/education/academic/subjects":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <SubjectsPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/education/timetable":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <TimetableOverviewPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/education/timetable/config":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <ScheduleConfigPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/education/timetable/class":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <ClassTimetablePage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/education/timetable/teacher":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <TeacherTimetablePage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/education/examinations":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <ExaminationsPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/education/examinations/assessments":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <AssessmentsPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/education/examinations/marks":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <MarksEntryPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/education/examinations/results":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <ResultsPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/education/finance":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <FeesOverviewPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/education/finance/structures":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <FeeStructuresPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/education/finance/invoices":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <InvoicesPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/education/finance/payments":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <PaymentsPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/education/finance/reports":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <FinanceReportsPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/education/communication":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <CommunicationOverviewPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/education/communication/announcements":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <AnnouncementsPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/education/communication/compose":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <ComposeCommunicationPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/education/communication/notifications":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <NotificationsPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/education/communication/templates":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <TemplatesPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/education/communication/delivery":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <DeliveryHistoryPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/education/portal/parent":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <ParentPortalPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/education/portal/student":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <StudentPortalPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/education/analytics":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <SisAnalyticsOverviewPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/education/analytics/reports":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <SisReportsPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/education/analytics/data-quality":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <SisDataQualityPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/education/analytics/health":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <SisHealthPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/education/attendance":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <AttendanceOverviewPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/education/attendance/mark":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <MarkAttendancePage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/education/attendance/history":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <AttendanceHistoryPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/agents":
    case "/workspace/agents/discover":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <WorkspaceDiscoverPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case "/workspace/agents/active":
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <WorkspaceActiveAgentsPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case (pathname.match(/^\/workspace\/agents\/[^/]+\/configure$/) || {}).input:
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <AgentBuilderPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case (pathname.match(/^\/workspace\/agents\/[^/]+\/run$/) || {}).input:
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <AgentRunPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case (pathname.match(/^\/workspace\/agents\/[^/]+\/history$/) || {}).input:
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <AgentRunHistory />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case (pathname.match(/^\/workspace\/agents\/[^/]+$/) || {}).input:
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <AgentDetailsPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );    /* ───── Platform Administration Routes ───── */
    case "/admin":
      return (
        <ProtectedRoute>
          <AdminGuard>
            <AdminOverviewPage />
          </AdminGuard>
        </ProtectedRoute>
      );
    case "/admin/organizations":
      return (
        <ProtectedRoute>
          <AdminGuard>
            <AdminOrganizationsPage />
          </AdminGuard>
        </ProtectedRoute>
      );
    case "/admin/users":
      return (
        <ProtectedRoute>
          <AdminGuard>
            <AdminUsersPage />
          </AdminGuard>
        </ProtectedRoute>
      );
    case "/admin/audit-log":
      return (
        <ProtectedRoute>
          <AdminGuard>
            <AdminAuditLogPage />
          </AdminGuard>
        </ProtectedRoute>
      );
    case "/admin/system-health":
      return (
        <ProtectedRoute>
          <AdminGuard>
            <AdminSystemHealthPage />
          </AdminGuard>
        </ProtectedRoute>
      );
    case "/admin/modules":
      return (
        <ProtectedRoute>
          <AdminGuard>
            <AdminModulesPage />
          </AdminGuard>
        </ProtectedRoute>
      );

    default:
      if (pathname.startsWith("/workspace/agents/")) {
        return (
          <ProtectedRoute>
            <WorkspaceGuard>
              <AgentDetailsPage />
            </WorkspaceGuard>
          </ProtectedRoute>
        );
      }
      return <LandingPage />;
  }
}

export default App;

