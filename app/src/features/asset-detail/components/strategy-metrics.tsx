import { cn } from "@/core/utils/cn";

interface StrategyMetricsProps {
  metrics: Record<string, number>;
  className?: string;
}

export function StrategyMetrics({ metrics, className }: StrategyMetricsProps) {
  if (!metrics || Object.keys(metrics).length === 0) return null;

  return (
    <div className={cn("rounded border border-border/50 p-4", className)}>
      <div className="text-xs text-muted-foreground mb-3 pb-3 border-b border-border/50">
        Strategy Metrics
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Object.entries(metrics).map(([key, value]) => (
          <div key={key}>
            <div className="text-xs text-muted-foreground mb-1">{key.replace(/_/g, " ")}</div>
            <div className="text-sm font-medium tabular-nums">
              {typeof value === "number" ? value.toFixed(2) : value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
