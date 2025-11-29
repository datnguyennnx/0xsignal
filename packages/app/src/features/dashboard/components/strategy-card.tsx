/**
 * Strategy Card - Pure component with Card styling
 */

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { RegimeBadge } from "./regime-badge";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
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
      ? "text-gain"
      : signal === "STRONG_SELL" || signal === "SELL"
        ? "text-loss"
        : "text-muted-foreground";

  return (
    <Card className={cn("py-0 shadow-none", className)}>
      <CardHeader className="px-4 py-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Active Strategy</CardTitle>
          <RegimeBadge regime={regime} />
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-semibold">{strategy}</span>
          <Badge
            variant="outline"
            className={cn(
              "text-xs",
              signal.includes("BUY")
                ? "text-gain border-gain/30"
                : signal.includes("SELL")
                  ? "text-loss border-loss/30"
                  : ""
            )}
          >
            {signal.replace("_", " ")}
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          <Progress value={confidence} className="flex-1 h-1.5" />
          <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">
            {confidence}%
          </span>
        </div>

        <CardDescription className="text-xs leading-relaxed">{reasoning}</CardDescription>
      </CardContent>
    </Card>
  );
}
