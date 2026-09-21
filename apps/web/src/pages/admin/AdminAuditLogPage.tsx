import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AdminPageHeader, DataTable } from "@haza-aios/ui";
import type { DataTableColumn } from "@haza-aios/ui";
import type { AuditLogEntry } from "@/admin/platform-admin.types";
import { operationalService } from "@/operations/operational-service";
import { useOrganization } from "@/org/use-organization";
import { navigate } from "@/routes/navigation";

const ACTION_TYPE_LABELS: Record<string, string> = {
  create: "Create",
  update: "Update",
  delete: "Delete",
  login: "Login",
  system: "System",
};

const ACTION_TYPE_COLORS: Record<string, string> = {
  create: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  update: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  delete: "bg-red-500/10 text-red-400 border-red-500/20",
  login: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  system: "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

function AdminAuditLogPage() {
  const { currentOrganization } = useOrganization();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);

    if (!currentOrganization) {
      setEntries([]);
      setIsLoading(false);
      return () => {
        active = false;
      };
    }

    operationalService
      .getAuditLog(currentOrganization.id)
      .then((log) => {
        if (active) setEntries(log);
      })
      .catch((reason: unknown) => {
        if (active) {
          setEntries([]);
          setError(reason instanceof Error ? reason.message : "Unable to load the audit trail.");
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currentOrganization]);

  const filtered =
    filterType === "all" ? entries : entries.filter((e) => e.actionType === filterType);

  const formatTimestamp = (iso: string) => {
    const d = new Date(iso);
    return (
      d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
      " at " +
      d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    );
  };

  const columns: DataTableColumn<AuditLogEntry>[] = [
    {
      key: "timestamp",
      header: "Timestamp",
      sortable: true,
      render: (row) => (
        <span className="font-mono text-xs whitespace-nowrap text-slate-400">
          {formatTimestamp(row.timestamp)}
        </span>
      ),
    },
    {
      key: "action",
      header: "Action",
      render: (row) => (
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
              ACTION_TYPE_COLORS[row.actionType] ||
              "border-slate-500/20 bg-slate-500/10 text-slate-400"
            }`}
          >
            {ACTION_TYPE_LABELS[row.actionType] || row.actionType}
          </span>
          <span className="text-xs font-semibold text-white">{row.action}</span>
        </div>
      ),
    },
    {
      key: "actor",
      header: "Actor",
      render: (row) => (
        <div>
          <p className="text-xs text-white">{row.actor}</p>
          <p className="text-[10px] text-slate-500">{row.actorEmail}</p>
        </div>
      ),
    },
    {
      key: "target",
      header: "Target",
      render: (row) => (
        <div>
          <p className="text-xs text-slate-300">{row.target}</p>
          <p className="text-[10px] text-slate-500 capitalize">{row.targetType}</p>
        </div>
      ),
    },
    {
      key: "details",
      header: "Details",
      render: (row) => (
        <p className="max-w-[300px] truncate text-xs text-slate-400">{row.details}</p>
      ),
    },
  ];

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="size-8 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 pb-8">
        <AdminPageHeader
          title="Audit Log"
          description="Immutable audit trail for the active organization."
          breadcrumbs={[
            { label: "Admin", onClick: () => navigate("/admin") },
            { label: "Audit Log" },
          ]}
        />

        {error ? (
          <div className="border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {["all", "create", "update", "delete", "login", "system"].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`rounded-lg border px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase transition-all ${
                filterType === type
                  ? "border-red-500/20 bg-red-500/10 text-red-400"
                  : "border-white/10 bg-transparent text-slate-400 hover:border-white/20 hover:text-white"
              }`}
            >
              {type === "all" ? "All Events" : ACTION_TYPE_LABELS[type] || type}
            </button>
          ))}
          <span className="ml-auto text-xs text-slate-500">{filtered.length} entries</span>
        </div>

        {/* Data Table */}
        <DataTable
          columns={columns}
          data={filtered}
          keyExtractor={(row) => row.id}
          emptyMessage="No audit log entries match the selected filter."
        />
      </div>
    </AppShell>
  );
}

export { AdminAuditLogPage };
