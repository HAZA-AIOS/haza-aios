import React from "react";
import { cn } from "../lib/utils";

/* ─────────────────── Attendance Status Badge ─────────────────── */

export type AttendanceStatusType = "present" | "absent" | "late" | "excused";

export interface AttendanceStatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: AttendanceStatusType;
  showDot?: boolean;
}

const attendanceStyles: Record<AttendanceStatusType, string> = {
  present: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  absent: "bg-red-500/10 text-red-400 border-red-500/20",
  late: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  excused: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

const attendanceDotStyles: Record<AttendanceStatusType, string> = {
  present: "bg-emerald-400",
  absent: "bg-red-400",
  late: "bg-amber-400",
  excused: "bg-blue-400",
};

const attendanceLabels: Record<AttendanceStatusType, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  excused: "Excused",
};

export const AttendanceStatusBadge = React.forwardRef<HTMLSpanElement, AttendanceStatusBadgeProps>(
  ({ status, showDot = true, className, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
          attendanceStyles[status] || attendanceStyles.absent,
          className
        )}
        {...props}
      >
        {showDot && (
          <span
            className={cn(
              "size-1.5 rounded-full shrink-0",
              attendanceDotStyles[status] || attendanceDotStyles.absent
            )}
          />
        )}
        {attendanceLabels[status] || status}
      </span>
    );
  }
);
AttendanceStatusBadge.displayName = "AttendanceStatusBadge";

/* ─────────────────── Attendance Summary Metric Card ─────────────────── */

export interface AttendanceSummaryCardProps {
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
  attendancePercentage?: number;
  className?: string;
}

export function AttendanceSummaryCard({
  totalStudents,
  presentCount,
  absentCount,
  lateCount,
  excusedCount,
  attendancePercentage,
  className,
}: AttendanceSummaryCardProps) {
  const computedPercentage =
    attendancePercentage !== undefined
      ? attendancePercentage
      : totalStudents > 0
        ? Math.round(((presentCount + lateCount) / totalStudents) * 100)
        : 100;

  return (
    <div
      className={cn(
        "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 rounded-2xl border border-white/5 bg-[#0f141f] p-4 text-center",
        className
      )}
    >
      <div className="rounded-xl bg-slate-900/60 p-3 border border-white/5">
        <div className="text-xs font-medium text-slate-400">Total Enrolled</div>
        <div className="mt-1 text-2xl font-bold text-white">{totalStudents}</div>
      </div>
      <div className="rounded-xl bg-emerald-500/5 p-3 border border-emerald-500/20">
        <div className="text-xs font-medium text-emerald-400">Present</div>
        <div className="mt-1 text-2xl font-bold text-emerald-400">{presentCount}</div>
      </div>
      <div className="rounded-xl bg-red-500/5 p-3 border border-red-500/20">
        <div className="text-xs font-medium text-red-400">Absent</div>
        <div className="mt-1 text-2xl font-bold text-red-400">{absentCount}</div>
      </div>
      <div className="rounded-xl bg-amber-500/5 p-3 border border-amber-500/20">
        <div className="text-xs font-medium text-amber-400">Late</div>
        <div className="mt-1 text-2xl font-bold text-amber-400">{lateCount}</div>
      </div>
      <div className="rounded-xl bg-blue-500/5 p-3 border border-blue-500/20">
        <div className="text-xs font-medium text-blue-400">Excused</div>
        <div className="mt-1 text-2xl font-bold text-blue-400">{excusedCount}</div>
      </div>
      <div className="rounded-xl bg-indigo-500/5 p-3 border border-indigo-500/20">
        <div className="text-xs font-medium text-indigo-400">Attendance Rate</div>
        <div className="mt-1 text-2xl font-bold text-indigo-400">{computedPercentage}%</div>
      </div>
    </div>
  );
}

/* ─────────────────── Grade Badge ─────────────────── */

export interface GradeBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  grade: string;
}

export const GradeBadge = React.forwardRef<HTMLSpanElement, GradeBadgeProps>(
  ({ grade, className, ...props }, ref) => {
    const isHigh = grade.startsWith("A");
    const isMedium = grade.startsWith("B");
    const isLow = grade.startsWith("C") || grade.startsWith("D");
    const isFail = grade.startsWith("F");

    const colorClass = isHigh
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      : isMedium
        ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
        : isLow
          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
          : isFail
            ? "bg-red-500/10 text-red-400 border-red-500/20"
            : "bg-slate-500/10 text-slate-300 border-slate-500/20";

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-bold px-2 py-0.5 rounded-md text-xs border tracking-wider",
          colorClass,
          className
        )}
        {...props}
      >
        {grade}
      </span>
    );
  }
);
GradeBadge.displayName = "GradeBadge";

