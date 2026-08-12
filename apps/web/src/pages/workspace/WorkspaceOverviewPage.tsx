import { useEffect, useState } from "react";
import { useOrganization } from "../../org/use-organization";
import { workspaceService } from "../../workspace/workspace-service";
import type { WorkspaceActivityLog } from "../../workspace/workspace.types";
import { AppShell } from "../../components/AppShell";
import { AdminStatCard, AdminPageHeader, StatusBadge } from "@haza-aios/ui";
import { navigate } from "../../routes/navigation";

export function WorkspaceOverviewPage() {
  const { currentOrganization } = useOrganization();
  const [memberCount, setMemberCount] = useState(0);
  const [activeModuleCount, setActiveModuleCount] = useState(0);
  const [logs, setLogs] = useState<WorkspaceActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!currentOrganization) return;

    let active = true;

    async function loadData() {
      try {
        setIsLoading(true);
        const members = await workspaceService.getMembers(currentOrganization!.id);
        const modules = await workspaceService.getModules(currentOrganization!.id, currentOrganization!.organizationType);
        const activityLogs = await workspaceService.getActivityLogs(currentOrganization!.id);

        if (active) {
          setMemberCount(members.length);
          setActiveModuleCount(modules.filter((m) => m.activationState === "active").length);
          setLogs(activityLogs);
        }
      } catch (err) {
        console.error("Failed to load workspace overview data:", err);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, [currentOrganization]);

  if (!currentOrganization) return null;

  return (
    <AppShell>
      <div className="space-y-6 pb-24">
        {/* Page Header */}
        <AdminPageHeader
          title="Organization Workspace"
          description={`Manage workspace settings, members, and active modules for ${currentOrganization.name}.`}
        />

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="relative flex h-8 w-8 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex h-4 w-4 rounded-full bg-red-500"></span>
            </div>
          </div>
        ) : (
          <>
            {/* KPI Stat Cards */}
            <div className="grid gap-6 sm:grid-cols-3">
              <AdminStatCard
                title="Total Members"
                value={memberCount}
                change="Active users"
                changeType="positive"
                icon={
                  <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                }
              />
              <AdminStatCard
                title="Active Modules"
                value={`${activeModuleCount} / 5`}
                change="Activated tools"
                changeType="neutral"
                icon={
                  <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m7.5 4.27 9 5.15" />
                    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                    <path d="m3.3 7 8.7 5 8.7-5" />
                    <path d="M12 22V12" />
                  </svg>
                }
              />
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-md flex flex-col justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Workspace Status</p>
                  <div className="mt-3">
                    <StatusBadge variant={currentOrganization.status === "active" ? "active" : "suspended"} />
                  </div>
                </div>
                <span className="text-[10px] text-slate-500">Tenant boundary isolated</span>
              </div>
            </div>

            {/* Dashboard Content Grid */}
            <div className="grid gap-6 lg:grid-cols-12">
              {/* Left Column: Organization Details & Quick Actions */}
              <div className="lg:col-span-7 space-y-6">
                {/* Identity Card */}
                <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-md">
                  <h3 className="text-sm font-semibold text-slate-300 mb-4">Organization Identity</h3>
                  <div className="flex items-start gap-4">
                    <div className="size-16 rounded-2xl bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center text-3xl font-bold">
                      {currentOrganization.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 space-y-2 text-sm">
                      <div>
                        <p className="text-xs text-slate-500">Legal Name</p>
                        <p className="font-semibold text-white">{currentOrganization.legalName}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-slate-500">Organization Type</p>
                          <p className="font-medium text-white">{currentOrganization.organizationType}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Industry Sector</p>
                          <p className="font-medium text-white">{currentOrganization.industry}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Country</p>
                          <p className="font-medium text-white">{currentOrganization.country}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Tenant Slug ID</p>
                          <p className="font-mono text-emerald-400">@{currentOrganization.slug}</p>
                        </div>
                      </div>
                      {currentOrganization.description && (
                        <div>
                          <p className="text-xs text-slate-500">Description</p>
                          <p className="text-slate-300">{currentOrganization.description}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick Actions Card */}
                <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-md">
                  <h3 className="text-sm font-semibold text-slate-300 mb-4">Quick Workspace Actions</h3>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <button
                      onClick={() => navigate("/workspace/members")}
                      className="flex flex-col items-center justify-center p-4 rounded-xl border border-white/5 bg-slate-950/40 hover:bg-white/5 hover:border-red-500/20 transition-all text-center group"
                    >
                      <div className="size-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                        </svg>
                      </div>
                      <span className="text-xs font-semibold text-white">Invite Members</span>
                    </button>

                    <button
                      onClick={() => navigate("/workspace/modules")}
                      className="flex flex-col items-center justify-center p-4 rounded-xl border border-white/5 bg-slate-950/40 hover:bg-white/5 hover:border-red-500/20 transition-all text-center group"
                    >
                      <div className="size-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="7" height="9" rx="1" />
                          <rect x="14" y="3" width="7" height="5" rx="1" />
                          <rect x="14" y="12" width="7" height="9" rx="1" />
                          <rect x="3" y="16" width="7" height="5" rx="1" />
                        </svg>
                      </div>
                      <span className="text-xs font-semibold text-white">Manage Modules</span>
                    </button>

                    <button
                      onClick={() => navigate("/workspace/settings")}
                      className="flex flex-col items-center justify-center p-4 rounded-xl border border-white/5 bg-slate-950/40 hover:bg-white/5 hover:border-red-500/20 transition-all text-center group"
                    >
                      <div className="size-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2z" />
                        </svg>
                      </div>
                      <span className="text-xs font-semibold text-white">Edit Settings</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Recent Workspace Activity Logs */}
              <div className="lg:col-span-5">
                <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-md flex flex-col justify-between h-full min-h-[350px]">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-300">Workspace Activity</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Isolated tenant operational logs</p>
                  </div>

                  <div className="space-y-4 my-4 flex-1 overflow-y-auto max-h-[300px] pr-1">
                    {logs.length === 0 ? (
                      <div className="flex h-32 items-center justify-center text-xs text-slate-500">
                        No activity logged yet.
                      </div>
                    ) : (
                      logs.map((log) => (
                        <div key={log.id} className="flex justify-between items-start gap-4 text-xs border-b border-white/5 pb-2.5 last:border-0 last:pb-0">
                          <div>
                            <p className="font-semibold text-white">{log.action}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{log.details}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-mono text-slate-400 font-semibold">{log.actor}</p>
                            <span className="text-[9px] text-slate-500">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
