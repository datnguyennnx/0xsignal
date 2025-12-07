/** Signal Detection - Entry signal detection for LONG and SHORT */

import type { EntryIndicators } from "../types";
import type { IndicatorSet } from "./indicator-types";
import { Match } from "effect";
import type { CryptoPrice, Signal, TradeDirection } from "@0xsignal/shared";

export const detectLongIndicators = (
  price: CryptoPrice,
  indicators: IndicatorSet
): EntryIndicators => ({
  trendReversal:
    indicators.macd.trend === "BULLISH" && indicators.rsi.rsi > 30 && indicators.rsi.rsi < 70,
  volumeIncrease: (indicators.volumeROC?.value ?? 0) > 20,
  momentumBuilding: indicators.adx.adx > 25 && price.change24h > 0,
  divergence:
    indicators.divergence.hasDivergence && indicators.divergence.divergenceType === "BULLISH",
});

// Detect SHORT entry indicators (bearish setup)
export const detectShortIndicators = (
  price: CryptoPrice,
  indicators: IndicatorSet
): EntryIndicators => ({
  trendReversal:
    indicators.macd.trend === "BEARISH" && indicators.rsi.rsi > 30 && indicators.rsi.rsi < 70,
  volumeIncrease: (indicators.volumeROC?.value ?? 0) > 20,
  momentumBuilding: indicators.adx.adx > 25 && price.change24h < 0,
  divergence:
    indicators.divergence.hasDivergence && indicators.divergence.divergenceType === "BEARISH",
});

// Detect entry indicators based on signal direction
export const detectEntryIndicators = (
  price: CryptoPrice,
  indicators: IndicatorSet,
  overallSignal: Signal
): { indicators: EntryIndicators; direction: TradeDirection } => {
  const isLong = overallSignal === "BUY" || overallSignal === "STRONG_BUY";
  const isShort = overallSignal === "SELL" || overallSignal === "STRONG_SELL";

  if (isLong) {
    return { indicators: detectLongIndicators(price, indicators), direction: "LONG" };
  }
  if (isShort) {
    return { indicators: detectShortIndicators(price, indicators), direction: "SHORT" };
  }
  // HOLD - check which direction has more indicators
  const longIndicators = detectLongIndicators(price, indicators);
  const shortIndicators = detectShortIndicators(price, indicators);
  const longCount = Object.values(longIndicators).filter(Boolean).length;
  const shortCount = Object.values(shortIndicators).filter(Boolean).length;

  if (longCount > shortCount && longCount >= 2) {
    return { indicators: longIndicators, direction: "LONG" };
  }
  if (shortCount > longCount && shortCount >= 2) {
    return { indicators: shortIndicators, direction: "SHORT" };
  }
  return { indicators: longIndicators, direction: "NEUTRAL" };
};

// Entry strength type
type EntryStrength = "WEAK" | "MODERATE" | "STRONG" | "VERY_STRONG";

// Leverage calculation based on ATR volatility
export const calculateLeverage = (normalizedATR: number): { suggested: number; max: number } =>
  Match.value(normalizedATR).pipe(
    Match.when(
      (atr) => atr < 1,
      () => ({ suggested: 10, max: 20 })
    ),
    Match.when(
      (atr) => atr < 2,
      () => ({ suggested: 5, max: 10 })
    ),
    Match.when(
      (atr) => atr < 4,
      () => ({ suggested: 3, max: 5 })
    ),
    Match.when(
      (atr) => atr < 6,
      () => ({ suggested: 2, max: 3 })
    ),
    Match.orElse(() => ({ suggested: 1, max: 2 }))
  );

// Entry recommendation - provides actionable trade setup info
export const generateEntryRecommendation = (
  _isOptimalEntry: boolean,
  strength: EntryStrength,
  direction: TradeDirection,
  entry: number,
  target: number,
  stopLoss: number,
  rr: number,
  leverage: number
): string => {
  if (direction === "NEUTRAL") {
    return "No clear setup. Wait for stronger confirmation signals.";
  }

  const dirLabel = direction === "LONG" ? "LONG" : "SHORT";
  const targetPct =
    direction === "LONG"
      ? (((target - entry) / entry) * 100).toFixed(1)
      : (((entry - target) / entry) * 100).toFixed(1);
  const stopPct =
    direction === "LONG"
      ? (((entry - stopLoss) / entry) * 100).toFixed(1)
      : (((stopLoss - entry) / entry) * 100).toFixed(1);

  const setupInfo = `${dirLabel} setup: Target +${targetPct}%, Stop -${stopPct}%, R:R ${rr}:1.`;

  // Different messages based on strength
  return Match.value(strength).pipe(
    Match.when(
      "VERY_STRONG",
      () => `${setupInfo} Strong confirmation. Consider ${leverage}x leverage.`
    ),
    Match.when("STRONG", () => `${setupInfo} Good setup. Suggested ${leverage}x leverage.`),
    Match.when("MODERATE", () => `${setupInfo} Moderate setup. Use smaller position size.`),
    Match.orElse(() => `${setupInfo} Weak confirmation. Consider waiting for better entry.`)
  );
};
