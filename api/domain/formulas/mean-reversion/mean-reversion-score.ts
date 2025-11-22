import { Effect } from "effect";
import type { FormulaMetadata } from "../core/types";
import type { CryptoPrice } from "@0xsignal/shared";
import { calculatePctB } from "./percent-b";
import { calculateBBWidth } from "./bollinger-width";
import { calculateDistanceFromMA } from "./distance-from-ma";
import { calculateKeltnerWidth } from "./keltner-width";

// ============================================================================
// MEAN REVERSION SCORE - Composite Mean Reversion Signal
// ============================================================================
// Combines multiple mean reversion indicators into a single score
// Higher score = stronger mean reversion opportunity
//
// Components:
// - Percent B (30% weight)
// - Bollinger Width (25% weight)
// - Distance from MA (25% weight)
// - Keltner Width (20% weight)
//
// Interpretation:
// - Score > 80: Strong mean reversion setup
// - Score > 60: Good mean reversion setup
// - Score < 40: Weak mean reversion setup
// - Direction: BUY (oversold) or SELL (overbought)
// ============================================================================

export interface MeanReversionScoreResult {
  readonly score: number; // 0-100
  readonly direction: "BUY" | "SELL" | "NEUTRAL";
  readonly strength: "VERY_STRONG" | "STRONG" | "MODERATE" | "WEAK" | "VERY_WEAK";
  readonly components: {
    readonly percentB: number;
    readonly bollingerWidth: number;
    readonly distanceFromMA: number;
    readonly keltnerWidth: number;
  };
}

/**
 * Pure function to calculate Mean Reversion Score
 */
export const calculateMeanReversionScore = (
  price: CryptoPrice
): MeanReversionScoreResult => {
  // Calculate all components
  const pctB = calculatePctB(price);
  const bbWidth = calculateBBWidth(price);
  const distMA = calculateDistanceFromMA(price);
  const kcWidth = calculateKeltnerWidth(price);

  // Component scores (0-100)
  // Percent B: extreme values = high score
  const pctBScore = pctB.value > 1 || pctB.value < 0 ? 100 : Math.abs(pctB.value - 0.5) * 200;

  // Bollinger Width: narrow = high score (squeeze)
  const bbWidthScore = bbWidth.squeeze === "TIGHT" ? 100 : bbWidth.squeeze === "MODERATE" ? 70 : 40;

  // Distance from MA: large distance = high score
  const distMAScore = Math.min(Math.abs(distMA.distance) * 5, 100);

  // Keltner Width: narrow = high score
  const kcWidthScore =
    kcWidth.volatility === "VERY_LOW" ? 100 : kcWidth.volatility === "LOW" ? 70 : 40;

  // Weighted composite score
  const score =
    pctBScore * 0.3 + bbWidthScore * 0.25 + distMAScore * 0.25 + kcWidthScore * 0.2;

  // Determine direction
  let direction: "BUY" | "SELL" | "NEUTRAL";
  if (pctB.value < 0.2 || distMA.distance < -5) {
    direction = "BUY"; // Oversold
  } else if (pctB.value > 0.8 || distMA.distance > 5) {
    direction = "SELL"; // Overbought
  } else {
    direction = "NEUTRAL";
  }

  // Determine strength
  let strength: "VERY_STRONG" | "STRONG" | "MODERATE" | "WEAK" | "VERY_WEAK";
  if (score > 80) {
    strength = "VERY_STRONG";
  } else if (score > 60) {
    strength = "STRONG";
  } else if (score > 40) {
    strength = "MODERATE";
  } else if (score > 20) {
    strength = "WEAK";
  } else {
    strength = "VERY_WEAK";
  }

  return {
    score: Math.round(score),
    direction,
    strength,
    components: {
      percentB: Math.round(pctBScore),
      bollingerWidth: Math.round(bbWidthScore),
      distanceFromMA: Math.round(distMAScore),
      keltnerWidth: Math.round(kcWidthScore),
    },
  };
};

/**
 * Effect-based wrapper for Mean Reversion Score calculation
 */
export const computeMeanReversionScore = (
  price: CryptoPrice
): Effect.Effect<MeanReversionScoreResult> =>
  Effect.sync(() => calculateMeanReversionScore(price));

// ============================================================================
// FORMULA METADATA
// ============================================================================

export const MeanReversionScoreMetadata: FormulaMetadata = {
  name: "MeanReversionScore",
  category: "composite",
  difficulty: "advanced",
  description: "Mean Reversion Score - composite mean reversion signal",
  requiredInputs: ["price", "high24h", "low24h"],
  optionalInputs: [],
  minimumDataPoints: 1,
  outputType: "MeanReversionScoreResult",
  useCases: [
    "mean reversion trading",
    "reversal opportunity identification",
    "composite signal generation",
    "trading strategy optimization",
  ],
  timeComplexity: "O(1)",
  dependencies: ["PercentB", "BollingerWidth", "DistanceFromMA", "KeltnerWidth"],
};
