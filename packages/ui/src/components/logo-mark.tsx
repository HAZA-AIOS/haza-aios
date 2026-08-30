import * as React from "react";

import { cn } from "@haza-aios/ui/lib/utils";

interface LogoMarkProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
}

function LogoMark({ className, size = "md", ...props }: LogoMarkProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-xl bg-[linear-gradient(135deg,#7f7bff,#54d2ff)] font-black text-slate-950 shadow-[var(--shadow-glow)]",
        size === "sm" && "h-8 w-8 text-xs",
        size === "md" && "h-10 w-10 text-sm",
        size === "lg" && "h-12 w-12 text-base",
        className,
      )}
      {...props}
    >
      H
    </div>
  );
}

export { LogoMark };
