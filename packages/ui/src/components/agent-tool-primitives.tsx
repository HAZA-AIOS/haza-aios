import * as React from "react";
import { Badge } from "./badge";
import { Button } from "./button";
import { Card } from "./card";

export type ToolRiskLevel = "low" | "medium" | "high";
export type ToolStatus = "draft" | "active" | "deprecated" | "disabled";

export interface ToolMetadataProps {
  toolId: string;
  toolKey: string;
  name: string;
  description: string;
  category: string;
  industry: string;
  version: string;
  riskLevel: ToolRiskLevel;
  executionMode: "sync" | "async";
  approvalPolicy: string;
  requiredPermissions: string[];
  enabled: boolean;
  deprecated?: boolean;
}

export function AgentToolStatusBadge({
  status,
  enabled,
  className,
}: {
  status?: string;
  enabled?: boolean;
  className?: string;
}) {
  const isEnabled = enabled !== false && status !== "disabled";
  if (!isEnabled) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 ${className ?? ""}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
        DISABLED
      </span>
    );
  }

  if (status === "deprecated") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 ${className ?? ""}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        DEPRECATED
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 ${className ?? ""}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      ACTIVE
    </span>
  );
}

export function AgentToolRiskBadge({
  riskLevel,
  className,
}: {
  riskLevel: ToolRiskLevel | string;
  className?: string;
}) {
  const level = (riskLevel || "low").toLowerCase();
  switch (level) {
    case "high":
      return (
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 ${className ?? ""}`}
        >
          <svg className="w-3 h-3 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          HIGH RISK
        </span>
      );
    case "medium":
      return (
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 ${className ?? ""}`}
        >
          <svg className="w-3 h-3 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          MEDIUM RISK
        </span>
      );
    default:
      return (
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 ${className ?? ""}`}
        >
          <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          LOW RISK
        </span>
      );
  }
}

export function AgentToolCard({
  tool,
  onSelect,
  onToggleEnabled,
}: {
  tool: ToolMetadataProps;
  onSelect?: () => void;
  onToggleEnabled?: (enabled: boolean) => void;
}) {
  return (
    <Card className="p-5 border border-slate-800 bg-slate-900/60 backdrop-blur-sm rounded-xl hover:border-slate-700 transition-all group flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="font-semibold text-slate-100 group-hover:text-cyan-400 transition-colors text-base">
                {tool.name}
              </h3>
              <Badge variant="default" className="text-[10px] font-mono text-slate-400 border-slate-700">
                v{tool.version}
              </Badge>
            </div>
            <p className="font-mono text-xs text-cyan-400/80 mb-2 truncate max-w-sm">
              {tool.toolKey}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <AgentToolRiskBadge riskLevel={tool.riskLevel} />
            <AgentToolStatusBadge enabled={tool.enabled} status={tool.deprecated ? "deprecated" : "active"} />
          </div>
        </div>

        <p className="text-sm text-slate-400 line-clamp-2 mb-4 leading-relaxed">
          {tool.description}
        </p>

        <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500 mb-4">
          <span className="px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700/60 capitalize">
            {tool.category.replace(/_/g, " ")}
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700/60 uppercase">
            {tool.industry}
          </span>
          <span className="text-slate-400">
            Approval: <strong className="text-slate-200 capitalize">{tool.approvalPolicy}</strong>
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
        {onToggleEnabled && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleEnabled(!tool.enabled);
            }}
            className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
              tool.enabled
                ? "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
            }`}
          >
            {tool.enabled ? "Disable Tool" : "Enable Tool"}
          </button>
        )}
        {onSelect && (
          <Button
            size="sm"
            variant="default"
            onClick={onSelect}
            className="text-xs border-slate-700 hover:border-cyan-500/50 hover:text-cyan-400 ml-auto"
          >
            Inspect Schemas
          </Button>
        )}
      </div>
    </Card>
  );
}

