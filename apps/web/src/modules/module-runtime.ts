import { ModuleRegistry } from "./module-registry";
import { initModuleRegistry } from "./index";
import { apiClient } from "../api/api-client";
import { readStoredAuth } from "../auth/auth-storage";
import type {
  ModuleContract,
  OrganizationModuleState,
  ModuleNavigationItem,
  ModuleRouteDefinition,
} from "./module.types";

const orgModulesStorageKeyPrefix = "haza-aios.org-modules.";
const runtimeStateCache = new Map<string, OrganizationModuleState[]>();

type ApiCatalogModule = {
  key: string;
  name: string;
  description: string;
  category: string;
  industry: string;
  version: string;
  status: string;
  isCore: boolean;
  metadata: Record<string, unknown>;
};

type ApiModuleState = {
  organizationId: string;
  moduleKey: string;
  status: "activated" | "deactivated";
  enabled: boolean;
  settings?: Record<string, unknown>;
  activatedAt?: string | null;
  activatedBy?: string | null;
};

type ApiOrganizationModule = {
  catalog: ApiCatalogModule;
  state: ApiModuleState;
};

function getOrgModulesKey(orgId: string): string {
  return `${orgModulesStorageKeyPrefix}${orgId}`;
}

function getStoredOrgModuleStates(orgId: string): OrganizationModuleState[] {
  if (import.meta.env.MODE !== "test") return [];
  const data = localStorage.getItem(getOrgModulesKey(orgId));
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function saveStoredOrgModuleStates(orgId: string, states: OrganizationModuleState[]): void {
  if (import.meta.env.MODE !== "test") {
    runtimeStateCache.set(orgId, states);
    return;
  }
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
    const storedStates = runtimeStateCache.get(orgId) ?? getStoredOrgModuleStates(orgId);

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

  async getAvailableModulesForOrgAsync(orgId: string): Promise<Array<{
    module: ModuleContract;
    state: OrganizationModuleState;
  }>> {
    ensureModuleRegistryReady();

    if (import.meta.env.MODE === "test") {
      return this.getAvailableModulesForOrg(orgId);
    }

    const auth = readStoredAuth();
    const response = await apiClient.request<{ modules: ApiOrganizationModule[] }>(
      `/api/v1/organizations/${orgId}/modules`,
      { authToken: auth?.session.accessToken }
    );
    const allModules = ModuleRegistry.getAll();
    const states: OrganizationModuleState[] = [];

    const available = response.modules.flatMap((item) => {
      const module = allModules.find((candidate) => candidate.slug === item.catalog.key);
      if (!module) return [];

      const state = toOrganizationModuleState(orgId, module.id, item.state);
      states.push(state);
      return [{ module: mergeCatalogMetadata(module, item.catalog), state }];
    });

    runtimeStateCache.set(orgId, states);
    return available;
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

  async toggleModuleActivationForOrgAsync(
    orgId: string,
    moduleId: string,
    activate: boolean
  ): Promise<OrganizationModuleState> {
    ensureModuleRegistryReady();
    const targetModule = ModuleRegistry.get(moduleId);
    if (!targetModule) {
      throw new Error(`Cannot toggle activation: Module "${moduleId}" is not registered.`);
    }

    if (import.meta.env.MODE === "test") {
      return this.toggleModuleActivationForOrg(orgId, moduleId, activate);
    }

    const auth = readStoredAuth();
    const response = activate
      ? await apiClient.request<{ module: ApiModuleState }>(`/api/v1/organizations/${orgId}/modules`, {
          method: "POST",
          authToken: auth?.session.accessToken,
          body: JSON.stringify({ moduleKey: targetModule.slug, enabled: true }),
        })
      : await apiClient.request<{ module: ApiModuleState }>(`/api/v1/organizations/${orgId}/modules/${targetModule.slug}`, {
          method: "DELETE",
          authToken: auth?.session.accessToken,
        });

    const state = toOrganizationModuleState(orgId, moduleId, response.module);
    const cached = runtimeStateCache.get(orgId) ?? [];
    runtimeStateCache.set(orgId, upsertState(cached, state));
    return state;
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

  async updateModuleConfigurationForOrgAsync(
    orgId: string,
    moduleId: string,
    settings: Record<string, unknown>
  ): Promise<OrganizationModuleState> {
    ensureModuleRegistryReady();
    const targetModule = ModuleRegistry.get(moduleId);
    if (!targetModule) {
      throw new Error(`Cannot configure module: Module "${moduleId}" is not registered.`);
    }

    if (import.meta.env.MODE === "test") {
      this.updateModuleConfigurationForOrg(orgId, moduleId, settings);
      return this.getAvailableModulesForOrg(orgId).find((item) => item.module.id === moduleId)?.state as OrganizationModuleState;
    }

    const auth = readStoredAuth();
    const response = await apiClient.request<{ module: ApiModuleState }>(
      `/api/v1/organizations/${orgId}/modules/${targetModule.slug}/config`,
      {
        method: "PATCH",
        authToken: auth?.session.accessToken,
        body: JSON.stringify({ settings }),
      }
    );
    const state = toOrganizationModuleState(orgId, moduleId, response.module);
    const cached = runtimeStateCache.get(orgId) ?? [];
    runtimeStateCache.set(orgId, upsertState(cached, state));
    return state;
  },
};

function toOrganizationModuleState(orgId: string, moduleId: string, state: ApiModuleState): OrganizationModuleState {
  return {
    organizationId: state.organizationId || orgId,
    moduleId,
    status: state.status,
    enabled: state.enabled,
    activatedAt: state.activatedAt ?? undefined,
    activatedBy: state.activatedBy ?? undefined,
    settings: state.settings ?? {},
  };
}

function mergeCatalogMetadata(module: ModuleContract, catalog: ApiCatalogModule): ModuleContract {
  return {
    ...module,
    name: catalog.name || module.name,
    description: catalog.description || module.description,
    version: catalog.version || module.version,
    metadata: { ...module.metadata, ...catalog.metadata },
  };
}

function upsertState(states: OrganizationModuleState[], next: OrganizationModuleState): OrganizationModuleState[] {
  const index = states.findIndex((state) => state.moduleId === next.moduleId);
  if (index === -1) return [...states, next];
  return states.map((state, position) => position === index ? next : state);
}
