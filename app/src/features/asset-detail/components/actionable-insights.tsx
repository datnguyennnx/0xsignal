import { Card, CardHeader, CardTitle, CardDescription } from "@/ui/card";
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
  const signalStyles = {
    STRONG_BUY: "border-green-500/30 bg-green-500/5",
    BUY: "border-green-500/20 bg-green-500/5",
    HOLD: "border-gray-500/20 bg-gray-500/5",
    SELL: "border-red-500/20 bg-red-500/5",
    STRONG_SELL: "border-red-500/30 bg-red-500/5",
  };

  const signalColor = {
    STRONG_BUY: "text-green-500",
    BUY: "text-green-500",
    HOLD: "text-gray-400",
    SELL: "text-red-500",
    STRONG_SELL: "text-red-500",
  };

  const riskLevel = riskScore > 70 ? "High Risk" : riskScore > 40 ? "Moderate Risk" : "Low Risk";

  const riskColor =
    riskScore > 70 ? "text-red-500" : riskScore > 40 ? "text-orange-500" : "text-green-500";

  return (
    <Card className={cn(signalStyles[signal], className)}>
      <CardHeader>
        <CardTitle className="text-sm font-medium mb-3">Trading Action</CardTitle>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className={cn("text-lg font-semibold", signalColor[signal])}>{signal}</span>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Confidence</div>
              <div className="text-sm font-medium tabular-nums">{confidence}%</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Strategy</div>
              <div className="font-medium">{strategy}</div>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Regime</div>
              <div className="font-medium">{regime.replace(/_/g, " ")}</div>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Risk Level</div>
              <div className={cn("font-medium", riskColor)}>{riskLevel}</div>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Risk Score</div>
              <div className="font-medium tabular-nums">{riskScore}/100</div>
            </div>
          </div>

          <div className="pt-3 border-t border-border/50">
            <CardDescription className="text-xs leading-relaxed">
              {actionableInsight}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
