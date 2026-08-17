import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "@haza-aios/ui/components/input";
import { cn } from "@haza-aios/ui/lib/utils";

type PasswordFieldProps = Omit<React.ComponentPropsWithoutRef<typeof Input>, "type">;

const PasswordField = React.forwardRef<HTMLInputElement, PasswordFieldProps>(
  ({ className, ...props }, ref) => {
    const [isVisible, setIsVisible] = React.useState(false);
    const Icon = isVisible ? EyeOff : Eye;

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={isVisible ? "text" : "password"}
          className={cn("pr-11", className)}
          {...props}
        />
        <button
          type="button"
          className="absolute top-1/2 right-2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:outline-none"
          onClick={() => setIsVisible((current) => !current)}
          aria-label={isVisible ? "Hide password" : "Show password"}
        >
          <Icon className="size-4" aria-hidden="true" />
        </button>
      </div>
    );
  },
);

PasswordField.displayName = "PasswordField";

export { PasswordField };
