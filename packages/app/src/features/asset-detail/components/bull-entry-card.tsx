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

  const riskReward = ((targetPrice - entryPrice) / (entryPrice - stopLoss)).toFixed(2);
  const upside = (((targetPrice - entryPrice) / entryPrice) * 100).toFixed(1);
  const downside = (((entryPrice - stopLoss) / entryPrice) * 100).toFixed(1);

  const strengthColor =
    strength === "VERY_STRONG" || strength === "STRONG"
      ? "text-gain"
      : strength === "MODERATE"
        ? "text-warn"
        : "text-muted-foreground";

  return (
    <div className={cn("rounded border border-border/50 p-4", className)}>
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/50">
        <span className="text-xs text-muted-foreground">Entry Setup</span>
        <span className={cn("text-xs font-medium", strengthColor)}>
          {strength.replace(/_/g, " ")}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <div className="text-xs text-muted-foreground mb-1">Entry</div>
          <div className="text-sm font-medium tabular-nums">${entryPrice.toLocaleString()}</div>
        </div>

        <div>
          <div className="text-xs text-muted-foreground mb-1">Target</div>
          <div className="text-sm font-medium tabular-nums text-gain">
            ${targetPrice.toLocaleString()}
          </div>
          <div className="text-xs text-gain">+{upside}%</div>
        </div>

        <div>
          <div className="text-xs text-muted-foreground mb-1">Stop</div>
          <div className="text-sm font-medium tabular-nums text-loss">
            ${stopLoss.toLocaleString()}
          </div>
          <div className="text-xs text-loss">-{downside}%</div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-border/50 text-xs">
        <span className="text-muted-foreground">R:R {riskReward}:1</span>
        <div className="flex items-center gap-2">
          <div className="h-1 w-16 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-gain transition-all" style={{ width: `${confidence}%` }} />
          </div>
          <span className="text-muted-foreground tabular-nums">{confidence}%</span>
        </div>
      </div>
    </div>
  );
}
