import type { AssetAnalysis, AssetContext } from "@0xsignal/shared";
import { cn } from "@/core/utils/cn";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface UnifiedSignalCardProps {
  analysis: AssetAnalysis;
  context?: AssetContext | null;
  className?: string;
}

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const formatCompact = (n: number) => {
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
};

const calculatePct = (start: number, end: number) => {
  if (!start || start === 0) return 0;
  return ((end - start) / start) * 100;
};

const getSignalColor = (signal: string) =>
  signal.includes("BUY") ? "text-gain" : signal.includes("SELL") ? "text-loss" : "text-foreground";

const getRiskLabel = (score: number): string => {
  if (score < 30) return "Low";
  if (score < 50) return "Moderate";
  if (score < 70) return "Elevated";
  return "High";
};

// Humanize regime names for user understanding
const humanizeRegime = (regime: string): string => {
  const map: Record<string, string> = {
    TRENDING_BULL: "Uptrend",
    TRENDING_BEAR: "Downtrend",
    TRENDING: "Trending",
    RANGING: "Sideways",
    VOLATILE: "Volatile",
    HIGH_VOLATILITY: "High Volatility",
    LOW_VOLATILITY: "Low Volatility",
    BULL_MARKET: "Bull Market",
    BEAR_MARKET: "Bear Market",
    SIDEWAYS: "Sideways",
    MEAN_REVERSION: "Mean Reversion",
    ACCUMULATION: "Accumulation",
    DISTRIBUTION: "Distribution",
  };
  return map[regime] || regime.replace(/_/g, " ");
};

