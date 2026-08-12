import React from "react";
import { cn } from "../lib/utils";

// 1. DashboardCard: Container with premium glassmorphism dark background and border/hover effects
interface DashboardCardProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: boolean;
}

const DashboardCard = React.forwardRef<HTMLDivElement, DashboardCardProps>(
  ({ className, glow = true, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-md transition-all duration-300",
          glow && "hover:border-red-500/20 hover:shadow-[0_0_25px_rgba(239,68,68,0.05)]",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
DashboardCard.displayName = "DashboardCard";

// 2. StatCard: Premium card showing key stats, change percentages, and custom SVG Sparklines
interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  sparklineData?: number[];
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ className, title, value, change, changeType = "neutral", sparklineData = [10, 15, 8, 12, 18, 14, 20], ...props }, ref) => {
    const isPositive = changeType === "positive";
    const isNegative = changeType === "negative";

    // Generate points for the sparkline path
    const width = 120;
    const height = 30;
    const maxVal = Math.max(...sparklineData);
    const minVal = Math.min(...sparklineData);
    const range = maxVal - minVal || 1;
    const points = sparklineData
      .map((val, index) => {
        const x = (index / (sparklineData.length - 1)) * width;
        const y = height - ((val - minVal) / range) * height;
        return `${x},${y}`;
      })
      .join(" ");

    return (
      <DashboardCard
        ref={ref}
        className={cn("flex flex-col justify-between gap-4 min-h-[140px]", className)}
        {...props}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">{title}</p>
            <h3 className="mt-1 text-2xl font-bold text-white tracking-tight">{value}</h3>
          </div>
          {change && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-semibold",
                isPositive && "bg-emerald-500/10 text-emerald-400",
                isNegative && "bg-red-500/10 text-red-400",
                changeType === "neutral" && "bg-slate-500/10 text-slate-400"
              )}
            >
              {change}
            </span>
          )}
        </div>

        {/* Sparkline Visualisation */}
        <div className="flex h-8 items-end justify-between">
          <svg className="w-full h-full max-w-[120px]" viewBox={`0 0 ${width} ${height}`}>
            <polyline
              fill="none"
              stroke={isPositive ? "#10b981" : isNegative ? "#ef4444" : "#64748b"}
              strokeWidth="1.5"
              points={points}
            />
          </svg>
          <span className="text-[10px] text-slate-500">Last 24h</span>
        </div>
      </DashboardCard>
    );
  }
);
StatCard.displayName = "StatCard";

// 3. AIAssistantWidget: Floating premium prompt box styled exactly like the bottom-center chatbot box
interface AIAssistantWidgetProps extends React.HTMLAttributes<HTMLDivElement> {
  onSend?: (query: string) => void;
  placeholder?: string;
}

const AIAssistantWidget = React.forwardRef<HTMLDivElement, AIAssistantWidgetProps>(
  ({ className, onSend, placeholder = "Ask me anything...", ...props }, ref) => {
    const [query, setQuery] = React.useState("");

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim() && onSend) {
        onSend(query);
        setQuery("");
      }
    };

    return (
      <div
        ref={ref}
        className={cn(
          "w-full max-w-xl rounded-full border border-white/10 bg-slate-900/90 px-4 py-2.5 shadow-2xl backdrop-blur-lg transition-all focus-within:border-red-500/30",
          className
        )}
        {...props}
      >
        <form onSubmit={handleSubmit} className="flex items-center gap-3">
          {/* AI Status Pulsing Glow */}
          <div className="relative flex h-2 w-2 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
          </div>

          <input
            type="text"
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-400 focus:outline-none"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <button
            type="submit"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white transition-transform hover:scale-105 active:scale-95"
            aria-label="Send query"
          >
            <svg
              className="h-3.5 w-3.5 fill-current"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </form>
      </div>
    );
  }
);
AIAssistantWidget.displayName = "AIAssistantWidget";

export { DashboardCard, StatCard, AIAssistantWidget };
