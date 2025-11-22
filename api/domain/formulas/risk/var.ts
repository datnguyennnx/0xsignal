import { Effect } from "effect";
import type { FormulaMetadata } from "../core/types";

// ============================================================================
// VALUE AT RISK (VaR) - Downside Risk Measure
// ============================================================================
// Estimates the maximum loss over a given time period at a confidence level
//
// Formula (Historical Method):
// VaR = Quantile of returns distribution at (1 - confidence level)
//
// Interpretation:
// - VaR at 95%: Expected to lose no more than VaR in 95% of cases
// - VaR at 99%: Expected to lose no more than VaR in 99% of cases
// - More negative = higher risk
// ============================================================================

export interface VaRResult {
  readonly var95: number; // VaR at 95% confidence (%)
  readonly var99: number; // VaR at 99% confidence (%)
  readonly riskLevel: "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH";
}

/**
 * Pure function to calculate quantile
 */
const calculateQuantile = (
  sortedValues: ReadonlyArray<number>,
  quantile: number
): number => {
  const index = quantile * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) {
    return sortedValues[lower];
  }

  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
};

/**
 * Pure function to calculate Value at Risk
 * @param returns - Array of returns
 */
export const calculateVaR = (
  returns: ReadonlyArray<number>
): VaRResult => {
  // Sort returns in ascending order
  const sortedReturns = [...returns].sort((a, b) => a - b);

  // Calculate VaR at 95% and 99% confidence levels
  const var95 = calculateQuantile(sortedReturns, 0.05);
  const var99 = calculateQuantile(sortedReturns, 0.01);

  // Determine risk level based on 95% VaR
  let riskLevel: "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH";
  const absVar95 = Math.abs(var95);
  if (absVar95 < 0.01) {
    riskLevel = "LOW";
  } else if (absVar95 < 0.02) {
    riskLevel = "MODERATE";
  } else if (absVar95 < 0.05) {
    riskLevel = "HIGH";
  } else {
    riskLevel = "VERY_HIGH";
  }

  return {
    var95: Math.round(var95 * 10000) / 100, // Convert to percentage
    var99: Math.round(var99 * 10000) / 100,
    riskLevel,
  };
};

/**
 * Effect-based wrapper for VaR calculation
 */
export const computeVaR = (
  returns: ReadonlyArray<number>
): Effect.Effect<VaRResult> => Effect.sync(() => calculateVaR(returns));

// ============================================================================
// FORMULA METADATA
// ============================================================================

export const VaRMetadata: FormulaMetadata = {
  name: "VaR",
  category: "risk",
  difficulty: "advanced",
  description: "Value at Risk - maximum expected loss at confidence level",
  requiredInputs: ["returns"],
  optionalInputs: [],
  minimumDataPoints: 20,
  outputType: "VaRResult",
  useCases: [
    "risk management",
    "capital allocation",
    "regulatory compliance",
    "downside risk measurement",
  ],
  timeComplexity: "O(n log n)",
  dependencies: [],
};
