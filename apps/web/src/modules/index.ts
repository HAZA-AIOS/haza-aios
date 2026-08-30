import { ModuleRegistry } from "./module-registry";
import { registerDemoModule } from "./demo-module";
import type { ModuleContract } from "./module.types";

/**
 * Default catalog of registered platform module definitions for discovery across industries.
 */
const platformCatalog: ModuleContract[] = [
  {
    id: "mod-education-sis",
    name: "Education & SIS Suite",
    slug: "education-sis",
    description:
      "Future School Information System capability for managing academic structures, students, and course registries.",
    version: "0.1.0-alpha",
    category: "industry",
    industry: "Education",
    icon: "🎓",
    status: "available",
    enabled: true,
    routes: [
      { path: "/workspace/education/students", component: "StudentDirectoryPage" as any },
      { path: "/workspace/education/students/new", component: "StudentAdmissionPage" as any },
      { path: "/workspace/education/students/:id", component: "StudentProfilePage" as any },
      { path: "/workspace/education/staff", component: "StaffDirectoryPage" as any },
      { path: "/workspace/education/staff/departments", component: "DepartmentDirectoryPage" as any },
      { path: "/workspace/education/staff/teachers", component: "TeacherDirectoryPage" as any },
      { path: "/workspace/education/staff/new", component: "AddStaffPage" as any },
      { path: "/workspace/education/staff/:id", component: "StaffProfilePage" as any },
      { path: "/workspace/education/academic", component: "AcademicOverviewPage" as any },
      { path: "/workspace/education/academic/years", component: "AcademicYearsPage" as any },
      { path: "/workspace/education/academic/terms", component: "TermsPage" as any },
      { path: "/workspace/education/academic/classes", component: "ClassesPage" as any },
      { path: "/workspace/education/academic/sections", component: "SectionsPage" as any },
      { path: "/workspace/education/academic/subjects", component: "SubjectsPage" as any },
      { path: "/workspace/education/timetable", component: "TimetableOverviewPage" as any },
      { path: "/workspace/education/timetable/config", component: "ScheduleConfigPage" as any },
      { path: "/workspace/education/timetable/class", component: "ClassTimetablePage" as any },
      { path: "/workspace/education/timetable/teacher", component: "TeacherTimetablePage" as any },
      { path: "/workspace/education/examinations", component: "ExaminationsPage" as any },
      { path: "/workspace/education/examinations/assessments", component: "AssessmentsPage" as any },
      { path: "/workspace/education/examinations/marks", component: "MarksEntryPage" as any },
      { path: "/workspace/education/examinations/results", component: "ResultsPage" as any },
      { path: "/workspace/education/finance", component: "FeesOverviewPage" as any },
      { path: "/workspace/education/finance/structures", component: "FeeStructuresPage" as any },
      { path: "/workspace/education/finance/invoices", component: "InvoicesPage" as any },
      { path: "/workspace/education/finance/payments", component: "PaymentsPage" as any },
      { path: "/workspace/education/finance/reports", component: "FinanceReportsPage" as any },
      { path: "/workspace/education/communication", component: "CommunicationOverviewPage" as any },
      { path: "/workspace/education/communication/announcements", component: "AnnouncementsPage" as any },
      { path: "/workspace/education/communication/compose", component: "ComposeCommunicationPage" as any },
      { path: "/workspace/education/communication/notifications", component: "NotificationsPage" as any },
      { path: "/workspace/education/communication/templates", component: "TemplatesPage" as any },
      { path: "/workspace/education/communication/delivery", component: "DeliveryHistoryPage" as any },
      { path: "/workspace/education/portal/parent", component: "ParentPortalPage" as any },
      { path: "/workspace/education/portal/student", component: "StudentPortalPage" as any },
      { path: "/workspace/education/analytics", component: "SisAnalyticsOverviewPage" as any },
      { path: "/workspace/education/analytics/reports", component: "SisReportsPage" as any },
      { path: "/workspace/education/analytics/data-quality", component: "SisDataQualityPage" as any },
      { path: "/workspace/education/analytics/health", component: "SisHealthPage" as any }
    ],
    navigation: [
      {
        id: "nav-education-students",
        label: "Students",
        route: "/workspace/education/students",
        icon: "👨‍🎓",
        requiredPermission: "module.education.view",
        order: 1
      },
      {
        id: "nav-education-staff",
        label: "Staff",
        route: "/workspace/education/staff",
        icon: "👩‍🏫",
        requiredPermission: "module.education.view",
        order: 2
      },
      {
        id: "nav-education-departments",
        label: "Departments",
        route: "/workspace/education/staff/departments",
        icon: "🏢",
        requiredPermission: "module.education.view",
        order: 3
      },
      {
        id: "nav-education-academic",
        label: "Academic Structure",
        route: "/workspace/education/academic",
        icon: "🏛️",
        requiredPermission: "module.education.manage",
        order: 4
      },
      {
        id: "nav-education-timetable",
        label: "Timetable",
        route: "/workspace/education/timetable",
        icon: "📅",
        requiredPermission: "module.education.manage",
        order: 5
      },
      {
        id: "nav-education-examinations",
        label: "Exams & Results",
        route: "/workspace/education/examinations",
        icon: "🧾",
        requiredPermission: "module.education.manage",
        order: 6
      },
      {
        id: "nav-education-finance",
        label: "Fees & Finance",
        route: "/workspace/education/finance",
        icon: "💳",
        requiredPermission: "finance.manage",
        order: 7
      },
      {
        id: "nav-education-communication",
        label: "Communication",
        route: "/workspace/education/communication",
        icon: "📣",
        requiredPermission: "communication.view",
        order: 8
      },
      {
        id: "nav-education-parent-portal",
        label: "Parent Portal",
        route: "/workspace/education/portal/parent",
        icon: "👪",
        requiredPermission: "portal.parent.view",
        order: 9
      },
      {
        id: "nav-education-student-portal",
        label: "Student Portal",
        route: "/workspace/education/portal/student",
        icon: "🎒",
        requiredPermission: "portal.student.view",
        order: 10
      },
      {
        id: "nav-education-analytics",
        label: "Analytics & Reports",
        route: "/workspace/education/analytics",
        icon: "📊",
        requiredPermission: "analytics.view",
        order: 11
      }
    ],
    permissions: [
      {
        key: "module.education.view",
        name: "View Education Data",
        description: "Access student and academic registries.",
      },
      {
        key: "module.education.manage",
        name: "Manage Education Data",
        description: "Modify student records and courses.",
      },
      {
        key: "examination.view",
        name: "View Examinations",
        description: "Access examination, assessment, marks, and result records.",
      },
      {
        key: "examination.manage",
        name: "Manage Examinations",
        description: "Create examinations, enter marks, calculate results, and publish outcomes.",
      },
      {
        key: "fees.view",
        name: "View Fees",
        description: "Access fee structures, invoices, balances, receipts, and finance reports.",
      },
      {
        key: "finance.manage",
        name: "Manage Fees & Finance",
        description: "Configure fees, generate invoices, record payments, void payments, and manage reports.",
      },
      {
        key: "communication.view",
        name: "View Communication",
        description: "Access announcements, notifications, templates, and delivery history.",
      },
      {
        key: "communication.manage",
        name: "Manage Communication",
        description: "Create announcements, send communications, manage templates, and update notification preferences.",
      },
      {
        key: "portal.parent.view",
        name: "View Parent Portal",
        description: "Access authorized parent and guardian self-service portal views.",
      },
      {
        key: "portal.student.view",
        name: "View Student Portal",
        description: "Access authorized student self-service portal views.",
      },
      {
        key: "analytics.view",
        name: "View SIS Analytics",
        description: "Access SIS operational analytics dashboards.",
      },
      {
        key: "reports.view",
        name: "View SIS Reports",
        description: "Access generated SIS reports with organization-scoped filters.",
      },
      {
        key: "reports.export",
        name: "Export SIS Reports",
        description: "Export permitted SIS reports to CSV.",
      },
      {
        key: "data_quality.view",
        name: "View SIS Data Quality",
        description: "Review data quality and operational completion issues.",
      },
      {
        key: "sis_health.view",
        name: "View SIS Health",
        description: "Review SIS readiness and module completion status.",
      },
    ],
    metadata: {
      author: "HAZA AIOS Core Team",
      tags: ["education", "sis", "academic"],
      releasedAt: "2026-08-12",
    },
  },
  {
    id: "mod-healthcare-ehr",
    name: "Healthcare & Patient EHR (Framework Ready)",
    slug: "healthcare-ehr",
    description:
      "Future Clinical Patient EHR capability for managing health records, appointments, and care plans.",
    version: "0.1.0-alpha",
    category: "industry",
    industry: "Healthcare",
    icon: "🏥",
    status: "available",
    enabled: false,
    routes: [],
    navigation: [],
    permissions: [
      {
        key: "module.healthcare.view",
        name: "View Patient Records",
        description: "Access clinical patient charts.",
      },
    ],
    metadata: {
      author: "HAZA AIOS Core Team",
      tags: ["healthcare", "ehr", "clinical"],
      releasedAt: "2026-08-12",
    },
  },
  {
    id: "mod-corporate-hr",
    name: "Corporate HR & Operations (Framework Ready)",
    slug: "corporate-hr",
    description:
      "Future Corporate HR capability for managing workforce directories, payroll, and performance goals.",
    version: "0.1.0-alpha",
    category: "industry",
    industry: "Corporate",
    icon: "🏢",
    status: "available",
    enabled: false,
    routes: [],
    navigation: [],
    permissions: [],
    metadata: {
      author: "HAZA AIOS Core Team",
      tags: ["corporate", "hr", "operations"],
      releasedAt: "2026-08-12",
    },
  },
];

/**
 * Initialize and register all core, industry, and demo modules.
 */
export function initModuleRegistry(): void {
  // Register demo module
  registerDemoModule();

  // Register catalog stubs
  for (const mod of platformCatalog) {
    if (!ModuleRegistry.get(mod.id)) {
      ModuleRegistry.register(mod);
    }
  }
}

