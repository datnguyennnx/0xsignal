/**
 * Trade Setup Card - Minimalist design
 * Consistent 2-col mobile → 3-col desktop
 * Semantic colors only for values, no colored borders
 */

import type { EntrySignal } from "@0xsignal/shared";
import { cn } from "@/core/utils/cn";
import { formatPrice } from "@/core/utils/formatters";

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
    <div className={cn("rounded border border-border/50", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 sm:px-4 sm:py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Trade Setup</span>
          <span className={cn("text-xs font-medium", directionColor)}>{entry.direction}</span>
        </div>
        <span className="text-xs text-muted-foreground">{entry.strength.replace("_", " ")}</span>
      </div>

      {/* Price Levels - 2 col mobile, 3 col desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-3">
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
        <Cell label="R:R" value={`${entry.riskRewardRatio}:1`} />
        <Cell
          label="LEVERAGE"
          value={`${entry.suggestedLeverage}x`}
          context={`max ${entry.maxLeverage}x`}
        />
        <Cell label="CONF" value={`${entry.confidence}%`} />
      </div>

      {/* Indicators - inline */}
      <div className="px-3 py-2 sm:px-4 sm:py-3 border-t border-border/50">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            RSI{" "}
            <span
              className={cn(
                "font-medium",
                rsi.signal === "OVERSOLD"
                  ? "text-gain"
                  : rsi.signal === "OVERBOUGHT"
                    ? "text-loss"
                    : "text-foreground"
              )}
            >
              {rsi.value}
            </span>
          </span>
          <span>
            MACD{" "}
            <span
              className={cn(
                "font-medium",
                macd.trend === "BULLISH"
                  ? "text-gain"
                  : macd.trend === "BEARISH"
                    ? "text-loss"
                    : "text-foreground"
              )}
            >
              {macd.trend}
            </span>
          </span>
          <span>
            ADX <span className="font-medium text-foreground">{adx.value}</span>
          </span>
          <span>
            ATR <span className="font-medium text-foreground">{atr.value}%</span>
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-2 sm:px-4 sm:py-3 border-t border-border/50 text-xs text-muted-foreground">
        <div>Based on 24h snapshot</div>
        {entry.recommendation && <div className="mt-1 line-clamp-2">{entry.recommendation}</div>}
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
  value: string;
  context?: string;
  valueClass?: string;
  contextClass?: string;
}) {
  return (
    <div className="px-3 py-2 sm:px-4 sm:py-3 border-r border-b border-border/50 even:border-r-0 sm:even:border-r sm:nth-3:border-r-0">
      <div className="text-[10px] text-muted-foreground uppercase mb-0.5">{label}</div>
      <div className={cn("text-sm font-medium tabular-nums", valueClass)}>{value}</div>
      {context && (
        <div className={cn("text-[10px] tabular-nums", contextClass || "text-muted-foreground")}>
          {context}
        </div>
      )}
    </div>
  );
}
