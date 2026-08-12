import React, { useState } from "react";
import { cn } from "../lib/utils";

/* ─────────────────── 1. StatusBadge ─────────────────── */

type StatusBadgeVariant =
  | "active"
  | "suspended"
  | "pending"
  | "healthy"
  | "degraded"
  | "down"
  | "invited";

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant: StatusBadgeVariant;
  label?: string;
}

const statusStyles: Record<StatusBadgeVariant, string> = {
  active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  healthy: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  suspended: "bg-red-500/10 text-red-400 border-red-500/20",
  down: "bg-red-500/10 text-red-400 border-red-500/20",
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  degraded: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  invited: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ variant, label, className, ...props }, ref) => {
    const displayLabel = label ?? variant.charAt(0).toUpperCase() + variant.slice(1);
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
          statusStyles[variant],
          className,
        )}
        {...props}
      >
        <span
          className={cn(
            "size-1.5 rounded-full",
            variant === "active" || variant === "healthy"
              ? "bg-emerald-400"
              : variant === "suspended" || variant === "down"
                ? "bg-red-400"
                : variant === "pending" || variant === "degraded"
                  ? "bg-amber-400"
                  : "bg-blue-400",
          )}
        />
        {displayLabel}
      </span>
    );
  },
);
StatusBadge.displayName = "StatusBadge";

/* ─────────────────── 2. AdminStatCard ─────────────────── */

interface AdminStatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon?: React.ReactNode;
}

const AdminStatCard = React.forwardRef<HTMLDivElement, AdminStatCardProps>(
  ({ title, value, change, changeType = "neutral", icon, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-md transition-all duration-300 hover:border-red-500/20 hover:shadow-[0_0_25px_rgba(239,68,68,0.05)]",
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{title}</p>
            <h3 className="mt-2 text-3xl font-bold text-white tracking-tight">{value}</h3>
          </div>
          {icon && (
            <div className="flex size-10 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
              {icon}
            </div>
          )}
        </div>
        {change && (
          <div className="mt-4 flex items-center gap-2">
            <span
              className={cn(
                "text-xs font-semibold",
                changeType === "positive" && "text-emerald-400",
                changeType === "negative" && "text-red-400",
                changeType === "neutral" && "text-slate-400",
              )}
            >
              {change}
            </span>
            <span className="text-[10px] text-slate-500">vs last period</span>
          </div>
        )}
      </div>
    );
  },
);
AdminStatCard.displayName = "AdminStatCard";

/* ─────────────────── 3. AdminPageHeader ─────────────────── */

interface AdminPageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  breadcrumbs?: Array<{ label: string; onClick?: () => void }>;
  actions?: React.ReactNode;
}

const AdminPageHeader = React.forwardRef<HTMLDivElement, AdminPageHeaderProps>(
  ({ title, description, breadcrumbs, actions, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between", className)}
        {...props}
      >
        <div>
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav className="mb-2 flex items-center gap-1.5 text-[10px] text-slate-500">
              {breadcrumbs.map((crumb, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span className="text-slate-600">/</span>}
                  {crumb.onClick ? (
                    <button
                      onClick={crumb.onClick}
                      className="hover:text-white transition-colors"
                    >
                      {crumb.label}
                    </button>
                  ) : (
                    <span className="text-slate-400">{crumb.label}</span>
                  )}
                </React.Fragment>
              ))}
            </nav>
          )}
          <h1 className="text-xl font-bold text-white tracking-tight">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-slate-400">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    );
  },
);
AdminPageHeader.displayName = "AdminPageHeader";

/* ─────────────────── 4. DataTable ─────────────────── */

interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  sortable?: boolean;
  align?: "left" | "center" | "right";
}

interface DataTableProps<T> extends React.HTMLAttributes<HTMLDivElement> {
  columns: DataTableColumn<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

function DataTableInner<T>(
  {
    columns,
    data,
    keyExtractor,
    onRowClick,
    emptyMessage = "No data available",
    className,
    ...props
  }: DataTableProps<T>,
  ref: React.ForwardedRef<HTMLDivElement>,
) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-md overflow-hidden",
        className,
      )}
      {...props}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-white/5">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-6 py-4 text-[10px] font-semibold text-slate-400 uppercase tracking-wider",
                    col.sortable && "cursor-pointer select-none hover:text-white transition-colors",
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center",
                  )}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && sortKey === col.key && (
                      <svg className="size-3" viewBox="0 0 24 24" fill="currentColor">
                        {sortDir === "asc" ? (
                          <path d="M7 14l5-5 5 5z" />
                        ) : (
                          <path d="M7 10l5 5 5-5z" />
                        )}
                      </svg>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-6 py-12 text-center text-sm text-slate-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={keyExtractor(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    "transition-colors hover:bg-white/[0.03]",
                    onRowClick && "cursor-pointer",
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-6 py-4 text-sm text-slate-300",
                        col.align === "right" && "text-right",
                        col.align === "center" && "text-center",
                      )}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Forward ref wrapper for DataTable
const DataTable = React.forwardRef(DataTableInner) as <T>(
  props: DataTableProps<T> & { ref?: React.ForwardedRef<HTMLDivElement> },
) => React.ReactElement;

/* ─────────────────── 5. ConfirmDialog ─────────────────── */

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Dialog */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <p className="mt-2 text-sm text-slate-400 leading-relaxed">{description}</p>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-xl border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-slate-300 transition-all hover:bg-white/5"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all",
              variant === "danger"
                ? "bg-red-600 hover:bg-red-500"
                : "bg-red-500 hover:bg-red-400",
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export { StatusBadge, AdminStatCard, AdminPageHeader, DataTable, ConfirmDialog };
export type { StatusBadgeVariant, DataTableColumn, DataTableProps, ConfirmDialogProps };
