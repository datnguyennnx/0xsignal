/**
 * Pattern Matching Utilities
 * Type-safe pattern matching for domain types
 */

import { Match } from "effect";
import type { Signal, MarketRegime, NoiseScore } from "./types";

// Noise level type (extracted from NoiseScore)
type NoiseLevel = NoiseScore["level"];

// Signal pattern matcher
export const matchSignal = Match.type<Signal>().pipe(
  Match.when("STRONG_BUY", () => ({ score: 2, action: "enter", urgency: "high" }) as const),
  Match.when("BUY", () => ({ score: 1, action: "enter", urgency: "medium" }) as const),
  Match.when("HOLD", () => ({ score: 0, action: "wait", urgency: "low" }) as const),
  Match.when("SELL", () => ({ score: -1, action: "exit", urgency: "medium" }) as const),
  Match.when("STRONG_SELL", () => ({ score: -2, action: "exit", urgency: "high" }) as const),
  Match.exhaustive
);

// Market regime pattern matcher
export const matchRegime = Match.type<MarketRegime>().pipe(
  Match.when("BULL_MARKET", () => ({ bias: "bullish", strategies: ["momentum"] }) as const),
  Match.when("BEAR_MARKET", () => ({ bias: "bearish", strategies: ["momentum"] }) as const),
  Match.when("TRENDING", () => ({ bias: "neutral", strategies: ["momentum"] }) as const),
  Match.when("SIDEWAYS", () => ({ bias: "neutral", strategies: ["mean-reversion"] }) as const),
  Match.when(
    "MEAN_REVERSION",
    () => ({ bias: "neutral", strategies: ["mean-reversion"] }) as const
  ),
  Match.when(
    "LOW_VOLATILITY",
    () => ({ bias: "neutral", strategies: ["breakout", "mean-reversion"] }) as const
  ),
  Match.when("HIGH_VOLATILITY", () => ({ bias: "neutral", strategies: ["volatility"] }) as const),
  Match.when(
    "RANGING",
    () => ({ bias: "neutral", strategies: ["mean-reversion", "range-bound"] }) as const
  ),
  Match.when(
    "VOLATILE",
    () => ({ bias: "neutral", strategies: ["volatility", "breakout"] }) as const
  ),
  Match.when(
    "ACCUMULATION",
    () => ({ bias: "bullish", strategies: ["accumulation", "swing"] }) as const
  ),
  Match.when(
    "DISTRIBUTION",
    () => ({ bias: "bearish", strategies: ["distribution", "short"] }) as const
  ),
  Match.exhaustive
);

// Noise level to reliability mapping
const noiseReliability: Record<NoiseLevel, { reliability: number; description: string }> = {
  LOW: { reliability: 0.9, description: "High signal clarity" },
  MEDIUM: { reliability: 0.7, description: "Average noise" },
  MODERATE: { reliability: 0.7, description: "Acceptable noise" },
  HIGH: { reliability: 0.5, description: "Noisy signals" },
  EXTREME: { reliability: 0.3, description: "Very unreliable" },
};

// Signal to numeric score
export const signalToNumeric = (signal: Signal): number => matchSignal(signal).score;

// Signal to action recommendation
export const signalToAction = (signal: Signal): "enter" | "exit" | "wait" =>
  matchSignal(signal).action;

// Regime to strategy list
export const regimeToStrategies = (regime: MarketRegime): readonly string[] =>
  matchRegime(regime).strategies;

// Noise to reliability factor
export const noiseToReliability = (level: NoiseLevel): number =>
  noiseReliability[level].reliability;

// Noise to description
export const noiseToDescription = (level: NoiseLevel): string =>
  noiseReliability[level].description;
