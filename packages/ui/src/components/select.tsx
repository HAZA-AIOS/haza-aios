import * as React from "react";

import { cn } from "@haza-aios/ui/lib/utils";

const Select = React.forwardRef<HTMLSelectElement, React.ComponentPropsWithoutRef<"select">>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "border-border bg-input/60 text-foreground focus-visible:border-ring focus-visible:ring-ring/20 flex h-11 w-full appearance-none rounded-xl border px-3 py-2 text-sm shadow-none transition-colors focus-visible:ring-4 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    );
  },
);

Select.displayName = "Select";

export { Select };