export function UnifiedSignalCard({ analysis, context, className }: UnifiedSignalCardProps) {
  const { overallSignal, confidence, riskScore, entrySignal, strategyResult, recommendation } =
    analysis;
  const { entryPrice, targetPrice, stopLoss, direction, riskRewardRatio, indicatorSummary } =
    entrySignal;
  const hasDirection = direction !== "NEUTRAL";
  const targetPct = hasDirection ? Math.abs(calculatePct(entryPrice, targetPrice)) : 0;
  const stopPct = hasDirection ? Math.abs(calculatePct(entryPrice, stopLoss)) : 0;

  const { treasury, derivatives, riskContext } = context || {};
  const hasContext = treasury || derivatives;
  const reasoning = strategyResult?.primarySignal?.reasoning || recommendation;

  return (
    <Card className={cn("w-full bg-card border-border/40 shadow-none p-5", className)}>
      <div className="flex flex-col space-y-5">
        {/* Signal Header */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-medium uppercase tracking-widest text-muted-foreground">
              {humanizeRegime(strategyResult.regime)}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs sm:text-sm font-mono text-muted-foreground cursor-help">
                  Strength {confidence}%
                </span>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-48 text-xs">
                Signal strength based on indicator alignment. Not a probability of profit.
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex items-baseline gap-3">
            <h2
              className={cn(
                "text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight leading-none",
                getSignalColor(overallSignal)
              )}
            >
              {overallSignal.replace(/_/g, " ")}
            </h2>
            <Badge
              variant="secondary"
              className="h-6 sm:h-7 px-2 text-xs font-mono uppercase tracking-wide text-muted-foreground bg-secondary/50 hover:bg-secondary/50 border-0 rounded-sm"
            >
              {direction}
            </Badge>
          </div>
        </div>

        {/* Why This Signal - Reasoning Section */}
        {reasoning && (
          <div className="px-3 py-2.5 bg-secondary/30 rounded-sm border border-border/30">
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{reasoning}</p>
          </div>
        )}

        {/* Entry Price */}
        <div className="min-w-0 overflow-hidden">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-3xl sm:text-4xl lg:text-5xl font-mono font-medium tracking-tighter text-foreground tabular-nums break-all">
              {formatCurrency(entryPrice)}
            </span>
            <span className="text-sm sm:text-base text-muted-foreground font-medium">USD</span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wider mt-1">
            Entry Zone
          </p>
        </div>

        {/* Targets & Risk */}
        {hasDirection && (
          <div className="grid grid-cols-3 gap-4 lg:flex lg:flex-col lg:gap-0 lg:space-y-3">
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
              label="Risk"
              value={`${getRiskLabel(riskContext?.finalRisk ?? riskScore)}`}
              subValue={`${riskContext?.finalRisk ?? riskScore}/100 · R:R 1:${riskRewardRatio}`}
              highlight="neutral"
              tooltip={
                riskContext ? (
                  <div className="max-w-56 text-[10px]">
                    <p className="font-medium mb-1">Risk Level: {riskContext.riskLevel}</p>
                    <p className="text-muted-foreground mb-1">Base Score: {riskScore}</p>
                    <p className="text-muted-foreground border-t border-border/50 pt-1 mt-1">
                      {riskContext.explanation}
                    </p>
                  </div>
                ) : undefined
              }
            />
          </div>
        )}

        {/* Indicator Summary */}
        {indicatorSummary && (
          <div className="pt-3 border-t border-border/30">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
                Indicators
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <IndicatorChip
                label="RSI"
                value={indicatorSummary.rsi.value}
                context={
                  indicatorSummary.rsi.value < 30
                    ? "oversold"
                    : indicatorSummary.rsi.value > 70
                      ? "overbought"
                      : "neutral"
                }
              />
              <IndicatorChip
                label="MACD"
                value={indicatorSummary.macd.trend}
                context={
                  indicatorSummary.macd.trend === "BULLISH"
                    ? "bullish"
                    : indicatorSummary.macd.trend === "BEARISH"
                      ? "bearish"
                      : "neutral"
                }
              />
              <IndicatorChip
                label="ADX"
                value={indicatorSummary.adx.value}
                context={indicatorSummary.adx.value > 25 ? "trending" : "weak"}
              />
              <IndicatorChip label="ATR" value={`${indicatorSummary.atr.value}%`} context="info" />
            </div>
          </div>
        )}

        {/* Context Section */}
        {hasContext && (
          <div className="pt-3 border-t border-border/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
                Market Context
              </span>
            </div>

            <div className="space-y-2">
              {treasury?.hasInstitutionalHoldings && (
                <DataRow
                  label="Treasury"
                  value={`$${formatCompact(treasury.totalHoldingsUsd)}`}
                  subValue={`${treasury.entityCount} entities`}
                  highlight={
                    treasury.accumulationSignal === "buy" ||
                    treasury.accumulationSignal === "strong_buy"
                      ? "gain"
                      : treasury.accumulationSignal === "sell" ||
                          treasury.accumulationSignal === "strong_sell"
                        ? "loss"
                        : "neutral"
                  }
                />
              )}

              {derivatives && (
                <DataRow
                  label="Open Interest"
                  value={`$${formatCompact(derivatives.openInterestUsd)}`}
                  subValue={`${derivatives.oiChange24h >= 0 ? "+" : ""}${derivatives.oiChange24h.toFixed(1)}%`}
                  highlight={
                    derivatives.oiChange24h > 5
                      ? "gain"
                      : derivatives.oiChange24h < -5
                        ? "loss"
                        : "neutral"
                  }
                />
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function IndicatorChip({
  label,
  value,
  context,
}: {
  label: string;
  value: string | number;
  context:
    | "bullish"
    | "bearish"
    | "oversold"
    | "overbought"
    | "trending"
    | "weak"
    | "neutral"
    | "info";
}) {
  const contextColor =
    context === "bullish" || context === "oversold" || context === "trending"
      ? "text-gain"
      : context === "bearish" || context === "overbought"
        ? "text-loss"
        : "text-muted-foreground";

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-secondary/40 rounded-sm">
      <span className="text-[10px] text-muted-foreground uppercase">{label}</span>
      <span className={cn("text-xs font-mono font-medium tabular-nums", contextColor)}>
        {value}
      </span>
    </div>
  );
}

function TickerItem({
  label,
  value,
  subValue,
  highlight,
  tooltip,
}: {
  label: string;
  value: string;
  subValue: string;
  highlight: "gain" | "loss" | "neutral";
  tooltip?: React.ReactNode;
}) {
  const subColor =
    highlight === "gain"
      ? "text-gain"
      : highlight === "loss"
        ? "text-loss"
        : "text-muted-foreground";

  const content = (
    <div className="flex flex-col space-y-0.5 lg:flex-row lg:justify-between lg:items-center lg:space-y-0 lg:border-b lg:border-border/40 lg:pb-2 lg:last:border-0 lg:last:pb-0">
      <span className="text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground/70">
        {label}
      </span>
      <div className="flex flex-col lg:flex-row lg:items-baseline lg:gap-2">
        <span className="text-base sm:text-lg font-mono font-medium text-foreground tabular-nums leading-tight">
          {value}
        </span>
        <span
          className={cn(
            "text-[10px] sm:text-xs font-mono tabular-nums leading-none lg:text-right",
            subColor
          )}
        >
          {subValue}
        </span>
      </div>
    </div>
  );

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help">{content}</div>
        </TooltipTrigger>
        <TooltipContent side="left">{tooltip}</TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

function DataRow({
  label,
  value,
  subValue,
  highlight,
}: {
  label: string;
  value: string;
  subValue: string;
  highlight: "gain" | "loss" | "warn" | "neutral";
}) {
  const subColor =
    highlight === "gain"
      ? "text-gain"
      : highlight === "loss"
        ? "text-loss"
        : highlight === "warn"
          ? "text-warn"
          : "text-muted-foreground";

  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground/80">
        {label}
      </span>
      <div className="flex flex-col items-end">
        <span className="text-xs sm:text-sm font-mono font-medium tabular-nums">{value}</span>
        <span className={cn("text-[10px] font-mono tabular-nums", subColor)}>{subValue}</span>
      </div>
    </div>
  );
}
