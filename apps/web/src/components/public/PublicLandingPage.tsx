import { useState, type ReactNode } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faBars,
  faXmark,
  faLayerGroup,
  faGraduationCap,
  faShieldHalved,
} from "@fortawesome/free-solid-svg-icons";
import { LogoMark } from "@haza-aios/ui/components/logo-mark";
import {
  adoption,
  agentFlow,
  businessBenefits,
  dataFlow,
  educationModules,
  layers,
  modules,
  navigation,
  operations,
  schoolBenefits,
  schoolFlow,
  security,
  stack,
} from "./platform-content";
import "./public-landing.css";
import { PublicPricingCards } from "./PublicPricingCards";

type Items = readonly (readonly [string, string])[];

function Section({
  id,
  eyebrow,
  title,
  intro,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="public-section" aria-labelledby={`${id}-title`}>
      <div className="public-container">
        <header className="section-intro">
          <p className="eyebrow">{eyebrow}</p>
          <h2 id={`${id}-title`}>{title}</h2>
          {intro && <p>{intro}</p>}
        </header>
        {children}
      </div>
    </section>
  );
}

function FeatureGrid({ items }: { items: Items }) {
  return (
    <div className="feature-grid">
      {items.map(([title, text], i) => (
        <article key={title}>
          <span className="item-index" aria-hidden="true">
            {String(i + 1).padStart(2, "0")}
          </span>
          <h3>{title}</h3>
          <p>{text}</p>
        </article>
      ))}
    </div>
  );
}

function Flow({ items, label }: { items: Items; label: string }) {
  return (
    <ol className="public-flow" aria-label={label}>
      {items.map(([title, text], i) => (
        <li key={title}>
          <span className="flow-number" aria-hidden="true">
            {i + 1}
          </span>
          <div>
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
          {i < items.length - 1 && (
            <FontAwesomeIcon icon={faArrowRight} className="flow-arrow" aria-hidden="true" />
          )}
        </li>
      ))}
    </ol>
  );
}

function PublicHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="public-header">
      <div className="public-container public-nav">
        <a href="/" className="public-brand" aria-label="HAZA AIOS home">
          <LogoMark />
          <span>HAZA AIOS</span>
        </a>
        <nav className="desktop-navigation" aria-label="Main navigation">
          {navigation.map(([label, id]) => (
            <a href={`#${id}`} key={id}>
              {label}
            </a>
          ))}
        </nav>
        <a className="public-signin" href="/login">
          Sign in <FontAwesomeIcon icon={faArrowRight} />
        </a>
        <button
          type="button"
          className="mobile-toggle"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          aria-controls="public-mobile-nav"
          onClick={() => setOpen(!open)}
        >
          <FontAwesomeIcon icon={open ? faXmark : faBars} />
        </button>
      </div>
      {open && (
        <nav
          id="public-mobile-nav"
          className="mobile-navigation"
          aria-label="Mobile navigation"
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        >
          {navigation.map(([label, id]) => (
            <a href={`#${id}`} key={id} onClick={() => setOpen(false)}>
              {label}
            </a>
          ))}
          <a href="/login">Sign in</a>
        </nav>
      )}
    </header>
  );
}

function PublicHero() {
  return (
    <section className="public-hero" aria-labelledby="hero-title">
      <img className="hero-art" src="/ai_hero_bg.jpg" alt="" fetchPriority="high" />
      <div className="public-container hero-content">
        <p className="eyebrow">One platform. Shared organizational context.</p>
        <h1 id="hero-title">HAZA AIOS</h1>
        <p className="hero-subtitle">
          AI Operating System for
          <br />
          Modern Organizations
        </p>
        <p className="hero-description">
          Connect people, operations and data. Build on an education-first platform with shared
          identity, persistent records and an evolving foundation for AI agents and automation.
        </p>
        <div className="public-actions">
          <a className="public-button primary" href="#platform">
            Explore the platform <FontAwesomeIcon icon={faArrowRight} />
          </a>
          <a className="public-button" href="#education">
            Explore education
          </a>
        </div>
        <p className="hero-status">
          <span aria-hidden="true" /> Active development <span className="status-divider">/</span>{" "}
          Education SIS + platform foundations
        </p>
      </div>
    </section>
  );
}

