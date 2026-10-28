import * as React from "react";
import { cn } from "@haza-aios/ui/lib/utils";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./card";
import { Badge } from "./badge";
import { Button } from "./button";

// AgentBadge
export const AgentBadge: React.FC<{ category?: string; industry?: string }> = ({
  category,
  industry,
}) => {
  return (
    <div className="flex flex-wrap gap-1.5">
      {category && (
        <Badge variant="secondary" className="text-[10px] tracking-wider">
          {category}
        </Badge>
      )}
      {industry && (
        <Badge variant="default" className="text-[10px] tracking-wider text-muted-foreground">
          {industry}
        </Badge>
      )}
    </div>
  );
};

// AgentStatus with rich enterprise dark indicators
export const AgentStatus: React.FC<{ status: string; className?: string }> = ({
  status,
  className,
}) => {
  const normalized = status.toLowerCase();

  switch (normalized) {
    case "active":
      return (
        <Badge variant="success" className={cn("gap-1.5 font-semibold", className)}>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Active
        </Badge>
      );
    case "configured":
      return (
        <Badge variant="primary" className={cn("gap-1.5 font-semibold", className)}>
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
          Configured
        </Badge>
      );
    case "suspended":
      return (
        <Badge variant="warning" className={cn("gap-1.5 font-semibold border-amber-500/40 bg-amber-500/10 text-amber-400", className)}>
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
          Suspended
        </Badge>
      );
    case "paused":
      return (
        <Badge variant="warning" className={cn("gap-1.5 font-semibold", className)}>
          <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
          Paused
        </Badge>
      );
    case "draft":
      return (
        <Badge variant="default" className={cn("gap-1.5 font-medium text-muted-foreground", className)}>
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
          Draft
        </Badge>
      );
    case "disabled":
      return (
        <Badge variant="secondary" className={cn("gap-1.5 font-medium text-muted-foreground", className)}>
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
          Disabled
        </Badge>
      );
    case "archived":
      return (
        <Badge variant="destructive" className={cn("gap-1.5 font-medium", className)}>
          <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
          Archived
        </Badge>
      );
    default:
      return (
        <Badge variant="default" className={cn(className)}>
          {status}
        </Badge>
      );
  }
};

// HumanApprovalBadge
export const HumanApprovalBadge: React.FC<{
  policy?: {
    required: boolean;
    approverRoles: string[];
    escalationTimeoutHours?: number;
    fallbackAction?: string;
    sensitiveCapabilities?: string[];
  } | null;
  className?: string;
}> = ({ policy, className }) => {
  if (!policy || !policy.required) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)}>
        <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
        Automated (No Approval Req.)
      </span>
    );
  }

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      <Badge variant="warning" className="text-[10px] font-semibold border-amber-500/40 bg-amber-500/10 text-amber-300">
        🛡️ Human Approval Required
      </Badge>
      <span className="text-[11px] text-muted-foreground">
        Roles: [{policy.approverRoles.join(", ")}]
      </span>
    </div>
  );
};

// AgentCapabilityList
export const AgentCapabilityList: React.FC<{
  capabilities: Array<{
    key?: string;
    name: string;
    description?: string;
    requiresApproval?: boolean;
    riskLevel?: string;
  }>;
}> = ({ capabilities }) => {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {capabilities.map((cap, i) => (
        <span
          key={i}
          className={cn(
            "text-xs px-2 py-0.5 rounded-md border font-medium transition-colors",
            cap.requiresApproval
              ? "bg-amber-950/20 text-amber-300 border-amber-800/40"
              : "bg-blue-950/20 text-blue-300 border-blue-800/40",
          )}
          title={cap.description}
        >
          {cap.name}
          {cap.requiresApproval && <span className="ml-1 text-[10px]">🛡️</span>}
        </span>
      ))}
    </div>
  );
};

// AgentCard
export interface AgentCardProps {
  name: string;
  description: string;
  icon?: string;
  category?: string;
  industry?: string;
  status?: string;
  approvalPolicy?: {
    required: boolean;
    approverRoles: string[];
  } | null;
  capabilities?: Array<{ name: string; requiresApproval?: boolean }>;
  onClick?: () => void;
  action?: React.ReactNode;
}

