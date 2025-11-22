import { Effect } from "effect";
import type { FormulaMetadata } from "../core/types";
import { mean } from "../core/math";

// ============================================================================
// SORTINO RATIO - Downside Risk-Adjusted Return
// ============================================================================
// Similar to Sharpe but only penalizes downside volatility
//
// Formula:
// Sortino = (R_p - R_f) / σ_d
// where σ_d = downside deviation (only negative returns)
//
// Interpretation:
// - Sortino > 2: Excellent
// - Sortino > 1: Good
// - Sortino > 0: Acceptable
// - Sortino < 0: Poor
// - Higher is better
// ============================================================================

export interface SortinoRatioResult {
  readonly value: number; // Sortino ratio
  readonly rating: "EXCELLENT" | "GOOD" | "ACCEPTABLE" | "POOR";
  readonly downsideDeviation: number; // Downside volatility
  readonly excessReturn: number; // Return above target
}

/**
 * Pure function to calculate Sortino Ratio
 * @param returns - Array of returns
 * @param targetReturn - Target/minimum acceptable return (default: 0)
 * @param annualizationFactor - Factor to annualize (default: 252)
 */
export const calculateSortinoRatio = (
  returns: ReadonlyArray<number>,
  targetReturn: number = 0,
  annualizationFactor: number = 252
): SortinoRatioResult => {
  // Calculate average return
  const avgReturn = mean([...returns]);

  // Calculate downside deviation (only negative deviations from target)
  const downsideReturns = returns
    .map((r) => Math.min(0, r - targetReturn))
    .map((r) => r * r);

  const downsideVariance =
    downsideReturns.reduce((a, b) => a + b, 0) / returns.length;
  const downsideDeviation = Math.sqrt(downsideVariance);

  // Annualize
  const annualizedReturn = avgReturn * annualizationFactor;
  const annualizedDownsideDev = downsideDeviation * Math.sqrt(annualizationFactor);
  const annualizedTarget = targetReturn * annualizationFactor;

  // Calculate excess return
  const excessReturn = annualizedReturn - annualizedTarget;

  // Calculate Sortino ratio
  const sortino =
    annualizedDownsideDev === 0 ? 0 : excessReturn / annualizedDownsideDev;

  // Determine rating
  let rating: "EXCELLENT" | "GOOD" | "ACCEPTABLE" | "POOR";
  if (sortino > 2) {
    rating = "EXCELLENT";
  } else if (sortino > 1) {
    rating = "GOOD";
  } else if (sortino > 0) {
    rating = "ACCEPTABLE";
  } else {
    rating = "POOR";
  }

  return {
    value: Math.round(sortino * 10000) / 10000,
    rating,
    downsideDeviation: Math.round(annualizedDownsideDev * 10000) / 10000,
    excessReturn: Math.round(excessReturn * 10000) / 10000,
  };
};

/**
 * Effect-based wrapper for Sortino Ratio calculation
 */
export const computeSortinoRatio = (
  returns: ReadonlyArray<number>,
  targetReturn: number = 0,
  annualizationFactor: number = 252
): Effect.Effect<SortinoRatioResult> =>
  Effect.sync(() =>
    calculateSortinoRatio(returns, targetReturn, annualizationFactor)
  );

// ============================================================================
// FORMULA METADATA
// ============================================================================

export const SortinoRatioMetadata: FormulaMetadata = {
  name: "SortinoRatio",
  category: "risk",
  difficulty: "advanced",
  description: "Sortino Ratio - downside risk-adjusted return measure",
  requiredInputs: ["returns"],
  optionalInputs: ["targetReturn", "annualizationFactor"],
  minimumDataPoints: 2,
  outputType: "SortinoRatioResult",
  useCases: [
    "downside risk assessment",
    "performance evaluation",
    "strategy comparison",
    "asymmetric risk measurement",
  ],
  timeComplexity: "O(n)",
  dependencies: [],
};
