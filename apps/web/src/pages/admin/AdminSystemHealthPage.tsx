import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  AdminPageHeader,
  AdminStatCard,
  StatusBadge,
  DashboardCard,
} from "@haza-aios/ui";
import { platformAdminService } from "@/admin/platform-admin-service";
import type { SystemHealthMetric } from "@/admin/platform-admin.types";
import { navigate } from "@/routes/navigation";

function AdminSystemHealthPage() {
  const [services, setServices] = useState<SystemHealthMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    platformAdminService.getSystemHealth().then((h) => {
      if (active) {
        setServices(h);
        setIsLoading(false);
      }
    });
    return () => { active = false; };
  }, []);

  const healthyCount = services.filter((s) => s.status === "healthy").length;
  const degradedCount = services.filter((s) => s.status === "degraded").length;
  const downCount = services.filter((s) => s.status === "down").length;
  const overallPercent = services.length > 0
    ? Math.round((healthyCount / services.length) * 100 * 100) / 100
    : 0;
  const avgLatency = services.length > 0
    ? Math.round(services.reduce((sum, s) => sum + s.latencyMs, 0) / services.length)
    : 0;

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return (
      d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
      " " +
      d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    );
  };

  if (isLoading) {
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
          title="System Health"
          description="Detailed service health monitoring for all HAZA AIOS infrastructure components."
          breadcrumbs={[
            { label: "Admin", onClick: () => navigate("/admin") },
            { label: "System Health" },
          ]}
          actions={
            <StatusBadge
              variant={downCount > 0 ? "down" : degradedCount > 0 ? "degraded" : "healthy"}
              label={downCount > 0 ? "Service Outage" : degradedCount > 0 ? "Partial Degradation" : "All Systems Operational"}
            />
          }
        />

        {/* Summary Stats */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <AdminStatCard
            title="Overall Health"
            value={`${overallPercent}%`}
            change={`${healthyCount}/${services.length} healthy`}
            changeType={overallPercent >= 99 ? "positive" : overallPercent >= 90 ? "neutral" : "negative"}
            icon={
              <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            }
          />
          <AdminStatCard
            title="Avg Latency"
            value={`${avgLatency}ms`}
            change={avgLatency < 100 ? "Excellent" : avgLatency < 300 ? "Acceptable" : "High"}
            changeType={avgLatency < 100 ? "positive" : avgLatency < 300 ? "neutral" : "negative"}
            icon={
              <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            }
          />
          <AdminStatCard
            title="Healthy Services"
            value={healthyCount}
            change={`of ${services.length} services`}
            changeType="positive"
            icon={
              <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            }
          />
          <AdminStatCard
            title="Issues"
            value={degradedCount + downCount}
            change={downCount > 0 ? `${downCount} critical` : degradedCount > 0 ? `${degradedCount} degraded` : "No issues"}
            changeType={downCount > 0 ? "negative" : degradedCount > 0 ? "neutral" : "positive"}
            icon={
              <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
            }
          />
        </div>

        {/* Service Health Cards Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((svc) => (
            <DashboardCard key={svc.id} className="flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">{svc.name}</h3>
                  <StatusBadge variant={svc.status} />
                </div>
                <p className="mt-2 text-xs text-slate-500 leading-relaxed">{svc.description}</p>
              </div>

              {/* Metrics Row */}
              <div className="mt-6 grid grid-cols-3 gap-3 border-t border-white/5 pt-4">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Latency</p>
                  <p className={`mt-1 text-sm font-bold font-mono ${
                    svc.latencyMs < 100 ? "text-emerald-400" :
                    svc.latencyMs < 300 ? "text-amber-400" : "text-red-400"
                  }`}>
                    {svc.latencyMs}ms
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Uptime</p>
                  <p className={`mt-1 text-sm font-bold font-mono ${
                    svc.uptimePercent >= 99.9 ? "text-emerald-400" :
                    svc.uptimePercent >= 99 ? "text-amber-400" : "text-red-400"
                  }`}>
                    {svc.uptimePercent}%
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Checked</p>
                  <p className="mt-1 text-[10px] text-slate-400 font-mono">
                    {formatTime(svc.lastChecked)}
                  </p>
                </div>
              </div>

              {/* Status Bar */}
              <div className="mt-4">
                <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      svc.status === "healthy"
                        ? "bg-emerald-500"
                        : svc.status === "degraded"
                          ? "bg-amber-500"
                          : "bg-red-500"
                    }`}
                    style={{ width: `${svc.uptimePercent}%` }}
                  />
                </div>
              </div>
            </DashboardCard>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

export { AdminSystemHealthPage };
