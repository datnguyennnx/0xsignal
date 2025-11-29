/** Entry Detection - Dynamic trade setup aligned with strategy signals */

import { Effect, Match } from "effect";
import type { CryptoPrice, Signal } from "@0xsignal/shared";
import type { EntrySignal, IndicatorSummary } from "../domain/types";
import { computeIndicators, type IndicatorSet } from "../domain/analysis/indicators";
import {
  detectEntryIndicators,
  generateEntryRecommendation,
  calculateLeverage,
} from "../domain/analysis/signals";

// Stablecoins - should never have trade signals
const STABLECOINS = new Set([
  "USDT",
  "USDC",
  "BUSD",
  "DAI",
  "TUSD",
  "USDP",
  "FRAX",
  "LUSD",
  "USDD",
  "FDUSD",
  "PYUSD",
  "GUSD",
  "SUSD",
  "CUSD",
  "USDJ",
  "UST",
  "MIM",
  "DOLA",
  "CRVUSD",
]);

// Check if asset is tradeable
const isTradeable = (symbol: string, atr: number, volume24h: number): boolean => {
  const upperSymbol = symbol.toUpperCase().replace(/USD$/, "");
  if (STABLECOINS.has(upperSymbol) || STABLECOINS.has(symbol.toUpperCase())) return false;
  if (atr < 0.3) return false; // Minimum 0.3% daily volatility (relaxed)
  if (volume24h < 100000) return false; // Minimum $100K daily volume (relaxed)
  return true;
};

// Map signal to base strength
const signalToStrength = (signal: Signal): "WEAK" | "MODERATE" | "STRONG" | "VERY_STRONG" =>
  Match.value(signal).pipe(
    Match.when("STRONG_BUY", () => "VERY_STRONG" as const),
    Match.when("STRONG_SELL", () => "VERY_STRONG" as const),
    Match.when("BUY", () => "STRONG" as const),
    Match.when("SELL", () => "STRONG" as const),
    Match.orElse(() => "MODERATE" as const)
  );

// Map signal to base confidence
const signalToBaseConfidence = (signal: Signal): number =>
  Match.value(signal).pipe(
    Match.when("STRONG_BUY", () => 70),
    Match.when("STRONG_SELL", () => 70),
    Match.when("BUY", () => 50),
    Match.when("SELL", () => 50),
    Match.orElse(() => 20)
  );

// Calculate strength from signal + indicators
type EntryStrength = "WEAK" | "MODERATE" | "STRONG" | "VERY_STRONG";

const calculateStrength = (
  baseStrength: EntryStrength,
  activeCount: number,
  adx: number,
  hasDivergence: boolean
): EntryStrength => {
  // Start with base strength from signal
  let score = Match.value(baseStrength).pipe(
    Match.when("VERY_STRONG", () => 80),
    Match.when("STRONG", () => 60),
    Match.when("MODERATE", () => 40),
    Match.orElse(() => 20)
  );

  // Boost from entry indicators (up to +20)
  score += activeCount * 5;

  // Boost from trend strength (up to +10)
  if (adx > 25) score += 10;
  else if (adx > 15) score += 5;

  // Boost from divergence (+10)
  if (hasDivergence) score += 10;

  if (score >= 80) return "VERY_STRONG";
  if (score >= 60) return "STRONG";
  if (score >= 40) return "MODERATE";
  return "WEAK";
};

// Dynamic target/stop calculation using ATR and market conditions
const calculateDynamicLevels = (
  price: number,
  direction: "LONG" | "SHORT" | "NEUTRAL",
  atrPercent: number,
  strength: EntryStrength
) => {
  if (direction === "NEUTRAL") {
    return { target: price, stopLoss: price, riskRewardRatio: 0 };
  }

  // Ensure minimum ATR for calculation
  const effectiveATR = Math.max(atrPercent, 1.5);

  // Base multipliers from strength
  const baseTargetMultiplier = Match.value(strength).pipe(
    Match.when("VERY_STRONG", () => 3.0),
    Match.when("STRONG", () => 2.5),
    Match.when("MODERATE", () => 2.0),
    Match.orElse(() => 1.5)
  );

  const baseStopMultiplier = Match.value(strength).pipe(
    Match.when("VERY_STRONG", () => 1.0),
    Match.when("STRONG", () => 1.2),
    Match.when("MODERATE", () => 1.5),
    Match.orElse(() => 2.0)
  );

  // Calculate percentages
  const targetPct = (effectiveATR * baseTargetMultiplier) / 100;
  const stopPct = (effectiveATR * baseStopMultiplier) / 100;

  // Minimum thresholds
  const minTarget = 0.02; // 2% minimum
  const minStop = 0.01; // 1% minimum

  const finalTargetPct = Math.max(targetPct, minTarget);
  const finalStopPct = Math.max(stopPct, minStop);

  if (direction === "LONG") {
    const target = price * (1 + finalTargetPct);
    const stopLoss = price * (1 - finalStopPct);
    const rr = (target - price) / (price - stopLoss);
    return { target, stopLoss, riskRewardRatio: Math.round(rr * 100) / 100 };
  } else {
    const target = price * (1 - finalTargetPct);
    const stopLoss = price * (1 + finalStopPct);
    const rr = (price - target) / (stopLoss - price);
    return { target, stopLoss, riskRewardRatio: Math.round(rr * 100) / 100 };
  }
};

