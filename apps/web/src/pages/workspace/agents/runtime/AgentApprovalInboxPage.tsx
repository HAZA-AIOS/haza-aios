import React, { useState, useEffect } from "react";
import { navigate } from "@/routes/navigation";
import { useOrganization } from "@/org/use-organization";
import { readStoredAuth } from "@/auth/auth-storage";
import {
  AgentRuntimeService,
  type AgentApprovalRequestItem,
} from "@/agents/agent-runtime-service";
import { AppShell } from "@/components/AppShell";
import {
  Button,
  AgentApprovalCard,
  AgentRuntimeEmptyState,
} from "@haza-aios/ui";

export const AgentApprovalInboxPage: React.FC = () => {
  const { currentOrganization } = useOrganization();
  const currentUserId = readStoredAuth()?.user.id;

  const [approvals, setApprovals] = useState<AgentApprovalRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected">("pending");
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchApprovals = async () => {
    if (!currentOrganization) return;
    setLoading(true);
    setError(null);
    try {
      const res = await AgentRuntimeService.listApprovals(currentOrganization.id, statusFilter);
      setApprovals(res.approvals);
    } catch (err: any) {
      setError(err.message || "Failed to load approval requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, [currentOrganization, statusFilter]);

  const handleApprove = async (approvalId: string, reason?: string) => {
    if (!currentOrganization) return;
    setActingId(approvalId);
    setError(null);
    setSuccessMessage(null);
    try {
      await AgentRuntimeService.approveApproval(currentOrganization.id, approvalId, reason);
      setSuccessMessage("Execution authorized successfully. Agent run has resumed execution.");
      fetchApprovals();
    } catch (err: any) {
      setError(err.message || "Approval authorization failed.");
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async (approvalId: string, reason?: string) => {
    if (!currentOrganization) return;
    setActingId(approvalId);
    setError(null);
    setSuccessMessage(null);
    try {
      await AgentRuntimeService.rejectApproval(currentOrganization.id, approvalId, reason);
      setSuccessMessage("Agent run has been rejected and moved to terminal state.");
      fetchApprovals();
    } catch (err: any) {
      setError(err.message || "Rejection failed.");
    } finally {
      setActingId(null);
    }
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        {/* Navigation & Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <button
                type="button"
                onClick={() => navigate("/workspace/agents/active")}
                className="hover:text-cyan-400 transition-colors"
              >
                Agents
              </button>
              <span>/</span>
              <span className="text-white font-medium">Human Approval Inbox</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
              <span>Human Approval Inbox</span>
              {statusFilter === "pending" && approvals.length > 0 && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold border border-amber-500/30">
                  {approvals.length} PENDING
                </span>
              )}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate("/workspace/agents/runs")}
            >
              All Runs
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate("/workspace/agents/runtime/monitoring")}
            >
              Runtime Monitoring
            </Button>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm flex items-center justify-between">
            <span>{successMessage}</span>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              className="text-xs text-emerald-400 hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Status Tabs */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-2">
          <button
            type="button"
            onClick={() => setStatusFilter("pending")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              statusFilter === "pending"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Pending Approvals
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("approved")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              statusFilter === "approved"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Approved History
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("rejected")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              statusFilter === "rejected"
                ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Rejected History
          </button>
        </div>

        {/* Approvals List */}
        {loading ? (
          <div className="py-20 text-center text-xs text-slate-400">Loading approvals queue...</div>
        ) : approvals.length === 0 ? (
          <AgentRuntimeEmptyState
            title="Inbox Clean"
            description={
              statusFilter === "pending"
                ? "There are no agent executions currently awaiting human authorization."
                : `No requests found in ${statusFilter} history.`
            }
            icon={
              <svg className="size-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
        ) : (
          <div className="space-y-4">
            {approvals.map((req) => (
              <AgentApprovalCard
                key={req.id}
                approval={{
                  id: req.id,
                  runId: req.runId,
                  actionName: req.actionName,
                  actionType: req.actionType,
                  actionPayload: req.actionPayload,
                  riskLevel: req.riskLevel,
                  policy: req.policy,
                  requiredRoles: req.requiredRoles,
                  status: req.status,
                  requestedBy: req.requestedBy,
                  createdAt: req.createdAt,
                  expiresAt: req.expiresAt,
                }}
                currentUserId={currentUserId}
                isActing={actingId === req.id}
                onApprove={(reason) => handleApprove(req.id, reason)}
                onReject={(reason) => handleReject(req.id, reason)}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
};
