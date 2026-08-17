import * as React from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";

import { cn } from "@haza-aios/ui/lib/utils";

type AuthAlertVariant = "error" | "success" | "info";

type AuthAlertProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: AuthAlertVariant;
  title?: string;
};

const variantClassNames: Record<AuthAlertVariant, string> = {
  error: "border-red-400/30 bg-red-500/10 text-red-100",
  success: "border-emerald-400/30 bg-emerald-500/10 text-emerald-100",
  info: "border-cyan-400/30 bg-cyan-500/10 text-cyan-100",
};

const icons = {
  error: AlertCircle,
  success: CheckCircle2,
  info: Info,
};

function AuthAlert({ variant = "info", title, className, children, ...props }: AuthAlertProps) {
  const Icon = icons[variant];

  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "flex gap-3 rounded-xl border p-3 text-sm leading-6",
        variantClassNames[variant],
        className,
      )}
      {...props}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="text-current/85">{children}</div> : null}
      </div>
    </div>
  );
}

export { AuthAlert };
