import * as React from "react"
import { cn } from "@haza-aios/ui/lib/utils"

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status: "active" | "inactive" | "pending" | "archived" | "draft" | string;
}

const StatusBadge = React.forwardRef<HTMLDivElement, StatusBadgeProps>(
  ({ className, status, ...props }, ref) => {
    const s = status.toLowerCase();
    
    let colorClass = "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    
    if (s === "active" || s === "published" || s === "current") {
      colorClass = "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    } else if (s === "inactive" || s === "archived") {
      colorClass = "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    } else if (s === "pending" || s === "draft") {
      colorClass = "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    } else if (s === "suspended" || s === "error") {
      colorClass = "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    }

    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          colorClass,
          className
        )}
        {...props}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </div>
    )
  }
)
StatusBadge.displayName = "StatusBadge"

export { StatusBadge }
