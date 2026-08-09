import * as React from "react";

import { cn } from "@haza-aios/ui/lib/utils";

const Checkbox = React.forwardRef<HTMLInputElement, React.ComponentPropsWithoutRef<"input">>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type="checkbox"
        className={cn(
          "border-border bg-input/60 text-primary focus-visible:ring-ring/20 h-4 w-4 rounded border shadow-none transition-colors focus-visible:ring-4 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);

Checkbox.displayName = "Checkbox";

export { Checkbox };