/* ─────────────────── Gradebook Stat Card ─────────────────── */

export interface GradebookStatCardProps {
  totalStudents: number;
  marksEnteredCount: number;
  averagePercentage: number;
  highestPercentage: number;
  lowestPercentage: number;
  passCount: number;
  className?: string;
}

export function GradebookStatCard({
  totalStudents,
  marksEnteredCount,
  averagePercentage,
  highestPercentage,
  lowestPercentage,
  passCount,
  className,
}: GradebookStatCardProps) {
  const passRate =
    marksEnteredCount > 0 ? Math.round((passCount / marksEnteredCount) * 100) : 0;

  return (
    <div
      className={cn(
        "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 rounded-2xl border border-white/5 bg-[#0f141f] p-4 text-center",
        className
      )}
    >
      <div className="rounded-xl bg-slate-900/60 p-3 border border-white/5">
        <div className="text-xs font-medium text-slate-400">Enrolled</div>
        <div className="mt-1 text-2xl font-bold text-white">{totalStudents}</div>
      </div>
      <div className="rounded-xl bg-blue-500/5 p-3 border border-blue-500/20">
        <div className="text-xs font-medium text-blue-400">Entered</div>
        <div className="mt-1 text-2xl font-bold text-blue-400">
          {marksEnteredCount} / {totalStudents}
        </div>
      </div>
      <div className="rounded-xl bg-indigo-500/5 p-3 border border-indigo-500/20">
        <div className="text-xs font-medium text-indigo-400">Average</div>
        <div className="mt-1 text-2xl font-bold text-indigo-400">
          {marksEnteredCount > 0 ? `${averagePercentage}%` : "—"}
        </div>
      </div>
      <div className="rounded-xl bg-emerald-500/5 p-3 border border-emerald-500/20">
        <div className="text-xs font-medium text-emerald-400">Highest</div>
        <div className="mt-1 text-2xl font-bold text-emerald-400">
          {marksEnteredCount > 0 ? `${highestPercentage}%` : "—"}
        </div>
      </div>
      <div className="rounded-xl bg-amber-500/5 p-3 border border-amber-500/20">
        <div className="text-xs font-medium text-amber-400">Lowest</div>
        <div className="mt-1 text-2xl font-bold text-amber-400">
          {marksEnteredCount > 0 ? `${lowestPercentage}%` : "—"}
        </div>
      </div>
      <div className="rounded-xl bg-purple-500/5 p-3 border border-purple-500/20">
        <div className="text-xs font-medium text-purple-400">Pass Rate</div>
        <div className="mt-1 text-2xl font-bold text-purple-400">
          {marksEnteredCount > 0 ? `${passRate}%` : "—"}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── Announcement Priority Badge ─────────────────── */

export type AnnouncementPriority = "normal" | "important" | "urgent";

export interface AnnouncementPriorityBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  priority: AnnouncementPriority | string;
}

const priorityStyles: Record<string, string> = {
  normal: "bg-slate-500/10 text-slate-300 border-slate-500/20",
  important: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  urgent: "bg-red-500/10 text-red-400 border-red-500/20 animate-pulse",
};

export const AnnouncementPriorityBadge = React.forwardRef<HTMLSpanElement, AnnouncementPriorityBadgeProps>(
  ({ priority, className, ...props }, ref) => {
    const key = String(priority).toLowerCase();
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
          priorityStyles[key] || priorityStyles.normal,
          className
        )}
        {...props}
      >
        {key}
      </span>
    );
  }
);
AnnouncementPriorityBadge.displayName = "AnnouncementPriorityBadge";

/* ─────────────────── Announcement Status Badge ─────────────────── */

export type AnnouncementStatusType = "draft" | "published" | "scheduled" | "archived";

export interface AnnouncementStatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: AnnouncementStatusType | string;
}

const announcementStatusStyles: Record<string, string> = {
  draft: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  published: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  scheduled: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  archived: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

export const AnnouncementStatusBadge = React.forwardRef<HTMLSpanElement, AnnouncementStatusBadgeProps>(
  ({ status, className, ...props }, ref) => {
    const key = String(status).toLowerCase();
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
          announcementStatusStyles[key] || announcementStatusStyles.draft,
          className
        )}
        {...props}
      >
        {key}
      </span>
    );
  }
);
AnnouncementStatusBadge.displayName = "AnnouncementStatusBadge";

