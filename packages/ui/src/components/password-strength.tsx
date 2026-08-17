import { cn } from "@haza-aios/ui/lib/utils";

type PasswordStrengthProps = {
  value: string;
  className?: string;
};

function getPasswordStrength(value: string) {
  const checks = [
    value.length >= 8,
    /[A-Z]/.test(value),
    /[a-z]/.test(value),
    /\d/.test(value),
    /[^A-Za-z0-9]/.test(value),
  ];
  const score = checks.filter(Boolean).length;

  if (!value) {
    return { label: "Password strength", score: 0, color: "bg-slate-700" };
  }

  if (score <= 2) {
    return { label: "Weak password", score, color: "bg-red-400" };
  }

  if (score <= 4) {
    return { label: "Good password", score, color: "bg-amber-300" };
  }

  return { label: "Strong password", score, color: "bg-emerald-300" };
}

function PasswordStrength({ value, className }: PasswordStrengthProps) {
  const strength = getPasswordStrength(value);
  const activeBars = Math.max(1, strength.score);

  return (
    <div className={cn("space-y-2", className)} aria-live="polite">
      <div className="grid grid-cols-5 gap-1" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, index) => (
          <span
            key={index}
            className={cn(
              "h-1.5 rounded-full",
              index < activeBars && value ? strength.color : "bg-white/10",
            )}
          />
        ))}
      </div>
      <p className="text-xs text-slate-400">{strength.label}</p>
    </div>
  );
}

export { PasswordStrength, getPasswordStrength };
