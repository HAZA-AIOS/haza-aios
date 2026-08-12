import React, { useState } from "react";
import { useOrganization } from "../../org/use-organization";
import { ModuleRuntime } from "../module-runtime";
import { AppShell } from "../../components/AppShell";
import { AdminPageHeader } from "@haza-aios/ui";

export function DemoAnalyticsModulePage() {
  const { currentOrganization } = useOrganization();
  const [metricFilter, setMetricFilter] = useState("all");

  if (!currentOrganization) return null;

  const isActivated = ModuleRuntime.isModuleActivatedForOrg(
    currentOrganization.id,
    "demo-analytics"
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <AdminPageHeader
          title="Demo Analytics & Workspace Telemetry"
          description={`Sample non-production module proving dynamic route resolution and runtime isolation for ${currentOrganization.name}.`}
        />

        {!isActivated ? (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-6 text-amber-300 backdrop-blur-md">
            <h3 className="font-bold text-sm mb-1">Module Deactivated</h3>
            <p className="text-xs text-amber-400">
              The Demo Analytics module is currently deactivated for {currentOrganization.name}. Please activate it from the Active Modules page to unlock metrics.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Filter Bar */}
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-900/60 p-4 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">Telemetry Filter:</span>
                <select
                  value={metricFilter}
                  onChange={(e) => setMetricFilter(e.target.value)}
                  className="rounded-lg border border-white/10 bg-slate-950 px-3 py-1.5 text-xs text-white focus:outline-none"
                >
                  <option value="all">All Workspace Signals</option>
                  <option value="api">API Ingestion Rate</option>
                  <option value="user">Active Operator Sessions</option>
                </select>
              </div>
              <span className="text-[11px] text-emerald-400 font-mono">● LIVE RUNTIME METRICS</span>
            </div>

            {/* Stat Grid */}
            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-md">
                <p className="text-xs font-semibold text-slate-400">Daily Active Events</p>
                <h3 className="text-2xl font-bold text-white mt-2">14,290</h3>
                <span className="text-[10px] text-emerald-400">+12% vs last week</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-md">
                <p className="text-xs font-semibold text-slate-400">Avg Response Latency</p>
                <h3 className="text-2xl font-bold text-white mt-2">18.4 ms</h3>
                <span className="text-[10px] text-emerald-400">Optimal throughput</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-md">
                <p className="text-xs font-semibold text-slate-400">Tenant Sync Health</p>
                <h3 className="text-2xl font-bold text-white mt-2">99.98%</h3>
                <span className="text-[10px] text-slate-400">Isolated database storage</span>
              </div>
            </div>

            {/* Runtime Isolation Disclaimer */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-5">
              <h4 className="text-xs font-bold text-slate-300 mb-2">Module Framework Verification</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                This page demonstrates a modular capability loaded dynamically via <code className="text-red-300">/workspace/modules/demo-analytics</code>.
                No core files were modified to introduce this specific feature view. Future industry modules (e.g. Education / SIS) will plug in seamlessly using this identical interface contract.
              </p>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
