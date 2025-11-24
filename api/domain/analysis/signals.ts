import type { CryptoPrice } from "@0xsignal/shared";
import type { Signal, CrashIndicators, EntryIndicators } from "../types";
import type { IndicatorSet } from "./indicators";

export const detectCrashIndicators = (
  price: CryptoPrice,
  indicators: IndicatorSet
): CrashIndicators => {
  const rapidDrop = price.change24h < -15;
  const volumeSpike = indicators.volumeROC.value > 100;
  const oversoldExtreme = indicators.rsi.rsi < 20;
  const highVolatility = indicators.atr.normalizedATR > 10;

  return {
    rapidDrop,
    volumeSpike,
    oversoldExtreme,
    highVolatility,
  };
};

export const detectEntryIndicators = (
  price: CryptoPrice,
  indicators: IndicatorSet
): EntryIndicators => {
  const trendReversal =
    indicators.macd.trend === "BULLISH" && indicators.rsi.rsi > 40 && indicators.rsi.rsi < 70;
  const volumeIncrease = indicators.volumeROC.value > 20;
  const momentumBuilding = indicators.adx.adx > 25 && price.change24h > 0;
  const bullishDivergence =
    indicators.divergence.hasDivergence && indicators.divergence.divergenceType === "BULLISH";

  return {
    trendReversal,
    volumeIncrease,
    momentumBuilding,
    bullishDivergence,
  };
};

export const generateCrashRecommendation = (
  isCrashing: boolean,
  severity: "LOW" | "MEDIUM" | "HIGH" | "EXTREME",
  priceChange: number,
  rsi: number
): string => {
  if (!isCrashing) {
    return "No crash detected. Normal market conditions.";
  }

  switch (severity) {
    case "EXTREME":
      return `EXTREME CRASH: ${Math.abs(priceChange).toFixed(1)}% drop. AVOID buying. Wait for stabilization. Consider stop-losses.`;
    case "HIGH":
      return `HIGH SEVERITY CRASH: Significant selling pressure. Wait for RSI to recover above 30 before considering entry.`;
    case "MEDIUM":
      return `MEDIUM CRASH: Market stress detected. Only enter with tight stop-losses. Watch for reversal signals.`;
    case "LOW":
      return `LOW SEVERITY: Minor crash indicators. Monitor closely but not critical yet.`;
  }
};

export const generateEntryRecommendation = (
  isOptimalEntry: boolean,
  strength: "WEAK" | "MODERATE" | "STRONG" | "VERY_STRONG",
  entry: number,
  target: number,
  stopLoss: number
): string => {
  if (!isOptimalEntry) {
    return "Not optimal entry. Wait for stronger bull signals.";
  }

  const riskReward = ((target - entry) / (entry - stopLoss)).toFixed(2);

  switch (strength) {
    case "VERY_STRONG":
      return `VERY STRONG BULL ENTRY: Multiple confirmations. Entry: ${entry.toFixed(2)}, Target: ${target.toFixed(2)}, Stop: ${stopLoss.toFixed(2)}. Risk/Reward: ${riskReward}:1. Consider larger position.`;
    case "STRONG":
      return `STRONG BULL ENTRY: Good setup with confirmation. Entry: ${entry.toFixed(2)}, Target: ${target.toFixed(2)}, Stop: ${stopLoss.toFixed(2)}. Risk/Reward: ${riskReward}:1.`;
    case "MODERATE":
      return `MODERATE BULL ENTRY: Decent setup but watch closely. Entry: ${entry.toFixed(2)}, Target: ${target.toFixed(2)}, Stop: ${stopLoss.toFixed(2)}. Risk/Reward: ${riskReward}:1. Use smaller position.`;
    case "WEAK":
      return `WEAK BULL SIGNAL: Entry possible but risky. Consider waiting for stronger confirmation.`;
  }
};

export const calculateEntryLevels = (
  price: number,
  strength: "WEAK" | "MODERATE" | "STRONG" | "VERY_STRONG"
): { target: number; stopLoss: number } => {
  const targetMultiplier =
    strength === "VERY_STRONG"
      ? 1.2
      : strength === "STRONG"
        ? 1.15
        : strength === "MODERATE"
          ? 1.1
          : 1.05;

  const stopPercent =
    strength === "VERY_STRONG"
      ? 0.05
      : strength === "STRONG"
        ? 0.07
        : strength === "MODERATE"
          ? 0.1
          : 0.12;

  return {
    target: price * targetMultiplier,
    stopLoss: price * (1 - stopPercent),
  };
};
