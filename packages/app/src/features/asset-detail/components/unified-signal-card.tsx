import { cn } from "@/core";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AssetAnalysis } from "@0xsignal/shared";

interface UnifiedSignalCardProps {
  analysis: AssetAnalysis;
  className?: string;
}

export function UnifiedSignalCard({ analysis, className }: UnifiedSignalCardProps) {
  const { overallSignal, confidence, riskScore, entrySignal, strategyResult } = analysis;
  const { entryPrice, targetPrice, stopLoss, direction, strength, indicatorSummary } = entrySignal;

  // Derived State
  const isLong = direction === "LONG";
  const isShort = direction === "SHORT";
  const hasDirection = direction !== "NEUTRAL";

  // Semantic Coloring
  const signalColor = overallSignal.includes("BUY")
    ? "text-gain"
    : overallSignal.includes("SELL")
      ? "text-loss"
      : "text-muted-foreground";

  const directionColor = isLong ? "text-gain" : isShort ? "text-loss" : "text-muted-foreground";

  // Percentage Calculations
  const calculatePct = (start: number, end: number) => {
    if (!start || start === 0) return 0;
    return ((end - start) / start) * 100;
  };

  const targetPct = hasDirection ? Math.abs(calculatePct(entryPrice, targetPrice)) : 0;

  const stopPct = hasDirection ? Math.abs(calculatePct(entryPrice, stopLoss)) : 0;

  return (
    <Card className={cn("w-full overflow-hidden bg-background border-border", className)}>
      <div className="p-4 space-y-4">
        {/* SECTION 1: SIGNAL OVERVIEW */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-4 gap-x-6">
          <DataPoint
            label="Signal"
            subLabel={strategyResult.regime.replace(/_/g, " ").toLowerCase()}
          >
            <span className={cn("font-semibold tracking-tight", signalColor)}>
              {overallSignal.replace(/_/g, " ")}
            </span>
          </DataPoint>

          <DataPoint label="Direction" subLabel={strength.toLowerCase()}>
            <span className={cn("font-semibold", directionColor)}>{direction}</span>
          </DataPoint>

          <DataPoint label="Confidence">
            <span className="font-semibold tabular-nums">{confidence}%</span>
          </DataPoint>

          <DataPoint label="Risk">
            <span
              className={cn(
                "font-semibold tabular-nums",
                riskScore > 75 ? "text-loss" : riskScore > 40 ? "text-warn" : "text-gain"
              )}
            >
              {riskScore}
              <span className="text-sm text-muted-foreground font-normal ml-0.5">/100</span>
            </span>
          </DataPoint>
        </div>

        {/* SECTION 2: EXECUTION LEVELS */}
        {hasDirection && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-4 gap-x-6">
              <DataPoint label="Entry">
                <span className="font-mono font-medium tabular-nums text-foreground">
                  {formatCurrency(entryPrice)}
                </span>
              </DataPoint>

              <DataPoint
                label="Target"
                subLabel={`+${targetPct.toFixed(1)}%`}
                subLabelColor="text-gain"
              >
                <span className={cn("font-mono font-medium tabular-nums", directionColor)}>
                  {formatCurrency(targetPrice)}
                </span>
              </DataPoint>

              <DataPoint
                label="Stop"
                subLabel={`-${stopPct.toFixed(1)}%`}
                subLabelColor="text-loss"
              >
                <span
                  className={cn(
                    "font-mono font-medium tabular-nums",
                    isLong ? "text-loss" : "text-gain"
                  )}
                >
                  {formatCurrency(stopLoss)}
                </span>
              </DataPoint>

              <DataPoint label="R:R" subLabel={`${entrySignal.suggestedLeverage}x leverage`}>
                <span className="font-medium tabular-nums">{entrySignal.riskRewardRatio}:1</span>
              </DataPoint>
            </div>
          </>
        )}

        {/* SECTION 3: TECHNICAL CONTEXT */}
        <div className="flex flex-wrap items-center gap-2">
          <IndicatorBadge
            label="RSI"
            value={indicatorSummary.rsi.value.toFixed(0)}
            state={getIndicatorState(indicatorSummary.rsi.value, "RSI")}
          />
          <IndicatorBadge
            label="MACD"
            value={formatTrend(indicatorSummary.macd.trend)}
            state={
              indicatorSummary.macd.trend === "BULLISH"
                ? "gain"
                : indicatorSummary.macd.trend === "BEARISH"
                  ? "loss"
                  : "neutral"
            }
          />
          <IndicatorBadge
            label="ADX"
            value={indicatorSummary.adx.value.toFixed(0)}
            state="neutral"
          />
          <IndicatorBadge label="ATR" value={`${indicatorSummary.atr.value}%`} state="neutral" />
        </div>
      </div>
    </Card>
  );
}

// --- Sub-components for Structural Consistency ---

function DataPoint({
  label,
  subLabel,
  subLabelColor,
  children,
}: {
  label: string;
  subLabel?: string;
  subLabelColor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] sm:text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
        {label}
      </span>
      <div className="text-base sm:text-lg leading-none mb-1">{children}</div>
      {subLabel && (
        <span className={cn("text-xs leading-none", subLabelColor || "text-muted-foreground")}>
          {subLabel}
        </span>
      )}
    </div>
  );
}

function IndicatorBadge({
  label,
  value,
  state,
}: {
  label: string;
  value: string | number;
  state: "gain" | "loss" | "neutral";
}) {
  const stateColor =
    state === "gain"
      ? "text-gain bg-gain/10 border-gain/20"
      : state === "loss"
        ? "text-loss bg-loss/10 border-loss/20"
        : "text-foreground bg-secondary/50 border-transparent";

  return (
    <Badge variant="outline" className={cn("h-6 px-2.5 font-normal border gap-1.5", stateColor)}>
      <span className="text-muted-foreground text-[10px] uppercase font-medium">{label}</span>
      <span className="text-xs font-semibold tabular-nums">{value}</span>
    </Badge>
  );
}

// --- Utilities (Local for context, move to @/lib/utils in production) ---

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatTrend(trend: string): string {
  if (!trend) return "Neutral";
  return trend.charAt(0) + trend.slice(1).toLowerCase();
}

function getIndicatorState(value: number, type: "RSI"): "gain" | "loss" | "neutral" {
  if (type === "RSI") {
    if (value < 30) return "gain"; // Oversold
    if (value > 70) return "loss"; // Overbought
  }
  return "neutral";
}