// Build indicator summary
const buildIndicatorSummary = (indicators: IndicatorSet): IndicatorSummary => ({
  rsi: {
    value: Math.round(indicators.rsi.rsi),
    signal: indicators.rsi.signal,
  },
  macd: {
    trend: indicators.macd.trend,
    histogram: Math.round(indicators.macd.histogram * 100) / 100,
  },
  adx: {
    value: Math.round(indicators.adx.adx),
    strength: indicators.adx.trendStrength,
  },
  atr: {
    value: Math.round(indicators.atr.normalizedATR * 100) / 100,
    volatility: indicators.atr.volatilityLevel,
  },
});

// Create neutral signal for non-tradeable assets
const createNeutralSignal = (
  price: CryptoPrice,
  indicators: IndicatorSet,
  reason: string
): EntrySignal => ({
  direction: "NEUTRAL",
  isOptimalEntry: false,
  strength: "WEAK",
  confidence: 0,
  indicators: {
    trendReversal: false,
    volumeIncrease: false,
    momentumBuilding: false,
    divergence: false,
  },
  entryPrice: price.price,
  targetPrice: price.price,
  stopLoss: price.price,
  riskRewardRatio: 0,
  suggestedLeverage: 1,
  maxLeverage: 1,
  indicatorSummary: buildIndicatorSummary(indicators),
  dataSource: "24H_SNAPSHOT",
  recommendation: reason,
});

// Input for entry detection - includes strategy context
interface EntryContext {
  signal: Signal;
  strategyConfidence: number;
}

export const findEntry = (
  price: CryptoPrice,
  overallSignal: Signal = "HOLD",
  strategyConfidence: number = 50
): Effect.Effect<EntrySignal, never> =>
  Effect.gen(function* () {
    const indicators = yield* computeIndicators(price);

    // Check if tradeable
    if (!isTradeable(price.symbol, indicators.atr.normalizedATR, price.volume24h)) {
      const isStable =
        STABLECOINS.has(price.symbol.toUpperCase()) ||
        STABLECOINS.has(price.symbol.toUpperCase().replace(/USD$/, ""));
      const reason = isStable
        ? `${price.symbol} is a stablecoin - not suitable for directional trading.`
        : `${price.symbol} has insufficient volatility or volume for trading.`;
      return createNeutralSignal(price, indicators, reason);
    }

    const { indicators: entryIndicators, direction } = detectEntryIndicators(
      price,
      indicators,
      overallSignal
    );

    const activeCount = Object.values(entryIndicators).filter(Boolean).length;
    const hasDivergence = indicators.divergence.hasDivergence;

    // Get base strength from signal
    const baseStrength = signalToStrength(overallSignal);

    // Calculate final strength considering indicators
    const strength = calculateStrength(
      baseStrength,
      activeCount,
      indicators.adx.adx,
      hasDivergence
    );

    // Optimal entry: has direction + reasonable strength
    const isOptimalEntry =
      direction !== "NEUTRAL" && (strength === "STRONG" || strength === "VERY_STRONG");

    // Confidence: start with strategy confidence, adjust based on entry quality
    const baseConfidence = signalToBaseConfidence(overallSignal);
    let confidence = Math.max(baseConfidence, strategyConfidence);

    // Adjust confidence based on entry indicators
    if (activeCount >= 3) confidence = Math.min(confidence + 15, 100);
    else if (activeCount >= 2) confidence = Math.min(confidence + 10, 100);
    else if (activeCount === 1) confidence = Math.min(confidence + 5, 100);

    // Boost for divergence
    if (hasDivergence) confidence = Math.min(confidence + 10, 100);

    // Penalty for weak ADX (no clear trend)
    if (indicators.adx.adx < 15) confidence = Math.max(confidence - 10, 10);

    confidence = Math.round(confidence);

    // Dynamic levels
    const { target, stopLoss, riskRewardRatio } = calculateDynamicLevels(
      price.price,
      direction,
      indicators.atr.normalizedATR,
      strength
    );

    const { suggested: suggestedLeverage, max: maxLeverage } = calculateLeverage(
      indicators.atr.normalizedATR
    );

    // Generate recommendation aligned with signal
    const recommendation =
      direction === "NEUTRAL"
        ? "No clear setup. Wait for stronger confirmation signals."
        : generateEntryRecommendation(
            isOptimalEntry,
            strength,
            direction,
            price.price,
            target,
            stopLoss,
            riskRewardRatio,
            suggestedLeverage
          );

    return {
      direction,
      isOptimalEntry,
      strength,
      confidence,
      indicators: entryIndicators,
      entryPrice: price.price,
      targetPrice: target,
      stopLoss,
      riskRewardRatio,
      suggestedLeverage,
      maxLeverage,
      indicatorSummary: buildIndicatorSummary(indicators),
      dataSource: "24H_SNAPSHOT" as const,
      recommendation,
    };
  });
