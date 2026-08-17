import { Badge } from "./badge";

export function RunStatusBadge({ status, className }: { status: string; className?: string }) {
  let variant: "default" | "secondary" | "destructive" | "outline" = "default";
  let label = status.toUpperCase();

  switch (status) {
    case "completed":
      variant = "default";
      break;
    case "failed":
      variant = "destructive";
      break;
    case "running":
    case "waiting":
      variant = "secondary";
      break;
    case "cancelled":
    case "queued":
      variant = "outline";
      break;
  }

  return (
    <Badge variant={variant as any} className={className}>
      {label}
    </Badge>
  );
}

export function ExecutionTimeline({ steps }: { steps: { label: string; status: "pending" | "active" | "completed" | "failed" }[] }) {
  return (
    <div className="space-y-4">
      {steps.map((step, index) => (
        <div key={index} className="flex items-center gap-3">
          <div className={`size-4 rounded-full flex items-center justify-center border-2 ${
            step.status === "completed" ? "bg-green-500 border-green-500" :
            step.status === "active" ? "bg-blue-500 border-blue-500 animate-pulse" :
            step.status === "failed" ? "bg-red-500 border-red-500" :
            "bg-transparent border-slate-600"
          }`}>
            {step.status === "completed" && <svg className="size-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>}
          </div>
          <span className={`text-sm font-medium ${step.status === "active" ? "text-white" : "text-slate-400"}`}>
            {step.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export function RunOutputViewer({ output, error }: { output?: any; error?: string }) {
  if (error) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm whitespace-pre-wrap font-mono">
        {error}
      </div>
    );
  }

  if (!output) {
    return <div className="p-4 text-sm text-slate-500 italic">No output generated.</div>;
  }

  const isObject = typeof output === "object" && output !== null;
  const displayString = isObject ? JSON.stringify(output, null, 2) : String(output);

  return (
    <div className="p-4 bg-slate-900 border border-white/10 rounded-xl overflow-x-auto">
      <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap">{displayString}</pre>
    </div>
  );
}