/* ─────────────────── Delivery Status Badge ─────────────────── */

export type DeliveryStatusType = "pending" | "queued" | "sent" | "delivered" | "failed";

export interface DeliveryStatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: DeliveryStatusType | string;
}

const deliveryStatusStyles: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  queued: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  sent: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  delivered: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  failed: "bg-red-500/10 text-red-400 border-red-500/20",
};

export const DeliveryStatusBadge = React.forwardRef<HTMLSpanElement, DeliveryStatusBadgeProps>(
  ({ status, className, ...props }, ref) => {
    const key = String(status).toLowerCase();
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
          deliveryStatusStyles[key] || deliveryStatusStyles.pending,
          className
        )}
        {...props}
      >
        {key}
      </span>
    );
  }
);
DeliveryStatusBadge.displayName = "DeliveryStatusBadge";

/* ─────────────────── Audience Type Badge ─────────────────── */

export interface AudienceTypeBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  type: string;
}

const audienceLabels: Record<string, string> = {
  organization: "Whole School",
  all_students: "All Students",
  all_guardians: "All Guardians",
  all_teachers: "All Teachers",
  all_staff: "All Staff",
  class: "Class",
  section: "Section",
  selected_students: "Selected Students",
  selected_guardians: "Selected Guardians",
  selected_staff: "Selected Staff",
  selected_users: "Selected Users",
};

export const AudienceTypeBadge = React.forwardRef<HTMLSpanElement, AudienceTypeBadgeProps>(
  ({ type, className, ...props }, ref) => {
    const label = audienceLabels[type] || type;
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-md border border-white/10 bg-slate-800/80 px-2 py-0.5 text-xs font-medium text-slate-300",
          className
        )}
        {...props}
      >
        {label}
      </span>
    );
  }
);
AudienceTypeBadge.displayName = "AudienceTypeBadge";

/* ─────────────────── Communication Stat Card ─────────────────── */

export interface CommunicationStatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
  variant?: "default" | "emerald" | "amber" | "blue" | "red" | "purple";
  className?: string;
}

const statCardVariants: Record<string, { iconBg: string; textCol: string }> = {
  default: { iconBg: "bg-slate-800 text-slate-300", textCol: "text-white" },
  emerald: { iconBg: "bg-emerald-500/10 text-emerald-400", textCol: "text-emerald-400" },
  amber: { iconBg: "bg-amber-500/10 text-amber-400", textCol: "text-amber-400" },
  blue: { iconBg: "bg-blue-500/10 text-blue-400", textCol: "text-blue-400" },
  red: { iconBg: "bg-red-500/10 text-red-400", textCol: "text-red-400" },
  purple: { iconBg: "bg-purple-500/10 text-purple-400", textCol: "text-purple-400" },
};

export function CommunicationStatCard({
  icon,
  label,
  value,
  subtext,
  variant = "default",
  className,
}: CommunicationStatCardProps) {
  const styles = statCardVariants[variant] || statCardVariants.default;
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/5 bg-[#0f141f] p-5 flex items-center justify-between gap-4 transition-all duration-200 hover:border-white/10",
        className
      )}
    >
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
        <p className={cn("text-2xl font-bold tracking-tight", styles.textCol)}>{value}</p>
        {subtext && <p className="text-xs text-slate-500">{subtext}</p>}
      </div>
      <div className={cn("size-12 rounded-xl flex items-center justify-center shrink-0", styles.iconBg)}>
        {icon}
      </div>
    </div>
  );
}

/* ─────────────────── Result Status Badge ─────────────────── */

export interface ResultStatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: "passed" | "failed" | "review" | string;
}

const resultStatusStyles: Record<string, string> = {
  passed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  failed: "bg-red-500/10 text-red-400 border-red-500/20",
  review: "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

export const ResultStatusBadge = React.forwardRef<HTMLSpanElement, ResultStatusBadgeProps>(
  ({ status, className, ...props }, ref) => {
    const key = String(status).toLowerCase();
    const isPassed = key === "passed" || key === "pass";
    const isFailed = key === "failed" || key === "fail";
    const mapped = isPassed ? "passed" : isFailed ? "failed" : "review";
    const label = isPassed ? "Passed" : isFailed ? "Failed" : "Review";

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
          resultStatusStyles[mapped] || resultStatusStyles.review,
          className
        )}
        {...props}
      >
        {label}
      </span>
    );
  }
);
ResultStatusBadge.displayName = "ResultStatusBadge";

