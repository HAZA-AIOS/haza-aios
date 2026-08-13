import { ModuleRegistry } from "../module-registry";
import type { ModuleContract } from "../module.types";
import { EducationDashboardPage } from "./pages/EducationDashboardPage";
import { EducationSettingsPage } from "./pages/EducationSettingsPage";
import { 
  SchoolProfilePage, 
  AcademicYearsPage, 
  StudentsPage, 
  StaffPage 
} from "./pages/sis";

export const EducationModule: ModuleContract = {
  id: "mod-education-sis",
  name: "HAZA AIOS Education",
  slug: "education",
  description: "Comprehensive School Information System (SIS) for managing academic structures, students, and courses.",
  version: "0.1.0-alpha",
  category: "industry",
  industry: "Education",
  icon: "🎓",
  status: "available",
  enabled: false,
  routes: [
    {
      path: "/education",
      component: EducationDashboardPage,
      exact: true,
      requiredPermission: "module.education.view",
    },
    {
      path: "/education/school",
      component: SchoolProfilePage,
      exact: true,
      requiredPermission: "module.education.admin",
    },
    {
      path: "/education/school/academic-years",
      component: AcademicYearsPage,
      exact: true,
      requiredPermission: "module.education.admin",
    },
    {
      path: "/education/students",
      component: StudentsPage,
      exact: true,
      requiredPermission: "module.education.view",
    },
    {
      path: "/education/staff",
      component: StaffPage,
      exact: true,
      requiredPermission: "module.education.admin",
    },
    {
      path: "/education/settings",
      component: EducationSettingsPage,
      exact: true,
      requiredPermission: "module.education.admin",
    }
  ],
  navigation: [
    {
      id: "nav-education-dashboard",
      label: "Overview",
      icon: "layout-dashboard",
      route: "/education",
      order: 1,
      requiredPermission: "module.education.view",
    },
    {
      id: "nav-education-school",
      label: "School Profile",
      icon: "building",
      route: "/education/school",
      order: 2,
      requiredPermission: "module.education.admin",
    },
    {
      id: "nav-education-academic-years",
      label: "Academic Years",
      icon: "calendar",
      route: "/education/school/academic-years",
      order: 3,
      requiredPermission: "module.education.admin",
    },
    {
      id: "nav-education-students",
      label: "Students",
      icon: "users",
      route: "/education/students",
      order: 4,
      requiredPermission: "module.education.view",
    },
    {
      id: "nav-education-staff",
      label: "Staff",
      icon: "briefcase",
      route: "/education/staff",
      order: 5,
      requiredPermission: "module.education.admin",
    },
    {
      id: "nav-education-settings",
      label: "Settings",
      icon: "settings",
      route: "/education/settings",
      order: 99,
      requiredPermission: "module.education.admin",
    }
  ],
  permissions: [
    {
      key: "module.education.view",
      name: "View Education Data",
      description: "Access student and academic registries.",
    },
    {
      key: "module.education.admin",
      name: "Manage Education Settings",
      description: "Manage core module settings and academic terms.",
    },
    {
      key: "module.education.teacher",
      name: "Teacher Access",
      description: "Access teacher-specific tools and resources.",
    }
  ],
  metadata: {
    author: "HAZA AIOS Core Team",
    tags: ["education", "sis", "academic"],
    releasedAt: new Date().toISOString().split("T")[0],
  },
};

/**
 * Registers the Education module with the global registry.
 */
export function registerEducationModule(): void {
  if (!ModuleRegistry.get(EducationModule.id)) {
    ModuleRegistry.register(EducationModule);
  }
}
