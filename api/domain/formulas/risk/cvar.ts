import { Effect } from "effect";
import type { FormulaMetadata } from "../core/types";
import { calculateVaR } from "./var";

// ============================================================================
// CVaR (Conditional Value at Risk) - Expected Shortfall
// ============================================================================
// Measures the expected loss given that the loss exceeds VaR
// More conservative than VaR as it considers tail risk
//
// Formula:
// CVaR = E[Loss | Loss > VaR]
//
// Interpretation:
// - CVaR > VaR: Tail risk exists
// - CVaR >> VaR: Significant tail risk
// - Used for risk management and capital allocation
// ============================================================================

export interface CVaRResult {
  readonly cvar95: number; // CVaR at 95% confidence (%)
  readonly cvar99: number; // CVaR at 99% confidence (%)
  readonly var95: number; // VaR at 95% for comparison
  readonly var99: number; // VaR at 99% for comparison
  readonly tailRisk: "LOW" | "MODERATE" | "HIGH" | "EXTREME";
}

/**
 * Pure function to calculate CVaR
 * @param returns - Array of returns
 */
export const calculateCVaR = (returns: ReadonlyArray<number>): CVaRResult => {
  // Calculate VaR first
  const varResult = calculateVaR(returns);

  // Sort returns
  const sortedReturns = [...returns].sort((a, b) => a - b);

  // Calculate CVaR at 95% (average of worst 5%)
  const var95Threshold = varResult.var95 / 100; // Convert back to decimal
  const worst5Percent = sortedReturns.filter((r) => r <= var95Threshold);
  const cvar95 =
    worst5Percent.length > 0
      ? worst5Percent.reduce((a, b) => a + b, 0) / worst5Percent.length
      : var95Threshold;

  // Calculate CVaR at 99% (average of worst 1%)
  const var99Threshold = varResult.var99 / 100;
  const worst1Percent = sortedReturns.filter((r) => r <= var99Threshold);
  const cvar99 =
    worst1Percent.length > 0
      ? worst1Percent.reduce((a, b) => a + b, 0) / worst1Percent.length
      : var99Threshold;

  // Determine tail risk based on CVaR/VaR ratio
  const ratio = Math.abs(cvar95 / (var95Threshold || 1));
  let tailRisk: "LOW" | "MODERATE" | "HIGH" | "EXTREME";
  if (ratio < 1.2) {
    tailRisk = "LOW";
  } else if (ratio < 1.5) {
    tailRisk = "MODERATE";
  } else if (ratio < 2) {
    tailRisk = "HIGH";
  } else {
    tailRisk = "EXTREME";
  }

  return {
    cvar95: Math.round(cvar95 * 10000) / 100,
    cvar99: Math.round(cvar99 * 10000) / 100,
    var95: varResult.var95,
    var99: varResult.var99,
    tailRisk,
  };
};

/**
 * Effect-based wrapper for CVaR calculation
 */
export const computeCVaR = (returns: ReadonlyArray<number>): Effect.Effect<CVaRResult> =>
  Effect.sync(() => calculateCVaR(returns));

// ============================================================================
// FORMULA METADATA
// ============================================================================

export const CVaRMetadata: FormulaMetadata = {
  name: "CVaR",
  category: "risk",
  difficulty: "advanced",
  description: "Conditional VaR - expected loss beyond VaR threshold",
  requiredInputs: ["returns"],
  optionalInputs: [],
  minimumDataPoints: 20,
  outputType: "CVaRResult",
  useCases: [
    "tail risk measurement",
    "extreme loss estimation",
    "capital allocation",
    "risk management",
  ],
  timeComplexity: "O(n log n)",
  dependencies: ["VaR"],
};
