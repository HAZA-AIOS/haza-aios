import * as React from "react";
import { Badge } from "./badge";
import { Button } from "./button";
import { Card } from "./card";

export type AutonomyLevel = "L0" | "L1" | "L2" | "L3";

export interface AutonomyBadgeProps {
  level: AutonomyLevel | string;
  showDescription?: boolean;
  className?: string;
}

export function AutonomyBadge({ level, showDescription = false, className = "" }: AutonomyBadgeProps) {
  const normalized = (level || "L0").toUpperCase();
  let badgeColor = "bg-slate-800 text-slate-300 border-slate-700";
  let title = "L0: Read-Only";
  let desc = "Observation and analysis only. No state mutation.";

  switch (normalized) {
    case "L1":
      badgeColor = "bg-sky-950/80 text-sky-400 border-sky-800/80";
      title = "L1: Bounded Advisory";
      desc = "Advises plans and recommendations. State mutation requires manual review.";
      break;
    case "L2":
      badgeColor = "bg-amber-950/80 text-amber-400 border-amber-800/80";
      title = "L2: Supervised Execution";
      desc = "Bounded autonomous execution. Consequential actions require approval.";
      break;
    case "L3":
      badgeColor = "bg-purple-950/80 text-purple-300 border-purple-800/80";
      title = "L3: Continuous Operations";
      desc = "Full scheduled & event-driven autonomy with adaptive recovery.";
      break;
    default:
      badgeColor = "bg-slate-800 text-slate-300 border-slate-700";
      title = "L0: Read-Only";
      desc = "Observation and analysis only. No state mutation.";
  }

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${badgeColor}`}>
        {normalized}
      </span>
      {showDescription && (
        <span className="text-xs text-slate-400 hidden sm:inline" title={desc}>
          {title}
        </span>
      )}
    </div>
  );
}

export interface OperationalStatusBadgeProps {
  status: string;
  className?: string;
}

export function OperationalStatusBadge({ status, className = "" }: OperationalStatusBadgeProps) {
  const norm = (status || "").toLowerCase();
  let color = "bg-slate-800 text-slate-300 border-slate-700";
  let dotColor = "bg-slate-400";
  let label = status.replace(/_/g, " ").toUpperCase();

  switch (norm) {
    case "active":
    case "running":
      color = "bg-emerald-950/70 text-emerald-400 border-emerald-800/70";
      dotColor = "bg-emerald-400 animate-pulse";
      break;
    case "leased":
      color = "bg-indigo-950/70 text-indigo-300 border-indigo-800/70";
      dotColor = "bg-indigo-400 animate-pulse";
      break;
    case "queued":
      color = "bg-amber-950/60 text-amber-300 border-amber-800/60";
      dotColor = "bg-amber-400";
      break;
    case "waiting_approval":
      color = "bg-amber-950/80 text-amber-400 border-amber-800/80";
      dotColor = "bg-amber-400 animate-ping";
      label = "AWAITING APPROVAL";
      break;
    case "paused":
      color = "bg-amber-950/50 text-amber-400 border-amber-800/50";
      dotColor = "bg-amber-500";
      break;
    case "completed":
      color = "bg-emerald-950/80 text-emerald-300 border-emerald-800/80";
      dotColor = "bg-emerald-400";
      break;
    case "failed":
      color = "bg-rose-950/70 text-rose-300 border-rose-800/70";
      dotColor = "bg-rose-500";
      break;
    case "cancelled":
    case "disabled":
    case "archived":
      color = "bg-slate-800 text-slate-400 border-slate-700";
      dotColor = "bg-slate-500";
      break;
    case "emergency_stopped":
      color = "bg-red-950 text-red-300 border-red-700";
      dotColor = "bg-red-500 animate-bounce";
      label = "EMERGENCY STOPPED";
      break;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${color} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      {label}
    </span>
  );
}

export interface HeartbeatIndicatorProps {
  lastHeartbeat?: string | Date | null;
  leaseExpiresAt?: string | Date | null;
  className?: string;
}

export function HeartbeatIndicator({ lastHeartbeat, leaseExpiresAt, className = "" }: HeartbeatIndicatorProps) {
  const now = Date.now();
  const hbTime = lastHeartbeat ? new Date(lastHeartbeat).getTime() : 0;
  const expTime = leaseExpiresAt ? new Date(leaseExpiresAt).getTime() : 0;

  const secondsSinceHb = hbTime > 0 ? Math.floor((now - hbTime) / 1000) : 999;
  const isHealthy = hbTime > 0 && secondsSinceHb < 30;
  const isExpired = expTime > 0 && expTime < now;

  let statusText = "No heartbeat";
  let dotColor = "bg-slate-500";
  let textColor = "text-slate-400";

  if (isExpired) {
    statusText = "Lease expired";
    dotColor = "bg-rose-500";
    textColor = "text-rose-400";
  } else if (isHealthy) {
    statusText = `Healthy (${secondsSinceHb}s ago)`;
    dotColor = "bg-emerald-400 animate-pulse";
    textColor = "text-emerald-400";
  } else if (hbTime > 0) {
    statusText = `Lagging (${secondsSinceHb}s ago)`;
    dotColor = "bg-amber-400";
    textColor = "text-amber-400";
  }

  return (
    <div className={`inline-flex items-center gap-1.5 text-xs font-mono ${textColor} ${className}`} title={lastHeartbeat ? `Heartbeat: ${new Date(lastHeartbeat).toISOString()}` : undefined}>
      <span className={`w-2 h-2 rounded-full ${dotColor}`} />
      <span>{statusText}</span>
    </div>
  );
}

export interface TaskMetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  statusColor?: "emerald" | "amber" | "indigo" | "rose" | "purple" | "slate";
}

export function TaskMetricCard({
  title,
  value,
  subtitle,
  icon,
  statusColor = "slate",
}: TaskMetricCardProps) {
  const colorMap = {
    emerald: "text-emerald-400 bg-emerald-950/40 border-emerald-800/40",
    amber: "text-amber-400 bg-amber-950/40 border-amber-800/40",
    indigo: "text-indigo-400 bg-indigo-950/40 border-indigo-800/40",
    rose: "text-rose-400 bg-rose-950/40 border-rose-800/40",
    purple: "text-purple-400 bg-purple-950/40 border-purple-800/40",
    slate: "text-slate-300 bg-slate-900 border-slate-800",
  };

  return (
    <Card className={`p-4 border ${colorMap[statusColor]}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{title}</span>
        {icon && <div className="text-slate-400">{icon}</div>}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-slate-100">{value}</span>
        {subtitle && <span className="text-xs text-slate-400">{subtitle}</span>}
      </div>
    </Card>
  );
}

