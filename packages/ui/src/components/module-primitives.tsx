import * as React from "react";
import { cn } from "@haza-aios/ui/lib/utils";

export type ModuleBadgeStatus =
  | "registered"
  | "available"
  | "activated"
  | "enabled"
  | "disabled"
  | "deactivated";

export interface ModuleBadgeProps {
  status: ModuleBadgeStatus;
  className?: string;
}

export function ModuleBadge({ status, className }: ModuleBadgeProps) {
  const styles: Record<ModuleBadgeStatus, string> = {
    activated: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    enabled: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    available: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    registered: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    disabled: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    deactivated: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  };

  const labels: Record<ModuleBadgeStatus, string> = {
    activated: "Activated",
    enabled: "Enabled",
    available: "Available",
    registered: "Registered",
    disabled: "Disabled",
    deactivated: "Deactivated",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider transition-colors",
        styles[status] || styles.deactivated,
        className
      )}
    >
      {labels[status] || status}
    </span>
  );
}

export interface ModuleCardProps {
  name: string;
  version: string;
  industry: string;
  description: string;
  icon: string;
  status: ModuleBadgeStatus;
  hasWriteAccess?: boolean;
  onToggleStatus?: () => void;
  onViewDetails?: () => void;
  className?: string;
}

export function ModuleCard({
  name,
  version,
  industry,
  description,
  icon,
  status,
  hasWriteAccess = true,
  onToggleStatus,
  onViewDetails,
  className,
}: ModuleCardProps) {
  const isActivated = status === "activated" || status === "enabled";

  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-md transition-all hover:border-white/20 hover:bg-slate-900/80",
        className
      )}
    >
      <div>
        {/* Header row: Icon & Status */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-slate-950 text-xl text-red-400 shadow-inner">
              {icon || "📦"}
            </div>
            <div>
              <h4 className="text-sm font-bold text-white group-hover:text-red-400 transition-colors">
                {name}
              </h4>
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <span>v{version}</span>
                <span>•</span>
                <span className="text-slate-300 font-medium">{industry}</span>
              </div>
            </div>
          </div>
          <ModuleBadge status={status} />
        </div>

        {/* Description */}
        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-6">
          {description}
        </p>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between border-t border-white/5 pt-4">
        {onViewDetails ? (
          <button
            type="button"
            onClick={onViewDetails}
            className="text-xs font-semibold text-slate-300 hover:text-white transition-colors"
          >
            Details & Config →
          </button>
        ) : (
          <span />
        )}

        {onToggleStatus && (
          <button
            type="button"
            disabled={!hasWriteAccess}
            onClick={onToggleStatus}
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-bold transition-all shadow-sm",
              isActivated
                ? "border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20",
              !hasWriteAccess && "opacity-50 cursor-not-allowed"
            )}
          >
            {isActivated ? "Deactivate" : "Activate"}
          </button>
        )}
      </div>
    </div>
  );
}

export interface ModuleDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  module: {
    name: string;
    slug: string;
    version: string;
    industry: string;
    category: string;
    description: string;
    icon: string;
    permissions?: Array<{ key: string; name: string; description: string }>;
    navigation?: Array<{ label: string; route: string }>;
  } | null;
}

export function ModuleDetailsDialog({ isOpen, onClose, module }: ModuleDetailsDialogProps) {
  if (!isOpen || !module) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{module.icon || "📦"}</span>
            <div>
              <h3 className="text-lg font-bold text-white">{module.name}</h3>
              <p className="text-xs text-slate-400">
                {module.industry} Module • v{module.version} • Slug: <code className="text-red-300">{module.slug}</code>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-lg"
          >
            ✕
          </button>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
            Description
          </h4>
          <p className="text-xs text-slate-300 leading-relaxed">{module.description}</p>
        </div>

        {module.permissions && module.permissions.length > 0 && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Declared Permissions
            </h4>
            <div className="space-y-1.5">
              {module.permissions.map((p) => (
                <div key={p.key} className="rounded-lg border border-white/5 bg-slate-950 p-2 text-xs">
                  <span className="font-mono text-red-400 font-semibold">{p.key}</span>
                  <p className="text-slate-400 text-[11px]">{p.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {module.navigation && module.navigation.length > 0 && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Workspace Navigation Routes
            </h4>
            <div className="space-y-1">
              {module.navigation.map((nav) => (
                <div key={nav.route} className="flex justify-between items-center text-xs p-2 rounded-lg bg-slate-950 border border-white/5 text-slate-300">
                  <span>{nav.label}</span>
                  <code className="text-[11px] text-red-300">{nav.route}</code>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-white/5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-transparent px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
