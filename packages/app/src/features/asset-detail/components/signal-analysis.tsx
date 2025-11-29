/**
 * Signal Analysis - Minimalist design
 * Consistent 2-col mobile → 6-col desktop for ALL sections
 * Uses Card component with softer rounded corners
 */

import { cn } from "@/core/utils/cn";
import type { MarketRegime, NoiseScore, StrategyResult } from "@0xsignal/shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface SignalAnalysisProps {
  signal: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
  confidence: number;
  riskScore: number;
  noise: NoiseScore;
  strategyResult: StrategyResult;
  className?: string;
}

const REGIME_LABEL: Record<MarketRegime, string> = {
  BULL_MARKET: "Bull",
  BEAR_MARKET: "Bear",
  TRENDING: "Trend",
  SIDEWAYS: "Range",
  MEAN_REVERSION: "Reversion",
  LOW_VOLATILITY: "Low Vol",
  HIGH_VOLATILITY: "High Vol",
};

export function SignalAnalysis({
  signal,
  confidence,
  riskScore,
  noise,
  strategyResult,
  className,
}: SignalAnalysisProps) {
  const primarySignal = strategyResult.primarySignal;
  const metrics = primarySignal.metrics;

  const indicatorAgreement = metrics.indicatorAgreement ?? 0;
  const rsi = metrics.rsi ?? metrics.MEAN_REVERSION_rsi ?? metrics.MOMENTUM_rsi;
  const adx = metrics.adxValue ?? metrics.adx ?? metrics.MEAN_REVERSION_adxValue ?? 0;
  const atr = metrics.normalizedATR ?? metrics.MEAN_REVERSION_normalizedATR;
  const percentB = metrics.percentB ?? metrics.MEAN_REVERSION_percentB;
  const stochastic = metrics.stochastic ?? metrics.MEAN_REVERSION_stochastic;
  const distanceMA = metrics.distanceFromMA ?? metrics.MEAN_REVERSION_distanceFromMA;
  const macdTrend = metrics.macdTrend ?? metrics.MEAN_REVERSION_macdTrend;

  const signalColor = signal.includes("BUY")
    ? "text-gain"
    : signal.includes("SELL")
      ? "text-loss"
      : "";

  return (
    <Card className={cn("py-0 shadow-none overflow-hidden", className)}>
      {/* Primary Metrics - 2 col mobile, 6 col desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-6">
        <MetricCell
          label="Signal"
          value={signal.replace("_", " ")}
          context={primarySignal.strategy.replace("_", " ")}
          valueClass={signalColor}
        />
        <MetricCell
          label="Regime"
          value={REGIME_LABEL[strategyResult.regime]}
          context={`ADX ${Math.round(adx)}`}
        />
        <MetricCell
          label="Confidence"
          value={`${confidence}%`}
          context={`${indicatorAgreement}% agree`}
        />
        <MetricCell
          label="Risk"
          value={riskScore}
          context="/ 100"
          valueClass={riskScore > 70 ? "text-loss" : riskScore > 40 ? "text-warn" : "text-gain"}
        />
        <MetricCell
          label="Noise"
          value={noise.value}
          context={noise.level.toLowerCase()}
          valueClass={noise.value > 75 ? "text-loss" : noise.value > 50 ? "text-warn" : ""}
        />
        <MetricCell
          label="Volatility"
          value={atr !== undefined ? `${atr.toFixed(1)}%` : "-"}
          context="ATR"
          isLast
        />
      </div>

      {/* Secondary Indicators - 2 col mobile, 6 col desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-6 border-t border-border/50">
        <IndicatorCell
          label="RSI"
          value={rsi !== undefined ? Math.round(rsi) : "-"}
          context={
            rsi !== undefined
              ? rsi < 30
                ? "oversold"
                : rsi > 70
                  ? "overbought"
                  : "neutral"
              : undefined
          }
          signal={
            rsi !== undefined && rsi < 30
              ? "gain"
              : rsi !== undefined && rsi > 70
                ? "loss"
                : undefined
          }
        />
        <IndicatorCell
          label="%B"
          value={percentB !== undefined ? percentB.toFixed(2) : "-"}
          context={
            percentB !== undefined
              ? percentB < 0.2
                ? "lower"
                : percentB > 0.8
                  ? "upper"
                  : "mid"
              : undefined
          }
        />
        <IndicatorCell
          label="Stoch"
          value={stochastic !== undefined ? Math.round(stochastic) : "-"}
          context={
            stochastic !== undefined
              ? stochastic < 20
                ? "oversold"
                : stochastic > 80
                  ? "overbought"
                  : "neutral"
              : undefined
          }
          signal={
            stochastic !== undefined && stochastic < 20
              ? "gain"
              : stochastic !== undefined && stochastic > 80
                ? "loss"
                : undefined
          }
        />
        <IndicatorCell
          label="Dist MA"
          value={
            distanceMA !== undefined ? `${distanceMA > 0 ? "+" : ""}${distanceMA.toFixed(1)}%` : "-"
          }
          context={
            distanceMA !== undefined ? (Math.abs(distanceMA) > 3 ? "extended" : "near") : undefined
          }
        />
        <IndicatorCell
          label="MACD"
          value={
            macdTrend !== undefined
              ? macdTrend > 0
                ? "Bull"
                : macdTrend < 0
                  ? "Bear"
                  : "Flat"
              : "-"
          }
          context="trend"
          signal={
            macdTrend !== undefined && macdTrend > 0
              ? "gain"
              : macdTrend !== undefined && macdTrend < 0
                ? "loss"
                : undefined
          }
        />
        <IndicatorCell
          label="Agree"
          value={indicatorAgreement > 0 ? `${indicatorAgreement}%` : "-"}
          context={
            indicatorAgreement >= 70 ? "strong" : indicatorAgreement >= 50 ? "moderate" : "weak"
          }
          isLast
        />
      </div>
    </Card>
  );
}

function MetricCell({
  label,
  value,
  context,
  valueClass,
  isLast,
}: {
  label: string;
  value: string | number;
  context?: string;
  valueClass?: string;
  isLast?: boolean;
}) {
  return (
    <div
      className={cn(
        "px-4 py-3 border-b border-border/50",
        !isLast && "border-r border-border/50",
        "even:border-r-0 sm:even:border-r",
        isLast && "sm:border-r-0"
      )}
    >
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
      <div className={cn("text-base sm:text-lg font-semibold tabular-nums", valueClass)}>
        {value}
      </div>
      {context && <div className="text-[10px] text-muted-foreground mt-0.5">{context}</div>}
    </div>
  );
}

function IndicatorCell({
  label,
  value,
  context,
  signal,
  isLast,
}: {
  label: string;
  value: string | number;
  context?: string;
  signal?: "gain" | "loss";
  isLast?: boolean;
}) {
  return (
    <div
      className={cn(
        "px-3 py-2.5 border-b border-border/50",
        !isLast && "border-r border-border/50",
        "even:border-r-0 sm:even:border-r",
        isLast && "sm:border-r-0"
      )}
    >
      <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">
        {label}
      </div>
      <div
        className={cn(
          "text-sm font-medium tabular-nums",
          signal === "gain" && "text-gain",
          signal === "loss" && "text-loss"
        )}
      >
        {value}
      </div>
      {context && <div className="text-[9px] text-muted-foreground">{context}</div>}
    </div>
  );
}
