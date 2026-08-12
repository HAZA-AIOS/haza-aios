import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@haza-aios/ui/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-200 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "!bg-[#d90429] !text-white hover:!bg-[#ef233c] active:scale-[0.98] shadow-md font-bold",
        primary:
          "!bg-[#d90429] !text-white hover:!bg-[#ef233c] active:scale-[0.98] shadow-md font-bold",
        secondary:
          "!bg-[#e5a93c] !text-slate-950 hover:!bg-[#f3b647] active:scale-[0.98] shadow-md font-bold",
        outline:
          "border border-white/20 !bg-white/5 !text-white hover:!bg-white/10 hover:border-white/30 font-medium",
        ghost: "bg-transparent text-foreground hover:bg-card/80",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        gradient: "!bg-[#d90429] !text-white hover:!bg-[#ef233c] shadow-md font-bold",
      },
      size: {
        default: "h-11 px-6 py-2.5",
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
  style,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  const customStyle: React.CSSProperties = { ...style };
  if (variant === "primary" || variant === "default") {
    if (!customStyle.backgroundColor) customStyle.backgroundColor = "#d90429";
    if (!customStyle.color) customStyle.color = "#ffffff";
  } else if (variant === "secondary") {
    if (!customStyle.backgroundColor) customStyle.backgroundColor = "#e5a93c";
    if (!customStyle.color) customStyle.color = "#0b0f19";
  }

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      style={customStyle}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
