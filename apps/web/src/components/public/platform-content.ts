export const navigation = [
  ["Platform", "platform"],
  ["Education", "education"],
  ["Architecture", "architecture"],
  ["Security", "security"],
  ["Status", "status"],
  ["Pricing", "pricing"],
] as const;

export const layers = [
  [
    "Experience",
    "Web application, operational dashboards and role-specific portals",
    "React / TypeScript",
  ],
  [
    "Industry solutions",
    "Education SIS: people, academics, finance and communication",
    "Education first",
  ],
  [
    "AI & automation",
    "Agent registry, run history and memory; knowledge and durable workflows are evolving",
    "Mixed maturity",
  ],
  [
    "Platform core",
    "Organizations, workspaces, membership, permissions and module registry",
    "Shared foundation",
  ],
  [
    "Data & API",
    "Domain services, tenant-scoped repositories and relational records",
    "Node.js / Drizzle / MySQL",
  ],
  [
    "Infrastructure",
    "Cloudflare frontend, Railway API and MySQL, GitHub review and builds",
    "Separate web and API",
  ],
] as const;

export const operations = [
  ["Organization", "Establish ownership and institutional identity."],
  ["Workspace", "Give teams a shared operational context."],
  ["Modules", "Enable capabilities appropriate to the organization."],
  ["Records", "Maintain authorized operational data through the API."],
  ["Insights", "Review SIS reports and configure the evolving agent platform."],
] as const;

export const agentFlow = [
  ["Request", "A user starts an agent run."],
  ["Agent definition", "Configuration references a model and assigned tools."],
  ["Context & memory", "Conversation context and scoped durable memory inform the run."],
  [
    "Execution foundation",
    "The current execution provider is mocked; live reasoning is not promised.",
  ],
  ["Persistent result", "Runs, messages and conversations retain execution history."],
] as const;

export const schoolFlow = [
  ["Set up", "Organization, academic years, terms and departments."],
  ["Organize", "Staff, teaching assignments, classes, sections and subjects."],
  ["Enroll", "Student admissions, guardians and enrollment records."],
  ["Operate", "Timetables and daily attendance."],
  ["Assess", "Examinations, assessments, marks and published results."],
  ["Connect", "Fees, recorded payments, communication and role-specific portals."],
  ["Review", "Operational reports, CSV exports and data-quality checks."],
] as const;

export const educationModules = [
  [
    "Students & enrollment",
    "Maintain student profiles, guardian relationships and enrollment records.",
  ],
  [
    "Academics & staff",
    "Organize years, terms, classes, sections, subjects and teaching assignments.",
  ],
  [
    "Attendance & timetable",
    "Configure school periods, maintain schedules and record attendance sessions.",
  ],
  ["Assessment & results", "Manage examinations, marks and publication of student results."],
  [
    "Fees & finance",
    "Maintain fee structures, invoices, recorded payments, receipts and balances. Payment processing is not implied.",
  ],
  [
    "Communication & portals",
    "Manage announcements, notifications and self-service requests. Parent and student views use shared SIS records.",
  ],
  [
    "Analytics & reporting",
    "Review server-generated SIS summaries, reports, data quality and CSV exports.",
  ],
  ["Organization access", "Apply organization membership and permissions to operational access."],
] as const;

export const schoolBenefits = [
  [
    "Scattered student records",
    "A shared student and enrollment model gives academic teams a common reference.",
  ],
  [
    "Disconnected academic tracking",
    "Attendance, assessments and published results can be reviewed in the same SIS.",
  ],
  [
    "Repeated family enquiries",
    "Parent and student portals expose the records appropriate to each role.",
  ],
  [
    "Limited operational visibility",
    "Reports draw from persisted records instead of separately maintained spreadsheets.",
  ],
] as const;

export const businessBenefits = [
  [
    "One organizational context",
    "Organizations and workspaces provide a reusable foundation for industry-specific applications.",
  ],
  [
    "Extensible modules",
    "A module registry separates platform concerns from domain functionality.",
  ],
  [
    "Persistent agent context",
    "Agent definitions, conversation history and selected memories have distinct data responsibilities.",
  ],
  [
    "An integration direction",
    "Explicit API and domain-service boundaries support future integrations without claiming ready-made connectors.",
  ],
] as const;

export const stack = [
  ["Frontend", "React, Vite, TypeScript, Tailwind CSS and shared React UI components."],
  ["Backend", "A Node.js / TypeScript HTTP API with explicit routing and domain modules."],
  ["Data", "Drizzle ORM, SQL migrations and MySQL relational persistence."],
  [
    "Deployment",
    "Cloudflare Workers serves the frontend. Railway runs the separate API and MySQL services.",
  ],
  ["Architecture", "An npm-workspaces modular monorepo, not a distributed microservice claim."],
  ["Delivery", "GitHub branches, reviewed pull requests and Cloudflare build checks."],
] as const;

export const security = [
  [
    "Identity & sessions",
    "Server-backed identities, salted password hashes and revocable sessions underpin sign-in.",
  ],
  [
    "Tenant context",
    "Organization membership, workspace context and scoped data access define application boundaries.",
  ],
  [
    "Role-based access",
    "Permission checks protect domain operations at the API, not only in the interface.",
  ],
  [
    "Input & data boundaries",
    "Validation and domain rules apply before persistence. Environment secrets remain separate from public frontend configuration.",
  ],
] as const;

export const dataFlow = [
  ["User", "An authenticated action"],
  ["Web app", "API client request"],
  ["API boundary", "Session, validation and tenant context"],
  ["Domain service", "Permission and business rules"],
  ["MySQL", "Scoped persistent records"],
  ["Response", "Authorized data returns to the app and SIS reports"],
] as const;

export const modules = [
  ["Platform core", "Organizations, workspaces, identity and module access."],
  ["Education", "Academic and student operations with finance and portals."],
  ["AI agents", "Registry, configuration, run history and selected memory."],
  ["Analytics", "SIS aggregation, report generation and exports."],
  ["Communication", "SIS templates, messages, notifications and delivery records."],
  [
    "Knowledge & workflows",
    "Development foundations; not a promise of production semantic search or durable orchestration.",
  ],
] as const;

export const adoption = [
  ["Discover", "Agree on the institution, roles and operational scope."],
  ["Configure", "Set up the organization, workspace, users and module access."],
  ["Prepare", "Review data quality and enter the academic and operational records required."],
  ["Evaluate", "Exercise real scenarios with authorized users before wider adoption."],
  [
    "Improve",
    "Review reports and assess agent or automation capabilities against their current maturity.",
  ],
] as const;
