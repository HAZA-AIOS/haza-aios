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
import type { PlatformUser } from "@/admin/platform-admin.types";
import { navigate } from "@/routes/navigation";

function AdminUsersPage() {
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    user: PlatformUser | null;
    action: "deactivate" | "activate";
  }>({ open: false, user: null, action: "deactivate" });

  useEffect(() => {
    let active = true;
    platformAdminService.getAllUsers().then((u) => {
      if (active) {
        setUsers(u);
        setIsLoading(false);
      }
    });
    return () => { active = false; };
  }, []);

  const filteredUsers = users.filter((u) =>
    u.displayName.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.platformRole.toLowerCase().includes(search.toLowerCase()),
  );

  const handleToggleStatus = async () => {
    if (!confirmDialog.user) return;
    try {
      if (confirmDialog.action === "deactivate") {
        const updated = await platformAdminService.deactivateUser(confirmDialog.user.id);
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      } else {
        const updated = await platformAdminService.activateUser(confirmDialog.user.id);
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      }
    } finally {
      setConfirmDialog({ open: false, user: null, action: "deactivate" });
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "Never";
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const roleLabel = (role: string) => {
    switch (role) {
      case "super_admin":
        return "Super Admin";
      case "support_agent":
        return "Support Agent";
      default:
        return "Viewer";
    }
  };

  const columns: DataTableColumn<PlatformUser>[] = [
    {
      key: "name",
      header: "User",
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-full bg-red-500/20 text-red-400 text-xs font-bold shrink-0">
            {row.firstName.charAt(0)}{row.lastName.charAt(0)}
          </div>
          <div>
            <p className="font-semibold text-white">{row.displayName}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Platform Role",
      render: (row) => (
        <span
          className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wide ${
            row.platformRole === "super_admin"
              ? "bg-red-500/10 text-red-400 border border-red-500/20"
              : row.platformRole === "support_agent"
                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                : "bg-slate-500/10 text-slate-400 border border-slate-500/20"
          }`}
        >
          {roleLabel(row.platformRole)}
        </span>
      ),
    },
    {
      key: "orgs",
      header: "Organizations",
      align: "center",
      render: (row) => (
        <span className="font-mono text-xs text-slate-300">{row.organizationCount}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge variant={row.status} />,
    },
    {
      key: "verified",
      header: "Verified",
      align: "center",
      render: (row) => (
        <span className={`text-xs ${row.emailVerified ? "text-emerald-400" : "text-slate-500"}`}>
          {row.emailVerified ? "✓" : "✗"}
        </span>
      ),
    },
    {
      key: "lastLogin",
      header: "Last Login",
      render: (row) => (
        <span className="text-xs text-slate-400 font-mono">{formatDate(row.lastLoginAt)}</span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (row) => {
        if (row.platformRole === "super_admin") {
          return (
            <span className="text-[10px] text-slate-600 italic">Protected</span>
          );
        }
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDialog({
                open: true,
                user: row,
                action: row.status === "active" || row.status === "invited" ? "deactivate" : "activate",
              });
            }}
            className={`text-[10px] font-semibold px-3 py-1.5 rounded-lg border transition-all ${
              row.status === "active" || row.status === "invited"
                ? "border-red-500/20 text-red-400 hover:bg-red-500/10"
                : "border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10"
            }`}
          >
            {row.status === "active" || row.status === "invited" ? "Deactivate" : "Activate"}
          </button>
        );
      },
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
          title="Users"
          description="Manage all platform users across organizations."
          breadcrumbs={[
            { label: "Admin", onClick: () => navigate("/admin") },
            { label: "Users" },
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
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-900/60 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500/30 transition-colors"
            />
          </div>
          <span className="text-xs text-slate-500">
            {filteredUsers.length} of {users.length} users
          </span>
        </div>

        {/* Data Table */}
        <DataTable
          columns={columns}
          data={filteredUsers}
          keyExtractor={(row) => row.id}
          emptyMessage="No users match your search."
        />

        {/* Confirm Dialog */}
        <ConfirmDialog
          open={confirmDialog.open}
          title={
            confirmDialog.action === "deactivate"
              ? "Deactivate User"
              : "Activate User"
          }
          description={
            confirmDialog.action === "deactivate"
              ? `Are you sure you want to deactivate "${confirmDialog.user?.displayName}"? They will lose access to all organizations until reactivated.`
              : `Are you sure you want to activate "${confirmDialog.user?.displayName}"? They will regain access to their organizations immediately.`
          }
          confirmLabel={confirmDialog.action === "deactivate" ? "Deactivate" : "Activate"}
          variant={confirmDialog.action === "deactivate" ? "danger" : "default"}
          onConfirm={handleToggleStatus}
          onCancel={() => setConfirmDialog({ open: false, user: null, action: "deactivate" })}
        />
      </div>
    </AppShell>
  );
}

export { AdminUsersPage };
