import type {
  ModuleContract,
  ModuleIndustry,
  ModuleCategory,
} from "./module.types";

/**
 * ModuleRegistry provides a centralized in-memory registry to discover and manage
 * registered HAZA AIOS modules without hardcoding module details across pages.
 */
class ModuleRegistryClass {
  private modules: Map<string, ModuleContract> = new Map();

  /**
   * Register a new module contract in the platform registry.
   */
  register(moduleContract: ModuleContract): void {
    if (!moduleContract.id || !moduleContract.slug) {
      throw new Error("Cannot register module: missing required id or slug.");
    }

    if (this.modules.has(moduleContract.id)) {
      throw new Error(`Module with ID "${moduleContract.id}" is already registered.`);
    }

    this.modules.set(moduleContract.id, {
      ...moduleContract,
      status: moduleContract.status || "registered",
    });
  }

  /**
   * Get a registered module by its unique ID.
   */
  get(id: string): ModuleContract | undefined {
    return this.modules.get(id);
  }

  /**
   * Get a registered module by its URL slug.
   */
  getBySlug(slug: string): ModuleContract | undefined {
    return Array.from(this.modules.values()).find((m) => m.slug === slug);
  }

  /**
   * Get all registered modules.
   */
  getAll(): ModuleContract[] {
    return Array.from(this.modules.values());
  }

  /**
   * Get registered modules filtered by industry target.
   */
  getByIndustry(industry: ModuleIndustry): ModuleContract[] {
    return Array.from(this.modules.values()).filter((m) => m.industry === industry);
  }

  /**
   * Get registered modules filtered by category.
   */
  getByCategory(category: ModuleCategory): ModuleContract[] {
    return Array.from(this.modules.values()).filter((m) => m.category === category);
  }

  /**
   * Check if a module is registered and enabled system-wide.
   */
  isEnabled(id: string): boolean {
    const mod = this.get(id);
    return Boolean(mod && mod.enabled && mod.status !== "disabled" && mod.status !== "deactivated");
  }

  /**
   * Clear all registered modules (used in unit test setups).
   */
  reset(): void {
    this.modules.clear();
  }
}

export const ModuleRegistry = new ModuleRegistryClass();
