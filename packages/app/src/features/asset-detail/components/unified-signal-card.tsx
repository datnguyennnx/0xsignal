import { cn } from "@/core";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AssetAnalysis } from "@0xsignal/shared";

interface UnifiedSignalCardProps {
  analysis: AssetAnalysis;
  className?: string;
}

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const calculatePct = (start: number, end: number) => {
  if (!start || start === 0) return 0;
  return ((end - start) / start) * 100;
};

const getSignalColor = (signal: string) =>
  signal.includes("BUY") ? "text-gain" : signal.includes("SELL") ? "text-loss" : "text-foreground";

export function UnifiedSignalCard({ analysis, className }: UnifiedSignalCardProps) {
  const { overallSignal, confidence, riskScore, entrySignal, strategyResult } = analysis;
  const { entryPrice, targetPrice, stopLoss, direction, riskRewardRatio } = entrySignal;
  const hasDirection = direction !== "NEUTRAL";
  const targetPct = hasDirection ? Math.abs(calculatePct(entryPrice, targetPrice)) : 0;
  const stopPct = hasDirection ? Math.abs(calculatePct(entryPrice, stopLoss)) : 0;

  return (
    <Card className={cn("w-full bg-card border-border/40 shadow-none p-5", className)}>
      <div className="flex flex-col space-y-6">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              {strategyResult.regime.replace(/_/g, " ")}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">CONF {confidence}%</span>
          </div>
          <div className="flex items-baseline gap-3">
            <h2
              className={cn(
                "text-xl font-bold tracking-tight leading-none",
                getSignalColor(overallSignal)
              )}
            >
              {overallSignal.replace(/_/g, " ")}
            </h2>
            <Badge
              variant="secondary"
              className="h-5 px-1.5 text-[9px] font-mono uppercase tracking-wide text-muted-foreground bg-secondary/50 hover:bg-secondary/50 border-0 rounded-sm"
            >
              {direction}
            </Badge>
          </div>
        </div>

        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-mono font-medium tracking-tighter text-foreground tabular-nums">
              {formatCurrency(entryPrice)}
            </span>
            <span className="text-xs text-muted-foreground font-medium">USD</span>
          </div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">
            Suggested Entry Zone
          </p>
        </div>

        {hasDirection && (
          <div className="grid grid-cols-3 gap-4 pt-2 lg:flex lg:flex-col lg:gap-0 lg:space-y-3 lg:pt-0">
            <TickerItem
              label="Target"
              value={formatCurrency(targetPrice)}
              subValue={`+${targetPct.toFixed(2)}%`}
              highlight="gain"
            />
            <TickerItem
              label="Stop"
              value={formatCurrency(stopLoss)}
              subValue={`-${stopPct.toFixed(2)}%`}
              highlight="loss"
            />
            <TickerItem
              label="Risk / Reward"
              value={`${riskScore}/100`}
              subValue={`1:${riskRewardRatio}`}
              highlight="neutral"
            />
          </div>
        )}
      </div>
    </Card>
  );
}

function TickerItem({
  label,
  value,
  subValue,
  highlight,
}: {
  label: string;
  value: string;
  subValue: string;
  highlight: "gain" | "loss" | "neutral";
}) {
  const subColor =
    highlight === "gain"
      ? "text-gain"
      : highlight === "loss"
        ? "text-loss"
        : "text-muted-foreground";

  return (
    <div className="flex flex-col space-y-0.5 lg:flex-row lg:justify-between lg:items-center lg:space-y-0 lg:border-b lg:border-border/40 lg:pb-2 lg:last:border-0 lg:last:pb-0">
      <span className="text-[9px] uppercase tracking-widest text-muted-foreground/70">{label}</span>
      <div className="flex flex-col lg:flex-row lg:items-baseline lg:gap-2">
        <span className="text-sm font-mono font-medium text-foreground tabular-nums leading-tight">
          {value}
        </span>
        <span
          className={cn("text-[10px] font-mono tabular-nums leading-none lg:text-right", subColor)}
        >
          {subValue}
        </span>
      </div>
    </div>
  );
}
