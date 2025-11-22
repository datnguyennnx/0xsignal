import { Effect } from "effect";
import type { FormulaMetadata } from "../core/types";
import { mean } from "../core/math";
import { calculateMaximumDrawdown } from "./maximum-drawdown";

// ============================================================================
// CALMAR RATIO - Return to Drawdown Ratio
// ============================================================================
// Measures return relative to maximum drawdown
//
// Formula:
// Calmar = Annualized Return / |Maximum Drawdown|
//
// Interpretation:
// - Calmar > 3: Excellent
// - Calmar > 1: Good
// - Calmar > 0.5: Acceptable
// - Calmar < 0: Poor (negative returns)
// - Higher is better
// ============================================================================

export interface CalmarRatioResult {
  readonly value: number; // Calmar ratio
  readonly rating: "EXCELLENT" | "GOOD" | "ACCEPTABLE" | "POOR";
  readonly annualizedReturn: number; // Annualized return (%)
  readonly maxDrawdown: number; // Maximum drawdown (%)
}

/**
 * Pure function to calculate Calmar Ratio
 * @param returns - Array of returns
 * @param annualizationFactor - Factor to annualize (default: 252)
 */
export const calculateCalmarRatio = (
  returns: ReadonlyArray<number>,
  annualizationFactor: number = 252
): CalmarRatioResult => {
  // Calculate annualized return
  const avgReturn = mean([...returns]);
  const annualizedReturn = avgReturn * annualizationFactor * 100;

  // Calculate cumulative returns for drawdown
  const cumulativeReturns: number[] = [1];
  for (let i = 0; i < returns.length; i++) {
    cumulativeReturns.push(cumulativeReturns[i] * (1 + returns[i]));
  }

  // Calculate maximum drawdown
  const ddResult = calculateMaximumDrawdown(cumulativeReturns);
  const maxDrawdown = Math.abs(ddResult.value);

  // Calculate Calmar ratio
  const calmar = maxDrawdown === 0 ? 0 : annualizedReturn / maxDrawdown;

  // Determine rating
  let rating: "EXCELLENT" | "GOOD" | "ACCEPTABLE" | "POOR";
  if (calmar > 3) {
    rating = "EXCELLENT";
  } else if (calmar > 1) {
    rating = "GOOD";
  } else if (calmar > 0.5) {
    rating = "ACCEPTABLE";
  } else {
    rating = "POOR";
  }

  return {
    value: Math.round(calmar * 10000) / 10000,
    rating,
    annualizedReturn: Math.round(annualizedReturn * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
  };
};

/**
 * Effect-based wrapper for Calmar Ratio calculation
 */
export const computeCalmarRatio = (
  returns: ReadonlyArray<number>,
  annualizationFactor: number = 252
): Effect.Effect<CalmarRatioResult> =>
  Effect.sync(() => calculateCalmarRatio(returns, annualizationFactor));

// ============================================================================
// FORMULA METADATA
// ============================================================================

export const CalmarRatioMetadata: FormulaMetadata = {
  name: "CalmarRatio",
  category: "risk",
  difficulty: "advanced",
  description: "Calmar Ratio - return relative to maximum drawdown",
  requiredInputs: ["returns"],
  optionalInputs: ["annualizationFactor"],
  minimumDataPoints: 2,
  outputType: "CalmarRatioResult",
  useCases: [
    "drawdown risk assessment",
    "performance evaluation",
    "strategy comparison",
    "capital preservation focus",
  ],
  timeComplexity: "O(n)",
  dependencies: ["MaximumDrawdown"],
};
