import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  AdminPageHeader,
  DataTable,
  StatusBadge,
  ConfirmDialog,
} from "@haza-aios/ui";
import type { DataTableColumn } from "@haza-aios/ui";
import { platformAdminService } from "@/admin/platform-admin-service";
import type { PlatformOrganization } from "@/admin/platform-admin.types";
import { navigate } from "@/routes/navigation";

function AdminOrganizationsPage() {
  const [organizations, setOrganizations] = useState<PlatformOrganization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    org: PlatformOrganization | null;
    action: "suspend" | "activate";
  }>({ open: false, org: null, action: "suspend" });

  useEffect(() => {
    let active = true;
    platformAdminService.getAllOrganizations().then((orgs) => {
      if (active) {
        setOrganizations(orgs);
        setIsLoading(false);
      }
    });
    return () => { active = false; };
  }, []);

  const filteredOrgs = organizations.filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    o.ownerName.toLowerCase().includes(search.toLowerCase()) ||
    o.organizationType.toLowerCase().includes(search.toLowerCase()),
  );

  const handleToggleStatus = async () => {
    if (!confirmDialog.org) return;
    try {
      if (confirmDialog.action === "suspend") {
        const updated = await platformAdminService.suspendOrganization(confirmDialog.org.id);
        setOrganizations((prev) =>
          prev.map((o) => (o.id === updated.id ? updated : o)),
        );
      } else {
        const updated = await platformAdminService.activateOrganization(confirmDialog.org.id);
        setOrganizations((prev) =>
          prev.map((o) => (o.id === updated.id ? updated : o)),
        );
      }
    } finally {
      setConfirmDialog({ open: false, org: null, action: "suspend" });
    }
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const columns: DataTableColumn<PlatformOrganization>[] = [
    {
      key: "name",
      header: "Organization",
      sortable: true,
      render: (row) => (
        <div>
          <p className="font-semibold text-white">{row.name}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">{row.ownerEmail}</p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (row) => (
        <span className="text-xs text-slate-300">{row.organizationType}</span>
      ),
    },
    {
      key: "owner",
      header: "Owner",
      render: (row) => (
        <span className="text-xs text-slate-300">{row.ownerName}</span>
      ),
    },
    {
      key: "members",
      header: "Members",
      align: "center",
      render: (row) => (
        <span className="font-mono text-xs text-slate-300">{row.memberCount}</span>
      ),
    },
    {
      key: "country",
      header: "Country",
      render: (row) => (
        <span className="text-xs text-slate-300">{row.country}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge variant={row.status} />,
    },
    {
      key: "created",
      header: "Created",
      render: (row) => (
        <span className="text-xs text-slate-400 font-mono">{formatDate(row.createdAt)}</span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setConfirmDialog({
              open: true,
              org: row,
              action: row.status === "active" ? "suspend" : "activate",
            });
          }}
          className={`text-[10px] font-semibold px-3 py-1.5 rounded-lg border transition-all ${
            row.status === "active"
              ? "border-red-500/20 text-red-400 hover:bg-red-500/10"
              : "border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10"
          }`}
        >
          {row.status === "active" ? "Suspend" : "Activate"}
        </button>
      ),
    },
  ];

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
          title="Organizations"
          description="Manage all registered organizations across the platform."
          breadcrumbs={[
            { label: "Admin", onClick: () => navigate("/admin") },
            { label: "Organizations" },
          ]}
        />

        {/* Search bar */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              placeholder="Search organizations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-900/60 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500/30 transition-colors"
            />
          </div>
          <span className="text-xs text-slate-500">
            {filteredOrgs.length} of {organizations.length} organizations
          </span>
        </div>

        {/* Data Table */}
        <DataTable
          columns={columns}
          data={filteredOrgs}
          keyExtractor={(row) => row.id}
          emptyMessage="No organizations match your search."
        />

        {/* Confirm Dialog */}
        <ConfirmDialog
          open={confirmDialog.open}
          title={
            confirmDialog.action === "suspend"
              ? "Suspend Organization"
              : "Activate Organization"
          }
          description={
            confirmDialog.action === "suspend"
              ? `Are you sure you want to suspend "${confirmDialog.org?.name}"? All members will lose access until the organization is reactivated.`
              : `Are you sure you want to activate "${confirmDialog.org?.name}"? All members will regain access immediately.`
          }
          confirmLabel={confirmDialog.action === "suspend" ? "Suspend" : "Activate"}
          variant={confirmDialog.action === "suspend" ? "danger" : "default"}
          onConfirm={handleToggleStatus}
          onCancel={() => setConfirmDialog({ open: false, org: null, action: "suspend" })}
        />
      </div>
    </AppShell>
  );
}

export { AdminOrganizationsPage };
