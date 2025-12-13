/** Entry Detection - Trade setup using real indicator data */

import { Effect, Match } from "effect";
import type { CryptoPrice, Signal, TradeDirection } from "@0xsignal/shared";
import type { EntrySignal, IndicatorSummary } from "../domain/types";
import type { IndicatorOutput } from "../domain/analysis/indicator-types";

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
  "MIM",
]);

// Check if asset is tradeable using REAL ATR data
const isTradeable = (symbol: string, atr: number, volume24h: number): boolean => {
  const upperSymbol = symbol.toUpperCase().replace(/USD$/, "");
  if (STABLECOINS.has(upperSymbol) || STABLECOINS.has(symbol.toUpperCase())) return false;
  if (atr < 0.5) return false; // Minimum 0.5% normalized ATR
  if (volume24h < 100000) return false; // Minimum $100K volume
  return true;
};

type EntryStrength = "WEAK" | "MODERATE" | "STRONG" | "VERY_STRONG";

const signalToStrength = Match.type<Signal>().pipe(
  Match.when("STRONG_BUY", () => "VERY_STRONG" as const),
  Match.when("STRONG_SELL", () => "VERY_STRONG" as const),
  Match.when("BUY", () => "STRONG" as const),
  Match.when("SELL", () => "STRONG" as const),
  Match.orElse(() => "MODERATE" as const)
);

const signalToBaseConfidence = Match.type<Signal>().pipe(
  Match.when("STRONG_BUY", () => 70),
  Match.when("STRONG_SELL", () => 70),
  Match.when("BUY", () => 50),
  Match.when("SELL", () => 50),
  Match.orElse(() => 20)
);

// Determine direction from real indicator data
const determineDirection = (indicators: IndicatorOutput, signal: Signal): TradeDirection => {
  const isLongSignal = signal === "BUY" || signal === "STRONG_BUY";
  const isShortSignal = signal === "SELL" || signal === "STRONG_SELL";

  if (isLongSignal) return "LONG";
  if (isShortSignal) return "SHORT";

  // For HOLD, check indicator bias
  const plusDI = indicators.adx.plusDI;
  const minusDI = indicators.adx.minusDI;
  const rsi = indicators.rsi.value;

  if (plusDI > minusDI + 5 && rsi > 50) return "LONG";
  if (minusDI > plusDI + 5 && rsi < 50) return "SHORT";
  return "NEUTRAL";
};

// Calculate strength from REAL indicator alignment
const calculateStrength = (
  baseStrength: EntryStrength,
  indicators: IndicatorOutput,
  direction: TradeDirection
): EntryStrength => {
  if (direction === "NEUTRAL") return "WEAK";

  let score = Match.value(baseStrength).pipe(
    Match.when("VERY_STRONG", () => 80),
    Match.when("STRONG", () => 60),
    Match.when("MODERATE", () => 40),
    Match.orElse(() => 20)
  );

  // Real ADX trend strength
  if (indicators.adx.value > 40) score += 15;
  else if (indicators.adx.value > 25) score += 10;
  else if (indicators.adx.value < 15) score -= 10;

  // RSI confirmation
  const rsi = indicators.rsi.value;
  if (direction === "LONG" && rsi < 40) score += 10; // Oversold for long
  if (direction === "SHORT" && rsi > 60) score += 10; // Overbought for short

  // MACD confirmation
  const macdAligned =
    (direction === "LONG" && indicators.macd.histogram > 0) ||
    (direction === "SHORT" && indicators.macd.histogram < 0);
  if (macdAligned) score += 10;

  if (score >= 80) return "VERY_STRONG";
  if (score >= 60) return "STRONG";
  if (score >= 40) return "MODERATE";
  return "WEAK";
};

// Dynamic target/stop using REAL ATR
const calculateDynamicLevels = (
  price: number,
  direction: TradeDirection,
  atrPercent: number,
  strength: EntryStrength
) => {
  if (direction === "NEUTRAL") {
    return { target: price, stopLoss: price, riskRewardRatio: 0 };
  }

  const effectiveATR = Math.max(atrPercent, 1.0);

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

  const targetPct = (effectiveATR * baseTargetMultiplier) / 100;
  const stopPct = (effectiveATR * baseStopMultiplier) / 100;

  const finalTargetPct = Math.max(targetPct, 0.02);
  const finalStopPct = Math.max(stopPct, 0.01);

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

// Build indicator summary from REAL data
const buildIndicatorSummary = (indicators: IndicatorOutput): IndicatorSummary => ({
  rsi: {
    value: Math.round(indicators.rsi.value),
    signal: indicators.rsi.signal,
  },
  macd: {
    trend:
      indicators.macd.histogram > 0
        ? "BULLISH"
        : indicators.macd.histogram < 0
          ? "BEARISH"
          : "NEUTRAL",
    histogram: Math.round(indicators.macd.histogram * 100) / 100,
  },
  adx: {
    value: Math.round(indicators.adx.value),
    strength: indicators.adx.trend as "STRONG" | "MODERATE" | "WEAK" | "VERY_STRONG" | "VERY_WEAK",
  },
  atr: {
    value: Math.round(indicators.atr.normalized * 100) / 100,
    volatility: indicators.atr.volatility as "VERY_LOW" | "LOW" | "NORMAL" | "HIGH" | "VERY_HIGH",
  },
});

// Leverage calculation using REAL ATR volatility
const calculateLeverage = (normalizedATR: number): { suggested: number; max: number } =>
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

// Create neutral signal for non-tradeable assets
const createNeutralSignal = (
  price: CryptoPrice,
  indicators: IndicatorOutput,
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
  dataSource: "HISTORICAL_OHLCV",
  recommendation: reason,
});