export const AgentCard: React.FC<AgentCardProps> = ({
  name,
  description,
  icon = "🤖",
  category,
  industry,
  status,
  approvalPolicy,
  capabilities,
  onClick,
  action,
}) => {
  return (
    <Card
      className={cn(
        "flex flex-col h-full transition-all border border-border/80 bg-card hover:border-primary/50 hover:shadow-lg",
        onClick && "cursor-pointer",
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="text-3xl bg-muted/60 border border-border/50 rounded-xl p-2 h-12 w-12 flex-shrink-0 flex items-center justify-center">
              {icon}
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base font-semibold truncate text-foreground">{name}</CardTitle>
              <div className="mt-1">
                <AgentBadge category={category} industry={industry} />
              </div>
            </div>
          </div>
          {status && <AgentStatus status={status} />}
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        <CardDescription className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {description}
        </CardDescription>

        {approvalPolicy?.required && (
          <div className="pt-1">
            <HumanApprovalBadge policy={approvalPolicy} />
          </div>
        )}

        {capabilities && capabilities.length > 0 && (
          <div className="pt-1">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Capabilities
            </p>
            <AgentCapabilityList capabilities={capabilities} />
          </div>
        )}
      </CardContent>
      {action && (
        <CardFooter className="pt-3 border-t border-border/60 flex items-center justify-between gap-2">
          {action}
        </CardFooter>
      )}
    </Card>
  );
};

// AgentEmptyState
export const AgentEmptyState: React.FC<{
  title?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
}> = ({
  title = "No Agents Found",
  description = "No agent instances match the current filters or your workspace has no active agents.",
  actionText = "Discover Agent Templates",
  onAction,
}) => {
  return (
    <div className="bg-muted/20 border border-dashed border-border rounded-2xl p-12 text-center flex flex-col items-center justify-center max-w-xl mx-auto my-6">
      <div className="h-16 w-16 rounded-2xl bg-muted/50 border border-border/60 flex items-center justify-center text-3xl mb-4">
        🤖
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">{description}</p>
      {onAction && actionText && (
        <Button onClick={onAction} className="gap-2">
          {actionText}
        </Button>
      )}
    </div>
  );
};

// AgentAuditTimeline
export interface AgentAuditEventItem {
  id: string;
  action: string;
  operation: string;
  result: "success" | "failure" | "denied";
  actorUserId?: string | null;
  changedFields?: string[] | null;
  beforeSnapshot?: Record<string, unknown> | null;
  afterSnapshot?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export const AgentAuditTimeline: React.FC<{
  events: AgentAuditEventItem[];
  isLoading?: boolean;
}> = ({ events, isLoading }) => {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground text-sm">
        Loading agent audit trail...
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground text-sm border border-dashed rounded-xl">
        No audit events recorded for this agent yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
        {events.map((event) => {
          const isExpanded = expandedId === event.id;
          const isSuccess = event.result === "success";

          return (
            <div key={event.id} className="relative">
              {/* Dot */}
              <div
                className={cn(
                  "absolute -left-6 top-1 h-3 w-3 rounded-full border-2 border-background",
                  isSuccess ? "bg-emerald-500" : "bg-rose-500",
                )}
              />

              <div className="bg-card border border-border/80 rounded-xl p-4 shadow-sm hover:border-primary/40 transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={isSuccess ? "default" : "destructive"}
                      className="text-[11px] font-mono tracking-wider font-semibold"
                    >
                      {event.action}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      by <span className="font-mono text-foreground">{event.actorUserId ? event.actorUserId.slice(0, 8) : "system"}</span>
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(event.createdAt).toLocaleString()}
                  </span>
                </div>

                {event.changedFields && event.changedFields.length > 0 && (
                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-muted-foreground">Modified:</span>
                    {event.changedFields.map((field) => (
                      <span
                        key={field}
                        className="text-[10px] font-mono bg-muted/60 text-foreground px-1.5 py-0.5 rounded border border-border/50"
                      >
                        {field}
                      </span>
                    ))}
                  </div>
                )}

                {(event.beforeSnapshot || event.afterSnapshot) && (
                  <div className="mt-3 pt-2 border-t border-border/50">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : event.id)}
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      {isExpanded ? "Hide Snapshot Diff ▲" : "View Snapshot Diff ▼"}
                    </button>

                    {isExpanded && (
                      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                        {event.beforeSnapshot && (
                          <div className="bg-muted/40 p-3 rounded-lg border border-border/60 overflow-x-auto">
                            <p className="text-[10px] font-sans font-semibold text-muted-foreground uppercase mb-1">
                              Before Snapshot
                            </p>
                            <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap">
                              {JSON.stringify(event.beforeSnapshot, null, 2)}
                            </pre>
                          </div>
                        )}
                        {event.afterSnapshot && (
                          <div className="bg-muted/40 p-3 rounded-lg border border-border/60 overflow-x-auto">
                            <p className="text-[10px] font-sans font-semibold text-muted-foreground uppercase mb-1">
                              After Snapshot
                            </p>
                            <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap">
                              {JSON.stringify(event.afterSnapshot, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
