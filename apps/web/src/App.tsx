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

function App() {
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

export default App;
