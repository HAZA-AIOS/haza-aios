import React from "react";
import { cn } from "@haza-aios/ui/lib/utils";
import { Button } from "./button";

// --- Layout Primitives ---

export const BuilderContainer: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div
    className={cn(
      "flex flex-col md:flex-row h-[calc(100vh-64px)] overflow-hidden bg-slate-950 text-slate-100",
      className,
    )}
  >
    {children}
  </div>
);

export const BuilderSidebar: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div
    className={cn(
      "w-full md:w-72 border-r border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-y-auto flex-shrink-0 flex flex-col justify-between",
      className,
    )}
  >
    <div className="p-4 space-y-1.5">{children}</div>
  </div>
);

export interface BuilderNavItemProps {
  label: string;
  sectionKey: string;
  isActive: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  badgeCount?: number;
  badgeSeverity?: "error" | "warning";
}

export const BuilderNavItem: React.FC<BuilderNavItemProps> = ({
  label,
  isActive,
  onClick,
  icon,
  badgeCount,
  badgeSeverity = "error",
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-medium rounded-lg transition-all text-left",
      isActive
        ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-sm"
        : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent",
    )}
  >
    <div className="flex items-center gap-2.5 truncate">
      {icon && <span className="text-sm shrink-0">{icon}</span>}
      <span className="truncate">{label}</span>
    </div>
    {badgeCount !== undefined && badgeCount > 0 && (
      <span
        className={cn(
          "px-1.5 py-0.5 text-[10px] font-semibold rounded-full shrink-0",
          badgeSeverity === "error"
            ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
            : "bg-amber-500/20 text-amber-300 border border-amber-500/30",
        )}
      >
        {badgeCount}
      </span>
    )}
  </button>
);

export const BuilderContent: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div className={cn("flex-1 overflow-y-auto p-6 md:p-8 bg-slate-950", className)}>
    <div className="max-w-4xl mx-auto space-y-8 pb-12">{children}</div>
  </div>
);

export const BuilderHeaderBar: React.FC<{
  title: string;
  subtitle?: string;
  statusBadge?: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ title, subtitle, statusBadge, actions }) => (
  <header className="flex-shrink-0 flex items-center justify-between border-b border-slate-800 px-6 py-3.5 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
    <div className="flex items-center gap-3">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="font-semibold text-base text-slate-100">{title}</h1>
          {statusBadge}
        </div>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
    {actions && <div className="flex items-center gap-2.5">{actions}</div>}
  </header>
);

// --- Section & Form Fields ---

export const BuilderSection: React.FC<{
  title: string;
  description?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, description, badge, children }) => (
  <section className="space-y-4 rounded-xl border border-slate-800/80 bg-slate-900/40 p-5 md:p-6 backdrop-blur-sm">
    <div className="border-b border-slate-800/60 pb-3.5 flex items-start justify-between">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight text-slate-100">{title}</h2>
          {badge}
        </div>
        {description && <p className="text-xs text-slate-400 mt-1">{description}</p>}
      </div>
    </div>
    <div className="space-y-5 pt-1">{children}</div>
  </section>
);

export const ConfigField: React.FC<{
  label: string;
  description?: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}> = ({ label, description, required, error, children }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <label className="text-xs font-medium text-slate-300">
        {label}
        {required && <span className="text-rose-400 ml-1">*</span>}
      </label>
    </div>
    {description && <p className="text-[11px] text-slate-400">{description}</p>}
    <div className="pt-0.5">{children}</div>
    {error && <p className="text-xs text-rose-400 font-medium mt-1">{error}</p>}
  </div>
);

// --- Badges & Risk Tags ---

export const RiskBadge: React.FC<{ riskLevel: "low" | "medium" | "high" }> = ({ riskLevel }) => {
  switch (riskLevel) {
    case "low":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Low Risk
        </span>
      );
    case "medium":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          Medium Risk
        </span>
      );
    case "high":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
          High Risk
        </span>
      );
    default:
      return null;
  }
};

// --- Model Parameter Sliders ---

export interface ModelParameterSlidersProps {
  temperature: number;
  maxTokens: number;
  timeoutSeconds: number;
  onChangeTemperature: (val: number) => void;
  onChangeMaxTokens: (val: number) => void;
  onChangeTimeoutSeconds: (val: number) => void;
}

