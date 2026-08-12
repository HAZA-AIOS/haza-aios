import { useEffect, useState, useCallback } from "react";
import { useOrganization } from "../../org/use-organization";
import { workspaceService } from "../../workspace/workspace-service";
import type { WorkspaceModule } from "../../workspace/workspace.types";
import { AppShell } from "../../components/AppShell";
import { AdminPageHeader, StatusBadge } from "@haza-aios/ui";

export function WorkspaceModulesPage() {
  const { currentOrganization, currentMembership } = useOrganization();
  const [modules, setModules] = useState<WorkspaceModule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check write access (only Owners and Admins can toggle module activation)
  const hasWriteAccess = currentMembership?.role === "Owner" || currentMembership?.role === "Admin";

  const loadModules = useCallback(async () => {
    if (!currentOrganization) return;
    try {
      setIsLoading(true);
      setError(null);
      const list = await workspaceService.getModules(
        currentOrganization.id,
        currentOrganization.organizationType
      );
      setModules(list);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load modules list.");
    } finally {
      setIsLoading(false);
    }
  }, [currentOrganization]);

  useEffect(() => {
    Promise.resolve().then(() => {
      loadModules();
    });
  }, [loadModules]);

  const handleToggleModule = async (moduleId: string, currentActiveState: boolean) => {
    if (!currentOrganization) return;
    if (!hasWriteAccess) {
      setError("Unauthorized: Only Admins or Owners can toggle module activation.");
      return;
    }

    try {
      setError(null);
      const updatedList = await workspaceService.toggleModuleActivation(
        currentOrganization.id,
        moduleId,
        !currentActiveState
      );
      setModules(updatedList);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to toggle module activation state.");
    }
  };

  if (!currentOrganization) return null;

  return (
    <AppShell>
      <div className="space-y-6 pb-24">
        {/* Page Header */}
        <AdminPageHeader
          title="Active Modules"
          description="Activate or configure tenant-level functional modules for your organization."
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
            <span className="size-2 rounded-full bg-red-500 animate-pulse shrink-0"></span>
            <span>
              Tenant Workspace: <span className="text-white font-semibold">{currentOrganization.name}</span>
            </span>
          </div>
          <span className="font-medium text-slate-300">
            {modules.filter((m) => m.activationState === "active").length} of {modules.length} Modules Active
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
            {modules.map((mod) => {
              const isActive = mod.activationState === "active";
              return (
                <div
                  key={mod.id}
                  className={`rounded-2xl border p-6 flex flex-col justify-between gap-6 transition-all duration-300 ${
                    isActive
                      ? "border-red-500/25 bg-red-500/[0.02] shadow-[0_0_25px_rgba(239,68,68,0.03)]"
                      : "border-white/10 bg-slate-900/60 hover:border-white/20"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-white tracking-tight">{mod.name}</h3>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {mod.industry} • v{mod.version}
                        </p>
                      </div>
                      <StatusBadge variant={isActive ? "active" : "pending"} label={mod.status} />
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{mod.description}</p>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-white/5">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                      {isActive ? "Operational" : "Offline"}
                    </span>
                    
                    <div className="flex items-center gap-3">
                      {!hasWriteAccess && (
                        <span className="text-[10px] text-slate-600 italic">Read-only</span>
                      )}
                      
                      <button
                        role="switch"
                        aria-checked={isActive}
                        disabled={!hasWriteAccess}
                        onClick={() => handleToggleModule(mod.id, isActive)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-30 disabled:cursor-not-allowed ${
                          isActive ? "bg-red-600" : "bg-slate-800"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            isActive ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
