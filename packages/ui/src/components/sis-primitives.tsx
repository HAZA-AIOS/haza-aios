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
