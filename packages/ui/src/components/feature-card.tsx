import * as React from "react";

import { cn } from "@haza-aios/ui/lib/utils";

import { Card } from "./card";

interface FeatureCardProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description: string;
}

function FeatureCard({ className, icon, title, description, ...props }: FeatureCardProps) {
  return (
    <Card
      className={cn(
        "border-border/80 overflow-hidden bg-[linear-gradient(var(--gradient-panel),var(--gradient-panel))] p-6 shadow-[var(--shadow-card)]",
        className,
      )}
      {...props}
    >
      <div className="bg-primary/8 text-primary mb-4 flex h-12 w-12 items-center justify-center rounded-xl shadow-[var(--shadow-soft)]">
        {icon}
      </div>
      <h3 className="text-foreground text-xl font-semibold tracking-[-0.02em]">{title}</h3>
      <p className="text-muted-foreground mt-3 text-sm leading-6">{description}</p>
    </Card>
  );
}

export { FeatureCard };
