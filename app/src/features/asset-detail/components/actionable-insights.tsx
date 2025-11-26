import { cn } from "@/core/utils/cn";

interface ActionableInsightsProps {
  signal: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
  confidence: number;
  riskScore: number;
  strategy: string;
  regime: string;
  actionableInsight: string;
  className?: string;
}

export function ActionableInsights({
  signal,
  confidence,
  riskScore,
  strategy,
  regime,
  actionableInsight,
  className,
}: ActionableInsightsProps) {
  const signalColor = signal.includes("BUY")
    ? "text-gain"
    : signal.includes("SELL")
      ? "text-loss"
      : "text-muted-foreground";

  const riskColor = riskScore > 70 ? "text-loss" : riskScore > 40 ? "text-warn" : "text-gain";

  return (
    <div className={cn("rounded border border-border/50 p-4", className)}>
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/50">
        <div className="flex items-center gap-3">
          <span className={cn("text-sm font-medium", signalColor)}>{signal}</span>
          <span className="text-xs text-muted-foreground">{regime.replace(/_/g, " ")}</span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-muted-foreground">Conf </span>
            <span className="font-medium tabular-nums">{confidence}%</span>
          </div>
          <div>
            <span className="text-muted-foreground">Risk </span>
            <span className={cn("font-medium tabular-nums", riskColor)}>{riskScore}</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Strategy:</span>
          <span className="font-medium">{strategy}</span>
        </div>

        <p className="text-sm text-foreground leading-relaxed">{actionableInsight}</p>
      </div>
    </div>
  );
}
