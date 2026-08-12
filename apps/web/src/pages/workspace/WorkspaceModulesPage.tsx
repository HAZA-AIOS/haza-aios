import { useEffect, useState, useCallback } from "react";
import { useOrganization } from "../../org/use-organization";
import { ModuleRuntime } from "../../modules/module-runtime";
import type { ModuleContract, OrganizationModuleState } from "../../modules/module.types";
import { AppShell } from "../../components/AppShell";
import { AdminPageHeader, ModuleCard, ModuleDetailsDialog } from "@haza-aios/ui";

export function WorkspaceModulesPage() {
  const { currentOrganization, currentMembership } = useOrganization();
  const [modules, setModules] = useState<Array<{ module: ModuleContract; state: OrganizationModuleState }>>([]);
  const [selectedModule, setSelectedModule] = useState<ModuleContract | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check write access (only Owners and Admins can toggle module activation)
  const hasWriteAccess = currentMembership?.role === "Owner" || currentMembership?.role === "Admin";

  const loadModules = useCallback(() => {
    if (!currentOrganization) return;
    try {
      setIsLoading(true);
      setError(null);
      const list = ModuleRuntime.getAvailableModulesForOrg(currentOrganization.id);
      setModules(list);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load modules from registry.");
    } finally {
      setIsLoading(false);
    }
  }, [currentOrganization]);

  useEffect(() => {
    Promise.resolve().then(() => {
      loadModules();
    });
  }, [loadModules]);

  const handleToggleModule = (moduleId: string, isCurrentlyActive: boolean) => {
    if (!currentOrganization) return;
    if (!hasWriteAccess) {
      setError("Unauthorized: Only Admins or Owners can toggle module activation.");
      return;
    }

    try {
      setError(null);
      ModuleRuntime.toggleModuleActivationForOrg(
        currentOrganization.id,
        moduleId,
        !isCurrentlyActive
      );
      loadModules();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to toggle module activation state.");
    }
  };

  if (!currentOrganization) return null;

  const activeCount = modules.filter((m) => m.state.status === "activated" && m.state.enabled).length;

  return (
    <AppShell>
      <div className="space-y-6 pb-24">
        {/* Page Header */}
        <AdminPageHeader
          title="Active Industry & Platform Modules"
          description="Manage and toggle dynamic capabilities powered by the HAZA AIOS Module Registry."
        />

        {/* Global Error Display */}
        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-400 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-white font-bold">×</button>
          </div>
        )}

        {/* Active modules status summary banner */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
            <span>
              Tenant Workspace: <span className="text-white font-semibold">{currentOrganization.name}</span>
            </span>
          </div>
          <span className="font-medium text-slate-300">
            {activeCount} of {modules.length} Modules Activated
          </span>
        </div>

        {/* Modules Grid */}
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="relative flex h-8 w-8 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex h-4 w-4 rounded-full bg-red-500"></span>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {modules.map(({ module, state }) => {
              const isActivated = state.status === "activated" && state.enabled;
              return (
                <ModuleCard
                  key={module.id}
                  name={module.name}
                  version={module.version}
                  industry={module.industry}
                  description={module.description}
                  icon={module.icon}
                  status={isActivated ? "activated" : "deactivated"}
                  hasWriteAccess={hasWriteAccess}
                  onToggleStatus={() => handleToggleModule(module.id, isActivated)}
                  onViewDetails={() => {
                    setSelectedModule(module);
                    setIsDetailsOpen(true);
                  }}
                />
              );
            })}
          </div>
        )}

        <ModuleDetailsDialog
          isOpen={isDetailsOpen}
          onClose={() => {
            setIsDetailsOpen(false);
            setSelectedModule(null);
          }}
          module={selectedModule}
        />
      </div>
    </AppShell>
  );
}

