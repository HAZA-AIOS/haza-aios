import * as React from "react";

import { cn } from "@haza-aios/ui/lib/utils";

import { Card } from "./card";

function GlassCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Card
      className={cn(
        "text-foreground border-white/10 bg-white/5 shadow-[var(--shadow-glow)] backdrop-blur-xl",
        className,
      )}
      {...props}
    />
  );
}

export { GlassCard };
