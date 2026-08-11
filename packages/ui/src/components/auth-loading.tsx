import { Loader2 } from "lucide-react";

import { cn } from "@haza-aios/ui/lib/utils";

type AuthLoadingProps = {
  label?: string;
  className?: string;
};

function AuthLoading({ label = "Checking secure session", className }: AuthLoadingProps) {
  return (
    <div className={cn("flex items-center justify-center gap-3 text-sm text-slate-300", className)}>
      <Loader2 className="size-4 animate-spin text-red-300" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export { AuthLoading };
