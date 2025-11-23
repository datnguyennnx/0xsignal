import { Effect } from "effect";
import type { FormulaMetadata } from "../core/types";

// ============================================================================
// ROC (Rate of Change) - Momentum Indicator
// ============================================================================
// Measures the percentage change in price over a specified period
//
// Formula:
// ROC = ((Current Price - Price n periods ago) / Price n periods ago) * 100
//
// Interpretation:
// - ROC > 0: Positive momentum (price increasing)
// - ROC < 0: Negative momentum (price decreasing)
// - ROC > 10: Strong bullish momentum
// - ROC < -10: Strong bearish momentum
// ============================================================================

export interface ROCResult {
  readonly value: number; // Percentage change
  readonly signal: "STRONG_BULLISH" | "BULLISH" | "NEUTRAL" | "BEARISH" | "STRONG_BEARISH";
  readonly momentum: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
}

/**
 * Pure function to calculate Rate of Change
 * @param prices - Array of prices
 * @param period - Number of periods to look back (default: 12)
 */
export const calculateROC = (prices: ReadonlyArray<number>, period: number = 12): ROCResult => {
  const currentPrice = prices[prices.length - 1];
  const pastPrice = prices[prices.length - 1 - period];

  // Calculate percentage change
  const value = ((currentPrice - pastPrice) / pastPrice) * 100;

  // Determine momentum
  let momentum: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  if (value > 0) {
    momentum = "POSITIVE";
  } else if (value < 0) {
    momentum = "NEGATIVE";
  } else {
    momentum = "NEUTRAL";
  }

  // Determine signal strength
  let signal: "STRONG_BULLISH" | "BULLISH" | "NEUTRAL" | "BEARISH" | "STRONG_BEARISH";
  if (value > 10) {
    signal = "STRONG_BULLISH";
  } else if (value > 0) {
    signal = "BULLISH";
  } else if (value < -10) {
    signal = "STRONG_BEARISH";
  } else if (value < 0) {
    signal = "BEARISH";
  } else {
    signal = "NEUTRAL";
  }

  return {
    value: Math.round(value * 100) / 100,
    signal,
    momentum,
  };
};

/**
 * Pure function to calculate ROC series
 */
export const calculateROCSeries = (
  prices: ReadonlyArray<number>,
  period: number = 12
): ReadonlyArray<number> => {
  const result: number[] = [];

  for (let i = period; i < prices.length; i++) {
    const currentPrice = prices[i];
    const pastPrice = prices[i - period];
    const roc = ((currentPrice - pastPrice) / pastPrice) * 100;
    result.push(roc);
  }

  return result;
};

/**
 * Effect-based wrapper with validation
 */
export const computeROC = (
  prices: ReadonlyArray<number>,
  period: number = 12
): Effect.Effect<ROCResult> => Effect.sync(() => calculateROC(prices, period));

// ============================================================================
// FORMULA METADATA
// ============================================================================

export const ROCMetadata: FormulaMetadata = {
  name: "ROC",
  category: "momentum",
  difficulty: "beginner",
  description: "Rate of Change - percentage change in price over a period",
  requiredInputs: ["prices"],
  optionalInputs: ["period"],
  minimumDataPoints: 13,
  outputType: "ROCResult",
  useCases: [
    "momentum measurement",
    "trend strength analysis",
    "divergence detection",
    "overbought/oversold conditions",
  ],
  timeComplexity: "O(1)",
  dependencies: [],
};