/* ─────────────────── Invoice Status Badge ─────────────────── */

export interface InvoiceStatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: "paid" | "partially_paid" | "issued" | "overdue" | "draft" | "voided" | "cancelled" | string;
}

const invoiceStatusStyles: Record<string, string> = {
  paid: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  partially_paid: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  issued: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  overdue: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  draft: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  voided: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  cancelled: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

export const InvoiceStatusBadge = React.forwardRef<HTMLSpanElement, InvoiceStatusBadgeProps>(
  ({ status, className, ...props }, ref) => {
    const key = String(status).toLowerCase();
    const formatted = key.replace(/_/g, " ");

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
          invoiceStatusStyles[key] || invoiceStatusStyles.draft,
          className
        )}
        {...props}
      >
        {formatted}
      </span>
    );
  }
);
InvoiceStatusBadge.displayName = "InvoiceStatusBadge";

/* ─────────────────── Expense Status Badge ─────────────────── */

export interface ExpenseStatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: "draft" | "submitted" | "approved" | "rejected" | "paid" | "cancelled" | string;
}

const expenseStatusStyles: Record<string, string> = {
  draft: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  submitted: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  approved: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  rejected: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  paid: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  cancelled: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

export const ExpenseStatusBadge = React.forwardRef<HTMLSpanElement, ExpenseStatusBadgeProps>(
  ({ status, className, ...props }, ref) => {
    const key = String(status).toLowerCase();
    const formatted = key.replace(/_/g, " ");

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
          expenseStatusStyles[key] || expenseStatusStyles.draft,
          className
        )}
        {...props}
      >
        {formatted}
      </span>
    );
  }
);
ExpenseStatusBadge.displayName = "ExpenseStatusBadge";

/* ─────────────────── Reconciliation Status Badge ─────────────────── */

export interface ReconciliationStatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: "unreconciled" | "verified" | "reconciled" | "disputed" | string;
}

const reconciliationStatusStyles: Record<string, string> = {
  unreconciled: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  verified: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  reconciled: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  disputed: "bg-rose-500/10 text-rose-400 border-rose-500/20",
};

export const ReconciliationStatusBadge = React.forwardRef<HTMLSpanElement, ReconciliationStatusBadgeProps>(
  ({ status, className, ...props }, ref) => {
    const key = String(status).toLowerCase();
    const formatted = key.replace(/_/g, " ");

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
          reconciliationStatusStyles[key] || reconciliationStatusStyles.unreconciled,
          className
        )}
        {...props}
      >
        {formatted}
      </span>
    );
  }
);
ReconciliationStatusBadge.displayName = "ReconciliationStatusBadge";

/* ─────────────────── Portal Child Selector Card ─────────────────── */

export interface PortalChildSelectorCardProps {
  student: {
    id: string;
    displayName: string;
    admissionNumber: string;
    gradeName?: string;
    sectionName?: string;
    status: string;
    photoUrl?: string;
  };
  isSelected: boolean;
  onSelect: () => void;
  className?: string;
}

export function PortalChildSelectorCard({
  student,
  isSelected,
  onSelect,
  className,
}: PortalChildSelectorCardProps) {
  const classText = [student.gradeName, student.sectionName].filter(Boolean).join(" - ") || "Enrolled";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200 cursor-pointer min-w-[200px]",
        isSelected
          ? "border-red-500/50 bg-red-500/10 shadow-sm shadow-red-500/10"
          : "border-white/5 bg-[#0f141f] hover:border-white/20 hover:bg-slate-900/40",
        className
      )}
    >
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg font-bold text-sm",
          isSelected ? "bg-red-500 text-white" : "bg-slate-800 text-slate-300 border border-white/5"
        )}
      >
        {student.displayName.charAt(0) || "S"}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">{student.displayName}</p>
        <p className="truncate text-xs text-slate-400">{classText}</p>
        <p className="truncate text-[10px] text-slate-500">#{student.admissionNumber}</p>
      </div>
      <span
        className={cn(
          "size-2 rounded-full shrink-0",
          student.status === "active" ? "bg-emerald-400" : "bg-slate-500"
        )}
      />
    </button>
  );
}

/* ─────────────────── Payment Method Badge ─────────────────── */

export type FeePaymentMethodType = "cash" | "bank_transfer" | "card" | "online" | "cheque" | "other";

