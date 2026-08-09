import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@haza-aios/ui/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[var(--shadow-soft)]",
        primary:
          "bg-haza-primary text-primary-foreground hover:brightness-110 shadow-[var(--shadow-glow)]",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-[var(--shadow-soft)]",
        outline: "border border-border bg-transparent text-foreground hover:bg-card/70",
        ghost: "bg-transparent text-foreground hover:bg-card/80",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        gradient:
          "bg-haza-primary text-primary-foreground shadow-[var(--shadow-glow)] hover:brightness-110",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        xs: "h-8 gap-1 rounded-lg px-2.5 text-xs",
        sm: "h-9 gap-1.5 rounded-lg px-3.5",
        lg: "h-12 rounded-xl px-6 text-base",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "primary",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