export interface ApprovalActionCardProps {
  runId: string;
  taskName: string;
  reason: string;
  autonomyLevel: string;
  retryCount: number;
  requiresMutation?: boolean;
  onApprove: (feedback?: string) => void;
  onReject: (reason: string) => void;
  isLoading?: boolean;
}

export function ApprovalActionCard({
  runId,
  taskName,
  reason,
  autonomyLevel,
  retryCount,
  requiresMutation = false,
  onApprove,
  onReject,
  isLoading = false,
}: ApprovalActionCardProps) {
  const [rejectReason, setRejectReason] = React.useState("");
  const [isRejecting, setIsRejecting] = React.useState(false);

  return (
    <div className="p-4 rounded-lg border border-amber-700/60 bg-amber-950/20 text-slate-200 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-amber-400">RUN: {runId.slice(0, 8)}</span>
            <AutonomyBadge level={autonomyLevel} />
            {requiresMutation && (
              <Badge variant="warning" className="text-xs">State Mutation Gate</Badge>
            )}
          </div>
          <h4 className="text-sm font-semibold text-slate-100 mt-1">{taskName}</h4>
          <p className="text-xs text-amber-300/90 mt-0.5">{reason}</p>
        </div>
        <div className="text-xs text-slate-400 text-right">
          <div>Retries: <span className="font-mono text-slate-200">{retryCount}</span></div>
        </div>
      </div>

      {isRejecting ? (
        <div className="space-y-2 pt-2 border-t border-amber-800/40">
          <input
            type="text"
            className="w-full text-xs px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            placeholder="Specify reason for rejection..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={isLoading}
              onClick={() => setIsRejecting(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={isLoading || !rejectReason.trim()}
              onClick={() => {
                onReject(rejectReason);
                setIsRejecting(false);
              }}
            >
              Confirm Rejection
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-800/40">
          <Button
            size="sm"
            variant="outline"
            disabled={isLoading}
            onClick={() => setIsRejecting(true)}
          >
            Reject Run
          </Button>
          <Button
            size="sm"
            variant="default"
            disabled={isLoading}
            onClick={() => onApprove()}
          >
            Approve & Resume
          </Button>
        </div>
      )}
    </div>
  );
}
