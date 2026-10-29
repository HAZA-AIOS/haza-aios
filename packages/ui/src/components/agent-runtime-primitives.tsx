import * as React from "react";
import { Badge } from "./badge";
import { Button } from "./button";
import { Card } from "./card";

export type AgentRunStatusType =
  | "queued"
  | "running"
  | "waiting"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "cancelled"
  | "rejected";

export function AgentRunStatusBadge({
  status,
  className,
}: {
  status: AgentRunStatusType | string;
  className?: string;
}) {
  const normalized = status.toLowerCase();
  let variant: "default" | "primary" | "secondary" | "accent" | "success" | "warning" | "destructive" = "default";
  let label = status.replace(/_/g, " ").toUpperCase();
  let dotClass = "bg-slate-400";

  switch (normalized) {
    case "completed":
      variant = "success";
      dotClass = "bg-emerald-400";
      break;
    case "running":
      variant = "primary";
      dotClass = "bg-cyan-400 animate-pulse";
      break;
    case "awaiting_approval":
      variant = "warning";
      label = "AWAITING APPROVAL";
      dotClass = "bg-amber-400 animate-ping";
      break;
    case "failed":
      variant = "destructive";
      dotClass = "bg-rose-500";
      break;
    case "cancelled":
      variant = "secondary";
      dotClass = "bg-slate-500";
      break;
    case "rejected":
      variant = "destructive";
      dotClass = "bg-rose-400";
      break;
    case "queued":
      variant = "default";
      dotClass = "bg-amber-300/80";
      break;
    case "waiting":
      variant = "secondary";
      dotClass = "bg-cyan-300";
      break;
  }

  return (
    <Badge variant={variant} className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold ${className ?? ""}`}>
      <span className={`inline-block size-1.5 rounded-full ${dotClass}`} />
      <span>{label}</span>
    </Badge>
  );
}

// Backward compatibility alias
export const RunStatusBadge = AgentRunStatusBadge;

export interface TimelineEventItem {
  id?: string;
  eventType: string;
  timestamp: string | Date;
  status?: "pending" | "active" | "completed" | "failed";
  payload?: Record<string, unknown> | null;
}

export function AgentExecutionTimeline({
  events,
  className,
}: {
  events: TimelineEventItem[];
  className?: string;
}) {
  const [expandedIndex, setExpandedIndex] = React.useState<number | null>(null);

  if (!events || events.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-slate-500 italic">
        No execution events recorded yet.
      </div>
    );
  }

  return (
    <div className={`relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/10 ${className ?? ""}`}>
      {events.map((evt, idx) => {
        const timeStr = new Date(evt.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
        const isFailed = evt.eventType.includes("failed") || evt.status === "failed";
        const isCompleted = evt.eventType.includes("completed") || evt.status === "completed";
        const isRunning = evt.eventType.includes("started") || evt.eventType.includes("invoked") || evt.status === "active";
        const isApproval = evt.eventType.includes("approval");

        const circleBg = isFailed
          ? "bg-rose-500 border-rose-400"
          : isCompleted
          ? "bg-emerald-500 border-emerald-400"
          : isApproval
          ? "bg-amber-500 border-amber-400"
          : isRunning
          ? "bg-cyan-500 border-cyan-400"
          : "bg-slate-700 border-slate-600";

        const hasPayload = evt.payload && Object.keys(evt.payload).length > 0;
        const isExpanded = expandedIndex === idx;

        return (
          <div key={evt.id ?? idx} className="relative group">
            <span className={`absolute -left-6 top-1 size-3 rounded-full border-2 ${circleBg}`} />
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-semibold text-slate-200 capitalize">
                  {evt.eventType.replace(/_/g, " ")}
                </span>
                <span className="text-xs font-mono text-slate-500">{timeStr}</span>
              </div>
              {hasPayload && (
                <div className="mt-1">
                  <button
                    type="button"
                    onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-mono flex items-center gap-1"
                  >
                    {isExpanded ? "Hide details ▲" : "View payload ▼"}
                  </button>
                  {isExpanded && (
                    <pre className="mt-2 p-3 bg-slate-950/80 border border-white/10 rounded-lg text-xs font-mono text-slate-300 overflow-x-auto max-h-48">
                      {JSON.stringify(evt.payload, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Backward compatibility alias
export function ExecutionTimeline({ steps }: { steps: { label: string; status: "pending" | "active" | "completed" | "failed" }[] }) {
  const events: TimelineEventItem[] = steps.map((s) => ({
    eventType: s.label,
    timestamp: new Date(),
    status: s.status,
  }));
  return <AgentExecutionTimeline events={events} />;
}

export function AgentRunMetricCard({
  label,
  value,
  subvalue,
  icon,
  badge,
  className,
}: {
  label: string;
  value: string | number;
  subvalue?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`p-4 rounded-xl border border-white/10 bg-slate-900/60 backdrop-blur-md flex flex-col justify-between gap-2 shadow-sm ${className ?? ""}`}
    >
      <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider">
        <span>{label}</span>
        {icon && <span className="text-slate-500">{icon}</span>}
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-2xl font-bold tracking-tight text-white font-mono">{value}</span>
        {badge}
      </div>
      {subvalue && <span className="text-xs text-slate-500">{subvalue}</span>}
    </div>
  );
}

export interface ApprovalRequestItem {
  id: string;
  runId: string;
  actionName: string;
  actionType: string;
  actionPayload: Record<string, unknown>;
  riskLevel: string;
  policy: string;
  requiredRoles: string[];
  status: "pending" | "approved" | "rejected" | "expired";
  requestedBy: string;
  createdAt: string | Date;
  expiresAt?: string | Date | null;
}

export function AgentApprovalCard({
  approval,
  currentUserId,
  onApprove,
  onReject,
  isActing = false,
  className,
}: {
  approval: ApprovalRequestItem;
  currentUserId?: string;
  onApprove: (reason?: string) => void;
  onReject: (reason?: string) => void;
  isActing?: boolean;
  className?: string;
}) {
  const [reason, setReason] = React.useState("");
  const isRequester = currentUserId && approval.requestedBy === currentUserId;
  const isPending = approval.status === "pending";

  const riskBadgeVariant =
    approval.riskLevel === "critical" || approval.riskLevel === "high"
      ? "destructive"
      : approval.riskLevel === "medium"
      ? "warning"
      : "default";

  return (
    <Card className={`p-5 border border-white/10 bg-slate-900/80 rounded-xl space-y-4 shadow-lg ${className ?? ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-white">{approval.actionName}</span>
            <Badge variant={riskBadgeVariant as any} className="uppercase text-[10px]">
              {approval.riskLevel} RISK
            </Badge>
          </div>
          <p className="text-xs text-slate-400">
            Action: <span className="font-mono text-slate-300">{approval.actionType}</span> • Run:{" "}
            <span className="font-mono text-slate-300">{approval.runId.slice(0, 8)}...</span>
          </p>
        </div>
        <div className="text-right">
          <Badge variant={approval.status === "pending" ? "warning" : approval.status === "approved" ? "success" : "destructive"}>
            {approval.status.toUpperCase()}
          </Badge>
          <div className="text-[11px] text-slate-500 font-mono mt-1">
            {new Date(approval.createdAt).toLocaleDateString()}
          </div>
        </div>
      </div>

      <div className="bg-slate-950/70 border border-white/5 rounded-lg p-3">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
          Execution Payload
        </span>
        <pre className="text-xs font-mono text-slate-300 overflow-x-auto max-h-36">
          {JSON.stringify(approval.actionPayload, null, 2)}
        </pre>
      </div>

      {isPending && (
        <div className="space-y-3 pt-2 border-t border-white/5">
          {isRequester && (
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2">
              <svg className="size-4 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Separation of Duties: You initiated this run and cannot approve it yourself.</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs text-slate-400">Approval / Rejection Reason</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Verified educational content and safety parameters"
              className="w-full text-xs px-3 py-2 bg-slate-950 border border-white/10 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
              disabled={isActing}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => onReject(reason || undefined)}
              disabled={isActing}
            >
              Reject Run
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => onApprove(reason || undefined)}
              disabled={isActing || !!isRequester}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
            >
              {isActing ? "Processing..." : "Authorize & Resume"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export interface AttemptItem {
  id: string;
  attemptNumber: number;
  status: string;
  workerId: string;
  durationMs?: number | null;
  inputTokens: number;
  outputTokens: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  startedAt: string | Date;
  completedAt?: string | Date | null;
}

export function AgentAttemptHistory({
  attempts,
  className,
}: {
  attempts: AttemptItem[];
  className?: string;
}) {
  if (!attempts || attempts.length === 0) {
    return <div className="py-4 text-center text-xs text-slate-500 italic">No execution attempts recorded.</div>;
  }

  return (
    <div className={`overflow-x-auto border border-white/10 rounded-xl bg-slate-900/60 ${className ?? ""}`}>
      <table className="w-full text-left text-xs text-slate-300">
        <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-white/10 uppercase tracking-wider text-[11px]">
          <tr>
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Worker ID</th>
            <th className="px-4 py-3">Tokens (In / Out)</th>
            <th className="px-4 py-3">Duration</th>
            <th className="px-4 py-3">Outcome / Error</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5 font-mono">
          {attempts.map((att) => (
            <tr key={att.id} className="hover:bg-white/[0.02]">
              <td className="px-4 py-3 text-white font-bold">{att.attemptNumber}</td>
              <td className="px-4 py-3">
                <AgentRunStatusBadge status={att.status} />
              </td>
              <td className="px-4 py-3 text-slate-400">{att.workerId}</td>
              <td className="px-4 py-3">
                {att.inputTokens} / {att.outputTokens}
              </td>
              <td className="px-4 py-3 text-slate-400">
                {att.durationMs ? `${(att.durationMs / 1000).toFixed(2)}s` : "—"}
              </td>
              <td className="px-4 py-3">
                {att.errorMessage ? (
                  <span className="text-rose-400" title={att.errorMessage}>
                    {att.errorCode ?? "ERROR"}: {att.errorMessage.slice(0, 30)}
                  </span>
                ) : (
                  <span className="text-emerald-400">OK</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AgentExecutionResultViewer({
  output,
  error,
  input,
  className,
}: {
  output?: unknown;
  error?: string | null;
  input?: unknown;
  className?: string;
}) {
  const [tab, setTab] = React.useState<"output" | "input">("output");
  const [copied, setCopied] = React.useState(false);

  const activeContent = tab === "output" ? (error ? error : output) : input;
  const isObject = typeof activeContent === "object" && activeContent !== null;
  const displayString = isObject
    ? JSON.stringify(activeContent, null, 2)
    : String(activeContent ?? "");

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(displayString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={`rounded-xl border border-white/10 bg-slate-900/90 overflow-hidden shadow-lg ${className ?? ""}`}>
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950 border-b border-white/10">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab("output")}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
              tab === "output"
                ? "bg-white/10 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Output Result
          </button>
          {input !== undefined && (
            <button
              type="button"
              onClick={() => setTab("input")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                tab === "input"
                  ? "bg-white/10 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Invocation Input
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="text-xs text-slate-400 hover:text-cyan-400 font-mono flex items-center gap-1 transition-colors"
        >
          {copied ? "Copied! ✓" : "Copy raw 📋"}
        </button>
      </div>

      <div className="p-4 max-h-96 overflow-y-auto font-mono text-xs text-slate-200">
        {error && tab === "output" ? (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 whitespace-pre-wrap">
            {error}
          </div>
        ) : !displayString ? (
          <div className="text-slate-500 italic">No content available.</div>
        ) : (
          <pre className="whitespace-pre-wrap">{displayString}</pre>
        )}
      </div>
    </div>
  );
}

// Backward compatibility alias
export const RunOutputViewer = AgentExecutionResultViewer;

export function AgentRuntimeEmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="py-16 px-6 text-center border border-dashed border-white/10 rounded-2xl bg-slate-900/30 flex flex-col items-center justify-center gap-3">
      <div className="size-12 rounded-2xl bg-slate-800/80 border border-white/10 flex items-center justify-center text-slate-400 mb-1">
        {icon || (
          <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        )}
      </div>
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p className="text-sm text-slate-400 max-w-sm">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