export const ModelParameterSliders: React.FC<ModelParameterSlidersProps> = ({
  temperature,
  maxTokens,
  timeoutSeconds,
  onChangeTemperature,
  onChangeMaxTokens,
  onChangeTimeoutSeconds,
}) => (
  <div className="space-y-6 pt-2">
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-300">Temperature</span>
        <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700">
          {temperature.toFixed(2)}
        </span>
      </div>
      <input
        type="range"
        min={0.0}
        max={2.0}
        step={0.05}
        value={temperature}
        onChange={(e) => onChangeTemperature(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
      />
      <div className="flex justify-between text-[10px] text-slate-400">
        <span>0.0 (Deterministic)</span>
        <span>0.7 (Balanced)</span>
        <span>2.0 (Creative)</span>
      </div>
    </div>

    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-300">Max Output Tokens</span>
        <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700">
          {maxTokens}
        </span>
      </div>
      <input
        type="range"
        min={128}
        max={8192}
        step={128}
        value={maxTokens}
        onChange={(e) => onChangeMaxTokens(parseInt(e.target.value, 10))}
        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
      />
      <div className="flex justify-between text-[10px] text-slate-400">
        <span>128 tokens</span>
        <span>2048 tokens</span>
        <span>8192 tokens</span>
      </div>
    </div>

    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-300">Execution Timeout (Seconds)</span>
        <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700">
          {timeoutSeconds}s
        </span>
      </div>
      <input
        type="range"
        min={5}
        max={180}
        step={5}
        value={timeoutSeconds}
        onChange={(e) => onChangeTimeoutSeconds(parseInt(e.target.value, 10))}
        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
      />
      <div className="flex justify-between text-[10px] text-slate-400">
        <span>5 seconds</span>
        <span>60 seconds</span>
        <span>180 seconds</span>
      </div>
    </div>
  </div>
);

// --- Textarea with Char Limit Indicator ---

export const InstructionTextarea: React.FC<{
  value: string;
  onChange: (val: string) => void;
  maxLength?: number;
  rows?: number;
  placeholder?: string;
  hint?: string;
}> = ({ value, onChange, maxLength = 10000, rows = 4, placeholder, hint }) => {
  const currentLength = value?.length ?? 0;
  const isNearLimit = currentLength > maxLength * 0.9;
  const isOverLimit = currentLength > maxLength;

  return (
    <div className="space-y-1.5">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className={cn(
          "w-full rounded-lg border bg-slate-900 px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 transition-all resize-y",
          isOverLimit
            ? "border-rose-500 focus:ring-rose-500"
            : "border-slate-800 focus:border-indigo-500 focus:ring-indigo-500",
        )}
      />
      <div className="flex items-center justify-between text-[10px]">
        {hint ? <span className="text-slate-400">{hint}</span> : <span />}
        <span
          className={cn(
            "font-mono",
            isOverLimit
              ? "text-rose-400 font-bold"
              : isNearLimit
                ? "text-amber-400"
                : "text-slate-400",
          )}
        >
          {currentLength} / {maxLength}
        </span>
      </div>
    </div>
  );
};

// --- Capability Card ---

export const CapabilityCard: React.FC<{
  capabilityKey: string;
  name: string;
  description: string;
  riskLevel: "low" | "medium" | "high";
  requiresApproval: boolean;
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
}> = ({
  name,
  description,
  riskLevel,
  requiresApproval,
  isEnabled,
  onToggle,
}) => (
  <div
    className={cn(
      "p-3.5 rounded-lg border transition-all flex items-start justify-between gap-3",
      isEnabled
        ? "bg-slate-900 border-indigo-500/40 shadow-sm"
        : "bg-slate-900/30 border-slate-800/70 opacity-75 hover:opacity-100",
    )}
  >
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-200">{name}</span>
        <RiskBadge riskLevel={riskLevel} />
        {requiresApproval && (
          <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/10 text-amber-300 border border-amber-500/20">
            Approval Required
          </span>
        )}
      </div>
      <p className="text-[11px] text-slate-400 leading-relaxed">{description}</p>
    </div>
    <button
      type="button"
      onClick={() => onToggle(!isEnabled)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
        isEnabled ? "bg-indigo-600" : "bg-slate-700",
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
          isEnabled ? "translate-x-4" : "translate-x-0",
        )}
      />
    </button>
  </div>
);

// --- Tool Declaration Card ---

export const ToolDeclarationCard: React.FC<{
  toolKey: string;
  name: string;
  description: string;
  category: string;
  riskLevel: "low" | "medium" | "high";
  requiresApproval: boolean;
  permissions: string[];
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
}> = ({
  name,
  description,
  category,
  riskLevel,
  requiresApproval,
  permissions,
  isEnabled,
  onToggle,
}) => (
  <div
    className={cn(
      "p-4 rounded-lg border transition-all flex flex-col justify-between gap-3",
      isEnabled
        ? "bg-slate-900 border-indigo-500/40 shadow-sm"
        : "bg-slate-900/30 border-slate-800/70 opacity-75 hover:opacity-100",
    )}
  >
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-100">{name}</span>
          <span className="text-[10px] text-slate-400 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">
            {category}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onToggle(!isEnabled)}
          className={cn(
            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
            isEnabled ? "bg-indigo-600" : "bg-slate-700",
          )}
        >
          <span
            className={cn(
              "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
              isEnabled ? "translate-x-4" : "translate-x-0",
            )}
          />
        </button>
      </div>
      <p className="text-[11px] text-slate-400">{description}</p>
    </div>

    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800/60">
      <RiskBadge riskLevel={riskLevel} />
      {requiresApproval && (
        <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/10 text-amber-300 border border-amber-500/20">
          Approval Required
        </span>
      )}
      {permissions.map((p) => (
        <span
          key={p}
          className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400"
        >
          {p}
        </span>
      ))}
    </div>
  </div>
);

