/**
 * Signal Analysis - Minimalist design
 * Consistent 2-col mobile → 6-col desktop for ALL sections
 * Semantic colors only for signal values
 */

import { cn } from "@/core/utils/cn";
import type { MarketRegime, NoiseScore, StrategyResult } from "@0xsignal/shared";

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
    <div className={cn("rounded border border-border/50", className)}>
      {/* Primary Metrics - 2 col mobile, 6 col desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-6">
        <Cell
          label="SIGNAL"
          value={signal.replace("_", " ")}
          context={primarySignal.strategy.replace("_", " ")}
          valueClass={signalColor}
        />
        <Cell
          label="REGIME"
          value={REGIME_LABEL[strategyResult.regime]}
          context={`ADX ${Math.round(adx)}`}
        />
        <Cell
          label="CONFIDENCE"
          value={`${confidence}%`}
          context={`${indicatorAgreement}% agree`}
        />
        <Cell
          label="RISK"
          value={riskScore}
          context="/ 100"
          valueClass={riskScore > 70 ? "text-loss" : riskScore > 40 ? "text-warn" : "text-gain"}
        />
        <Cell
          label="NOISE"
          value={noise.value}
          context={noise.level.toLowerCase()}
          valueClass={noise.value > 75 ? "text-loss" : noise.value > 50 ? "text-warn" : ""}
        />
        <Cell
          label="VOLATILITY"
          value={atr !== undefined ? `${atr.toFixed(1)}%` : "-"}
          context="ATR"
        />
      </div>

      {/* Secondary Indicators - 2 col mobile, 6 col desktop (CONSISTENT) */}
      <div className="grid grid-cols-2 sm:grid-cols-6 border-t border-border/50">
        <CellSmall
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
          valueClass={
            rsi !== undefined && rsi < 30
              ? "text-gain"
              : rsi !== undefined && rsi > 70
                ? "text-loss"
                : ""
          }
        />
        <CellSmall
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
        <CellSmall
          label="STOCH"
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
          valueClass={
            stochastic !== undefined && stochastic < 20
              ? "text-gain"
              : stochastic !== undefined && stochastic > 80
                ? "text-loss"
                : ""
          }
        />
        <CellSmall
          label="DIST MA"
          value={
            distanceMA !== undefined ? `${distanceMA > 0 ? "+" : ""}${distanceMA.toFixed(1)}%` : "-"
          }
          context={
            distanceMA !== undefined ? (Math.abs(distanceMA) > 3 ? "extended" : "near") : undefined
          }
        />
        <CellSmall
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
          valueClass={
            macdTrend !== undefined && macdTrend > 0
              ? "text-gain"
              : macdTrend !== undefined && macdTrend < 0
                ? "text-loss"
                : ""
          }
        />
        <CellSmall
          label="AGREE"
          value={indicatorAgreement > 0 ? `${indicatorAgreement}%` : "-"}
          context={
            indicatorAgreement >= 70 ? "strong" : indicatorAgreement >= 50 ? "moderate" : "weak"
          }
        />
      </div>
    </div>
  );
}

// Primary cell
function Cell({
  label,
  value,
  context,
  valueClass,
}: {
  label: string;
  value: string | number;
  context?: string;
  valueClass?: string;
}) {
  return (
    <div className="px-3 py-3 sm:px-4 sm:py-4 border-r border-b border-border/50 even:border-r-0 sm:even:border-r sm:last:border-r-0">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
      <div className={cn("text-base sm:text-lg font-medium tabular-nums", valueClass)}>{value}</div>
      {context && <div className="text-[10px] text-muted-foreground mt-0.5">{context}</div>}
    </div>
  );
}

// Secondary cell - smaller
function CellSmall({
  label,
  value,
  context,
  valueClass,
}: {
  label: string;
  value: string | number;
  context?: string;
  valueClass?: string;
}) {
  return (
    <div className="px-3 py-2 sm:px-3 sm:py-3 border-r border-b border-border/50 even:border-r-0 sm:even:border-r sm:last:border-r-0">
      <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">
        {label}
      </div>
      <div className={cn("text-sm font-medium tabular-nums", valueClass)}>{value}</div>
      {context && <div className="text-[9px] text-muted-foreground">{context}</div>}
    </div>
  );
}
