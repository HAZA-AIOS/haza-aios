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
        <IntelligenceSection />
        <AdvantageSection />
        <IndustryShowcase />
        <CapabilitiesSection />
        <TrustSection />
        <PricingSection />
        <GlobalFutureSection />
        <DemoRequestSection />
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
    case (pathname.match(/^\/workspace\/agents\/[^\/]+\/configure$/) || {}).input:
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <AgentBuilderPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case (pathname.match(/^\/workspace\/agents\/[^\/]+\/run$/) || {}).input:
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <AgentRunPage />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case (pathname.match(/^\/workspace\/agents\/[^\/]+\/history$/) || {}).input:
      return (
        <ProtectedRoute>
          <WorkspaceGuard>
            <AgentRunHistory />
          </WorkspaceGuard>
        </ProtectedRoute>
      );
    case (pathname.match(/^\/workspace\/agents\/[^\/]+$/) || {}).input:
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

