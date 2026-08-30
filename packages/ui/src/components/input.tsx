import * as React from "react";

import { cn } from "@haza-aios/ui/lib/utils";

const inputClassName =
  "flex h-11 w-full rounded-xl border border-border bg-input/60 px-3 py-2 text-sm text-foreground shadow-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50";

const Input = React.forwardRef<HTMLInputElement, React.ComponentPropsWithoutRef<"input">>(
  ({ className, type, ...props }, ref) => {
    return <input ref={ref} type={type} className={cn(inputClassName, className)} {...props} />;
  },
);

Input.displayName = "Input";

export { Input };