function PlatformArchitecture() {
  return (
    <Section
      id="architecture"
      eyebrow="Built in layers"
      title="A shared foundation. Room to grow."
      intro="One web application and one modular API connect industry operations to shared identity, access and data services."
    >
      <ol className="architecture-diagram" aria-label="Platform architecture layers">
        {layers.map(([title, text, tag], i) => (
          <li key={title}>
            <span className="architecture-number" aria-hidden="true">
              0{i + 1}
            </span>
            <div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
            <span className="architecture-tag">{tag}</span>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function EducationSection() {
  return (
    <Section
      id="education"
      eyebrow="HAZA Education AIOS"
      title="The school day, connected."
      intro="Education is our most developed vertical: a shared SIS for administrators, teachers, students and parents, with records that connect academic and administrative work."
    >
      <div className="education-banner">
        <FontAwesomeIcon icon={faGraduationCap} aria-hidden="true" />
        <div>
          <h3>From institutional setup to student outcomes</h3>
          <p>
            For schools and education teams evaluating a common operating platform. School-group and
            multi-campus rollout requirements should be assessed individually.
          </p>
        </div>
        <a href="#school-flow">
          Follow the school lifecycle <FontAwesomeIcon icon={faArrowRight} />
        </a>
      </div>
      <FeatureGrid items={educationModules} />
    </Section>
  );
}

function PlatformStatus() {
  return (
    <Section
      id="status"
      eyebrow="Transparent by design"
      title="Built foundations. An evolving platform."
      intro="Implemented describes application capabilities, not a certification or a guarantee that every deployment is configured for every use case."
    >
      <div className="status-grid">
        <article>
          <span className="status-label implemented">Implemented foundations</span>
          <h3>Shared operations and persistence</h3>
          <ul>
            <li>Organizations, workspaces, identity and permissions</li>
            <li>Education SIS and server-side reporting</li>
            <li>Agent definitions, runs, conversations and selected memory</li>
          </ul>
        </article>
        <article>
          <span className="status-label developing">In active development</span>
          <h3>Knowledge and agent capability</h3>
          <ul>
            <li>
              Text-source and keyword-retrieval baseline on the development branch, not this
              production release
            </li>
            <li>Agent execution currently uses a mock provider</li>
            <li>Deployment-specific validation and wider integration work</li>
          </ul>
        </article>
        <article>
          <span className="status-label planned">Planned / deferred</span>
          <h3>Deeper automation</h3>
          <ul>
            <li>Embeddings and semantic vector search</li>
            <li>Durable workflow persistence and orchestration</li>
            <li>Additional industry solutions and production model integrations</li>
          </ul>
        </article>
      </div>
    </Section>
  );
}

function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="public-container">
        <div className="footer-top">
          <a href="/" className="public-brand">
            <LogoMark />
            <span>HAZA AIOS</span>
          </a>
          <p>
            Organizational software with shared context.
            <br />
            Education first. Built to evolve.
          </p>
        </div>
        <nav aria-label="Footer navigation">
          {navigation.map(([label, id]) => (
            <a href={`#${id}`} key={id}>
              {label}
            </a>
          ))}
          <a href="#technical">Technical overview</a>
          <a href="#adoption">Adoption</a>
          <a href="/login">Sign in</a>
        </nav>
        <div className="footer-bottom">
          <p>Copyright {new Date().getFullYear()} HAZA AIOS. All rights reserved.</p>
          <p>Active development. Capabilities vary by release.</p>
        </div>
      </div>
    </footer>
  );
}

export function PublicLandingPage() {
  return (
    <div className="haza-public">
      <a className="public-skip" href="#public-main">
        Skip to content
      </a>
      <PublicHeader />
      <main id="public-main">
        <PublicHero />
        <Section
          id="platform"
          eyebrow="What is HAZA AIOS?"
          title="More than another isolated application."
          intro="HAZA AIOS is being built as an extensible operating platform for organizations: industry-specific applications on a common core, with persistent data and a growing AI layer."
        >
          <div className="platform-principles">
            <article>
              <FontAwesomeIcon icon={faLayerGroup} />
              <h3>One platform core</h3>
              <p>
                Organizations, workspaces, identity and module access establish the common
                foundation.
              </p>
            </article>
            <article>
              <FontAwesomeIcon icon={faGraduationCap} />
              <h3>Real operational depth</h3>
              <p>
                Education SIS connects student records, academic operations, finance and reporting.
              </p>
            </article>
            <article>
              <FontAwesomeIcon icon={faShieldHalved} />
              <h3>Context before automation</h3>
              <p>
                Separate agent configuration, execution history and memory provide a basis for
                future intelligence.
              </p>
            </article>
          </div>
        </Section>
        <PlatformArchitecture />
        <Section
          id="how-it-works"
          eyebrow="How it works"
          title="Start with your organization."
          intro="Operational records and access come first. Agent and workflow capabilities build on that context, with availability clearly separated from the roadmap."
        >
          <Flow items={operations} label="How HAZA AIOS works" />
        </Section>
        <Section
          id="agents"
          eyebrow="AI operating model"
          title="Intelligence needs context, not just a prompt."
          intro="The agent platform separates definitions, runs, conversations and durable memory. Its persistence foundation is implemented; execution is currently mock-backed, not a production autonomous-agent promise."
        >
          <Flow items={agentFlow} label="Agent operating flow" />
          <aside className="public-note">
            <strong>Next layers:</strong> knowledge documents and keyword retrieval have a
            development baseline. Embeddings, vector search and durable workflow orchestration
            remain deferred. These are not depicted as live execution steps.
          </aside>
        </Section>
        <EducationSection />
        <Section
          id="school-flow"
          eyebrow="A connected school lifecycle"
          title="Every stage has a place."
          intro="A conceptual operational sequence, not an automatically executed workflow. Each stage is supported by the corresponding SIS screens and records."
        >
          <Flow items={schoolFlow} label="School operations lifecycle" />
        </Section>
        <Section
          id="school-benefits"
          eyebrow="For school teams"
          title="Less fragmentation. A clearer view."
          intro="The value comes from shared records and role-appropriate access, not unsupported promises about time saved."
        >
          <FeatureGrid items={schoolBenefits} />
        </Section>
        <Section
          id="business"
          eyebrow="Beyond education"
          title="A platform pattern for other organizations."
          intro="The core is designed for reuse. Education leads today; other complete industry products, cross-industry analytics and ready-made enterprise integrations are not claimed."
        >
          <FeatureGrid items={businessBenefits} />
        </Section>
        <Section
          id="comparison"
          eyebrow="From fragmented software to AIOS"
          title="Connect the context behind the tools."
        >
          <div className="comparison-grid">
            <div>
              <p className="eyebrow">The fragmented pattern</p>
              <h3>Each application holds a piece</h3>
              <ul>
                <li>Separate CRM, HR and finance records</li>
                <li>Communication detached from operations</li>
                <li>Files and reports rebuilt across teams</li>
                <li>AI tools without shared organizational context</li>
              </ul>
            </div>
            <div>
              <p className="eyebrow">The HAZA direction</p>
              <h3>A common organizational foundation</h3>
              <ul>
                <li>Shared platform core and industry modules</li>
                <li>Consistent identity and access boundaries</li>
                <li>Persistent operational records and SIS analytics</li>
                <li>Agent context, with automation developed in stages</li>
              </ul>
            </div>
          </div>
          <p className="section-caption">
            An architectural comparison, not a claim that HAZA replaces every CRM, HR, finance or AI
            product.
          </p>
        </Section>
        <Section
          id="technical"
          eyebrow="For technical decision makers"
          title="Explicit boundaries. Familiar technology."
        >
          <FeatureGrid items={stack} />
        </Section>
        <Section
          id="security"
          eyebrow="Security & tenant boundaries"
          title="Access belongs in the architecture."
          intro="The application uses server-side identity and authorization, with tenant context carried into domain operations. Deployment configuration and operational review remain essential."
        >
          <FeatureGrid items={security} />
          <aside className="public-note">
            These are implementation foundations, not a compliance certification. No SOC 2, ISO
            27001 or other certification is claimed.
          </aside>
        </Section>
        <Section
          id="data-flow"
          eyebrow="Request to record"
          title="Follow the data, not the guesswork."
        >
          <Flow items={dataFlow} label="Authorized application data flow" />
          <p className="section-caption">
            SIS analytics reads persisted source records. Agent history and memory have separate
            persistence responsibilities; future workflow actions must respect the same access
            boundaries.
          </p>
        </Section>
        <Section
          id="modules"
          eyebrow="The platform ecosystem"
          title="Focused modules. Shared foundations."
        >
          <FeatureGrid items={modules} />
        </Section>
        <Section
          id="why-haza"
          eyebrow="Why HAZA AIOS?"
          title="Keep the organization at the center."
          intro="The platform philosophy is simple: preserve operational context as teams move between tasks."
        >
          <div className="manifesto">
            <p>Industry-specific depth, rather than a collection of disconnected screens.</p>
            <p>
              Persistent records, rather than repeated reconstruction of organizational knowledge.
            </p>
            <p>Modular growth, rather than presenting every roadmap idea as a finished product.</p>
          </div>
        </Section>
        <Section
          id="adoption"
          eyebrow="An adoption model"
          title="Evaluate with your own operational reality."
          intro="Scope the rollout around the institution and the capabilities available today. There is no promised implementation duration or automatic data migration."
        >
          <Flow items={adoption} label="Platform adoption model" />
        </Section>
        <PlatformStatus />
        <Section
          id="pricing"
          eyebrow="Pricing & evaluation"
          title="Choose the right starting point."
          intro="Explore Starter, Professional and Enterprise. Prices are indicative, not a live subscription offer. Billing is not enabled; creating an evaluation account does not start a paid plan."
        >
          <PublicPricingCards />
          <p className="section-caption">
            Final scope, AI usage allowances and support terms require confirmation. Review{" "}
            <a href="#status" className="public-text-link">
              current platform status
            </a>{" "}
            before evaluating.
          </p>
        </Section>
        <Section
          id="demo"
          eyebrow="Explore HAZA"
          title="Build a smarter organization with HAZA AIOS."
          intro="Explore the education platform and evaluate its current capabilities with an account. Agent execution and roadmap features should be assessed against the maturity notes above."
        >
          <div className="public-actions">
            <a className="public-button primary" href="/register">
              Create an evaluation account <FontAwesomeIcon icon={faArrowRight} />
            </a>
            <a className="public-button" href="/login">
              Sign in
            </a>
            <a className="public-text-link" href="#education">
              Explore education
            </a>
          </div>
        </Section>
      </main>
      <PublicFooter />
    </div>
  );
}
