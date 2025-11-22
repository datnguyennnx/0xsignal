import { Effect } from "effect";
import type { FormulaMetadata } from "../core/types";

// ============================================================================
// MOMENTUM - Price Momentum Indicator
// ============================================================================
// Measures the absolute change in price over a specified period
// Unlike ROC which measures percentage change, Momentum measures absolute change
//
// Formula:
// Momentum = Current Price - Price n periods ago
//
// Interpretation:
// - Momentum > 0: Upward momentum
// - Momentum < 0: Downward momentum
// - Increasing Momentum: Strengthening trend
// - Decreasing Momentum: Weakening trend
// ============================================================================

export interface MomentumResult {
  readonly value: number; // Absolute price change
  readonly direction: "UP" | "DOWN" | "FLAT";
  readonly strength: number; // 0-100 scale
}

/**
 * Pure function to calculate Momentum
 * @param prices - Array of prices
 * @param period - Number of periods to look back (default: 10)
 */
export const calculateMomentum = (
  prices: ReadonlyArray<number>,
  period: number = 10
): MomentumResult => {
  const currentPrice = prices[prices.length - 1];
  const pastPrice = prices[prices.length - 1 - period];

  // Calculate absolute change
  const value = currentPrice - pastPrice;

  // Determine direction
  let direction: "UP" | "DOWN" | "FLAT";
  if (value > 0) {
    direction = "UP";
  } else if (value < 0) {
    direction = "DOWN";
  } else {
    direction = "FLAT";
  }

  // Calculate strength (normalized to 0-100)
  // Use percentage of current price as a proxy for strength
  const percentChange = Math.abs((value / pastPrice) * 100);
  const strength = Math.min(percentChange * 10, 100);

  return {
    value: Math.round(value * 100) / 100,
    direction,
    strength: Math.round(strength * 100) / 100,
  };
};

/**
 * Pure function to calculate Momentum series
 */
export const calculateMomentumSeries = (
  prices: ReadonlyArray<number>,
  period: number = 10
): ReadonlyArray<number> => {
  const result: number[] = [];

  for (let i = period; i < prices.length; i++) {
    const currentPrice = prices[i];
    const pastPrice = prices[i - period];
    const momentum = currentPrice - pastPrice;
    result.push(momentum);
  }

  return result;
};

/**
 * Effect-based wrapper with validation
 */
export const computeMomentum = (
  prices: ReadonlyArray<number>,
  period: number = 10
): Effect.Effect<MomentumResult> =>
  Effect.sync(() => calculateMomentum(prices, period));

// ============================================================================
// FORMULA METADATA
// ============================================================================

export const MomentumMetadata: FormulaMetadata = {
  name: "Momentum",
  category: "momentum",
  difficulty: "beginner",
  description: "Momentum - absolute price change over a period",
  requiredInputs: ["prices"],
  optionalInputs: ["period"],
  minimumDataPoints: 11,
  outputType: "MomentumResult",
  useCases: [
    "trend strength measurement",
    "momentum analysis",
    "divergence detection",
    "trend continuation signals",
  ],
  timeComplexity: "O(1)",
  dependencies: [],
};
