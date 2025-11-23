import { Card, CardHeader, CardTitle } from "@/ui/card";
import { cn } from "@/core/utils/cn";

interface StrategyMetricsProps {
  metrics: Record<string, number>;
  className?: string;
}

export function StrategyMetrics({ metrics, className }: StrategyMetricsProps) {
  const formatMetricName = (key: string): string => {
    return key
      .replace(/([A-Z])/g, " $1")
      .replace(/_/g, " ")
      .trim()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const formatMetricValue = (value: number): string => {
    if (Math.abs(value) < 0.01) return value.toFixed(4);
    if (Math.abs(value) < 1) return value.toFixed(3);
    if (Math.abs(value) < 100) return value.toFixed(2);
    return value.toFixed(0);
  };

  const entries = Object.entries(metrics);
  if (entries.length === 0) return null;

  return (
    <Card className={cn("border-border/50", className)}>
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-sm font-medium mb-4">Strategy Metrics</CardTitle>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          {entries.map(([key, value]) => (
            <div key={key} className="space-y-1">
              <div className="text-xs text-muted-foreground">{formatMetricName(key)}</div>
              <div className="font-medium tabular-nums">{formatMetricValue(value)}</div>
            </div>
          ))}
        </div>
      </CardHeader>
    </Card>
  );
}
