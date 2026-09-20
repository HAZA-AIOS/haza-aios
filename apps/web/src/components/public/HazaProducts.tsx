import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faBuildingColumns,
  faCircleCheck,
  faNetworkWired,
  faUserAstronaut,
} from "@fortawesome/free-solid-svg-icons";

const products = [
  {
    id: "haza-aios-card",
    name: "HAZA-AIOS",
    category: "Multi-Industry AI Operating System",
    badge: "AI OPERATING SYSTEM",
    status: "PLATFORM / IN DEVELOPMENT",
    headline: "Intelligent infrastructure for modern organizations.",
    description:
      "A unified platform for organizational applications, intelligent workflows, AI agents, automation, data, permissions and decision support across multiple industries.",
    capabilities: [
      "AI Agent Platform",
      "Agent Registry & Builder",
      "Workflow Orchestration",
      "Knowledge & Context",
      "Permissions & Governance",
      "Multi-Industry Applications",
    ],
    icon: faNetworkWired,
    href: "#platform",
    action: "Explore HAZA-AIOS",
    tone: "aios",
    external: false,
  },
  {
    id: "haza-me-card",
    name: "HAZA-ME",
    category: "Personal AI Operating System",
    badge: "PERSONAL AI",
    status: "PERSONAL AI / IN DEVELOPMENT",
    headline: "Your personal AI workforce.",
    description:
      "A personal operating system that turns goals into structured missions coordinated by an AI Chief of Staff and specialized AI teams, with important decisions kept under human control.",
    capabilities: [
      "AI Chief of Staff",
      "Goals & Missions",
      "Dynamic AI Organizations",
      "Specialized AI Teams",
      "Decision & Approval Gates",
      "Personal Memory & Knowledge",
    ],
    icon: faUserAstronaut,
    href: "#haza-me-card",
    action: "Discover HAZA-ME",
    tone: "me",
    external: false,
  },
  {
    id: "haza-sms-card",
    name: "HAZA-SMS",
    category: "School Management System",
    badge: "LIVE PRODUCT",
    status: "LIVE",
    headline: "Complete digital management for modern schools.",
    description:
      "A standalone production application for academic, administrative, financial and operational school workflows, with its own architecture, lifecycle and deployment.",
    capabilities: [
      "Admissions & Student Management",
      "Attendance & Timetables",
      "Fees, Accounts & Payroll",
      "Examinations & Analysis",
      "Parent & Student Portals",
      "Multi-Campus Reporting",
    ],
    icon: faBuildingColumns,
    href: "https://www.thementorschools.com",
    action: "Visit HAZA-SMS",
    tone: "sms",
    external: true,
  },
] as const;

export function HazaProducts() {
  return (
    <div className="product-family-grid">
      {products.map((product) => (
        <article
          id={product.id}
          key={product.name}
          className={`product-family-card product-family-card--${product.tone}`}
          aria-label={product.name}
        >
          <div className="product-card-topline">
            <span className="product-badge">{product.badge}</span>
            <FontAwesomeIcon icon={product.icon} aria-hidden="true" />
          </div>
          <p className="product-status">{product.status}</p>
          <h3>{product.name}</h3>
          <p className="product-category">{product.category}</p>
          <h4>{product.headline}</h4>
          <p className="product-description">{product.description}</p>
          <ul>
            {product.capabilities.map((capability) => (
              <li key={capability}>
                <FontAwesomeIcon icon={faCircleCheck} aria-hidden="true" />
                {capability}
              </li>
            ))}
          </ul>
          <a
            className="public-button product-action"
            href={product.href}
            target={product.external ? "_blank" : undefined}
            rel={product.external ? "noreferrer noopener" : undefined}
          >
            {product.action} <FontAwesomeIcon icon={faArrowRight} aria-hidden="true" />
          </a>
        </article>
      ))}
    </div>
  );
}
