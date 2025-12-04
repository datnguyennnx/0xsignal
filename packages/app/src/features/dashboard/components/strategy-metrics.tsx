import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/core/utils/cn";

interface StrategyMetricsProps {
  metrics: Record<string, number>;
  className?: string;
}

const formatMetricName = (key: string): string =>
  key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .trim()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const formatMetricValue = (value: number): string => {
  if (Math.abs(value) < 0.01) return value.toFixed(4);
  if (Math.abs(value) < 1) return value.toFixed(3);
  if (Math.abs(value) < 100) return value.toFixed(2);
  return value.toFixed(0);
};

export function StrategyMetrics({ metrics, className }: StrategyMetricsProps) {
  const entries = Object.entries(metrics);
  if (entries.length === 0) return null;

  return (
    <Card className={cn("py-0 shadow-none", className)}>
      <CardHeader className="px-4 py-3 border-b border-border/50">
        <CardTitle className="text-sm">Strategy Metrics</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {entries.map(([key, value]) => (
            <div key={key}>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                {formatMetricName(key)}
              </div>
              <div className="text-sm font-medium tabular-nums">{formatMetricValue(value)}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
