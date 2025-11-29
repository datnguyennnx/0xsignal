/**
 * Unified Signal Card - Minimalist quant-focused design
 * Combines signal analysis + trade setup into single high-density component
 * Mobile: 2 cols, Desktop: 4 cols
 * Follows minimalism philosophy: eliminate noise, prioritize signal density
 */

import { cn } from "@/core/utils/cn";
import { formatPrice } from "@/core/utils/formatters";
import type { AssetAnalysis } from "@0xsignal/shared";

interface UnifiedSignalCardProps {
  analysis: AssetAnalysis;
  className?: string;
}

export function UnifiedSignalCard({ analysis, className }: UnifiedSignalCardProps) {
  const { overallSignal, confidence, riskScore, entrySignal, strategyResult } = analysis;
  const entry = entrySignal;
  const regime = strategyResult.regime;

  // Direction and colors
  const direction = entry.direction;
  const isLong = direction === "LONG";
  const isShort = direction === "SHORT";
  const hasDirection = direction !== "NEUTRAL";

  const signalColor = overallSignal.includes("BUY")
    ? "text-gain"
    : overallSignal.includes("SELL")
      ? "text-loss"
      : "";

  const directionColor = isLong ? "text-gain" : isShort ? "text-loss" : "";

  // Calculate percentages
  const targetPct = hasDirection
    ? isLong
      ? ((entry.targetPrice - entry.entryPrice) / entry.entryPrice) * 100
      : ((entry.entryPrice - entry.targetPrice) / entry.entryPrice) * 100
    : 0;

  const stopPct = hasDirection
    ? isLong
      ? ((entry.entryPrice - entry.stopLoss) / entry.entryPrice) * 100
      : ((entry.stopLoss - entry.entryPrice) / entry.entryPrice) * 100
    : 0;

  // Indicators
  const { rsi, macd, adx, atr } = entry.indicatorSummary;

  return (
    <div className={cn("rounded border border-border/50", className)}>
      {/* Primary Row: Signal + Direction + Confidence + Risk */}
      <div className="grid grid-cols-2 sm:grid-cols-4">
        <Cell
          label="SIGNAL"
          value={overallSignal.replace("_", " ")}
          context={regime.replace("_", " ").toLowerCase()}
          valueClass={cn("text-base sm:text-lg", signalColor)}
        />
        <Cell
          label="DIRECTION"
          value={direction}
          context={entry.strength.replace("_", " ").toLowerCase()}
          valueClass={cn("text-base sm:text-lg", directionColor)}
        />
        <Cell label="CONFIDENCE" value={`${confidence}%`} valueClass="text-base sm:text-lg" />
        <Cell
          label="RISK"
          value={riskScore}
          context="/ 100"
          valueClass={cn(
            "text-base sm:text-lg",
            riskScore > 70 ? "text-loss" : riskScore > 40 ? "text-warn" : "text-gain"
          )}
        />
      </div>

      {/* Secondary Row: Entry Levels (only if has direction) */}
      {hasDirection && (
        <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-border/50">
          <Cell label="ENTRY" value={`$${formatPrice(entry.entryPrice)}`} />
          <Cell
            label="TARGET"
            value={`$${formatPrice(entry.targetPrice)}`}
            context={`+${targetPct.toFixed(1)}%`}
            valueClass={directionColor}
            contextClass={directionColor}
          />
          <Cell
            label="STOP"
            value={`$${formatPrice(entry.stopLoss)}`}
            context={`-${stopPct.toFixed(1)}%`}
            valueClass={isLong ? "text-loss" : "text-gain"}
            contextClass={isLong ? "text-loss" : "text-gain"}
          />
          <Cell
            label="R:R"
            value={`${entry.riskRewardRatio}:1`}
            context={`${entry.suggestedLeverage}x lev`}
          />
        </div>
      )}

      {/* Indicators Row - Inline compact */}
      <div className="px-3 py-2 sm:px-4 border-t border-border/50">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <Indicator
            label="RSI"
            value={rsi.value}
            signal={
              rsi.signal === "OVERSOLD" ? "gain" : rsi.signal === "OVERBOUGHT" ? "loss" : undefined
            }
          />
          <Indicator
            label="MACD"
            value={macd.trend.charAt(0) + macd.trend.slice(1).toLowerCase()}
            signal={
              macd.trend === "BULLISH" ? "gain" : macd.trend === "BEARISH" ? "loss" : undefined
            }
          />
          <Indicator label="ADX" value={adx.value} />
          <Indicator label="ATR" value={`${atr.value}%`} />
        </div>
      </div>
    </div>
  );
}

function Cell({
  label,
  value,
  context,
  valueClass,
  contextClass,
}: {
  label: string;
  value: string | number;
  context?: string;
  valueClass?: string;
  contextClass?: string;
}) {
  return (
    <div className="px-3 py-2 sm:px-4 sm:py-3 border-r border-b border-border/50 last:border-r-0 even:border-r-0 sm:even:border-r sm:nth-[4n]:border-r-0">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={cn("font-medium tabular-nums", valueClass)}>{value}</div>
      {context && (
        <div className={cn("text-[10px] tabular-nums", contextClass || "text-muted-foreground")}>
          {context}
        </div>
      )}
    </div>
  );
}

function Indicator({
  label,
  value,
  signal,
}: {
  label: string;
  value: string | number;
  signal?: "gain" | "loss";
}) {
  return (
    <span className="text-muted-foreground">
      {label}{" "}
      <span
        className={cn(
          "font-medium",
          signal === "gain" ? "text-gain" : signal === "loss" ? "text-loss" : "text-foreground"
        )}
      >
        {value}
      </span>
    </span>
  );
}
