import { Card, CardHeader, CardTitle, CardDescription } from "@/ui/card";
import { RegimeBadge } from "./regime-badge";
import { cn } from "@/core/utils/cn";

interface StrategyCardProps {
  strategy: string;
  regime: string;
  signal: string;
  confidence: number;
  reasoning: string;
  className?: string;
}

export function StrategyCard({
  strategy,
  regime,
  signal,
  confidence,
  reasoning,
  className,
}: StrategyCardProps) {
  const signalColor =
    signal === "STRONG_BUY" || signal === "BUY"
      ? "text-green-500"
      : signal === "STRONG_SELL" || signal === "SELL"
        ? "text-red-500"
        : "text-gray-400";

  return (
    <Card className={cn("border-border/50", className)}>
      <CardHeader>
        <div className="flex items-center justify-between mb-2">
          <CardTitle className="text-sm font-medium">Active Strategy</CardTitle>
          <RegimeBadge regime={regime} />
        </div>

        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-semibold">{strategy}</span>
            <span className={cn("text-sm font-medium", signalColor)}>{signal}</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${confidence}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">{confidence}%</span>
          </div>

          <CardDescription className="text-xs leading-relaxed">{reasoning}</CardDescription>
        </div>
      </CardHeader>
    </Card>
  );
}