export interface PaymentMethodBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  method: FeePaymentMethodType | string;
}

const paymentMethodStyles: Record<string, string> = {
  cash: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  bank_transfer: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  card: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  online: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  cheque: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  other: "bg-slate-500/10 text-slate-300 border-slate-500/20",
};

const paymentMethodLabels: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  card: "Card",
  online: "Online",
  cheque: "Cheque",
  other: "Other",
};

export const PaymentMethodBadge = React.forwardRef<HTMLSpanElement, PaymentMethodBadgeProps>(
  ({ method, className, ...props }, ref) => {
    const key = String(method).toLowerCase();
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
          paymentMethodStyles[key] || paymentMethodStyles.other,
          className
        )}
        {...props}
      >
        {paymentMethodLabels[key] || method}
      </span>
    );
  }
);
PaymentMethodBadge.displayName = "PaymentMethodBadge";

/* ─────────────────── Payment Status Badge ─────────────────── */

export interface PaymentStatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: "recorded" | "voided" | string;
}

const paymentStatusStyles: Record<string, string> = {
  recorded: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  voided: "bg-red-500/10 text-red-400 border-red-500/20 line-through",
};

export const PaymentStatusBadge = React.forwardRef<HTMLSpanElement, PaymentStatusBadgeProps>(
  ({ status, className, ...props }, ref) => {
    const key = String(status).toLowerCase();
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
          paymentStatusStyles[key] || "bg-slate-500/10 text-slate-400 border-slate-500/20",
          className
        )}
        {...props}
      >
        {key}
      </span>
    );
  }
);
PaymentStatusBadge.displayName = "PaymentStatusBadge";

/* ─────────────────── Communication Channel Badge ─────────────────── */

export interface CommunicationChannelBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  channel: "in_app" | "email" | "sms" | string;
}

const channelStyles: Record<string, { bg: string; text: string; border: string; label: string }> = {
  in_app: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20", label: "In-App" },
  email: { bg: "bg-sky-500/10", text: "text-sky-400", border: "border-sky-500/20", label: "Email" },
  sms: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", label: "SMS" },
};

export const CommunicationChannelBadge = React.forwardRef<HTMLSpanElement, CommunicationChannelBadgeProps>(
  ({ channel, className, ...props }, ref) => {
    const key = String(channel).toLowerCase();
    const style = channelStyles[key] || {
      bg: "bg-slate-500/10",
      text: "text-slate-400",
      border: "border-slate-500/20",
      label: channel,
    };

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase",
          style.bg,
          style.text,
          style.border,
          className
        )}
        {...props}
      >
        <span className={cn("size-1.5 rounded-full", style.bg.replace("/10", "/80"))} />
        {style.label}
      </span>
    );
  }
);
CommunicationChannelBadge.displayName = "CommunicationChannelBadge";

/* ─────────────────── Notification Category Badge ─────────────────── */

export interface NotificationCategoryBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  category: string;
}

const notificationCategoryStyles: Record<string, { bg: string; text: string; border: string; label: string }> = {
  attendance: { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/20", label: "Attendance" },
  fee: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20", label: "Fees & Finance" },
  finance: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20", label: "Fees & Finance" },
  exam: { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20", label: "Examinations" },
  examination: { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20", label: "Examinations" },
  announcement: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20", label: "Announcement" },
  academic: { bg: "bg-indigo-500/10", text: "text-indigo-400", border: "border-indigo-500/20", label: "Academics" },
  direct_message: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20", label: "Direct Message" },
  message: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20", label: "Message" },
  general: { bg: "bg-slate-500/10", text: "text-slate-300", border: "border-slate-500/20", label: "General" },
};

export const NotificationCategoryBadge = React.forwardRef<HTMLSpanElement, NotificationCategoryBadgeProps>(
  ({ category, className, ...props }, ref) => {
    const raw = String(category).toLowerCase();
    const key = Object.keys(notificationCategoryStyles).find((k) => raw.includes(k)) || "general";
    const style = notificationCategoryStyles[key];

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase",
          style.bg,
          style.text,
          style.border,
          className
        )}
        {...props}
      >
        {style.label}
      </span>
    );
  }
);
NotificationCategoryBadge.displayName = "NotificationCategoryBadge";

/* ─────────────────── Admission Status Badge ─────────────────── */

export type AdmissionApplicationStatusType =
  | "draft"
  | "submitted"
  | "under_review"
  | "assessment"
  | "approved"
  | "rejected"
  | "waitlisted"
  | "enrolled"
  | "withdrawn";

