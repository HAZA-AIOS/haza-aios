import { useState } from "react";
import { ModuleRegistry } from "../../modules/module-registry";
import type { ModuleContract, ModuleIndustry } from "../../modules/module.types";
import { AppShell } from "../../components/AppShell";
import { AdminPageHeader, ModuleBadge, ModuleDetailsDialog } from "@haza-aios/ui";

export function AdminModulesPage() {
  const [industryFilter, setIndustryFilter] = useState<string>("all");
  const [selectedModule, setSelectedModule] = useState<ModuleContract | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const allModules = ModuleRegistry.getAll();

  const filteredModules =
    industryFilter === "all"
      ? allModules
      : ModuleRegistry.getByIndustry(industryFilter as ModuleIndustry);

  return (
    <AppShell>
      <div className="space-y-6 pb-24">
        <AdminPageHeader
          title="Platform Module Registry"
          description="Global directory of all registered HAZA AIOS industry and platform capability modules."
        />

        {/* Filter bar */}
        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/60 p-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-400">Filter Industry:</span>
            <select
              value={industryFilter}
              onChange={(e) => setIndustryFilter(e.target.value)}
              className="rounded-xl border border-white/10 bg-slate-950 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-500/30"
            >
              <option value="all">All Target Industries</option>
              <option value="Education">Education</option>
              <option value="Healthcare">Healthcare</option>
              <option value="Corporate">Corporate</option>
              <option value="Cross-Industry">Cross-Industry</option>
              <option value="Platform">Platform Core</option>
            </select>
          </div>
          <span className="text-xs font-medium text-slate-400">
            Registered: <span className="text-white font-bold">{filteredModules.length}</span> Modules
          </span>
        </div>

        {/* Modules Table */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 overflow-hidden backdrop-blur-md">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-white/10 text-slate-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="p-4">Module Name & Slug</th>
                <th className="p-4">Industry</th>
                <th className="p-4">Category</th>
                <th className="p-4">Version</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {filteredModules.map((mod) => (
                <tr key={mod.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{mod.icon || "📦"}</span>
                      <div>
                        <div className="font-bold text-white text-sm">{mod.name}</div>
                        <code className="text-[10px] text-red-400 font-mono">{mod.slug}</code>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 font-medium text-slate-200">{mod.industry}</td>
                  <td className="p-4 capitalize text-slate-400">{mod.category}</td>
                  <td className="p-4 font-mono text-slate-400">v{mod.version}</td>
                  <td className="p-4">
                    <ModuleBadge status={mod.status} />
                  </td>
                  <td className="p-4 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedModule(mod);
                        setIsDetailsOpen(true);
                      }}
                      className="rounded-lg border border-white/10 bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
                    >
                      View Spec
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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
