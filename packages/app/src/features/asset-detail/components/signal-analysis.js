import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Signal Analysis - pure component
import { cn } from "@/core/utils/cn";
const REGIME_LABEL = {
  BULL_MARKET: "Bull",
  BEAR_MARKET: "Bear",
  TRENDING: "Trend",
  SIDEWAYS: "Range",
  MEAN_REVERSION: "Reversion",
  LOW_VOLATILITY: "Low Vol",
  HIGH_VOLATILITY: "High Vol",
};
function IndicatorCell({ label, value, context, highlight, bullish }) {
  return _jsxs("div", {
    className: "bg-background p-2 sm:p-3",
    children: [
      _jsx("div", {
        className:
          "text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5 sm:mb-1",
        children: label,
      }),
      _jsx("div", {
        className: cn(
          "text-xs sm:text-sm font-medium tabular-nums",
          highlight && bullish && "text-gain",
          highlight && !bullish && "text-loss"
        ),
        children: value ?? "-",
      }),
      context &&
        _jsx("div", {
          className: "text-[9px] sm:text-[10px] text-muted-foreground mt-0.5",
          children: context,
        }),
    ],
  });
}
export function SignalAnalysis({
  signal,
  confidence,
  riskScore,
  noise,
  strategyResult,
  className,
}) {
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
  return _jsxs("div", {
    className: cn("rounded border border-border/50", className),
    children: [
      _jsxs("div", {
        className: "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-border/30",
        children: [
          _jsxs("div", {
            className: "bg-background p-3 sm:p-4",
            children: [
              _jsx("div", {
                className: "text-[10px] text-muted-foreground uppercase tracking-wider mb-1",
                children: "Signal",
              }),
              _jsx("div", {
                className: cn("text-base sm:text-lg font-medium", signalColor),
                children: signal.replace("_", " "),
              }),
              _jsx("div", {
                className: "text-[10px] sm:text-xs text-muted-foreground mt-0.5",
                children: primarySignal.strategy.replace("_", " "),
              }),
            ],
          }),
          _jsxs("div", {
            className: "bg-background p-3 sm:p-4",
            children: [
              _jsx("div", {
                className: "text-[10px] text-muted-foreground uppercase tracking-wider mb-1",
                children: "Regime",
              }),
              _jsx("div", {
                className: "text-base sm:text-lg font-medium",
                children: REGIME_LABEL[strategyResult.regime],
              }),
              _jsxs("div", {
                className: "text-[10px] sm:text-xs text-muted-foreground mt-0.5",
                children: ["ADX ", Math.round(adx)],
              }),
            ],
          }),
          _jsxs("div", {
            className: "bg-background p-3 sm:p-4",
            children: [
              _jsx("div", {
                className: "text-[10px] text-muted-foreground uppercase tracking-wider mb-1",
                children: "Confidence",
              }),
              _jsxs("div", {
                className: "text-base sm:text-lg font-medium tabular-nums",
                children: [confidence, "%"],
              }),
              _jsxs("div", {
                className: "text-[10px] sm:text-xs text-muted-foreground mt-0.5",
                children: [indicatorAgreement, "% agree"],
              }),
            ],
          }),
          _jsxs("div", {
            className: "bg-background p-3 sm:p-4",
            children: [
              _jsx("div", {
                className: "text-[10px] text-muted-foreground uppercase tracking-wider mb-1",
                children: "Risk",
              }),
              _jsx("div", {
                className: cn(
                  "text-base sm:text-lg font-medium tabular-nums",
                  riskScore > 70 ? "text-loss" : riskScore > 40 ? "text-warn" : "text-gain"
                ),
                children: riskScore,
              }),
              _jsx("div", {
                className: "text-[10px] sm:text-xs text-muted-foreground mt-0.5",
                children: "/ 100",
              }),
            ],
          }),
          _jsxs("div", {
            className: "bg-background p-3 sm:p-4",
            children: [
              _jsx("div", {
                className: "text-[10px] text-muted-foreground uppercase tracking-wider mb-1",
                children: "Noise",
              }),
              _jsx("div", {
                className: cn(
                  "text-base sm:text-lg font-medium tabular-nums",
                  noise.value > 75 ? "text-loss" : noise.value > 50 ? "text-warn" : ""
                ),
                children: noise.value,
              }),
              _jsx("div", {
                className: "text-[10px] sm:text-xs text-muted-foreground mt-0.5",
                children: noise.level.toLowerCase(),
              }),
            ],
          }),
          _jsxs("div", {
            className: "bg-background p-3 sm:p-4",
            children: [
              _jsx("div", {
                className: "text-[10px] text-muted-foreground uppercase tracking-wider mb-1",
                children: "Volatility",
              }),
              _jsx("div", {
                className: "text-base sm:text-lg font-medium tabular-nums",
                children: atr !== undefined ? `${atr.toFixed(1)}%` : "-",
              }),
              _jsx("div", {
                className: "text-[10px] sm:text-xs text-muted-foreground mt-0.5",
                children: "ATR",
              }),
            ],
          }),
        ],
      }),
      _jsxs("div", {
        className: "grid grid-cols-3 lg:grid-cols-6 gap-px bg-border/30 border-t border-border/30",
        children: [
          _jsx(IndicatorCell, {
            label: "RSI",
            value: rsi !== undefined ? Math.round(rsi) : undefined,
            context:
              rsi !== undefined
                ? rsi < 30
                  ? "oversold"
                  : rsi > 70
                    ? "overbought"
                    : "neutral"
                : undefined,
            highlight: rsi !== undefined && (rsi < 30 || rsi > 70),
            bullish: rsi !== undefined && rsi < 30,
          }),
          _jsx(IndicatorCell, {
            label: "%B",
            value: percentB !== undefined ? percentB.toFixed(2) : undefined,
            context:
              percentB !== undefined
                ? percentB < 0.2
                  ? "lower"
                  : percentB > 0.8
                    ? "upper"
                    : "mid"
                : undefined,
            highlight: percentB !== undefined && (percentB < 0.2 || percentB > 0.8),
            bullish: percentB !== undefined && percentB < 0.2,
          }),
          _jsx(IndicatorCell, {
            label: "Stoch",
            value: stochastic !== undefined ? Math.round(stochastic) : undefined,
            context:
              stochastic !== undefined
                ? stochastic < 20
                  ? "oversold"
                  : stochastic > 80
                    ? "overbought"
                    : "neutral"
                : undefined,
            highlight: stochastic !== undefined && (stochastic < 20 || stochastic > 80),
            bullish: stochastic !== undefined && stochastic < 20,
          }),
          _jsx(IndicatorCell, {
            label: "Dist MA",
            value:
              distanceMA !== undefined
                ? `${distanceMA > 0 ? "+" : ""}${distanceMA.toFixed(1)}%`
                : undefined,
            context:
              distanceMA !== undefined
                ? Math.abs(distanceMA) > 3
                  ? "extended"
                  : "near"
                : undefined,
            highlight: distanceMA !== undefined && Math.abs(distanceMA) > 3,
            bullish: distanceMA !== undefined && distanceMA < -3,
          }),
          _jsx(IndicatorCell, {
            label: "MACD",
            value:
              macdTrend !== undefined
                ? macdTrend > 0
                  ? "Bull"
                  : macdTrend < 0
                    ? "Bear"
                    : "Flat"
                : undefined,
            context: macdTrend !== undefined ? "trend" : undefined,
            highlight: macdTrend !== undefined && macdTrend !== 0,
            bullish: macdTrend !== undefined && macdTrend > 0,
          }),
          _jsx(IndicatorCell, {
            label: "Agree",
            value: indicatorAgreement > 0 ? `${indicatorAgreement}%` : undefined,
            context:
              indicatorAgreement >= 70 ? "strong" : indicatorAgreement >= 50 ? "moderate" : "weak",
            highlight: indicatorAgreement >= 70,
            bullish: indicatorAgreement >= 70,
          }),
        ],
      }),
    ],
  });
}
//# sourceMappingURL=signal-analysis.js.map
