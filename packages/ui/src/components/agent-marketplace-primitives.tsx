import React from "react";
import { Search, Filter } from "lucide-react";
import { Input } from "./input";
import { Button } from "./button";
import { cn } from "@haza-aios/ui/lib/utils";

// --- Agent Search ---
export interface AgentSearchProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

export const AgentSearch: React.FC<AgentSearchProps> = ({
  value,
  onChange,
  placeholder = "Search agents by name, capability, or industry...",
  className,
}) => {
  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9 h-11 bg-background"
      />
    </div>
  );
};

// --- Agent Category Nav ---
export interface AgentCategoryNavProps {
  categories: string[];
  activeCategory: string;
  onSelectCategory: (category: string) => void;
}

export const AgentCategoryNav: React.FC<AgentCategoryNavProps> = ({
  categories,
  activeCategory,
  onSelectCategory,
}) => {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none w-full">
      <Button
        variant={activeCategory === "All" ? "default" : "secondary"}
        size="sm"
        onClick={() => onSelectCategory("All")}
        className="rounded-full px-4 shrink-0"
      >
        All
      </Button>
      {categories.map((cat) => (
        <Button
          key={cat}
          variant={activeCategory === cat ? "default" : "secondary"}
          size="sm"
          onClick={() => onSelectCategory(cat)}
          className="rounded-full px-4 shrink-0"
        >
          {cat}
        </Button>
      ))}
    </div>
  );
};

// --- Agent Filters ---
export interface AgentFiltersProps {
  industries: string[];
  selectedIndustry: string;
  onSelectIndustry: (industry: string) => void;
  statuses: string[];
  selectedStatus: string;
  onSelectStatus: (status: string) => void;
  onClear: () => void;
}

export const AgentFilters: React.FC<AgentFiltersProps> = ({
  industries,
  selectedIndustry,
  onSelectIndustry,
  statuses,
  selectedStatus,
  onSelectStatus,
  onClear,
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-center gap-3">
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
        <select
          value={selectedIndustry}
          onChange={(e) => onSelectIndustry(e.target.value)}
          className="h-10 px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 flex-1 sm:w-[150px]"
        >
          <option value="All">All Industries</option>
          {industries.map((ind) => (
            <option key={ind} value={ind}>
              {ind}
            </option>
          ))}
        </select>
        
        <select
          value={selectedStatus}
          onChange={(e) => onSelectStatus(e.target.value)}
          className="h-10 px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 flex-1 sm:w-[150px]"
        >
          <option value="All">All Statuses</option>
          {statuses.map((stat) => (
            <option key={stat} value={stat}>
              {stat}
            </option>
          ))}
        </select>
      </div>
      
      {(selectedIndustry !== "All" || selectedStatus !== "All") && (
        <Button variant="ghost" size="sm" onClick={onClear} className="h-10 w-full sm:w-auto">
          Clear Filters
        </Button>
      )}
    </div>
  );
};

// --- Publishing Status Badge ---
export interface PublishingStatusBadgeProps {
  status: string;
  className?: string;
}

export const PublishingStatusBadge: React.FC<PublishingStatusBadgeProps> = ({
  status,
  className,
}) => {
  const norm = status?.toLowerCase() || "draft";
  switch (norm) {
    case "published":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
            className,
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Published
        </span>
      );
    case "approved":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/30",
            className,
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
          Approved
        </span>
      );
    case "under_review":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30",
            className,
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
          Under Review
        </span>
      );
    case "submitted":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/30",
            className,
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
          Submitted
        </span>
      );
    case "rejected":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive border border-destructive/30",
            className,
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
          Rejected
        </span>
      );
    case "deprecated":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/30",
            className,
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
          Deprecated
        </span>
      );
    case "withdrawn":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/30",
            className,
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
          Withdrawn
        </span>
      );
    case "draft":
    default:
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border",
            className,
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
          Draft
        </span>
      );
  }
};

// --- Version Badge ---
export interface VersionBadgeProps {
  version: string;
  className?: string;
  prefix?: boolean;
}

