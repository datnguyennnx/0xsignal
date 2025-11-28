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

  // Extract metrics
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
      {/* Primary Metrics - Mobile: 2 cols, Tablet: 3 cols, Desktop: 6 cols */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-border/30">
        {/* Signal */}
        <div className="bg-background p-3 sm:p-4">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
            Signal
          </div>
          <div className={cn("text-base sm:text-lg font-medium", signalColor)}>
            {signal.replace("_", " ")}
          </div>
          <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
            {primarySignal.strategy.replace("_", " ")}
          </div>
        </div>

        {/* Regime */}
        <div className="bg-background p-3 sm:p-4">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
            Regime
          </div>
          <div className="text-base sm:text-lg font-medium">
            {REGIME_LABEL[strategyResult.regime]}
          </div>
          <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
            ADX {Math.round(adx)}
          </div>
        </div>

        {/* Confidence */}
        <div className="bg-background p-3 sm:p-4">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
            Confidence
          </div>
          <div className="text-base sm:text-lg font-medium tabular-nums">{confidence}%</div>
          <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
            {indicatorAgreement}% agree
          </div>
        </div>

        {/* Risk */}
        <div className="bg-background p-3 sm:p-4">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
            Risk
          </div>
          <div
            className={cn(
              "text-base sm:text-lg font-medium tabular-nums",
              riskScore > 70 ? "text-loss" : riskScore > 40 ? "text-warn" : "text-gain"
            )}
          >
            {riskScore}
          </div>
          <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">/ 100</div>
        </div>

        {/* Noise */}
        <div className="bg-background p-3 sm:p-4">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
            Noise
          </div>
          <div
            className={cn(
              "text-base sm:text-lg font-medium tabular-nums",
              noise.value > 75 ? "text-loss" : noise.value > 50 ? "text-warn" : ""
            )}
          >
            {noise.value}
          </div>
          <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
            {noise.level.toLowerCase()}
          </div>
        </div>

        {/* Volatility */}
        <div className="bg-background p-3 sm:p-4">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
            Volatility
          </div>
          <div className="text-base sm:text-lg font-medium tabular-nums">
            {atr !== undefined ? `${atr.toFixed(1)}%` : "-"}
          </div>
          <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">ATR</div>
        </div>
      </div>

      {/* Indicator Grid - Mobile: 3 cols, Tablet: 3 cols, Desktop: 6 cols */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-px bg-border/30 border-t border-border/30">
        <IndicatorCell
          label="RSI"
          value={rsi !== undefined ? Math.round(rsi) : undefined}
          context={
            rsi !== undefined
              ? rsi < 30
                ? "oversold"
                : rsi > 70
                  ? "overbought"
                  : "neutral"
              : undefined
          }
          highlight={rsi !== undefined && (rsi < 30 || rsi > 70)}
          bullish={rsi !== undefined && rsi < 30}
        />
        <IndicatorCell
          label="%B"
          value={percentB !== undefined ? percentB.toFixed(2) : undefined}
          context={
            percentB !== undefined
              ? percentB < 0.2
                ? "lower"
                : percentB > 0.8
                  ? "upper"
                  : "mid"
              : undefined
          }
          highlight={percentB !== undefined && (percentB < 0.2 || percentB > 0.8)}
          bullish={percentB !== undefined && percentB < 0.2}
        />
        <IndicatorCell
          label="Stoch"
          value={stochastic !== undefined ? Math.round(stochastic) : undefined}
          context={
            stochastic !== undefined
              ? stochastic < 20
                ? "oversold"
                : stochastic > 80
                  ? "overbought"
                  : "neutral"
              : undefined
          }
          highlight={stochastic !== undefined && (stochastic < 20 || stochastic > 80)}
          bullish={stochastic !== undefined && stochastic < 20}
        />
        <IndicatorCell
          label="Dist MA"
          value={
            distanceMA !== undefined
              ? `${distanceMA > 0 ? "+" : ""}${distanceMA.toFixed(1)}%`
              : undefined
          }
          context={
            distanceMA !== undefined ? (Math.abs(distanceMA) > 3 ? "extended" : "near") : undefined
          }
          highlight={distanceMA !== undefined && Math.abs(distanceMA) > 3}
          bullish={distanceMA !== undefined && distanceMA < -3}
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
              : undefined
          }
          context={macdTrend !== undefined ? "trend" : undefined}
          highlight={macdTrend !== undefined && macdTrend !== 0}
          bullish={macdTrend !== undefined && macdTrend > 0}
        />
        <IndicatorCell
          label="Agree"
          value={indicatorAgreement > 0 ? `${indicatorAgreement}%` : undefined}
          context={
            indicatorAgreement >= 70 ? "strong" : indicatorAgreement >= 50 ? "moderate" : "weak"
          }
          highlight={indicatorAgreement >= 70}
          bullish={indicatorAgreement >= 70}
        />
      </div>
    </div>
  );
}

function IndicatorCell({
  label,
  value,
  context,
  highlight,
  bullish,
}: {
  label: string;
  value?: string | number;
  context?: string;
  highlight?: boolean;
  bullish?: boolean;
}) {
  return (
    <div className="bg-background p-2 sm:p-3">
      <div className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5 sm:mb-1">
        {label}
      </div>
      <div
        className={cn(
          "text-xs sm:text-sm font-medium tabular-nums",
          highlight && bullish && "text-gain",
          highlight && !bullish && "text-loss"
        )}
      >
        {value ?? "-"}
      </div>
      {context && (
        <div className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5">{context}</div>
      )}
    </div>
  );
}
