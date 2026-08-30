import * as React from "react";

import { cn } from "@haza-aios/ui/lib/utils";

type AuthCardProps = React.HTMLAttributes<HTMLDivElement> & {
  eyebrow?: string;
  title: string;
  description?: string;
};

function AuthCard({ eyebrow, title, description, className, children, ...props }: AuthCardProps) {
  return (
    <section
      className={cn(
        "w-full max-w-md rounded-2xl border border-white/10 bg-slate-950/80 p-6 text-white shadow-2xl shadow-black/30 backdrop-blur-xl",
        className,
      )}
      {...props}
    >
      <div className="mb-6 space-y-2">
        {eyebrow ? (
          <p className="text-xs font-semibold tracking-[0.24em] text-red-300 uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {description ? <p className="text-sm leading-6 text-slate-300">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export { AuthCard };
