import { Effect } from "effect";
import type { FormulaMetadata } from "../core/types";
import type { CryptoPrice } from "@0xsignal/shared";

// ============================================================================
// DISTANCE FROM MOVING AVERAGE - Mean Reversion Indicator
// ============================================================================
// Measures how far price has deviated from its moving average
// Large deviations often revert to the mean
//
// Formula:
// Distance = (Price - MA) / MA × 100
//
// Interpretation:
// - Distance > 5%: Significantly above MA (potential reversal down)
// - Distance < -5%: Significantly below MA (potential reversal up)
// - Distance near 0: Price at MA (equilibrium)
// - Extreme distances: Strong mean reversion opportunity
// ============================================================================

export interface DistanceFromMAResult {
  readonly distance: number; // Percentage distance from MA
  readonly signal: "EXTREME_ABOVE" | "ABOVE" | "NEUTRAL" | "BELOW" | "EXTREME_BELOW";
  readonly meanReversionSetup: boolean; // True if good reversion opportunity
  readonly strength: number; // 0-100 (strength of deviation)
}

/**
 * Pure function to calculate Distance from Moving Average
 * Uses 24h average as proxy for MA
 */
export const calculateDistanceFromMA = (price: CryptoPrice): DistanceFromMAResult => {
  // Approximate MA using 24h average
  const ma =
    price.high24h && price.low24h ? (price.high24h + price.low24h + price.price) / 3 : price.price;

  // Calculate percentage distance
  const distance = ma === 0 ? 0 : ((price.price - ma) / ma) * 100;

  // Determine signal
  let signal: "EXTREME_ABOVE" | "ABOVE" | "NEUTRAL" | "BELOW" | "EXTREME_BELOW";
  if (distance > 10) {
    signal = "EXTREME_ABOVE";
  } else if (distance > 5) {
    signal = "ABOVE";
  } else if (distance < -10) {
    signal = "EXTREME_BELOW";
  } else if (distance < -5) {
    signal = "BELOW";
  } else {
    signal = "NEUTRAL";
  }

  // Mean reversion setup: extreme deviations
  const meanReversionSetup = Math.abs(distance) > 5;

  // Calculate strength (0-100)
  const strength = Math.min(Math.abs(distance) * 5, 100);

  return {
    distance: Math.round(distance * 100) / 100,
    signal,
    meanReversionSetup,
    strength: Math.round(strength),
  };
};

/**
 * Effect-based wrapper for Distance from MA calculation
 */
export const computeDistanceFromMA = (price: CryptoPrice): Effect.Effect<DistanceFromMAResult> =>
  Effect.sync(() => calculateDistanceFromMA(price));

// ============================================================================
// FORMULA METADATA
// ============================================================================

export const DistanceFromMAMetadata: FormulaMetadata = {
  name: "DistanceFromMA",
  category: "statistical",
  difficulty: "intermediate",
  description: "Distance from Moving Average - mean reversion indicator",
  requiredInputs: ["price", "high24h", "low24h"],
  optionalInputs: [],
  minimumDataPoints: 1,
  outputType: "DistanceFromMAResult",
  useCases: [
    "mean reversion trading",
    "overbought/oversold detection",
    "deviation measurement",
    "reversal opportunity identification",
  ],
  timeComplexity: "O(1)",
  dependencies: [],
};
