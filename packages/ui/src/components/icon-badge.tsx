import * as React from "react";

import { cn } from "@haza-aios/ui/lib/utils";

interface IconBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
}

function IconBadge({ className, size = "md", children, ...props }: IconBadgeProps) {
  return (
    <div
      className={cn(
        "text-primary flex items-center justify-center rounded-xl border border-white/10 bg-white/5 shadow-[var(--shadow-soft)]",
        size === "sm" && "h-9 w-9",
        size === "md" && "h-12 w-12",
        size === "lg" && "h-14 w-14",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export { IconBadge };
