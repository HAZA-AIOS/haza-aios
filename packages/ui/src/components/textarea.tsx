import * as React from "react";

import { cn } from "@haza-aios/ui/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentPropsWithoutRef<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "border-border bg-input/60 text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/20 flex min-h-[120px] w-full rounded-xl border px-3 py-2 text-sm shadow-none transition-colors focus-visible:ring-4 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);

Textarea.displayName = "Textarea";

export { Textarea };
