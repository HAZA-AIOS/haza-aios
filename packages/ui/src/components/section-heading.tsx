import * as React from "react";

import { cn } from "@haza-aios/ui/lib/utils";

interface SectionHeadingProps extends React.HTMLAttributes<HTMLDivElement> {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
}

function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  className,
  ...props
}: SectionHeadingProps) {
  return (
    <div
      className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}
      {...props}
    >
      {eyebrow ? (
        <p className="text-label text-primary border-primary/30 bg-primary/10 mb-4 inline-flex rounded-full border px-3 py-1.5">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-h2 text-foreground">{title}</h2>
      {description ? <p className="text-body text-muted-foreground mt-4">{description}</p> : null}
    </div>
  );
}

export { SectionHeading };
