import { ModuleRegistry } from "./module-registry";
import { registerDemoModule } from "./demo-module";
import { registerEducationModule } from "./education";
import type { ModuleContract } from "./module.types";

/**
 * Default catalog of registered platform module definitions for discovery across industries.
 */
const platformCatalog: ModuleContract[] = [
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
  
  // Register Education module
  registerEducationModule();

  // Register catalog stubs
  for (const mod of platformCatalog) {
    if (!ModuleRegistry.get(mod.id)) {
      ModuleRegistry.register(mod);
    }
  }
}

// Auto-run initialization
initModuleRegistry();
