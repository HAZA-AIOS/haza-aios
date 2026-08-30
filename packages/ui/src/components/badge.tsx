import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@haza-aios/ui/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium tracking-[0.08em] uppercase transition-colors",
  {
    variants: {
      variant: {
        default: "border-border bg-card text-foreground",
        primary: "border-primary/30 bg-primary/12 text-primary",
        secondary: "border-secondary/30 bg-secondary/12 text-secondary",
        accent: "border-accent/30 bg-accent/12 text-accent",
        success: "border-success/30 bg-success/12 text-success",
        warning: "border-warning/30 bg-warning/12 text-warning",
        destructive: "border-destructive/30 bg-destructive/12 text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentPropsWithoutRef<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
