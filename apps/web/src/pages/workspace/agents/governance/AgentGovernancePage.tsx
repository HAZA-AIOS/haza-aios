import * as React from "react";
import { useOrganization } from "../../../../org/use-organization";
import {
  GovernanceOverviewMetricCard,
  GovernanceRiskBadge,
  SecurityClassificationBadge,
  PolicyLifecycleBadge,
  ComplianceStatusBadge,
  PolicyInventoryCard,
  AgentGovernanceProfileCard,
  GovernanceAuditLogTable,
  Button,
  Card,
  Input,
} from "@haza-aios/ui";
import {
  agentGovernanceService,
  type WebAgentGovernanceProfile,
  type WebAgentOwnershipAssignment,
  type WebAgentGovernancePolicy,
  type WebAgentGovernanceAuditLog,
  type WebGovernanceOverviewStats,
  type PolicyLifecycleState,
  type SecurityClassification,
  type RiskTier,
  type ComplianceStatus,
  type PolicyScopeType,
  type PolicySeverity,
  type PolicyEnforcementAction,
} from "../../../../agents/governance-service";

type ActiveTab = "overview" | "policies" | "profiles" | "ownership" | "audit";

export function AgentGovernancePage() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id || "org-default";

  const [activeTab, setActiveTab] = React.useState<ActiveTab>("overview");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = React.useState<string | null>(null);

  // Data state
  const [overview, setOverview] = React.useState<WebGovernanceOverviewStats | null>(null);
  const [policies, setPolicies] = React.useState<WebAgentGovernancePolicy[]>([]);
  const [profiles, setProfiles] = React.useState<WebAgentGovernanceProfile[]>([]);
  const [ownershipList, setOwnershipList] = React.useState<WebAgentOwnershipAssignment[]>([]);
  const [auditLogs, setAuditLogs] = React.useState<WebAgentGovernanceAuditLog[]>([]);

  // Dialog / Modal states
  const [showCreatePolicy, setShowCreatePolicy] = React.useState(false);
  const [selectedAgentForProfile, setSelectedAgentForProfile] = React.useState<string | null>(null);
  const [selectedAgentForReview, setSelectedAgentForReview] = React.useState<string | null>(null);
  const [selectedAgentForOwnership, setSelectedAgentForOwnership] = React.useState<string | null>(null);

  // Policy form state
  const [newPolicyName, setNewPolicyName] = React.useState("");
  const [newPolicyKey, setNewPolicyKey] = React.useState("");
  const [newPolicyDesc, setNewPolicyDesc] = React.useState("");
  const [newPolicyType, setNewPolicyType] = React.useState("security");
  const [newPolicySeverity, setNewPolicySeverity] = React.useState<PolicySeverity>("high");
  const [newPolicyScope, setNewPolicyScope] = React.useState<PolicyScopeType>("organization");
  const [newPolicyEnforcement, setNewPolicyEnforcement] = React.useState<PolicyEnforcementAction>("warn");

  // Profile form state
  const [profileClassification, setProfileClassification] = React.useState<SecurityClassification>("internal");
  const [profileRiskTier, setProfileRiskTier] = React.useState<RiskTier>("medium");
  const [profileFrameworks, setProfileFrameworks] = React.useState("SOC2, ISO27001");
  const [profileCadenceDays, setProfileCadenceDays] = React.useState(90);
  const [profileMaxAutonomy, setProfileMaxAutonomy] = React.useState(2);

  // Review form state
  const [reviewStatus, setReviewStatus] = React.useState<ComplianceStatus>("compliant");
  const [reviewNotes, setReviewNotes] = React.useState("");

  // Ownership form state
  const [ownerPrimary, setOwnerPrimary] = React.useState("");
  const [ownerTech, setOwnerTech] = React.useState("");
  const [ownerBiz, setOwnerBiz] = React.useState("");
  const [ownerEscalation, setOwnerEscalation] = React.useState("");

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [overviewData, policiesData, profilesData, ownershipData, logsData] =
        await Promise.allSettled([
          agentGovernanceService.getOverview(orgId),
          agentGovernanceService.listPolicies(orgId),
          agentGovernanceService.listProfiles(orgId),
          agentGovernanceService.listOwnership(orgId),
          agentGovernanceService.listAuditLogs(orgId, { limit: 50 }),
        ]);

      if (overviewData.status === "fulfilled") setOverview(overviewData.value);
      if (policiesData.status === "fulfilled") setPolicies(policiesData.value);
      if (profilesData.status === "fulfilled") setProfiles(profilesData.value);
      if (ownershipData.status === "fulfilled") setOwnershipList(ownershipData.value);
      if (logsData.status === "fulfilled") setAuditLogs(logsData.value);
    } catch (err: any) {
      setError(err?.message || "Failed to load governance telemetry");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Lifecycle Transition Handler
  const handleTransitionPolicy = async (policyId: string, targetState: string) => {
    try {
      setError(null);
      await agentGovernanceService.transitionPolicyLifecycle(
        orgId,
        policyId,
        targetState as PolicyLifecycleState,
      );
      setActionSuccess(`Policy transitioned to ${targetState}`);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to transition policy lifecycle");
    }
  };

  // Create Policy Handler
  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await agentGovernanceService.createPolicy(orgId, {
        name: newPolicyName,
        policyKey: newPolicyKey,
        description: newPolicyDesc,
        policyType: newPolicyType,
        severity: newPolicySeverity,
        scopeType: newPolicyScope,
        enforcementAction: newPolicyEnforcement,
        rules: { version: "1.0", createdVia: "Governance Center Console" },
      });
      setShowCreatePolicy(false);
      setNewPolicyName("");
      setNewPolicyKey("");
      setNewPolicyDesc("");
      setActionSuccess("Governance policy created successfully");
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to create policy");
    }
  };

  // Upsert Profile Handler
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentForProfile) return;
    try {
      setError(null);
      await agentGovernanceService.upsertProfile(orgId, selectedAgentForProfile, {
        securityClassification: profileClassification,
        riskTier: profileRiskTier,
        complianceFrameworks: profileFrameworks.split(",").map((s) => s.trim()).filter(Boolean),
        reviewCadenceDays: profileCadenceDays,
        maxAutonomyLevel: profileMaxAutonomy,
      });
      setSelectedAgentForProfile(null);
      setActionSuccess("Agent governance profile saved");
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to save governance profile");
    }
  };

  // Record Review Handler
  const handleRecordReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentForReview) return;
    try {
      setError(null);
      await agentGovernanceService.recordReview(orgId, selectedAgentForReview, {
        complianceStatus: reviewStatus,
        notes: reviewNotes,
      });
      setSelectedAgentForReview(null);
      setReviewNotes("");
      setActionSuccess("Compliance review recorded");
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to record compliance review");
    }
  };

  // Save Ownership Handler
  const handleSaveOwnership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentForOwnership) return;
    try {
      setError(null);
      await agentGovernanceService.assignOwnership(orgId, selectedAgentForOwnership, {
        primaryOwnerId: ownerPrimary,
        technicalOwnerId: ownerTech || null,
        businessOwnerId: ownerBiz || null,
        escalationContact: ownerEscalation,
      });
      setSelectedAgentForOwnership(null);
      setOwnerPrimary("");
      setOwnerTech("");
      setOwnerBiz("");
      setOwnerEscalation("");
      setActionSuccess("Agent ownership updated");
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to assign ownership");
    }
  };

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Agent Governance & Security
            </h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary">
              Phase 22A Foundation
            </span>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Enterprise policy management, agent ownership accountability, risk classification, and audit ledger.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData()}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
          <Button
            size="sm"
            onClick={() => setShowCreatePolicy(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            + New Policy
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-xs font-semibold underline ml-2">
            Dismiss
          </button>
        </div>
      )}
      {actionSuccess && (
        <div className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-sm flex items-center justify-between">
          <span>{actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} className="text-xs font-semibold underline ml-2">
            Dismiss
          </button>
        </div>
      )}

      {/* Top Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GovernanceOverviewMetricCard
          title="Governed Agents"
          value={overview?.totalProfiles ?? profiles.length}
          subtitle="Agents with assigned profiles"
          badge={<span className="text-[10px] font-mono text-muted-foreground">Active</span>}
        />
        <GovernanceOverviewMetricCard
          title="Active Policies"
          value={overview?.activePolicies ?? policies.filter((p) => p.lifecycleState === "active").length}
          subtitle={`Total: ${overview?.totalPolicies ?? policies.length} defined`}
          badge={<PolicyLifecycleBadge state="active" />}
        />
        <GovernanceOverviewMetricCard
          title="Accountability Coverage"
          value={
            overview
              ? `${Math.max(0, (overview.totalProfiles - overview.orphanedAgents))}/${overview.totalProfiles || 1}`
              : `${ownershipList.length} Assigned`
          }
          subtitle={`${overview?.orphanedAgents ?? 0} orphaned agents`}
          badge={
            (overview?.orphanedAgents ?? 0) > 0 ? (
              <span className="text-[11px] font-semibold text-amber-400">Action Required</span>
            ) : (
              <span className="text-[11px] font-semibold text-emerald-400">100% Assigned</span>
            )
          }
        />
        <GovernanceOverviewMetricCard
          title="Compliance Reviews"
          value={overview?.pendingReviews ?? 0}
          subtitle="Reviews due or overdue"
          badge={
            (overview?.pendingReviews ?? 0) > 0 ? (
              <ComplianceStatusBadge status="needs_review" />
            ) : (
              <ComplianceStatusBadge status="compliant" />
            )
          }
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-border/50 gap-2">
        <button
          onClick={() => setActiveTab("overview")}
          className={`pb-3 px-3 text-sm font-medium border-b-2 transition-all ${
            activeTab === "overview"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Overview & Risk
        </button>
        <button
          onClick={() => setActiveTab("policies")}
          className={`pb-3 px-3 text-sm font-medium border-b-2 transition-all ${
            activeTab === "policies"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Policy Registry ({policies.length})
        </button>
        <button
          onClick={() => setActiveTab("profiles")}
          className={`pb-3 px-3 text-sm font-medium border-b-2 transition-all ${
            activeTab === "profiles"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Agent Profiles ({profiles.length})
        </button>
        <button
          onClick={() => setActiveTab("ownership")}
          className={`pb-3 px-3 text-sm font-medium border-b-2 transition-all ${
            activeTab === "ownership"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Ownership & Accountability ({ownershipList.length})
        </button>
        <button
          onClick={() => setActiveTab("audit")}
          className={`pb-3 px-3 text-sm font-medium border-b-2 transition-all ${
            activeTab === "audit"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Audit Ledger ({auditLogs.length})
        </button>
      </div>

      {/* Tab 1: Overview & Risk Posture */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Risk Tier Posture */}
            <Card className="p-6 bg-card/60 border-border/80">
              <h3 className="text-base font-semibold text-foreground mb-1">
                Risk Tier Distribution
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Classification of autonomous agents by operational risk.
              </p>

              <div className="space-y-3">
                {[
                  { tier: "critical", label: "Critical Risk", color: "bg-rose-500", count: overview?.riskTierDistribution?.critical ?? 0 },
                  { tier: "high", label: "High Risk", color: "bg-amber-500", count: overview?.riskTierDistribution?.high ?? 0 },
                  { tier: "medium", label: "Medium Risk", color: "bg-blue-500", count: overview?.riskTierDistribution?.medium ?? 0 },
                  { tier: "low", label: "Low Risk", color: "bg-emerald-500", count: overview?.riskTierDistribution?.low ?? 0 },
                ].map((item) => (
                  <div key={item.tier} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`size-2.5 rounded-full ${item.color}`} />
                      <span className="text-muted-foreground">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-foreground">{item.count}</span>
                      <GovernanceRiskBadge riskTier={item.tier} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Compliance Distribution */}
            <Card className="p-6 bg-card/60 border-border/80">
              <h3 className="text-base font-semibold text-foreground mb-1">
                Compliance Status Breakdown
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Regulatory compliance adherence across frameworks (SOC2, HIPAA, GDPR).
              </p>

              <div className="space-y-3">
                {[
                  { status: "compliant", label: "Compliant", count: overview?.complianceDistribution?.compliant ?? 0 },
                  { status: "pending_review", label: "Pending Review", count: overview?.complianceDistribution?.pending_review ?? 0 },
                  { status: "non_compliant", label: "Non-Compliant", count: overview?.complianceDistribution?.non_compliant ?? 0 },
                  { status: "exempt", label: "Exempt", count: overview?.complianceDistribution?.exempt ?? 0 },
                ].map((item) => (
                  <div key={item.status} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-foreground">{item.count}</span>
                      <ComplianceStatusBadge status={item.status} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Quick Guidance Card */}
          <Card className="p-5 bg-card/40 border-border/60">
            <h4 className="text-sm font-semibold text-foreground mb-1">Governance Architecture Note</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Phase 22A establishes the governance data model, registry, accountability assignments, and audit trails.
              In accordance with architectural principles, live policy blocking is deferred to Phase 22B to guarantee
              zero disruption to existing agent runtime executions.
            </p>
          </Card>
        </div>
      )}

      {/* Tab 2: Policy Registry */}
      {activeTab === "policies" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Showing {policies.length} governance policies defined across the organization.
            </span>
          </div>

          {policies.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-xl">
              <p className="text-muted-foreground text-sm">No governance policies defined yet.</p>
              <Button
                size="sm"
                className="mt-3"
                onClick={() => setShowCreatePolicy(true)}
              >
                Create First Policy
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {policies.map((p) => (
                <PolicyInventoryCard
                  key={p.id}
                  id={p.id}
                  name={p.name}
                  policyKey={p.policyKey}
                  policyType={p.policyType}
                  scopeType={p.scopeType}
                  severity={p.severity}
                  enforcementAction={p.enforcementAction}
                  lifecycleState={p.lifecycleState}
                  currentVersion={p.currentVersion}
                  description={p.description}
                  rulesCount={Object.keys(p.rules || {}).length}
                  onTransitionState={(newState) => handleTransitionPolicy(p.id, newState)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Agent Profiles */}
      {activeTab === "profiles" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Showing {profiles.length} agent governance profiles.
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const id = prompt("Enter Agent ID to configure governance profile:");
                if (id) setSelectedAgentForProfile(id);
              }}
            >
              + Configure Agent Profile
            </Button>
          </div>

          {profiles.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-xl">
              <p className="text-muted-foreground text-sm">No agent governance profiles created yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {profiles.map((p) => {
                const owner = ownershipList.find((o) => o.agentId === p.agentId);
                return (
                  <AgentGovernanceProfileCard
                    key={p.id}
                    agentId={p.agentId}
                    agentName={`Agent (${p.agentId.slice(0, 8)})`}
                    securityClassification={p.securityClassification}
                    riskTier={p.riskTier}
                    complianceFrameworks={p.complianceFrameworks || []}
                    maxAutonomyLevel={`Level ${p.maxAutonomyLevel}`}
                    approvalPolicy={p.requireApprovalForTools ? "Tools Require Approval" : "Autonomous Tools"}
                    complianceStatus={p.complianceStatus}
                    nextReviewDueAt={p.nextReviewDueAt}
                    primaryOwnerName={owner?.primaryOwnerId || null}
                    onEditProfile={() => setSelectedAgentForProfile(p.agentId)}
                    onAssignOwnership={() => setSelectedAgentForOwnership(p.agentId)}
                    onRecordReview={() => setSelectedAgentForReview(p.agentId)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Ownership & Accountability */}
      {activeTab === "ownership" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Showing {ownershipList.length} agent ownership assignments.
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const id = prompt("Enter Agent ID to assign ownership:");
                if (id) setSelectedAgentForOwnership(id);
              }}
            >
              + Assign Agent Ownership
            </Button>
          </div>

          {ownershipList.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-xl">
              <p className="text-muted-foreground text-sm">No ownership assignments recorded yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-border/60 rounded-xl bg-card/40">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30 text-muted-foreground font-mono uppercase text-[10px]">
                    <th className="py-2.5 px-4">Agent ID</th>
                    <th className="py-2.5 px-4">Primary Owner</th>
                    <th className="py-2.5 px-4">Technical Owner</th>
                    <th className="py-2.5 px-4">Business Owner</th>
                    <th className="py-2.5 px-4">Escalation Contact</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {ownershipList.map((o) => (
                    <tr key={o.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-4 font-mono font-medium text-foreground">
                        {o.agentId}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-muted-foreground">
                        {o.primaryOwnerId}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-muted-foreground">
                        {o.technicalOwnerId || "—"}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-muted-foreground">
                        {o.businessOwnerId || "—"}
                      </td>
                      <td className="py-2.5 px-4 text-muted-foreground">
                        {o.escalationContact}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="font-semibold text-emerald-400 capitalize">
                          {o.accountabilityStatus}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs px-2"
                          onClick={() => {
                            setSelectedAgentForOwnership(o.agentId);
                            setOwnerPrimary(o.primaryOwnerId);
                            setOwnerTech(o.technicalOwnerId || "");
                            setOwnerBiz(o.businessOwnerId || "");
                            setOwnerEscalation(o.escalationContact);
                          }}
                        >
                          Reassign
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Audit Log Ledger */}
      {activeTab === "audit" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Showing recent immutable governance audit log events.
            </span>
          </div>

          <GovernanceAuditLogTable
            logs={auditLogs.map((l) => ({
              id: l.id,
              action: l.action,
              targetType: l.targetType,
              targetId: l.targetId,
              actorId: l.actorId,
              createdAt: l.createdAt,
              metadata: l.metadata,
            }))}
          />
        </div>
      )}

      {/* Modal: Create Policy */}
      {showCreatePolicy && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-lg w-full p-6 bg-card border-border/80 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="font-semibold text-lg text-foreground">Create Governance Policy</h3>
              <button
                onClick={() => setShowCreatePolicy(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePolicy} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-foreground mb-1">Policy Name</label>
                <Input
                  required
                  placeholder="e.g., Sensitive Data Protection Policy"
                  value={newPolicyName}
                  onChange={(e) => setNewPolicyName(e.target.value)}
                />
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">Policy Key (Unique Identifier)</label>
                <Input
                  required
                  placeholder="e.g., sec-pii-protection"
                  value={newPolicyKey}
                  onChange={(e) => setNewPolicyKey(e.target.value)}
                />
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">Description</label>
                <Input
                  placeholder="Summary of requirements and scope"
                  value={newPolicyDesc}
                  onChange={(e) => setNewPolicyDesc(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-foreground mb-1">Policy Type</label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground"
                    value={newPolicyType}
                    onChange={(e) => setNewPolicyType(e.target.value)}
                  >
                    <option value="security">Security</option>
                    <option value="compliance">Compliance</option>
                    <option value="behavioral">Behavioral</option>
                    <option value="data_access">Data Access</option>
                    <option value="model_restriction">Model Restriction</option>
                    <option value="tool_restriction">Tool Restriction</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-foreground mb-1">Severity</label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground"
                    value={newPolicySeverity}
                    onChange={(e) => setNewPolicySeverity(e.target.value as PolicySeverity)}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-foreground mb-1">Scope</label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground"
                    value={newPolicyScope}
                    onChange={(e) => setNewPolicyScope(e.target.value as PolicyScopeType)}
                  >
                    <option value="organization">Organization Wide</option>
                    <option value="workspace">Workspace Scoped</option>
                    <option value="agent">Agent Specific</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-foreground mb-1">Enforcement Action</label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground"
                    value={newPolicyEnforcement}
                    onChange={(e) => setNewPolicyEnforcement(e.target.value as PolicyEnforcementAction)}
                  >
                    <option value="audit">Audit Only (Silent)</option>
                    <option value="warn">Warn (Telemetry)</option>
                    <option value="require_approval">Require Approval</option>
                    <option value="block">Block Execution</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border/40">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreatePolicy(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Create Policy
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal: Configure Profile */}
      {selectedAgentForProfile && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 bg-card border-border/80 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div>
                <h3 className="font-semibold text-lg text-foreground">Governance Profile</h3>
                <span className="font-mono text-xs text-muted-foreground">{selectedAgentForProfile}</span>
              </div>
              <button
                onClick={() => setSelectedAgentForProfile(null)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-foreground mb-1">Security Classification</label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground"
                  value={profileClassification}
                  onChange={(e) => setProfileClassification(e.target.value as SecurityClassification)}
                >
                  <option value="public">Public</option>
                  <option value="internal">Internal</option>
                  <option value="confidential">Confidential</option>
                  <option value="restricted">Restricted</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">Risk Tier</label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground"
                  value={profileRiskTier}
                  onChange={(e) => setProfileRiskTier(e.target.value as RiskTier)}
                >
                  <option value="low">Low Risk</option>
                  <option value="medium">Medium Risk</option>
                  <option value="high">High Risk</option>
                  <option value="critical">Critical Risk</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">Compliance Frameworks (comma separated)</label>
                <Input
                  value={profileFrameworks}
                  onChange={(e) => setProfileFrameworks(e.target.value)}
                  placeholder="e.g. SOC2, HIPAA, GDPR"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-foreground mb-1">Review Cadence (days)</label>
                  <Input
                    type="number"
                    value={profileCadenceDays}
                    onChange={(e) => setProfileCadenceDays(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block font-medium text-foreground mb-1">Max Autonomy Level (1-4)</label>
                  <Input
                    type="number"
                    min={1}
                    max={4}
                    value={profileMaxAutonomy}
                    onChange={(e) => setProfileMaxAutonomy(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border/40">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedAgentForProfile(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Save Profile
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal: Record Review */}
      {selectedAgentForReview && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 bg-card border-border/80 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div>
                <h3 className="font-semibold text-lg text-foreground">Record Compliance Review</h3>
                <span className="font-mono text-xs text-muted-foreground">{selectedAgentForReview}</span>
              </div>
              <button
                onClick={() => setSelectedAgentForReview(null)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordReview} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-foreground mb-1">Review Outcome</label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground"
                  value={reviewStatus}
                  onChange={(e) => setReviewStatus(e.target.value as ComplianceStatus)}
                >
                  <option value="compliant">Compliant (Passed)</option>
                  <option value="pending_review">Pending Additional Review</option>
                  <option value="non_compliant">Non-Compliant (Requires Remediation)</option>
                  <option value="exempt">Exempt</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">Review Notes & Evidence</label>
                <Input
                  required
                  placeholder="e.g. Verified data isolation and prompt safeguards"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border/40">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedAgentForReview(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Record Review
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal: Assign Ownership */}
      {selectedAgentForOwnership && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 bg-card border-border/80 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div>
                <h3 className="font-semibold text-lg text-foreground">Assign Agent Ownership</h3>
                <span className="font-mono text-xs text-muted-foreground">{selectedAgentForOwnership}</span>
              </div>
              <button
                onClick={() => setSelectedAgentForOwnership(null)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveOwnership} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-foreground mb-1">Primary Owner (User ID / Email) *</label>
                <Input
                  required
                  placeholder="e.g. user-primary-owner"
                  value={ownerPrimary}
                  onChange={(e) => setOwnerPrimary(e.target.value)}
                />
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">Technical Owner (Optional)</label>
                <Input
                  placeholder="e.g. lead-engineer"
                  value={ownerTech}
                  onChange={(e) => setOwnerTech(e.target.value)}
                />
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">Business Owner (Optional)</label>
                <Input
                  placeholder="e.g. product-manager"
                  value={ownerBiz}
                  onChange={(e) => setOwnerBiz(e.target.value)}
                />
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">Escalation Contact (Email / PagerDuty / Slack) *</label>
                <Input
                  required
                  placeholder="e.g. ops-escalation@company.com"
                  value={ownerEscalation}
                  onChange={(e) => setOwnerEscalation(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border/40">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedAgentForOwnership(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Save Ownership
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
