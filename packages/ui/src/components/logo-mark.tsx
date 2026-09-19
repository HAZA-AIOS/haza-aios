import * as React from "react";

import { cn } from "@haza-aios/ui/lib/utils";

interface LogoMarkProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
}

function LogoMark({ className, size = "md", ...props }: LogoMarkProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center",
        size === "sm" && "h-8 w-8 text-xs",
        size === "md" && "h-10 w-10 text-sm",
        size === "lg" && "h-12 w-12 text-base",
        className,
      )}
      {...props}
    >
      <img
        src="/branding/haza-logo.png"
        alt="HAZA"
        width={550}
        height={618}
        className="h-full w-full object-contain"
        draggable={false}
      />
    </div>
  );
}

export { LogoMark };
