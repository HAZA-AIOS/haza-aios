import { describe, it, expect, beforeEach } from "vitest";
import { ModuleRegistry } from "../module-registry";
import { ModuleRuntime } from "../module-runtime";
import type { ModuleContract } from "../module.types";

describe("ModuleRegistry & ModuleRuntime", () => {
  const dummyModule: ModuleContract = {
    id: "test-sis",
    name: "Student Information System",
    slug: "sis-module",
    description: "Manage student enrollments, academic grades, and course schedules.",
    version: "1.0.0",
    category: "industry",
    industry: "Education",
    icon: "🎓",
    status: "available",
    enabled: true,
    routes: [
      {
        path: "/workspace/sis",
        component: () => null,
      },
    ],
    navigation: [
      {
        id: "nav-sis",
        label: "SIS Portal",
        icon: "🎓",
        route: "/workspace/sis",
        order: 10,
      },
    ],
    permissions: [
      {
        key: "sis.read",
        name: "Read SIS Data",
        description: "Allows viewing student records.",
      },
    ],
    metadata: {
      author: "HAZA AIOS Team",
    },
  };

  beforeEach(() => {
    localStorage.clear();
    ModuleRegistry.reset();
  });

  describe("ModuleRegistry", () => {
    it("registers and retrieves a module contract", () => {
      ModuleRegistry.register(dummyModule);
      expect(ModuleRegistry.get("test-sis")).toEqual(dummyModule);
      expect(ModuleRegistry.getBySlug("sis-module")).toEqual(dummyModule);
    });

    it("throws error when registering duplicate module ID", () => {
      ModuleRegistry.register(dummyModule);
      expect(() => ModuleRegistry.register(dummyModule)).toThrow();
    });

    it("filters registered modules by industry target", () => {
      ModuleRegistry.register(dummyModule);
      const eduModules = ModuleRegistry.getByIndustry("Education");
      expect(eduModules).toHaveLength(1);
      expect(eduModules[0].id).toBe("test-sis");
    });
  });

  describe("ModuleRuntime", () => {
    it("retrieves available modules with tenant state", () => {
      ModuleRegistry.register(dummyModule);
      const available = ModuleRuntime.getAvailableModulesForOrg("org-test");
      expect(available).toHaveLength(1);
      expect(available[0].module.id).toBe("test-sis");
      expect(available[0].state.status).toBe("deactivated");
    });

    it("toggles module activation for an organization", () => {
      ModuleRegistry.register(dummyModule);
      
      const activatedState = ModuleRuntime.toggleModuleActivationForOrg(
        "org-test",
        "test-sis",
        true
      );
      expect(activatedState.status).toBe("activated");
      expect(activatedState.enabled).toBe(true);

      const isActivated = ModuleRuntime.isModuleActivatedForOrg("org-test", "test-sis");
      expect(isActivated).toBe(true);

      const navItems = ModuleRuntime.getActiveModuleNavigationForOrg("org-test");
      expect(navItems).toHaveLength(1);
      expect(navItems[0].label).toBe("SIS Portal");
    });
  });
});
