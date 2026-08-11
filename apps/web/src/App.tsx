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
import { ProtectedAppPage } from "./pages/app/ProtectedAppPage";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage";
import { VerifyEmailPage } from "./pages/auth/VerifyEmailPage";
import { CreateOrganizationPage } from "./pages/org/CreateOrganizationPage";
import { usePathname } from "./routes/navigation";
import { ProtectedRoute, PublicOnlyRoute } from "./routes/router";

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
      return (
        <ProtectedRoute>
          <ProtectedAppPage />
        </ProtectedRoute>
      );
    default:
      return <LandingPage />;
  }
}

export default App;
