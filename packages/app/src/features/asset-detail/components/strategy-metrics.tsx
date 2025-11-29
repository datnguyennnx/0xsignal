/**
 * Strategy Metrics - Minimalist design
 * Uses Card component with softer rounded corners
 */

import { cn } from "@/core/utils/cn";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StrategyMetricsProps {
  metrics: Record<string, number>;
  className?: string;
}

export function StrategyMetrics({ metrics, className }: StrategyMetricsProps) {
  if (!metrics || Object.keys(metrics).length === 0) return null;

  return (
    <Card className={cn("py-0 shadow-none", className)}>
      <CardHeader className="px-4 py-3 border-b border-border/50">
        <CardTitle className="text-sm">Strategy Metrics</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Object.entries(metrics).map(([key, value]) => (
            <div key={key}>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                {key.replace(/_/g, " ")}
              </div>
              <div className="text-sm font-medium tabular-nums">
                {typeof value === "number" ? value.toFixed(2) : value}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
