import { ModuleRegistry } from "./module-registry";
import { initModuleRegistry } from "./index";
import type {
  ModuleContract,
  OrganizationModuleState,
  ModuleNavigationItem,
  ModuleRouteDefinition,
} from "./module.types";

const orgModulesStorageKeyPrefix = "haza-aios.org-modules.";

function getOrgModulesKey(orgId: string): string {
  return `${orgModulesStorageKeyPrefix}${orgId}`;
}

function getStoredOrgModuleStates(orgId: string): OrganizationModuleState[] {
  const data = localStorage.getItem(getOrgModulesKey(orgId));
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function saveStoredOrgModuleStates(orgId: string, states: OrganizationModuleState[]): void {
  localStorage.setItem(getOrgModulesKey(orgId), JSON.stringify(states));
}

function ensureModuleRegistryReady(): void {
  if (ModuleRegistry.getAll().length === 0) {
    initModuleRegistry();
  }
}

/**
 * ModuleRuntime handles tenant-isolated activation, dynamic routing lookups,
 * dynamic sidebar navigation generation, and permission verification for modules.
 */
export const ModuleRuntime = {
  /**
   * Get all registered modules along with their organization-specific activation state.
   */
  getAvailableModulesForOrg(orgId: string): Array<{
    module: ModuleContract;
    state: OrganizationModuleState;
  }> {
    ensureModuleRegistryReady();
    const allModules = ModuleRegistry.getAll();
    const storedStates = getStoredOrgModuleStates(orgId);

    return allModules.map((module) => {
      const existing = storedStates.find((s) => s.moduleId === module.id);
      const isDefaultActivated = module.slug === "demo-analytics" || module.slug === "education-sis";

      const state: OrganizationModuleState = existing || {
        organizationId: orgId,
        moduleId: module.id,
        status: isDefaultActivated ? "activated" : "deactivated",
        enabled: isDefaultActivated,
        activatedAt: isDefaultActivated ? new Date("2026-06-15").toISOString() : undefined,
      };

      return { module, state };
    });
  },

  /**
   * Check if a specific module is activated for an organization.
   */
  isModuleActivatedForOrg(orgId: string, moduleIdOrSlug: string): boolean {
    ensureModuleRegistryReady();
    const targetModule =
      ModuleRegistry.get(moduleIdOrSlug) || ModuleRegistry.getBySlug(moduleIdOrSlug);
    if (!targetModule) return false;

    const available = this.getAvailableModulesForOrg(orgId);
    const item = available.find((a) => a.module.id === targetModule.id);
    return Boolean(item && item.state.status === "activated" && item.state.enabled);
  },

  /**
   * Toggle activation state of a module for a given organization.
   */
  toggleModuleActivationForOrg(
    orgId: string,
    moduleId: string,
    activate: boolean
  ): OrganizationModuleState {
    ensureModuleRegistryReady();
    const targetModule = ModuleRegistry.get(moduleId);
    if (!targetModule) {
      throw new Error(`Cannot toggle activation: Module "${moduleId}" is not registered.`);
    }

    const storedStates = getStoredOrgModuleStates(orgId);
    const index = storedStates.findIndex((s) => s.moduleId === moduleId);

    const updatedState: OrganizationModuleState = {
      organizationId: orgId,
      moduleId,
      status: activate ? "activated" : "deactivated",
      enabled: activate,
      activatedAt: activate ? new Date().toISOString() : undefined,
    };

    if (index >= 0) {
      storedStates[index] = updatedState;
    } else {
      storedStates.push(updatedState);
    }

    saveStoredOrgModuleStates(orgId, storedStates);
    return updatedState;
  },

  /**
   * Get dynamic sidebar navigation items contributed by all activated modules for an org.
   */
  getActiveModuleNavigationForOrg(orgId: string): ModuleNavigationItem[] {
    const available = this.getAvailableModulesForOrg(orgId);
    const activeModules = available
      .filter((a) => a.state.status === "activated" && a.state.enabled)
      .map((a) => a.module);

    const navItems: ModuleNavigationItem[] = [];
    for (const mod of activeModules) {
      if (mod.navigation && mod.navigation.length > 0) {
        navItems.push(...mod.navigation);
      }
    }

    return navItems.sort((a, b) => a.order - b.order);
  },

  /**
   * Get dynamic routes contributed by all activated modules for an org.
   */
  getActiveModuleRoutesForOrg(orgId: string): ModuleRouteDefinition[] {
    const available = this.getAvailableModulesForOrg(orgId);
    const activeModules = available
      .filter((a) => a.state.status === "activated" && a.state.enabled)
      .map((a) => a.module);

    const routes: ModuleRouteDefinition[] = [];
    for (const mod of activeModules) {
      if (mod.routes && mod.routes.length > 0) {
        routes.push(...mod.routes);
      }
    }

    return routes;
  },

  /**
   * Get module configuration settings for an org.
   */
  getModuleConfigurationForOrg(orgId: string, moduleId: string): Record<string, unknown> {
    ensureModuleRegistryReady();
    const targetModule = ModuleRegistry.get(moduleId);
    const defaultValues = targetModule?.configuration?.defaultValues || {};
    const states = getStoredOrgModuleStates(orgId);
    const match = states.find((s) => s.moduleId === moduleId);
    return { ...defaultValues, ...(match?.settings || {}) };
  },

  /**
   * Update module configuration settings for an org.
   */
  updateModuleConfigurationForOrg(
    orgId: string,
    moduleId: string,
    settings: Record<string, unknown>
  ): void {
    ensureModuleRegistryReady();
    const states = getStoredOrgModuleStates(orgId);
    const match = states.find((s) => s.moduleId === moduleId);
    if (match) {
      match.settings = { ...(match.settings || {}), ...settings };
    } else {
      states.push({
        organizationId: orgId,
        moduleId,
        status: "deactivated",
        enabled: false,
        settings,
      });
    }
    saveStoredOrgModuleStates(orgId, states);
  },
};
