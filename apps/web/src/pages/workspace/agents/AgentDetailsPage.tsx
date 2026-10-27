import React, { useEffect, useState } from "react";
import { navigate, usePathname } from "../../../routes/navigation";
import { useOrganization } from "../../../org/use-organization";
import { AgentService } from "../../../agents/agent-service";
import type {
  AgentAuditEvent,
  AgentInstance,
  AgentTemplate,
  AiProviderInfo,
} from "../../../agents/agent.types";
import { Button } from "@haza-aios/ui/components/button";
import {
  AgentBadge,
  AgentStatus,
  AgentCapabilityList,
  AgentAuditTimeline,
  HumanApprovalBadge,
} from "@haza-aios/ui/components/agent-primitives";
import { useAgentInstances } from "../../../agents/use-agents";
import { AppShell } from "../../../components/AppShell";

type ActiveTab = "overview" | "configuration" | "approval" | "audit";

export const AgentDetailsPage: React.FC = () => {
  const pathname = usePathname();
  const id = pathname.replace("/workspace/agents/", "");
  const { currentOrganization } = useOrganization();
  const {
    activateAgent,
    pauseAgent,
    suspendAgent,
    resumeAgent,
    archiveAgent,
    updateConfiguration,
    fetchAuditHistory,
    fetchProviders,
  } = useAgentInstances();

  const [template, setTemplate] = useState<AgentTemplate | null>(null);
  const [instance, setInstance] = useState<AgentInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [auditEvents, setAuditEvents] = useState<AgentAuditEvent[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [providers, setProviders] = useState<AiProviderInfo[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Configuration editing state
  const [instructionsText, setInstructionsText] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("mock");
  const [selectedModel, setSelectedModel] = useState("mock-gpt-4o");
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    if (!currentOrganization || !id) return;

    const load = async () => {
      setLoading(true);
      setActionError(null);
      try {
        const provs = await fetchProviders();
        setProviders(provs);

        // Try resolving as template first
        const tpl = await AgentService.getTemplateForOrg(id, currentOrganization.id);
        if (tpl) {
          setTemplate(tpl);
          const instances = await AgentService.getInstances(currentOrganization.id);
          const activeInst = instances.find((i) => i.agentTemplateId === tpl.id);
          setInstance(activeInst || null);
          if (activeInst) {
            initInstanceForm(activeInst);
          }
        } else {
          // Try resolving as instance
          const inst = await AgentService.getInstance(id, currentOrganization.id);
          if (inst) {
            setInstance(inst);
            initInstanceForm(inst);
            const instTpl = inst.agentTemplateId
              ? await AgentService.getTemplateForOrg(inst.agentTemplateId, currentOrganization.id)
              : undefined;
            setTemplate(instTpl || null);
          }
        }
      } catch (err: any) {
        setActionError(err.message || "Failed to load agent");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, currentOrganization]);

  const initInstanceForm = (inst: AgentInstance) => {
    const config = inst.configuration || {};
    const instructions = (config.instructions as any)?.systemInstructions || inst.instructions || "";
    setInstructionsText(instructions);
    setSelectedProvider((config.model as any)?.provider || inst.modelProvider || "mock");
    setSelectedModel((config.model as any)?.modelSelection || inst.modelSelection || "mock-gpt-4o");
  };

  // Load audit trail when switching to audit tab
  useEffect(() => {
    if (activeTab === "audit" && instance && currentOrganization) {
      setLoadingAudit(true);
      fetchAuditHistory(instance.id, 1, 50)
        .then((res) => {
          setAuditEvents(res.items);
        })
        .catch((err) => {
          console.error("Failed to load audit history:", err);
        })
        .finally(() => {
          setLoadingAudit(false);
        });
    }
  }, [activeTab, instance, currentOrganization]);

  const handleActivate = async () => {
    if (!currentOrganization || !template) return;
    setActionError(null);
    try {
      await activateAgent(template.id);
      const instances = await AgentService.getInstances(currentOrganization.id);
      const activeInst = instances.find((i) => i.agentTemplateId === template.id);
      setInstance(activeInst || null);
      if (activeInst) initInstanceForm(activeInst);
      setActionSuccess("Agent activated successfully.");
    } catch (err: any) {
      setActionError(err.message || "Failed to activate agent.");
    }
  };

  const handleStatusChange = async (target: "suspend" | "resume" | "pause" | "archive") => {
    if (!currentOrganization || !instance) return;
    setActionError(null);
    try {
      let updated: AgentInstance | undefined;
      if (target === "suspend") updated = await suspendAgent(instance.id);
      else if (target === "resume") updated = await resumeAgent(instance.id);
      else if (target === "pause") updated = await pauseAgent(instance.id);
      else updated = await archiveAgent(instance.id);
      if (updated) {
        setInstance(updated);
        setActionSuccess(`Agent state updated to: ${updated.status}`);
      }
    } catch (err: any) {
      setActionError(err.message || `Failed to update status to ${target}.`);
    }
  };

  const handleSaveConfiguration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization || !instance) return;
    setSavingConfig(true);
    setActionError(null);
    try {
      const updatedConfig = {
        ...instance.configuration,
        instructions: {
          ...instance.configuration?.instructions,
          systemInstructions: instructionsText,
        },
        model: {
          ...instance.configuration?.model,
          provider: selectedProvider,
          modelSelection: selectedModel,
        },
      };
      await updateConfiguration(instance.id, updatedConfig);
      const reloaded = await AgentService.getInstance(instance.id, currentOrganization.id);
      if (reloaded) setInstance(reloaded);
      setActionSuccess("Agent configuration updated and audit event logged.");
    } catch (err: any) {
      setActionError(err.message || "Failed to update configuration.");
    } finally {
      setSavingConfig(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="p-8 text-center text-muted-foreground animate-pulse">
          Loading agent details and specifications...
        </div>
      </AppShell>
    );
  }

  if (!template && !instance) {
    return (
      <AppShell>
        <div className="p-8 text-center max-w-md mx-auto my-12 bg-card border rounded-2xl">
          <div className="text-4xl mb-3">⚠️</div>
          <h2 className="text-lg font-bold text-foreground mb-1">Agent Not Found</h2>
          <p className="text-sm text-muted-foreground mb-4">
            The requested agent definition or instance does not exist in your organization.
          </p>
          <Button onClick={() => navigate("/workspace/agents")}>Back to Agent Platform</Button>
        </div>
      </AppShell>
    );
  }

  const effectiveStatus = instance ? instance.status : template?.status || "available";
  const effectiveName = instance ? instance.name : template?.name || "Agent";
  const effectiveDesc = template?.description || instance?.description || "";
  const effectiveIcon = template?.icon || "🤖";
  const approvalPolicy = instance?.humanApprovalPolicy || template?.defaultApprovalPolicy;

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto p-6">
        {/* Navigation & Header */}
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/workspace/agents")}
            className="mb-3 text-muted-foreground hover:text-foreground gap-1.5 -ml-2 text-xs"
          >
            ← Back to Agent Platform
          </Button>

          {actionSuccess && (
            <div className="mb-4 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-4 py-2.5 rounded-xl text-xs flex justify-between items-center">
              <span>✓ {actionSuccess}</span>
              <button
                onClick={() => setActionSuccess(null)}
                className="text-xs hover:underline ml-4"
              >
                ✕
              </button>
            </div>
          )}

          {actionError && (
            <div className="mb-4 bg-destructive/15 border border-destructive/30 text-destructive px-4 py-2.5 rounded-xl text-xs flex justify-between items-center">
              <span>✕ {actionError}</span>
              <button
                onClick={() => setActionError(null)}
                className="text-xs hover:underline ml-4"
              >
                ✕
              </button>
            </div>
          )}

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border/80 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="text-4xl bg-muted/60 border border-border/60 rounded-2xl p-3 h-20 w-20 flex-shrink-0 flex items-center justify-center shadow-inner">
                {effectiveIcon}
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  {effectiveName}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <AgentBadge category={template?.category} industry={template?.industry} />
                  <AgentStatus status={effectiveStatus} />
                  {approvalPolicy?.required && (
                    <HumanApprovalBadge policy={approvalPolicy} />
                  )}
                </div>
              </div>
            </div>

            {/* Lifecycle Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {instance ? (
                <>
                  {(effectiveStatus === "active" || effectiveStatus === "configured") && (
                    <>
                      <Button
                        onClick={() => navigate(`/workspace/agents/${instance.id}/run`)}
                        className="bg-primary text-xs"
                        size="sm"
                      >
                        ⚡ Run Agent
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs text-amber-400 hover:border-amber-500/50"
                        onClick={() => handleStatusChange("suspend")}
                      >
                        Suspend
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs text-yellow-400"
                        onClick={() => handleStatusChange("pause")}
                      >
                        Pause
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground hover:text-destructive"
                        onClick={() => handleStatusChange("archive")}
                      >
                        Archive
                      </Button>
                    </>
                  )}

                  {(effectiveStatus === "suspended" || effectiveStatus === "paused") && (
                    <>
                      <Button
                        variant="default"
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-xs"
                        onClick={() => handleStatusChange("resume")}
                      >
                        ▶ Resume Agent
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground hover:text-destructive"
                        onClick={() => handleStatusChange("archive")}
                      >
                        Archive
                      </Button>
                    </>
                  )}

                  {effectiveStatus === "archived" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => handleStatusChange("resume")}
                    >
                      Re-activate Agent
                    </Button>
                  )}
                </>
              ) : (
                <Button onClick={handleActivate} className="bg-primary text-xs" size="sm">
                  + Deploy This Agent
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border gap-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab("overview")}
            className={`pb-3 border-b-2 transition-all ${
              activeTab === "overview"
                ? "border-primary text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Overview & Capabilities
          </button>
          <button
            onClick={() => setActiveTab("configuration")}
            className={`pb-3 border-b-2 transition-all ${
              activeTab === "configuration"
                ? "border-primary text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Configuration & Model
          </button>
          <button
            onClick={() => setActiveTab("approval")}
            className={`pb-3 border-b-2 transition-all ${
              activeTab === "approval"
                ? "border-primary text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Human Approval Policy
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`pb-3 border-b-2 transition-all ${
              activeTab === "audit"
                ? "border-primary text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Audit & Activity Trail
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-2 space-y-6">
              <section className="bg-card border border-border/80 rounded-2xl p-6 shadow-sm">
                <h2 className="text-base font-semibold text-foreground mb-2">Description</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {effectiveDesc || "No detailed description provided."}
                </p>
              </section>

              <section className="bg-card border border-border/80 rounded-2xl p-6 shadow-sm">
                <h2 className="text-base font-semibold text-foreground mb-1">
                  Declared Capabilities
                </h2>
                <p className="text-xs text-muted-foreground mb-3">
                  Capabilities authorized under the platform default-deny security model.
                </p>
                {template && template.capabilities.length > 0 ? (
                  <AgentCapabilityList capabilities={template.capabilities} />
                ) : (
                  <p className="text-xs text-muted-foreground">Standard capabilities.</p>
                )}
              </section>

              <section className="bg-card border border-border/80 rounded-2xl p-6 shadow-sm">
                <h2 className="text-base font-semibold text-foreground mb-1">
                  Required Permissions
                </h2>
                <p className="text-xs text-muted-foreground mb-3">
                  Organization-level RBAC scopes required to operate this agent.
                </p>
                {template && template.requiredPermissions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {template.requiredPermissions.map((perm) => (
                      <span
                        key={perm}
                        className="text-xs bg-muted/60 text-foreground px-2.5 py-1 rounded-md border border-border font-mono"
                      >
                        {perm}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No extra permissions required.</p>
                )}
              </section>
            </div>

            {/* Sidebar Specifications */}
            <div className="space-y-6">
              <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Platform Specifications
                </h3>
                <ul className="space-y-2.5 text-xs">
                  <li className="flex justify-between border-b border-border/50 pb-2">
                    <span className="text-muted-foreground">Version</span>
                    <span className="font-mono font-medium text-foreground">
                      {template?.version || "1.0.0"}
                    </span>
                  </li>
                  <li className="flex justify-between border-b border-border/50 pb-2">
                    <span className="text-muted-foreground">Tenant Isolation</span>
                    <span className="font-medium text-emerald-400">Strict Organization Scoped</span>
                  </li>
                  <li className="flex justify-between border-b border-border/50 pb-2">
                    <span className="text-muted-foreground">Provider Neutrality</span>
                    <span className="font-medium text-foreground">AI Abstraction Layer</span>
                  </li>
                  <li className="flex justify-between pb-1">
                    <span className="text-muted-foreground">Audit Compliance</span>
                    <span className="font-medium text-foreground">Full Event Logging</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeTab === "configuration" && (
          <div className="max-w-3xl">
            {instance ? (
              <form
                onSubmit={handleSaveConfiguration}
                className="bg-card border border-border/80 rounded-2xl p-6 shadow-sm space-y-5"
              >
                <div>
                  <h2 className="text-base font-bold text-foreground">Agent Configuration</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Configure instructions and select model providers. Sensitive credentials are
                    never stored in agent configurations.
                  </p>
                </div>

                {/* AI Provider & Model Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">AI Provider</label>
                    <select
                      value={selectedProvider}
                      onChange={(e) => setSelectedProvider(e.target.value)}
                      className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {providers.map((p) => (
                        <option key={p.id} value={p.id} className="bg-background">
                          {p.name} {p.isDefault ? "(Default)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Model Selection</label>
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="mock-gpt-4o" className="bg-background">Mock GPT-4o (128k context)</option>
                      <option value="mock-claude-3-5-sonnet" className="bg-background">Mock Claude 3.5 Sonnet (200k context)</option>
                      <option value="mock-gemini-1-5-pro" className="bg-background">Mock Gemini 1.5 Pro (1M context)</option>
                    </select>
                  </div>
                </div>

                {/* System Instructions */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    System Instructions & Behavior Guidance
                  </label>
                  <textarea
                    rows={6}
                    value={instructionsText}
                    onChange={(e) => setInstructionsText(e.target.value)}
                    placeholder="Provide specific instructions, persona guidance, and objectives for this agent instance..."
                    className="w-full bg-muted/30 border border-border rounded-xl p-3 text-xs text-foreground font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Instructions guide how the agent approaches tasks and formats output.
                  </p>
                </div>

                <div className="pt-2 border-t border-border flex justify-end">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={savingConfig}
                    className="bg-primary text-xs"
                  >
                    {savingConfig ? "Saving Configuration..." : "Save Configuration"}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="bg-card border border-dashed rounded-2xl p-8 text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Deploy this agent into your workspace first to configure custom parameters.
                </p>
                <Button onClick={handleActivate} size="sm">
                  Deploy Agent
                </Button>
              </div>
            )}
          </div>
        )}

        {activeTab === "approval" && (
          <div className="max-w-2xl bg-card border border-border/80 rounded-2xl p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-base font-bold text-foreground">Human Approval Policy</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Declarative safety contracts governing autonomous execution and sensitive operations.
              </p>
            </div>

            <div className="bg-muted/30 border border-border/60 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Policy Status</span>
                {approvalPolicy?.required ? (
                  <span className="text-xs font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
                    Enforced
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    Optional / Automated
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-border/40 pt-2 text-xs">
                <span className="text-muted-foreground">Authorized Approver Roles</span>
                <span className="font-mono text-foreground font-medium">
                  [{approvalPolicy?.approverRoles ? approvalPolicy.approverRoles.join(", ") : "owner, admin"}]
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-border/40 pt-2 text-xs">
                <span className="text-muted-foreground">Escalation Timeout</span>
                <span className="text-foreground">
                  {approvalPolicy?.escalationTimeoutHours
                    ? `${approvalPolicy.escalationTimeoutHours} hours`
                    : "Immediate fallback"}
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-border/40 pt-2 text-xs">
                <span className="text-muted-foreground">Fallback Action</span>
                <span className="font-mono text-foreground uppercase text-[11px]">
                  {approvalPolicy?.fallbackAction || "deny"}
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "audit" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-foreground">Agent Audit History</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Complete immutable ledger of configuration updates, lifecycle transitions, and operational records.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (instance && currentOrganization) {
                    setLoadingAudit(true);
                    fetchAuditHistory(instance.id, 1, 50)
                      .then((res) => setAuditEvents(res.items))
                      .finally(() => setLoadingAudit(false));
                  }
                }}
                className="text-xs"
              >
                ↻ Refresh Trail
              </Button>
            </div>

            <AgentAuditTimeline events={auditEvents} isLoading={loadingAudit} />
          </div>
        )}
      </div>
    </AppShell>
  );
};
