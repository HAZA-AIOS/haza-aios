import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  AdminStatCard,
  AdminPageHeader,
  StatusBadge,
  DashboardCard,
} from "@haza-aios/ui";
import { platformAdminService } from "@/admin/platform-admin-service";
import type {
  PlatformOverviewStats,
  SystemHealthMetric,
  AuditLogEntry,
} from "@/admin/platform-admin.types";

function AdminOverviewPage() {
  const [stats, setStats] = useState<PlatformOverviewStats | null>(null);
  const [health, setHealth] = useState<SystemHealthMetric[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [s, h, a] = await Promise.all([
          platformAdminService.getOverviewStats(),
          platformAdminService.getSystemHealth(),
          platformAdminService.getAuditLog(),
        ]);
        if (active) {
          setStats(s);
          setHealth(h);
          setAuditLog(a.slice(0, 10));
          setIsLoading(false);
        }
      } catch {
        if (active) setIsLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, []);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
      " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  if (isLoading || !stats) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="size-8 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 pb-8">
        <AdminPageHeader
          title="Platform Administration"
          description="System-wide overview of HAZA AIOS platform operations."
          breadcrumbs={[
            { label: "Admin" },
            { label: "Overview" },
          ]}
        />

        {/* Row 1: Platform KPI stat cards */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <AdminStatCard
            title="Total Organizations"
            value={stats.totalOrganizations}
            change={stats.orgChange}
            changeType="positive"
            icon={
              <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            }
          />
          <AdminStatCard
            title="Total Users"
            value={stats.totalUsers}
            change={stats.userChange}
            changeType="positive"
            icon={
              <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            }
          />
          <AdminStatCard
            title="Active Sessions"
            value={stats.activeSessions}
            change={stats.sessionChange}
            changeType="neutral"
            icon={
              <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="14" x="2" y="3" rx="2" />
                <path d="M8 21h8" />
                <path d="M12 17v4" />
              </svg>
            }
          />
          <AdminStatCard
            title="System Health"
            value={`${stats.systemHealthPercent}%`}
            change={stats.healthChange}
            changeType={stats.systemHealthPercent >= 99 ? "positive" : "neutral"}
            icon={
              <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            }
          />
        </div>

        {/* Row 2: System Health Monitor */}
        <DashboardCard>
          <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-300">System Health Monitor</h3>
              <p className="text-xs text-slate-500 mt-0.5">Real-time service status overview</p>
            </div>
            <StatusBadge
              variant={health.every((s) => s.status === "healthy") ? "healthy" : "degraded"}
              label={health.every((s) => s.status === "healthy") ? "All Systems Operational" : "Partial Degradation"}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {health.map((svc) => (
              <div
                key={svc.id}
                className="rounded-xl border border-white/5 bg-slate-950/50 p-4 transition-all hover:border-white/10"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">{svc.name}</span>
                  <StatusBadge variant={svc.status} />
                </div>
                <p className="mt-2 text-[10px] text-slate-500 leading-relaxed">{svc.description}</p>
                <div className="mt-3 flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">
                    <span className="font-mono text-white">{svc.latencyMs}ms</span> latency
                  </span>
                  <span className="text-slate-400">
                    <span className="font-mono text-white">{svc.uptimePercent}%</span> uptime
                  </span>
                </div>
              </div>
            ))}
          </div>
        </DashboardCard>

        {/* Row 3: Recent Audit Log */}
        <DashboardCard>
          <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-300">Recent Audit Activity</h3>
              <p className="text-xs text-slate-500 mt-0.5">Last 10 platform-wide events</p>
            </div>
          </div>
          <div className="space-y-3">
            {auditLog.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start justify-between gap-4 rounded-lg bg-white/[0.02] px-4 py-3 transition-colors hover:bg-white/[0.04]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`size-2 rounded-full shrink-0 ${
                      entry.actionType === "create"
                        ? "bg-emerald-400"
                        : entry.actionType === "delete"
                          ? "bg-red-400"
                          : entry.actionType === "login"
                            ? "bg-blue-400"
                            : entry.actionType === "system"
                              ? "bg-amber-400"
                              : "bg-slate-400"
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{entry.action}</p>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                      {entry.actor} → {entry.target}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-slate-500">{formatTime(entry.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        </DashboardCard>
      </div>
    </AppShell>
  );
}

export { AdminOverviewPage };