export const VersionBadge: React.FC<VersionBadgeProps> = ({
  version,
  className,
  prefix = true,
}) => {
  return (
    <span
      className={cn(
        "inline-flex items-center font-mono text-xs px-2 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border/80 tracking-tight",
        className,
      )}
    >
      {prefix && !version.startsWith("v") ? `v${version}` : version}
    </span>
  );
};

// --- Publisher Badge ---
export interface PublisherBadgeProps {
  publisherType?: "platform" | "organization" | "developer" | string;
  organizationName?: string | null;
  className?: string;
}

export const PublisherBadge: React.FC<PublisherBadgeProps> = ({
  publisherType = "platform",
  organizationName,
  className,
}) => {
  if (publisherType === "platform") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-primary/10 text-primary border border-primary/20",
          className,
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        Platform Certified
      </span>
    );
  }

  if (publisherType === "organization") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-secondary text-secondary-foreground border border-border",
          className,
        )}
      >
        {organizationName || "Verified Organization"}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-muted text-muted-foreground border border-border",
        className,
      )}
    >
      Community Publisher
    </span>
  );
};

// --- Upgrade Notice Badge ---
export interface UpgradeNoticeBadgeProps {
  installedVersion: string;
  latestVersion: string;
  className?: string;
  onUpgrade?: () => void;
  disabled?: boolean;
}

export const UpgradeNoticeBadge: React.FC<UpgradeNoticeBadgeProps> = ({
  installedVersion,
  latestVersion,
  className,
  onUpgrade,
  disabled,
}) => {
  if (installedVersion === latestVersion) return null;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30",
        className,
      )}
    >
      <span className="flex items-center gap-1">
        Update available: <span className="font-mono text-[11px]">v{installedVersion}</span> →{" "}
        <span className="font-mono font-semibold text-[11px] text-amber-200">v{latestVersion}</span>
      </span>
      {onUpgrade && (
        <button
          type="button"
          onClick={onUpgrade}
          disabled={disabled}
          className="ml-1 text-[11px] font-semibold underline underline-offset-2 hover:text-amber-100 disabled:opacity-50"
        >
          Upgrade Now
        </button>
      )}
    </div>
  );
};

// --- Marketplace Metric Card ---
export interface MarketplaceMetricCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: string;
  className?: string;
}

export const MarketplaceMetricCard: React.FC<MarketplaceMetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  className,
}) => {
  return (
    <div
      className={cn(
        "p-4 rounded-xl border border-border/80 bg-card/60 backdrop-blur-sm shadow-sm flex flex-col justify-between space-y-2",
        className,
      )}
    >
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs font-medium tracking-wide uppercase">{title}</span>
        {icon && <span className="text-primary/70">{icon}</span>}
      </div>
      <div>
        <div className="text-2xl font-bold tracking-tight text-foreground">{value}</div>
        {(subtitle || trend) && (
          <div className="flex items-center gap-2 mt-1">
            {trend && <span className="text-xs text-emerald-400 font-medium">{trend}</span>}
            {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
          </div>
        )}
      </div>
    </div>
  );
};

// --- Capability Tag List ---
export interface CapabilityTagListProps {
  capabilities: Array<{ key?: string; name?: string; description?: string } | string>;
  limit?: number;
  className?: string;
}

export const CapabilityTagList: React.FC<CapabilityTagListProps> = ({
  capabilities,
  limit = 4,
  className,
}) => {
  if (!capabilities || capabilities.length === 0) {
    return <span className="text-xs text-muted-foreground italic">No specialized capabilities</span>;
  }

  const displayed = capabilities.slice(0, limit);
  const remaining = capabilities.length - limit;

  return (
    <div className={cn("flex flex-wrap gap-1.5 items-center", className)}>
      {displayed.map((cap, idx) => {
        const label = typeof cap === "string" ? cap : cap.name || cap.key || "capability";
        return (
          <span
            key={typeof cap === "string" ? cap : cap.key || idx}
            className="px-2 py-0.5 rounded text-[11px] font-medium bg-muted/60 text-muted-foreground border border-border/70"
          >
            {label}
          </span>
        );
      })}
      {remaining > 0 && (
        <span className="text-[11px] text-muted-foreground/80 font-mono">
          +{remaining} more
        </span>
      )}
    </div>
  );
};
