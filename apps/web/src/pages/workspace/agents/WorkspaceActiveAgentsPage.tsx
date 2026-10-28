import React, { useMemo, useState } from "react";
import { Button } from "@haza-aios/ui/components/button";
import { Input } from "@haza-aios/ui/components/input";
import {
  AgentCard,
  AgentEmptyState,
  HumanApprovalBadge,
} from "@haza-aios/ui/components/agent-primitives";
import { useAgentTemplates, useAgentInstances } from "../../../agents/use-agents";
import { navigate } from "../../../routes/navigation";
import { AppShell } from "../../../components/AppShell";
import type { AgentLifecycleStatus } from "../../../agents/agent.types";

const statusFilterTabs: Array<{ label: string; value: AgentLifecycleStatus | "all" }> = [
  { label: "All Agents", value: "all" },
  { label: "Active", value: "active" },
  { label: "Configured", value: "configured" },
  { label: "Suspended", value: "suspended" },
  { label: "Paused", value: "paused" },
  { label: "Archived", value: "archived" },
];

export const WorkspaceActiveAgentsPage: React.FC = () => {
  const { templates } = useAgentTemplates();
  const {
    instances,
    isLoading,
    activateAgent,
    suspendAgent,
    resumeAgent,
    pauseAgent,
    archiveAgent,
  } = useAgentInstances();

  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<AgentLifecycleStatus | "all">("all");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [customName, setCustomName] = useState("");
  const [requireApproval, setRequireApproval] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Filtered instances
  const filteredInstances = useMemo(() => {
    return instances.filter((inst) => {
      const matchesStatus =
        selectedStatus === "all" || inst.status === selectedStatus;
      const template = templates.find((t) => t.id === inst.agentTemplateId);
      const matchesSearch =
        !search.trim() ||
        inst.name.toLowerCase().includes(search.toLowerCase()) ||
        (template?.description || "").toLowerCase().includes(search.toLowerCase()) ||
        (template?.category || "").toLowerCase().includes(search.toLowerCase()) ||
        (template?.industry || "").toLowerCase().includes(search.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [instances, templates, selectedStatus, search]);

  const handleOpenCreateModal = () => {
    if (templates.length > 0 && !selectedTemplateId) {
      setSelectedTemplateId(templates[0].id);
    }
    setCustomName("");
    setRequireApproval(false);
    setActionError(null);
    setIsCreateModalOpen(true);
  };

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplateId) return;

    setIsSubmitting(true);
    setActionError(null);
    try {
      const template = templates.find((t) => t.id === selectedTemplateId);
      await activateAgent(selectedTemplateId, {
        name: customName.trim() || undefined,
        humanApprovalPolicy: requireApproval
          ? {
              required: true,
              approverRoles: ["owner", "admin"],
              fallbackAction: "deny",
            }
          : undefined,
      });
      setIsCreateModalOpen(false);
    } catch (err: any) {
      setActionError(err.message || "Failed to create agent");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickStatusChange = async (
    e: React.MouseEvent,
    instanceId: string,
    action: "suspend" | "resume" | "pause" | "archive",
  ) => {
    e.stopPropagation();
    setActionError(null);
    try {
      if (action === "suspend") await suspendAgent(instanceId);
      else if (action === "resume") await resumeAgent(instanceId);
      else if (action === "pause") await pauseAgent(instanceId);
      else if (action === "archive") await archiveAgent(instanceId);
    } catch (err: any) {
      setActionError(err.message || `Failed to ${action} agent`);
    }
  };

  return (
    <AppShell>
      <div className="space-y-8 p-6 max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              AI Agent Platform
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Manage organization-scoped agent instances, monitor lifecycle states, and configure capabilities.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => navigate("/workspace/agents/discover")}
              className="gap-2"
            >
              Browse Marketplace
            </Button>
            <Button onClick={handleOpenCreateModal} className="gap-2 bg-primary">
              + Deploy Agent
            </Button>
          </div>
        </div>

        {actionError && (
          <div className="bg-destructive/15 text-destructive border border-destructive/30 px-4 py-3 rounded-xl text-sm flex items-center justify-between">
            <span>{actionError}</span>
            <button
              onClick={() => setActionError(null)}
              className="text-xs hover:underline ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {statusFilterTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setSelectedStatus(tab.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all whitespace-nowrap ${
                  selectedStatus === tab.value
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="w-full md:w-72">
            <Input
              type="search"
              placeholder="Search by agent name, capability..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
        </div>

        {/* Agent Cards Grid */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-64 rounded-xl border border-border/60 bg-muted/20 animate-pulse"
                />
              ))}
            </div>
          ) : filteredInstances.length === 0 ? (
            <AgentEmptyState
              title={
                search || selectedStatus !== "all"
                  ? "No matching agents"
                  : "No agents deployed yet"
              }
              description={
                search || selectedStatus !== "all"
                  ? "Try adjusting your search criteria or status filter."
                  : "Deploy an agent from the marketplace or create a custom tenant agent to get started."
              }
              actionText={
                search || selectedStatus !== "all"
                  ? "Clear Filters"
                  : "Deploy Your First Agent"
              }
              onAction={() => {
                if (search || selectedStatus !== "all") {
                  setSearch("");
                  setSelectedStatus("all");
                } else {
                  handleOpenCreateModal();
                }
              }}
            />
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredInstances.map((instance) => {
                const template = templates.find((t) => t.id === instance.agentTemplateId);
                const isSuspended = instance.status === "suspended";
                const isPaused = instance.status === "paused";
                const isArchived = instance.status === "archived";
                const isActive = instance.status === "active" || instance.status === "configured";

                return (
                  <AgentCard
                    key={instance.id}
                    name={instance.name}
                    description={template?.description || instance.description || "Tenant AI Agent Instance"}
                    status={instance.status}
                    icon={template?.icon || "🤖"}
                    category={template?.category}
                    industry={template?.industry}
                    approvalPolicy={instance.humanApprovalPolicy}
                    capabilities={template?.capabilities}
                    onClick={() => navigate(`/workspace/agents/${instance.id}`)}
                    action={
                      <div className="w-full flex items-center justify-between gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/workspace/agents/${instance.id}`);
                          }}
                        >
                          Details & Config
                        </Button>

                        {isActive && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs text-amber-400 hover:text-amber-300 hover:border-amber-500/50"
                              title="Suspend agent operations"
                              onClick={(e) =>
                                handleQuickStatusChange(e, instance.id, "suspend")
                              }
                            >
                              Suspend
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs text-yellow-400 hover:text-yellow-300"
                              title="Pause agent"
                              onClick={(e) =>
                                handleQuickStatusChange(e, instance.id, "pause")
                              }
                            >
                              Pause
                            </Button>
                          </>
                        )}

                        {(isSuspended || isPaused) && (
                          <Button
                            variant="default"
                            size="sm"
                            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={(e) =>
                              handleQuickStatusChange(e, instance.id, "resume")
                            }
                          >
                            Resume
                          </Button>
                        )}

                        {!isArchived && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-muted-foreground hover:text-destructive"
                            title="Archive agent"
                            onClick={(e) =>
                              handleQuickStatusChange(e, instance.id, "archive")
                            }
                          >
                            Archive
                          </Button>
                        )}

                        {isArchived && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={(e) =>
                              handleQuickStatusChange(e, instance.id, "resume")
                            }
                          >
                            Reactivate
                          </Button>
                        )}
                      </div>
                    }
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Create Agent Modal */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-5 animate-in fade-in-0 zoom-in-95">
              <div className="flex items-center justify-between border-b pb-3 border-border">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Deploy AI Agent</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Instantiate an AI agent for your organization workspace.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-muted-foreground hover:text-foreground text-sm font-mono"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateAgent} className="space-y-4">
                {/* Template Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Select Agent Template <span className="text-destructive">*</span>
                  </label>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  >
                    {templates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id} className="bg-background">
                        {tpl.icon} {tpl.name} ({tpl.category})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Instance Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Agent Instance Name
                  </label>
                  <Input
                    placeholder="e.g., Primary Worksheet Generator"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="h-9 text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Leave blank to use the template's default instance name.
                  </p>
                </div>

                {/* Human Approval Policy */}
                <div className="bg-muted/30 border border-border rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-foreground block">
                        Human Approval Policy
                      </span>
                      <span className="text-[11px] text-muted-foreground block">
                        Require organization admin approval before executing high-risk actions.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={requireApproval}
                      onChange={(e) => setRequireApproval(e.target.checked)}
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                  </div>
                  {requireApproval && (
                    <div className="pt-2 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-md p-2">
                      🛡️ Actions requiring approval will be routed to users with <strong>owner</strong> or <strong>admin</strong> roles.
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCreateModalOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSubmitting || !selectedTemplateId}
                    className="bg-primary"
                  >
                    {isSubmitting ? "Deploying..." : "Deploy Agent"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};