export interface AdmissionStatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: AdmissionApplicationStatusType | string;
}

const admissionStatusStyles: Record<string, { bg: string; text: string; border: string; label: string }> = {
  draft: { bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/20", label: "Draft" },
  submitted: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20", label: "Submitted" },
  under_review: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20", label: "Under Review" },
  assessment: { bg: "bg-indigo-500/10", text: "text-indigo-400", border: "border-indigo-500/20", label: "Assessment" },
  approved: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", label: "Approved" },
  rejected: { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/20", label: "Rejected" },
  waitlisted: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20", label: "Waitlisted" },
  enrolled: { bg: "bg-teal-500/10", text: "text-teal-300", border: "border-teal-500/20", label: "Enrolled" },
  withdrawn: { bg: "bg-zinc-500/10", text: "text-zinc-400", border: "border-zinc-500/20", label: "Withdrawn" },
};

export const AdmissionStatusBadge = React.forwardRef<HTMLSpanElement, AdmissionStatusBadgeProps>(
  ({ status, className, ...props }, ref) => {
    const key = String(status).toLowerCase();
    const style = admissionStatusStyles[key] || {
      bg: "bg-slate-500/10",
      text: "text-slate-400",
      border: "border-slate-500/20",
      label: status,
    };

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
          style.bg,
          style.text,
          style.border,
          className
        )}
        {...props}
      >
        <span className={cn("size-1.5 rounded-full", style.bg.replace("/10", "/80"))} />
        {style.label}
      </span>
    );
  }
);
AdmissionStatusBadge.displayName = "AdmissionStatusBadge";

/* ─────────────────── Enquiry Status Badge ─────────────────── */

export type AdmissionEnquiryStatusType =
  | "new"
  | "contacted"
  | "visit_scheduled"
  | "under_review"
  | "converted"
  | "closed";

export interface EnquiryStatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: AdmissionEnquiryStatusType | string;
}

const enquiryStatusStyles: Record<string, { bg: string; text: string; border: string; label: string }> = {
  new: { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20", label: "New Enquiry" },
  contacted: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20", label: "Contacted" },
  visit_scheduled: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20", label: "Visit Scheduled" },
  under_review: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20", label: "Under Review" },
  converted: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", label: "Converted" },
  closed: { bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/20", label: "Closed" },
};

export const EnquiryStatusBadge = React.forwardRef<HTMLSpanElement, EnquiryStatusBadgeProps>(
  ({ status, className, ...props }, ref) => {
    const key = String(status).toLowerCase();
    const style = enquiryStatusStyles[key] || {
      bg: "bg-slate-500/10",
      text: "text-slate-400",
      border: "border-slate-500/20",
      label: status,
    };

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
          style.bg,
          style.text,
          style.border,
          className
        )}
        {...props}
      >
        <span className={cn("size-1.5 rounded-full", style.bg.replace("/10", "/80"))} />
        {style.label}
      </span>
    );
  }
);
EnquiryStatusBadge.displayName = "EnquiryStatusBadge";

/* ─────────────────── Assessment Outcome Badge ─────────────────── */

export type AssessmentOutcomeType =
  | "passed"
  | "failed"
  | "conditional_pass"
  | "exempted"
  | "pending";

export interface AssessmentOutcomeBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  outcome: AssessmentOutcomeType | string;
}

const assessmentOutcomeStyles: Record<string, { bg: string; text: string; border: string; label: string }> = {
  passed: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", label: "Passed" },
  failed: { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/20", label: "Failed" },
  conditional_pass: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20", label: "Conditional Pass" },
  exempted: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20", label: "Exempted" },
  pending: { bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/20", label: "Pending" },
};

export const AssessmentOutcomeBadge = React.forwardRef<HTMLSpanElement, AssessmentOutcomeBadgeProps>(
  ({ outcome, className, ...props }, ref) => {
    const key = String(outcome).toLowerCase();
    const style = assessmentOutcomeStyles[key] || {
      bg: "bg-slate-500/10",
      text: "text-slate-400",
      border: "border-slate-500/20",
      label: outcome,
    };

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
          style.bg,
          style.text,
          style.border,
          className
        )}
        {...props}
      >
        <span className={cn("size-1.5 rounded-full", style.bg.replace("/10", "/80"))} />
        {style.label}
      </span>
    );
  }
);
AssessmentOutcomeBadge.displayName = "AssessmentOutcomeBadge";


