/** Signal Detection - Crash and entry signal detection */

import { Match } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import type { CrashIndicators, EntryIndicators } from "../types";
import type { IndicatorSet } from "./indicators";

// Detect crash indicators
export const detectCrashIndicators = (
  price: CryptoPrice,
  indicators: IndicatorSet
): CrashIndicators => ({
  rapidDrop: price.change24h < -15,
  volumeSpike: indicators.volumeROC.value > 100,
  oversoldExtreme: indicators.rsi.rsi < 20,
  highVolatility: indicators.atr.normalizedATR > 10,
});

// Detect entry indicators
export const detectEntryIndicators = (
  price: CryptoPrice,
  indicators: IndicatorSet
): EntryIndicators => ({
  trendReversal:
    indicators.macd.trend === "BULLISH" && indicators.rsi.rsi > 40 && indicators.rsi.rsi < 70,
  volumeIncrease: indicators.volumeROC.value > 20,
  momentumBuilding: indicators.adx.adx > 25 && price.change24h > 0,
  bullishDivergence:
    indicators.divergence.hasDivergence && indicators.divergence.divergenceType === "BULLISH",
});

// Crash severity type
type CrashSeverity = "LOW" | "MEDIUM" | "HIGH" | "EXTREME";

// Crash recommendation using Match
const crashRecommendation = Match.type<{ severity: CrashSeverity; change: number }>().pipe(
  Match.when(
    { severity: "EXTREME" },
    ({ change }) =>
      `EXTREME CRASH: ${Math.abs(change).toFixed(1)}% drop. AVOID buying. Wait for stabilization. Consider stop-losses.`
  ),
  Match.when(
    { severity: "HIGH" },
    () =>
      `HIGH SEVERITY CRASH: Significant selling pressure. Wait for RSI to recover above 30 before considering entry.`
  ),
  Match.when(
    { severity: "MEDIUM" },
    () =>
      `MEDIUM CRASH: Market stress detected. Only enter with tight stop-losses. Watch for reversal signals.`
  ),
  Match.orElse(() => `LOW SEVERITY: Minor crash indicators. Monitor closely but not critical yet.`)
);

export const generateCrashRecommendation = (
  isCrashing: boolean,
  severity: CrashSeverity,
  priceChange: number,
  _rsi: number
): string =>
  isCrashing
    ? crashRecommendation({ severity, change: priceChange })
    : "No crash detected. Normal market conditions.";

// Entry strength type
type EntryStrength = "WEAK" | "MODERATE" | "STRONG" | "VERY_STRONG";

// Entry levels based on strength
const strengthConfig = Match.type<EntryStrength>().pipe(
  Match.when("VERY_STRONG", () => ({ targetMult: 1.2, stopPct: 0.05 })),
  Match.when("STRONG", () => ({ targetMult: 1.15, stopPct: 0.07 })),
  Match.when("MODERATE", () => ({ targetMult: 1.1, stopPct: 0.1 })),
  Match.orElse(() => ({ targetMult: 1.05, stopPct: 0.12 }))
);

export const calculateEntryLevels = (price: number, strength: EntryStrength) => {
  const { targetMult, stopPct } = strengthConfig(strength);
  return { target: price * targetMult, stopLoss: price * (1 - stopPct) };
};

// Entry recommendation using Match
const entryRecommendation = Match.type<{
  strength: EntryStrength;
  entry: number;
  target: number;
  stop: number;
  rr: string;
}>().pipe(
  Match.when(
    { strength: "VERY_STRONG" },
    ({ entry, target, stop, rr }) =>
      `VERY STRONG BULL ENTRY: Multiple confirmations. Entry: ${entry.toFixed(2)}, Target: ${target.toFixed(2)}, Stop: ${stop.toFixed(2)}. Risk/Reward: ${rr}:1. Consider larger position.`
  ),
  Match.when(
    { strength: "STRONG" },
    ({ entry, target, stop, rr }) =>
      `STRONG BULL ENTRY: Good setup with confirmation. Entry: ${entry.toFixed(2)}, Target: ${target.toFixed(2)}, Stop: ${stop.toFixed(2)}. Risk/Reward: ${rr}:1.`
  ),
  Match.when(
    { strength: "MODERATE" },
    ({ entry, target, stop, rr }) =>
      `MODERATE BULL ENTRY: Decent setup but watch closely. Entry: ${entry.toFixed(2)}, Target: ${target.toFixed(2)}, Stop: ${stop.toFixed(2)}. Risk/Reward: ${rr}:1. Use smaller position.`
  ),
  Match.orElse(
    () => `WEAK BULL SIGNAL: Entry possible but risky. Consider waiting for stronger confirmation.`
  )
);

export const generateEntryRecommendation = (
  isOptimalEntry: boolean,
  strength: EntryStrength,
  entry: number,
  target: number,
  stopLoss: number
): string => {
  if (!isOptimalEntry) return "Not optimal entry. Wait for stronger bull signals.";
  const rr = ((target - entry) / (entry - stopLoss)).toFixed(2);
  return entryRecommendation({ strength, entry, target, stop: stopLoss, rr });
};
