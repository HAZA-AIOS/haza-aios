import { ModuleRegistry } from "./module-registry";
import { registerDemoModule } from "./demo-module";
import type { ModuleContract } from "./module.types";

/**
 * Default catalog of registered platform module definitions for discovery across industries.
 */
const platformCatalog: ModuleContract[] = [
  {
    id: "mod-education-sis",
    name: "Education & SIS Suite (Framework Ready)",
    slug: "education-sis",
    description:
      "Future School Information System capability for managing academic structures, students, and course registries.",
    version: "0.1.0-alpha",
    category: "industry",
    industry: "Education",
    icon: "🎓",
    status: "available",
    enabled: false,
    routes: [],
    navigation: [],
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

// Auto-run initialization
initModuleRegistry();
