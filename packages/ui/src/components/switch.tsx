import * as React from "react";

import { cn } from "@haza-aios/ui/lib/utils";

function Switch({ className, ...props }: React.ComponentPropsWithoutRef<"button">) {
  return (
    <button
      type="button"
      role="switch"
      className={cn(
        "bg-muted focus-visible:ring-ring/20 relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent transition-colors focus-visible:ring-4 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "bg-background pointer-events-none block h-5 w-5 rounded-full shadow-sm ring-0 transition-transform",
          props["aria-checked"] === true ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  );
}

export { Switch };