// --- Approval Policy Selector ---

export const ApprovalPolicySelector: React.FC<{
  currentPolicy: "never" | "risk_threshold" | "always";
  onSelectPolicy: (policy: "never" | "risk_threshold" | "always") => void;
}> = ({ currentPolicy, onSelectPolicy }) => {
  const policies = [
    {
      id: "risk_threshold" as const,
      title: "Risk-Governed (Recommended)",
      badge: "Best Practice",
      description: "Human approval required only for medium and high risk capabilities and tools.",
    },
    {
      id: "always" as const,
      title: "Strict Human-in-the-Loop",
      badge: "High Security",
      description: "Every tool invocation or publishing action requires designated administrator sign-off.",
    },
    {
      id: "never" as const,
      title: "Permissive (Testing Only)",
      badge: "Restricted",
      description: "No approval requested. Only allowed when ZERO high-risk capabilities or tools are declared.",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {policies.map((p) => {
        const isSelected = currentPolicy === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelectPolicy(p.id)}
            className={cn(
              "p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between",
              isSelected
                ? "bg-indigo-600/10 border-indigo-500 text-slate-100 shadow-sm"
                : "bg-slate-900/40 border-slate-800 text-slate-400 hover:bg-slate-900 hover:text-slate-200",
            )}
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold">{p.title}</span>
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700">
                  {p.badge}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">{p.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
};

// --- Validation Summary Alert ---

export interface ValidationSummaryAlertProps {
  errors: Array<{ field: string; message: string; section?: string }>;
  warnings: Array<{ field: string; message: string; section?: string }>;
  onJumpToSection?: (section: string) => void;
}

export const ValidationSummaryAlert: React.FC<ValidationSummaryAlertProps> = ({
  errors,
  warnings,
  onJumpToSection,
}) => {
  if (errors.length === 0 && warnings.length === 0) {
    return (
      <div className="p-3.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span>✓</span>
          <span className="font-medium">All configuration checks passed. Ready for activation.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {errors.length > 0 && (
        <div className="p-4 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-xs text-rose-200">
            <span>⚠</span>
            <span>{errors.length} Blocking Error{errors.length > 1 ? "s" : ""}</span>
          </div>
          <ul className="space-y-1 text-xs">
            {errors.map((err, idx) => (
              <li key={idx} className="flex items-center justify-between gap-2">
                <span>• {err.message}</span>
                {err.section && onJumpToSection && (
                  <button
                    type="button"
                    onClick={() => onJumpToSection(err.section!)}
                    className="text-[10px] text-rose-200 underline hover:text-white shrink-0"
                  >
                    Fix in {err.section}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-xs text-amber-200">
            <span>ℹ</span>
            <span>{warnings.length} Advisory Warning{warnings.length > 1 ? "s" : ""}</span>
          </div>
          <ul className="space-y-1 text-xs">
            {warnings.map((warn, idx) => (
              <li key={idx} className="flex items-center justify-between gap-2">
                <span>• {warn.message}</span>
                {warn.section && onJumpToSection && (
                  <button
                    type="button"
                    onClick={() => onJumpToSection(warn.section!)}
                    className="text-[10px] text-amber-200 underline hover:text-white shrink-0"
                  >
                    Review in {warn.section}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// --- Safe Mock Preview Console ---

export interface MockPreviewConsoleProps {
  testPrompt: string;
  onChangeTestPrompt: (val: string) => void;
  onExecutePreview: () => void;
  isLoading: boolean;
  result?: {
    simulated: boolean;
    provider: string;
    model: string;
    content: string;
    latencyMs: number;
    simulatedUsage?: { promptTokens: number; completionTokens: number; totalTokens: number };
    simulatedToolCalls?: Array<{ name: string; description: string; riskLevel: string }>;
    validationWarnings?: string[];
  } | null;
}

export const MockPreviewConsole: React.FC<MockPreviewConsoleProps> = ({
  testPrompt,
  onChangeTestPrompt,
  onExecutePreview,
  isLoading,
  result,
}) => (
  <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden space-y-4">
    {/* Watermark Notice */}
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between text-[11px] text-amber-300">
      <div className="flex items-center gap-2">
        <span className="font-semibold uppercase tracking-wider">Simulated Preview</span>
        <span>•</span>
        <span>Zero external AI cost. Zero database modifications.</span>
      </div>
      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-200">
        MockAiProvider
      </span>
    </div>

    <div className="p-4 space-y-4">
      {/* Input Form */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-300">Test Invocation Prompt</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={testPrompt}
            onChange={(e) => onChangeTestPrompt(e.target.value)}
            placeholder="Ask your agent a question or assign a task..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isLoading && testPrompt.trim()) {
                e.preventDefault();
                onExecutePreview();
              }
            }}
          />
          <Button
            size="sm"
            disabled={isLoading || !testPrompt.trim()}
            onClick={onExecutePreview}
            className="shrink-0"
          >
            {isLoading ? "Simulating..." : "Run Preview"}
          </Button>
        </div>
      </div>

      {/* Result Display */}
      {result && (
        <div className="p-4 rounded-lg border border-slate-800 bg-slate-950 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-slate-200">Simulated Output</span>
              <span className="text-[10px] text-slate-400 font-mono">({result.model})</span>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono">
              <span>{result.latencyMs}ms</span>
              {result.simulatedUsage && <span>{result.simulatedUsage.totalTokens} tokens</span>}
            </div>
          </div>

          <div className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed font-sans">
            {result.content}
          </div>

          {result.simulatedToolCalls && result.simulatedToolCalls.length > 0 && (
            <div className="pt-2 border-t border-slate-800/60 space-y-1.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Simulated Tool Dispatches
              </span>
              <div className="space-y-1">
                {result.simulatedToolCalls.map((tc, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <span className="font-mono text-indigo-300">{tc.name}</span>
                    <span className="text-[10px] text-slate-400">{tc.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  </div>
);

// --- Revision History & Diff Modal ---

export interface RevisionHistoryProps {
  revisions: Array<{
    id: string;
    revisionNumber: number;
    version: string;
    status: string;
    changelog: string | null;
    createdAt: string | Date;
    publishedAt?: string | Date | null;
  }>;
  activeRevisionId?: string | null;
  onRestoreRevision: (revisionId: string) => void;
  onCompareRevisions: (revAId: string, revBId: string) => void;
}

export const RevisionHistoryList: React.FC<RevisionHistoryProps> = ({
  revisions,
  activeRevisionId,
  onRestoreRevision,
  onCompareRevisions,
}) => {
  const [selectedForCompare, setSelectedForCompare] = React.useState<string[]>([]);

  const handleSelectCompare = (id: string) => {
    setSelectedForCompare((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  return (
    <div className="space-y-4">
      {selectedForCompare.length === 2 && (
        <div className="p-3 rounded-lg bg-indigo-600/10 border border-indigo-500/30 flex items-center justify-between text-xs text-indigo-300">
          <span>2 revisions selected for comparison</span>
          <Button
            size="sm"
            onClick={() => onCompareRevisions(selectedForCompare[0], selectedForCompare[1])}
          >
            Compare Revisions
          </Button>
        </div>
      )}

      <div className="rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-semibold">
            <tr>
              <th className="py-2.5 px-4 w-10">Select</th>
              <th className="py-2.5 px-4">Rev</th>
              <th className="py-2.5 px-4">Version</th>
              <th className="py-2.5 px-4">Status</th>
              <th className="py-2.5 px-4">Changelog</th>
              <th className="py-2.5 px-4">Date</th>
              <th className="py-2.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-950">
            {revisions.map((rev) => {
              const isActive = rev.id === activeRevisionId;
              const isChecked = selectedForCompare.includes(rev.id);
              const dateStr = new Date(rev.createdAt).toLocaleDateString();

              return (
                <tr key={rev.id} className="hover:bg-slate-900/40 transition-colors">
                  <td className="py-3 px-4">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleSelectCompare(rev.id)}
                      className="rounded border-slate-700 bg-slate-900 text-indigo-500"
                    />
                  </td>
                  <td className="py-3 px-4 font-mono font-medium text-slate-200">
                    #{rev.revisionNumber}
                  </td>
                  <td className="py-3 px-4 font-mono text-indigo-300">{rev.version}</td>
                  <td className="py-3 px-4">
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-semibold",
                        isActive
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : rev.status === "published"
                            ? "bg-slate-800 text-slate-300"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/20",
                      )}
                    >
                      {isActive ? "Active Live" : rev.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-400 max-w-xs truncate">
                    {rev.changelog || "—"}
                  </td>
                  <td className="py-3 px-4 text-slate-400">{dateStr}</td>
                  <td className="py-3 px-4 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRestoreRevision(rev.id)}
                      className="text-[11px] h-7"
                    >
                      Restore Draft
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
