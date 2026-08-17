import * as React from "react";

import { cn } from "@haza-aios/ui/lib/utils";

type FormFieldProps = React.HTMLAttributes<HTMLDivElement> & {
  id: string;
  label: string;
  description?: string;
  error?: string;
};

function FormField({
  id,
  label,
  description,
  error,
  className,
  children,
  ...props
}: FormFieldProps) {
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={cn("space-y-2", className)} {...props}>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-100">
        {label}
      </label>
      {React.isValidElement(children)
        ? React.cloneElement(children, {
            id,
            "aria-describedby": [descriptionId, errorId].filter(Boolean).join(" ") || undefined,
            "aria-invalid": error ? true : undefined,
          } as React.HTMLAttributes<HTMLElement>)
        : children}
      {description ? (
        <p id={descriptionId} className="text-xs leading-5 text-slate-400">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs font-medium text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export { FormField };
