import * as React from "react";
import { Badge } from "./badge";
import { Card } from "./card";
import { Button } from "./button";

// ---------------------------------------------------------------------------
// BADGES
// ---------------------------------------------------------------------------

export interface GovernanceRiskBadgeProps {
  riskTier: "low" | "medium" | "high" | "critical" | string;
  size?: "sm" | "md";
}

export function GovernanceRiskBadge({ riskTier, size = "md" }: GovernanceRiskBadgeProps) {
  const tier = riskTier.toLowerCase();
  let badgeClass = "bg-muted text-muted-foreground border-border";
  let label = "Unknown Risk";

  switch (tier) {
    case "low":
      badgeClass = "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
      label = "Low Risk";
      break;
    case "medium":
      badgeClass = "bg-blue-500/15 text-blue-400 border-blue-500/30";
      label = "Medium Risk";
      break;
    case "high":
      badgeClass = "bg-amber-500/15 text-amber-400 border-amber-500/30";
      label = "High Risk";
      break;
    case "critical":
      badgeClass = "bg-rose-500/15 text-rose-400 border-rose-500/30";
      label = "Critical Risk";
      break;
  }

  const textSize = size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2.5 py-1";

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${badgeClass} ${textSize}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

export interface SecurityClassificationBadgeProps {
  classification: "public" | "internal" | "confidential" | "restricted" | string;
}

export function SecurityClassificationBadge({
  classification,
}: SecurityClassificationBadgeProps) {
  const c = classification.toLowerCase();
  let badgeClass = "bg-muted text-muted-foreground border-border";

  switch (c) {
    case "public":
      badgeClass = "bg-slate-500/15 text-slate-300 border-slate-500/30";
      break;
    case "internal":
      badgeClass = "bg-sky-500/15 text-sky-300 border-sky-500/30";
      break;
    case "confidential":
      badgeClass = "bg-purple-500/15 text-purple-300 border-purple-500/30";
      break;
    case "restricted":
      badgeClass = "bg-red-500/15 text-red-300 border-red-500/30";
      break;
  }

  return (
    <span
      className={`inline-flex items-center font-mono uppercase tracking-wider text-[10px] px-2 py-0.5 rounded border ${badgeClass}`}
    >
      {classification}
    </span>
  );
}

export interface PolicyLifecycleBadgeProps {
  state: "draft" | "review" | "active" | "deprecated" | "archived" | string;
}

export function PolicyLifecycleBadge({ state }: PolicyLifecycleBadgeProps) {
  const s = state.toLowerCase();
  let badgeClass = "bg-muted text-muted-foreground border-border";

  switch (s) {
    case "draft":
      badgeClass = "bg-zinc-500/15 text-zinc-300 border-zinc-500/30";
      break;
    case "review":
      badgeClass = "bg-amber-500/15 text-amber-300 border-amber-500/30";
      break;
    case "active":
      badgeClass = "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
      break;
    case "deprecated":
      badgeClass = "bg-orange-500/15 text-orange-300 border-orange-500/30";
      break;
    case "archived":
      badgeClass = "bg-neutral-800 text-neutral-400 border-neutral-700";
      break;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${badgeClass}`}
    >
      <span className="size-1 rounded-full bg-current" />
      {state.charAt(0).toUpperCase() + state.slice(1)}
    </span>
  );
}

export interface ComplianceStatusBadgeProps {
  status: "compliant" | "needs_review" | "non_compliant" | "exempt" | string;
}

export function ComplianceStatusBadge({ status }: ComplianceStatusBadgeProps) {
  const s = status.toLowerCase();
  let badgeClass = "bg-muted text-muted-foreground border-border";
  let label = status;

  switch (s) {
    case "compliant":
      badgeClass = "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
      label = "Compliant";
      break;
    case "needs_review":
      badgeClass = "bg-amber-500/15 text-amber-400 border-amber-500/30";
      label = "Needs Review";
      break;
    case "non_compliant":
      badgeClass = "bg-rose-500/15 text-rose-400 border-rose-500/30";
      label = "Non-Compliant";
      break;
    case "exempt":
      badgeClass = "bg-blue-500/15 text-blue-400 border-blue-500/30";
      label = "Exempt";
      break;
  }

  return (
    <span
      className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-md border ${badgeClass}`}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// METRIC CARDS
// ---------------------------------------------------------------------------

export interface GovernanceOverviewMetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
}

export function GovernanceOverviewMetricCard({
  title,
  value,
  subtitle,
  badge,
  icon,
}: GovernanceOverviewMetricCardProps) {
  return (
    <Card className="p-4 bg-card/60 backdrop-blur-sm border-border/80 flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </span>
        {icon && <span className="text-muted-foreground/70">{icon}</span>}
      </div>
      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-2xl font-bold tracking-tight text-foreground">{value}</span>
        {badge}
      </div>
      {subtitle && (
        <span className="mt-1 text-xs text-muted-foreground/80">{subtitle}</span>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// POLICY INVENTORY CARD
// ---------------------------------------------------------------------------

export interface PolicyInventoryCardProps {
  id: string;
  name: string;
  policyKey: string;
  policyType: string;
  scopeType: string;
  severity: string;
  enforcementAction: string;
  lifecycleState: string;
  currentVersion: number;
  description?: string | null;
  rulesCount?: number;
  onView?: () => void;
  onEdit?: () => void;
  onTransitionState?: (newState: string) => void;
}

export function PolicyInventoryCard({
  name,
  policyKey,
  policyType,
  scopeType,
  severity,
  enforcementAction,
  lifecycleState,
  currentVersion,
  description,
  rulesCount = 0,
  onView,
  onEdit,
  onTransitionState,
}: PolicyInventoryCardProps) {
  return (
    <Card className="p-5 bg-card/70 border-border/70 hover:border-primary/40 transition-all flex flex-col justify-between gap-4">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-base text-foreground">{name}</h4>
              <PolicyLifecycleBadge state={lifecycleState} />
            </div>
            <span className="font-mono text-xs text-muted-foreground/70 block mt-0.5">
              {policyKey} · v{currentVersion}
            </span>
          </div>
          <GovernanceRiskBadge riskTier={severity} size="sm" />
        </div>

        {description && (
          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{description}</p>
        )}

        <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-border/40 text-xs">
          <div>
            <span className="text-muted-foreground block text-[10px] uppercase">Type</span>
            <span className="font-medium text-foreground capitalize">{policyType.replace(/_/g, " ")}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[10px] uppercase">Scope</span>
            <span className="font-medium text-foreground capitalize">{scopeType}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[10px] uppercase">Enforcement</span>
            <span className="font-medium text-foreground capitalize">{enforcementAction}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[10px] uppercase">Defined Rules</span>
            <span className="font-medium text-foreground">{rulesCount} rule items</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border/30">
        <div className="flex items-center gap-2">
          {lifecycleState === "draft" && onTransitionState && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onTransitionState("review")}
              className="text-xs h-7 px-2"
            >
              Submit for Review
            </Button>
          )}
          {lifecycleState === "review" && onTransitionState && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onTransitionState("active")}
              className="text-xs h-7 px-2 bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
            >
              Approve & Activate
            </Button>
          )}
          {lifecycleState === "active" && onTransitionState && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onTransitionState("deprecated")}
              className="text-xs h-7 px-2 text-amber-400 border-amber-500/30"
            >
              Deprecate
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onEdit && (
            <Button variant="ghost" size="sm" onClick={onEdit} className="text-xs h-7">
              Edit
            </Button>
          )}
          {onView && (
            <Button variant="outline" size="sm" onClick={onView} className="text-xs h-7">
              Details
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// AGENT GOVERNANCE PROFILE CARD
// ---------------------------------------------------------------------------

export interface AgentGovernanceProfileCardProps {
  agentName: string;
  agentId: string;
  securityClassification: string;
  riskTier: string;
  complianceFrameworks: string[];
  maxAutonomyLevel: string;
  approvalPolicy: string;
  complianceStatus: string;
  nextReviewDueAt?: Date | string | null;
  primaryOwnerName?: string | null;
  onEditProfile?: () => void;
  onAssignOwnership?: () => void;
  onRecordReview?: () => void;
}

export function AgentGovernanceProfileCard({
  agentName,
  agentId,
  securityClassification,
  riskTier,
  complianceFrameworks,
  maxAutonomyLevel,
  approvalPolicy,
  complianceStatus,
  nextReviewDueAt,
  primaryOwnerName,
  onEditProfile,
  onAssignOwnership,
  onRecordReview,
}: AgentGovernanceProfileCardProps) {
  const isOverdue =
    nextReviewDueAt && new Date(nextReviewDueAt).getTime() < Date.now();

  return (
    <Card className="p-5 bg-card/70 border-border/70 hover:border-primary/40 transition-all flex flex-col justify-between gap-4">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-base text-foreground">{agentName}</h4>
              <ComplianceStatusBadge status={complianceStatus} />
            </div>
            <span className="font-mono text-xs text-muted-foreground/70 block mt-0.5">
              {agentId}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <SecurityClassificationBadge classification={securityClassification} />
            <GovernanceRiskBadge riskTier={riskTier} size="sm" />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-3 border-t border-border/40 text-xs">
          <div>
            <span className="text-muted-foreground block text-[10px] uppercase">Max Autonomy</span>
            <span className="font-semibold text-foreground">{maxAutonomyLevel}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[10px] uppercase">Approval Policy</span>
            <span className="font-medium text-foreground capitalize">{approvalPolicy}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[10px] uppercase">Accountable Owner</span>
            <span className="font-medium text-foreground truncate block">
              {primaryOwnerName || (
                <span className="text-amber-400 italic">Unassigned</span>
              )}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[10px] uppercase">Next Review</span>
            <span
              className={`font-medium ${
                isOverdue ? "text-rose-400 font-semibold" : "text-foreground"
              }`}
            >
              {nextReviewDueAt
                ? new Date(nextReviewDueAt).toLocaleDateString()
                : "Not scheduled"}
            </span>
          </div>
        </div>

        {complianceFrameworks.length > 0 && (
          <div className="mt-3 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-muted-foreground uppercase font-mono mr-1">
              Frameworks:
            </span>
            {complianceFrameworks.map((fw) => (
              <span
                key={fw}
                className="bg-muted/60 text-muted-foreground font-mono text-[10px] px-2 py-0.5 rounded border border-border/50"
              >
                {fw}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border/30">
        <div className="flex items-center gap-2">
          {onRecordReview && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRecordReview}
              className="text-xs h-7 px-2.5 bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
            >
              Record Review
            </Button>
          )}
          {onAssignOwnership && (
            <Button
              variant="outline"
              size="sm"
              onClick={onAssignOwnership}
              className="text-xs h-7 px-2"
            >
              Assign Owner
            </Button>
          )}
        </div>

        {onEditProfile && (
          <Button variant="ghost" size="sm" onClick={onEditProfile} className="text-xs h-7">
            Configure Profile
          </Button>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// AUDIT LOG TABLE
// ---------------------------------------------------------------------------

export interface GovernanceAuditLogItem {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  actorId: string;
  createdAt: Date | string;
  metadata?: Record<string, unknown>;
}

export function GovernanceAuditLogTable({ logs }: { logs: GovernanceAuditLogItem[] }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
        No governance audit events recorded yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-border/60 rounded-xl bg-card/40">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="border-b border-border/60 bg-muted/30 text-muted-foreground font-mono uppercase text-[10px]">
            <th className="py-2.5 px-4">Timestamp</th>
            <th className="py-2.5 px-4">Action</th>
            <th className="py-2.5 px-4">Target Type</th>
            <th className="py-2.5 px-4">Target ID</th>
            <th className="py-2.5 px-4">Actor</th>
            <th className="py-2.5 px-4">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/30">
          {logs.map((log) => (
            <tr key={log.id} className="hover:bg-muted/20 transition-colors">
              <td className="py-2.5 px-4 font-mono text-muted-foreground whitespace-nowrap">
                {new Date(log.createdAt).toLocaleString()}
              </td>
              <td className="py-2.5 px-4 font-semibold text-foreground capitalize">
                {log.action.replace(/_/g, " ")}
              </td>
              <td className="py-2.5 px-4 capitalize text-muted-foreground">
                {log.targetType.replace(/_/g, " ")}
              </td>
              <td className="py-2.5 px-4 font-mono text-muted-foreground/80 max-w-[140px] truncate">
                {log.targetId}
              </td>
              <td className="py-2.5 px-4 font-mono text-muted-foreground/80 max-w-[120px] truncate">
                {log.actorId}
              </td>
              <td className="py-2.5 px-4 text-muted-foreground font-mono text-[11px] max-w-[200px] truncate">
                {JSON.stringify(log.metadata || {})}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
