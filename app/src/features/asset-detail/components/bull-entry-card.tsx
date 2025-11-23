import { Card, CardHeader, CardTitle, CardDescription } from "@/ui/card";
import { cn } from "@/core/utils/cn";

interface BullEntryCardProps {
  isOptimalEntry: boolean;
  strength: "WEAK" | "MODERATE" | "STRONG" | "VERY_STRONG";
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  confidence: number;
  className?: string;
}

export function BullEntryCard({
  isOptimalEntry,
  strength,
  entryPrice,
  targetPrice,
  stopLoss,
  confidence,
  className,
}: BullEntryCardProps) {
  if (!isOptimalEntry) return null;

  const strengthStyles = {
    WEAK: "border-gray-500/30",
    MODERATE: "border-blue-500/30",
    STRONG: "border-green-500/30",
    VERY_STRONG: "border-green-500/50",
  };

  const riskReward = ((targetPrice - entryPrice) / (entryPrice - stopLoss)).toFixed(2);
  const upside = (((targetPrice - entryPrice) / entryPrice) * 100).toFixed(1);
  const downside = (((entryPrice - stopLoss) / entryPrice) * 100).toFixed(1);

  return (
    <Card className={cn("border-green-500/20 bg-green-500/5", strengthStyles[strength], className)}>
      <CardHeader className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <CardTitle className="text-sm font-medium">Bull Entry Setup</CardTitle>
          <span className="text-xs text-muted-foreground">{strength.replace(/_/g, " ")}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Entry</div>
            <div className="font-medium tabular-nums">${entryPrice.toLocaleString()}</div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Target</div>
            <div className="font-medium tabular-nums text-green-500">
              ${targetPrice.toLocaleString()}
            </div>
            <div className="text-xs text-green-500">+{upside}%</div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Stop</div>
            <div className="font-medium tabular-nums text-red-500">
              ${stopLoss.toLocaleString()}
            </div>
            <div className="text-xs text-red-500">-{downside}%</div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-border/50">
          <CardDescription className="text-xs">Risk/Reward: {riskReward}:1</CardDescription>
          <div className="flex items-center gap-2">
            <div className="h-1 w-16 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${confidence}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">{confidence}%</span>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
