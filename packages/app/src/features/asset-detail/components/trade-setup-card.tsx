/**
 * Trade Setup Card - Minimalist design
 * Consistent 2-col mobile → 3-col desktop
 * Uses Card component with softer rounded corners
 */

import type { EntrySignal } from "@0xsignal/shared";
import { cn } from "@/core/utils/cn";
import { formatPrice } from "@/core/utils/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TradeSetupCardProps {
  entry: EntrySignal;
  className?: string;
}

export function TradeSetupCard({ entry, className }: TradeSetupCardProps) {
  const isLong = entry.direction === "LONG";
  const directionColor = isLong ? "text-gain" : "text-loss";

  const targetPct = isLong
    ? ((entry.targetPrice - entry.entryPrice) / entry.entryPrice) * 100
    : ((entry.entryPrice - entry.targetPrice) / entry.entryPrice) * 100;
  const stopPct = isLong
    ? ((entry.entryPrice - entry.stopLoss) / entry.entryPrice) * 100
    : ((entry.stopLoss - entry.entryPrice) / entry.entryPrice) * 100;

  const { rsi, macd, adx, atr } = entry.indicatorSummary;

  return (
    <Card className={cn("py-0 shadow-none overflow-hidden", className)}>
      {/* Header */}
      <CardHeader className="px-4 py-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm">Trade Setup</CardTitle>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px]",
                directionColor,
                isLong ? "border-gain/30" : "border-loss/30"
              )}
            >
              {entry.direction}
            </Badge>
          </div>
          <Badge variant="secondary" className="text-[10px]">
            {entry.strength.replace("_", " ")}
          </Badge>
        </div>
      </CardHeader>

      {/* Price Levels - 2 col mobile, 3 col desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-3">
        <MetricCell label="Entry" value={`$${formatPrice(entry.entryPrice)}`} />
        <MetricCell
          label="Target"
          value={`$${formatPrice(entry.targetPrice)}`}
          context={`+${targetPct.toFixed(1)}%`}
          valueClass={directionColor}
          contextClass={directionColor}
        />
        <MetricCell
          label="Stop"
          value={`$${formatPrice(entry.stopLoss)}`}
          context={`-${stopPct.toFixed(1)}%`}
          valueClass={isLong ? "text-loss" : "text-gain"}
          contextClass={isLong ? "text-loss" : "text-gain"}
        />
        <MetricCell label="R:R" value={`${entry.riskRewardRatio}:1`} />
        <MetricCell
          label="Volatility"
          value={atr.volatility.replace("_", " ")}
          context={`ATR ${atr.value.toFixed(1)}%`}
        />
        <MetricCell label="Strength" value={`${entry.confidence}%`} />
      </div>

      {/* Indicators */}
      <CardContent className="px-4 py-3 border-t border-border/50">
        <div className="flex flex-wrap items-center gap-3">
          <IndicatorBadge
            label="RSI"
            value={rsi.value}
            signal={
              rsi.signal === "OVERSOLD" ? "gain" : rsi.signal === "OVERBOUGHT" ? "loss" : undefined
            }
          />
          <IndicatorBadge
            label="MACD"
            value={macd.trend}
            signal={
              macd.trend === "BULLISH" ? "gain" : macd.trend === "BEARISH" ? "loss" : undefined
            }
          />
          <IndicatorBadge label="ADX" value={adx.value} />
          <IndicatorBadge label="ATR" value={`${atr.value}%`} />
        </div>
      </CardContent>

      {/* Footer with recommendation */}
      <CardContent className="px-4 py-3 border-t border-border/50 space-y-2">
        {entry.recommendation && (
          <p className="text-xs text-muted-foreground leading-relaxed">{entry.recommendation}</p>
        )}
      </CardContent>
    </Card>
  );
}

function MetricCell({
  label,
  value,
  context,
  valueClass,
  contextClass,
}: {
  label: string;
  value: string;
  context?: string;
  valueClass?: string;
  contextClass?: string;
}) {
  return (
    <div className="px-4 py-3 border-r border-b border-border/50 even:border-r-0 sm:even:border-r sm:[&:nth-child(3n)]:border-r-0">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
      <div className={cn("text-sm font-semibold tabular-nums", valueClass)}>{value}</div>
      {context && (
        <div
          className={cn("text-[10px] tabular-nums mt-0.5", contextClass || "text-muted-foreground")}
        >
          {context}
        </div>
      )}
    </div>
  );
}

function IndicatorBadge({
  label,
  value,
  signal,
}: {
  label: string;
  value: string | number;
  signal?: "gain" | "loss";
}) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "text-xs font-normal gap-1.5",
        signal === "gain" && "text-gain",
        signal === "loss" && "text-loss"
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </Badge>
  );
}
