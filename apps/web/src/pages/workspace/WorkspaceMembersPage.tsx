import React, { useEffect, useState, useCallback } from "react";
import { useOrganization } from "../../org/use-organization";
import { workspaceService } from "../../workspace/workspace-service";
import type { WorkspaceMember } from "../../workspace/workspace.types";
import { AppShell } from "../../components/AppShell";
import { DataTable, StatusBadge, ConfirmDialog, AdminPageHeader } from "@haza-aios/ui";

export function WorkspaceMembersPage() {
  const { currentOrganization, currentMembership } = useOrganization();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite Modal State
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"Owner" | "Admin" | "Member">("Member");
  const [isInviting, setIsInviting] = useState(false);

  // Edit Role Modal State
  const [isRoleOpen, setIsRoleOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<WorkspaceMember | null>(null);
  const [editRole, setEditRole] = useState<"Owner" | "Admin" | "Member">("Member");
  const [isSavingRole, setIsSavingRole] = useState(false);

  // Remove Modal State
  const [isRemoveOpen, setIsRemoveOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<WorkspaceMember | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  // Check write access (only Owners and Admins can perform write operations)
  const userRole = currentMembership?.role || "Member";
  const hasWriteAccess = userRole === "Owner" || userRole === "Admin";

  const loadMembers = useCallback(async () => {
    if (!currentOrganization) return;
    try {
      setIsLoading(true);
      setError(null);
      const list = await workspaceService.getMembers(currentOrganization.id, {
        search: searchQuery,
        role: roleFilter || undefined,
      });
      setMembers(list);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load organization members");
    } finally {
      setIsLoading(false);
    }
  }, [currentOrganization, searchQuery, roleFilter]);

  useEffect(() => {
    Promise.resolve().then(() => {
      loadMembers();
    });
  }, [loadMembers]);

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization || !hasWriteAccess) return;

    if (!inviteName.trim() || !inviteEmail.trim()) {
      setError("Please fill in all invite details.");
      return;
    }

    try {
      setIsInviting(true);
      setError(null);
      await workspaceService.inviteMember(currentOrganization.id, {
        name: inviteName,
        email: inviteEmail,
        role: inviteRole,
      });
      setIsInviteOpen(false);
      setInviteName("");
      setInviteEmail("");
      setInviteRole("Member");
      await loadMembers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to invite member");
    } finally {
      setIsInviting(false);
    }
  };

  const handleSaveRole = async () => {
    if (!currentOrganization || !selectedMember || !hasWriteAccess) return;

    // Boundary check: Admins cannot change roles of Owners or make others Owners
    if (userRole === "Admin" && (selectedMember.role === "Owner" || editRole === "Owner")) {
      setError("Unauthorized: Admins cannot modify Owner roles.");
      setIsRoleOpen(false);
      return;
    }

    try {
      setIsSavingRole(true);
      setError(null);
      await workspaceService.changeMemberRole(currentOrganization.id, selectedMember.id, editRole);
      setIsRoleOpen(false);
      setSelectedMember(null);
      await loadMembers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setIsSavingRole(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!currentOrganization || !memberToRemove || !hasWriteAccess) return;

    // Boundary check: Admins cannot remove Owners or other Admins
    if (userRole === "Admin" && (memberToRemove.role === "Owner" || memberToRemove.role === "Admin")) {
      setError("Unauthorized: Admins can only remove standard Members.");
      setIsRemoveOpen(false);
      return;
    }

    try {
      setIsRemoving(true);
      setError(null);
      await workspaceService.removeMember(currentOrganization.id, memberToRemove.id);
      setIsRemoveOpen(false);
      setMemberToRemove(null);
      await loadMembers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setIsRemoving(false);
    }
  };

  if (!currentOrganization) return null;

  // Table columns definition
  const columns = [
    {
      key: "name",
      header: "Member details",
      sortable: true,
      render: (m: WorkspaceMember) => (
        <div>
          <p className="font-semibold text-white">{m.name}</p>
          <p className="text-[10px] text-slate-500">{m.email}</p>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      sortable: true,
      render: (m: WorkspaceMember) => (
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
          m.role === "Owner" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
          m.role === "Admin" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
          "bg-slate-500/10 text-slate-400 border border-slate-500/10"
        }`}>
          {m.role}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (m: WorkspaceMember) => <StatusBadge variant={m.status} />,
    },
    {
      key: "joinedAt",
      header: "Joined Date",
      sortable: true,
      render: (m: WorkspaceMember) => new Date(m.joinedAt).toLocaleDateString(),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right" as const,
      render: (m: WorkspaceMember) => {
        // Hide actions for current user themselves or if standard Member
        if (m.userId === currentMembership?.userId || !hasWriteAccess) {
          return <span className="text-xs text-slate-600">No Actions</span>;
        }

        // Boundary check: Admin role actions limitations
        if (userRole === "Admin" && (m.role === "Owner" || m.role === "Admin")) {
          return <span className="text-xs text-slate-600">Restricted</span>;
        }

        return (
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setSelectedMember(m);
                setEditRole(m.role);
                setIsRoleOpen(true);
              }}
              className="text-xs font-semibold text-amber-400 hover:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-xl transition-all"
            >
              Role
            </button>
            <button
              onClick={() => {
                setMemberToRemove(m);
                setIsRemoveOpen(true);
              }}
              className="text-xs font-semibold text-red-400 hover:text-red-300 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-xl transition-all"
            >
              Remove
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <AppShell>
      <div className="space-y-6 pb-24">
        {/* Page Header */}
        <AdminPageHeader
          title="Organization Members"
          description="View, invite, and manage permission roles for workspace members."
          actions={
            hasWriteAccess ? (
              <button
                onClick={() => setIsInviteOpen(true)}
                className="rounded-xl bg-red-500 px-4 py-2 text-xs font-semibold text-white hover:bg-red-400 transition-all shadow-[0_0_20px_rgba(239,68,68,0.15)]"
              >
                Invite Member
              </button>
            ) : (
              <span className="text-xs text-slate-500 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl">
                Read-Only Mode (Member)
              </span>
            )
          }
        />

        {/* Global Error Display */}
        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-400 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-white font-bold">×</button>
          </div>
        )}

        {/* Search and Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search members by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500/30 transition-all"
            />
          </div>

          <div className="flex items-center gap-3">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs font-medium text-white focus:outline-none"
            >
              <option value="">All Roles</option>
              <option value="Owner">Owner</option>
              <option value="Admin">Admin</option>
              <option value="Member">Member</option>
            </select>
          </div>
        </div>

        {/* Members Table */}
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="relative flex h-8 w-8 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex h-4 w-4 rounded-full bg-red-500"></span>
            </div>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={members}
            keyExtractor={(m) => m.id}
            emptyMessage="No workspace members match your search filters."
          />
        )}

        {/* INVITE MEMBER MODAL */}
        {isInviteOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsInviteOpen(false)} />
            <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-white mb-2">Invite New Member</h3>
              <p className="text-xs text-slate-400 mb-4">Send a workspace invite. They will default to pending status.</p>
              
              <form onSubmit={handleInviteSubmit} className="space-y-4">
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-950 p-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-red-500/30"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. john@haza-aios.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-950 p-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-red-500/30"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">Permission Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as "Owner" | "Admin" | "Member")}
                    className="w-full rounded-xl border border-white/10 bg-slate-950 p-2.5 text-xs text-white focus:outline-none focus:border-red-500/30"
                  >
                    <option value="Member">Member (standard access)</option>
                    <option value="Admin">Admin (administrative rights)</option>
                    <option value="Owner">Owner (full control)</option>
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsInviteOpen(false)}
                    className="rounded-xl border border-white/10 bg-transparent px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isInviting}
                    className="rounded-xl bg-red-500 px-4 py-2 text-xs font-semibold text-white hover:bg-red-400 transition-all disabled:opacity-50"
                  >
                    {isInviting ? "Inviting..." : "Send Invite"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* CHANGE ROLE MODAL */}
        {isRoleOpen && selectedMember && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsRoleOpen(false)} />
            <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-white mb-2">Change Permission Role</h3>
              <p className="text-xs text-slate-400 mb-4">Modify workspace privileges for <span className="text-white font-semibold">{selectedMember.name}</span>.</p>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">Select Role</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as "Owner" | "Admin" | "Member")}
                    className="w-full rounded-xl border border-white/10 bg-slate-950 p-2.5 text-xs text-white focus:outline-none focus:border-red-500/30"
                  >
                    <option value="Member">Member (standard access)</option>
                    <option value="Admin">Admin (administrative rights)</option>
                    {userRole === "Owner" && <option value="Owner">Owner (full control)</option>}
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsRoleOpen(false)}
                    className="rounded-xl border border-white/10 bg-transparent px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveRole}
                    disabled={isSavingRole}
                    className="rounded-xl bg-red-500 px-4 py-2 text-xs font-semibold text-white hover:bg-red-400 transition-all"
                  >
                    {isSavingRole ? "Saving..." : "Update Role"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CONFIRM REMOVE MEMBER DIALOG */}
        <ConfirmDialog
          open={isRemoveOpen}
          title="Remove Member from Workspace"
          description={`Are you sure you want to remove ${memberToRemove?.name} (${memberToRemove?.email})? They will lose all access to this isolated tenant environment immediately.`}
          confirmLabel={isRemoving ? "Removing..." : "Remove Member"}
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={handleRemoveMember}
          onCancel={() => setIsRemoveOpen(false)}
        />
      </div>
    </AppShell>
  );
}