export function ToolSchemaViewer({
  schema,
  title,
}: {
  schema: Record<string, unknown>;
  title: string;
}) {
  const properties = (schema.properties as Record<string, any>) ?? {};
  const requiredFields = (schema.required as string[]) ?? [];

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4 font-sans text-xs">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
        <h4 className="font-semibold text-slate-200 uppercase tracking-wider">{title}</h4>
        <span className="text-[11px] text-slate-500 font-mono">
          {Object.keys(properties).length} parameters
        </span>
      </div>

      {Object.keys(properties).length === 0 ? (
        <p className="text-slate-500 italic">No parameters defined.</p>
      ) : (
        <div className="space-y-3">
          {Object.entries(properties).map(([key, val]) => {
            const isReq = requiredFields.includes(key);
            return (
              <div key={key} className="border-b border-slate-900/60 pb-2 last:border-b-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono font-bold text-cyan-300">{key}</span>
                  <span className="font-mono text-purple-400 text-[11px]">
                    {val.type || "any"}
                  </span>
                  {isReq ? (
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                      REQUIRED
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.2 rounded text-[10px] text-slate-500 bg-slate-800/50">
                      OPTIONAL
                    </span>
                  )}
                </div>
                {val.description && (
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    {val.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ToolPermissionMatrix({
  requiredPermissions,
  userPermissions,
}: {
  requiredPermissions: string[];
  userPermissions?: string[];
}) {
  const effective = userPermissions || [];
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
      <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
        Required Permissions & Access Matrix
      </h4>
      <div className="space-y-2">
        {requiredPermissions.map((perm) => {
          const granted =
            effective.includes(perm) ||
            effective.includes("platform.admin") ||
            effective.includes("organization.manage") ||
            effective.includes("workspace.manage");
          return (
            <div
              key={perm}
              className="flex items-center justify-between p-2 rounded bg-slate-950/60 border border-slate-800/80 text-xs"
            >
              <code className="text-slate-300 font-mono">{perm}</code>
              {granted ? (
                <span className="flex items-center gap-1 text-emerald-400 font-medium">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  AUTHORIZED
                </span>
              ) : (
                <span className="flex items-center gap-1 text-slate-500">
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  REQUIRED
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ToolExecutionTimeline({
  events,
}: {
  events: Array<{
    id: string;
    eventType: string;
    payload: Record<string, unknown>;
    createdAt: string;
  }>;
}) {
  return (
    <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
      {events.map((ev) => (
        <div key={ev.id} className="relative group">
          <span className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-cyan-500 border-2 border-slate-900 group-hover:scale-125 transition-transform" />
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 text-xs">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="font-semibold text-cyan-400 font-mono uppercase">{ev.eventType}</span>
              <span className="text-[10px] text-slate-500">{new Date(ev.createdAt).toLocaleTimeString()}</span>
            </div>
            <pre className="text-[11px] font-mono text-slate-300 bg-slate-950/80 p-2 rounded overflow-x-auto">
              {JSON.stringify(ev.payload, null, 2)}
            </pre>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ToolApprovalSummary({
  approvalPolicy,
  riskLevel,
  approvalRequestId,
  decision,
}: {
  approvalPolicy: string;
  riskLevel: string;
  approvalRequestId?: string | null;
  decision?: "pending" | "approved" | "rejected" | null;
}) {
  const isHighRisk = riskLevel === "high" || approvalPolicy === "always";

  return (
    <div
      className={`rounded-lg p-4 border text-xs ${
        isHighRisk
          ? "border-amber-500/30 bg-amber-500/5 text-amber-200"
          : "border-slate-800 bg-slate-900/40 text-slate-300"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <h5 className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
          <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Human Governance Policy
        </h5>
        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-800">
          Policy: {approvalPolicy}
        </span>
      </div>

      <p className="text-slate-400 mb-2 leading-relaxed">
        {isHighRisk
          ? "This tool can mutate organizational records. Execution will automatically pause and create a durable human approval gate before changes are committed."
          : "Standard read or low-risk operation. Authorized agents can invoke this tool directly within permitted scopes."}
      </p>

      {approvalRequestId && (
        <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between">
          <span className="text-slate-400">Approval Request:</span>
          <code className="text-cyan-400 font-mono text-[11px]">{approvalRequestId}</code>
          {decision && (
            <Badge
              variant={
                decision === "approved"
                  ? "success"
                  : decision === "rejected"
                  ? "destructive"
                  : "warning"
              }
              className="uppercase text-[10px]"
            >
              {decision}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

export function ToolUsageMetricCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="p-4 border border-slate-800 bg-slate-900/60 rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{title}</span>
        {icon && <span className="text-slate-500">{icon}</span>}
      </div>
      <div className="text-2xl font-bold text-slate-100 mb-1">{value}</div>
      {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
    </Card>
  );
}

export function ToolPolicyEditor({
  toolKey,
  enabled,
  approvalPolicyOverride,
  onSave,
}: {
  toolKey: string;
  enabled: boolean;
  approvalPolicyOverride?: string | null;
  onSave: (policy: { enabled: boolean; approvalPolicyOverride?: string | null }) => void;
}) {
  const [isEnabled, setIsEnabled] = React.useState(enabled);
  const [override, setOverride] = React.useState(approvalPolicyOverride ?? "default");

  return (
    <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/80 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-200">Organization Activation</h4>
          <p className="text-xs text-slate-400">Enable or disable tool access across this workspace.</p>
        </div>
        <button
          type="button"
          onClick={() => setIsEnabled(!isEnabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            isEnabled ? "bg-cyan-500" : "bg-slate-700"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              isEnabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-300 mb-1">Approval Policy Override</label>
        <select
          value={override}
          onChange={(e) => setOverride(e.target.value)}
          className="w-full text-xs rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
        >
          <option value="default">Default Platform Policy</option>
          <option value="always">Always Require Human Approval</option>
          <option value="none">Allow Autonomous Execution (Low Risk Only)</option>
        </select>
      </div>

      <div className="flex justify-end pt-2">
        <Button
          size="sm"
          onClick={() =>
            onSave({
              enabled: isEnabled,
              approvalPolicyOverride: override === "default" ? null : override,
            })
          }
          className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs"
        >
          Save Policy Changes
        </Button>
      </div>
    </div>
  );
}

export function ToolExecutionResultViewer({
  execution,
}: {
  execution: {
    id: string;
    toolKey: string;
    toolVersion: string;
    status: string;
    durationMs?: number | null;
    inputSnapshot?: Record<string, unknown> | null;
    outputSnapshot?: Record<string, unknown> | null;
    errorMessage?: string | null;
    createdAt: string;
  };
}) {
  const [tab, setTab] = React.useState<"output" | "input">("output");

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-3">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-cyan-400">{execution.toolKey}</span>
          <Badge variant="default" className="text-[10px] text-slate-400">
            {execution.status}
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          {execution.durationMs !== undefined && execution.durationMs !== null && (
            <span>{execution.durationMs}ms</span>
          )}
          <span>{new Date(execution.createdAt).toLocaleTimeString()}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-slate-900 pb-2">
        <button
          onClick={() => setTab("output")}
          className={`text-xs px-2.5 py-1 rounded font-medium ${
            tab === "output" ? "bg-slate-800 text-cyan-300" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Result Output
        </button>
        <button
          onClick={() => setTab("input")}
          className={`text-xs px-2.5 py-1 rounded font-medium ${
            tab === "input" ? "bg-slate-800 text-cyan-300" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Input Parameters
        </button>
      </div>

      {execution.errorMessage && (
        <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
          <strong>Error:</strong> {execution.errorMessage}
        </div>
      )}

      <pre className="text-xs font-mono text-slate-300 bg-slate-900/90 p-3 rounded-lg overflow-x-auto max-h-64">
        {JSON.stringify(
          tab === "output" ? execution.outputSnapshot ?? { message: "No output available" } : execution.inputSnapshot ?? {},
          null,
          2,
        )}
      </pre>
    </div>
  );
}