// Generate recommendation based on REAL data (no leverage advice)
const generateRecommendation = (
  direction: TradeDirection,
  strength: EntryStrength,
  target: number,
  stopLoss: number,
  entry: number,
  rr: number,
  _leverage: number
): string => {
  if (direction === "NEUTRAL") {
    return "No clear setup. Wait for stronger confirmation.";
  }

  const targetPct = Math.abs(((target - entry) / entry) * 100).toFixed(1);
  const stopPct = Math.abs(((stopLoss - entry) / entry) * 100).toFixed(1);
  const dirLabel = direction === "LONG" ? "LONG" : "SHORT";
  const strengthLabel = strength === "VERY_STRONG" ? "Strong setup" : "Moderate setup";

  return `${dirLabel}: Target +${targetPct}%, Stop -${stopPct}%, R:R ${rr}:1. ${strengthLabel}. Always manage your risk.`;
};

/** Find entry using REAL indicator data - no approximations */
export const findEntryWithIndicators = (
  price: CryptoPrice,
  indicators: IndicatorOutput,
  overallSignal: Signal,
  strategyConfidence: number
): Effect.Effect<EntrySignal, never> =>
  Effect.sync(() => {
    // Check if tradeable using REAL ATR
    if (!isTradeable(price.symbol, indicators.atr.normalized, price.volume24h)) {
      const isStable = STABLECOINS.has(price.symbol.toUpperCase());
      const reason = isStable
        ? `${price.symbol} is a stablecoin - not suitable for directional trading.`
        : `${price.symbol} has insufficient volatility or volume for trading.`;
      return createNeutralSignal(price, indicators, reason);
    }

    // If insufficient data, can't generate reliable signals
    if (!indicators.isValid) {
      return createNeutralSignal(
        price,
        indicators,
        `Insufficient historical data (${indicators.dataPoints} periods). Need 35+ for reliable signals.`
      );
    }

    const direction = determineDirection(indicators, overallSignal);
    const baseStrength = signalToStrength(overallSignal);
    const strength = calculateStrength(baseStrength, indicators, direction);

    const isOptimalEntry =
      direction !== "NEUTRAL" && (strength === "STRONG" || strength === "VERY_STRONG");

    // Confidence based on real indicator agreement
    let confidence = Math.max(signalToBaseConfidence(overallSignal), strategyConfidence);

    // Adjust based on ADX trend strength
    if (indicators.adx.value > 40) confidence = Math.min(confidence + 15, 100);
    else if (indicators.adx.value < 15) confidence = Math.max(confidence - 15, 10);

    confidence = Math.round(confidence);

    const { target, stopLoss, riskRewardRatio } = calculateDynamicLevels(
      price.price,
      direction,
      indicators.atr.normalized,
      strength
    );

    const { suggested: suggestedLeverage, max: maxLeverage } = calculateLeverage(
      indicators.atr.normalized
    );

    const recommendation = generateRecommendation(
      direction,
      strength,
      target,
      stopLoss,
      price.price,
      riskRewardRatio,
      suggestedLeverage
    );

    // Entry indicators based on REAL data
    const entryIndicators = {
      trendReversal: indicators.macd.crossover !== "NONE",
      volumeIncrease: false, // Would need volume data
      momentumBuilding:
        indicators.adx.value > 25 &&
        ((direction === "LONG" && indicators.adx.plusDI > indicators.adx.minusDI) ||
          (direction === "SHORT" && indicators.adx.minusDI > indicators.adx.plusDI)),
      divergence: false, // Would need price-RSI divergence detection
    };

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
      dataSource: "HISTORICAL_OHLCV" as const,
      recommendation,
    };
  });

/** Legacy wrapper for backward compatibility - will be deprecated */
export const findEntry = (
  price: CryptoPrice,
  overallSignal: Signal = "HOLD",
  strategyConfidence: number = 50
): Effect.Effect<EntrySignal, never> =>
  Effect.sync(() => {
    // Create minimal indicators for stablecoin detection
    const minimalIndicators: IndicatorOutput = {
      rsi: { value: 50, signal: "NEUTRAL", avgGain: 0, avgLoss: 0 },
      macd: { macd: 0, signal: 0, histogram: 0, crossover: "NONE" },
      adx: { value: 25, plusDI: 25, minusDI: 25, trend: "WEAK" },
      atr: { value: 0, normalized: 2, volatility: "MEDIUM" },
      isValid: false,
      dataPoints: 0,
    };

    const isStable = STABLECOINS.has(price.symbol.toUpperCase().replace(/USD$/, ""));
    if (isStable) {
      return createNeutralSignal(
        price,
        minimalIndicators,
        `${price.symbol} is a stablecoin - not suitable for trading.`
      );
    }

    // Return neutral with low confidence - should use findEntryWithIndicators
    return createNeutralSignal(
      price,
      minimalIndicators,
      "Signal requires historical data. Use findEntryWithIndicators for accurate signals."
    );
  });
