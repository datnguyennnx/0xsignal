import { Effect } from "effect";
import type { FormulaMetadata } from "../core/types";

// ============================================================================
// MAXIMUM DRAWDOWN - Peak-to-Trough Decline
// ============================================================================
// Measures the largest peak-to-trough decline in portfolio value
//
// Formula:
// MDD = (Trough Value - Peak Value) / Peak Value
//
// Interpretation:
// - MDD = 0: No drawdown
// - MDD < -10%: Moderate drawdown
// - MDD < -20%: Significant drawdown
// - MDD < -50%: Severe drawdown
// - Lower is worse (more negative)
// ============================================================================

export interface MaximumDrawdownResult {
  readonly value: number; // Maximum drawdown (%)
  readonly peakIndex: number; // Index of peak
  readonly troughIndex: number; // Index of trough
  readonly duration: number; // Periods from peak to trough
  readonly severity: "NONE" | "MILD" | "MODERATE" | "SIGNIFICANT" | "SEVERE";
}

/**
 * Pure function to calculate Maximum Drawdown
 * @param values - Array of portfolio values or prices
 */
export const calculateMaximumDrawdown = (values: ReadonlyArray<number>): MaximumDrawdownResult => {
  let maxDrawdown = 0;
  let peakIndex = 0;
  let troughIndex = 0;
  let peak = values[0];
  let peakIdx = 0;

  // Find maximum drawdown
  for (let i = 1; i < values.length; i++) {
    if (values[i] > peak) {
      peak = values[i];
      peakIdx = i;
    }

    const drawdown = (values[i] - peak) / peak;
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
      peakIndex = peakIdx;
      troughIndex = i;
    }
  }

  const duration = troughIndex - peakIndex;

  // Determine severity
  let severity: "NONE" | "MILD" | "MODERATE" | "SIGNIFICANT" | "SEVERE";
  const absDD = Math.abs(maxDrawdown);
  if (absDD < 0.05) {
    severity = "NONE";
  } else if (absDD < 0.1) {
    severity = "MILD";
  } else if (absDD < 0.2) {
    severity = "MODERATE";
  } else if (absDD < 0.5) {
    severity = "SIGNIFICANT";
  } else {
    severity = "SEVERE";
  }

  return {
    value: Math.round(maxDrawdown * 10000) / 100, // Convert to percentage
    peakIndex,
    troughIndex,
    duration,
    severity,
  };
};

/**
 * Effect-based wrapper for Maximum Drawdown calculation
 */
export const computeMaximumDrawdown = (
  values: ReadonlyArray<number>
): Effect.Effect<MaximumDrawdownResult> => Effect.sync(() => calculateMaximumDrawdown(values));

// ============================================================================
// FORMULA METADATA
// ============================================================================

export const MaximumDrawdownMetadata: FormulaMetadata = {
  name: "MaximumDrawdown",
  category: "risk",
  difficulty: "advanced",
  description: "Maximum Drawdown - largest peak-to-trough decline",
  requiredInputs: ["values"],
  optionalInputs: [],
  minimumDataPoints: 2,
  outputType: "MaximumDrawdownResult",
  useCases: [
    "risk assessment",
    "downside risk measurement",
    "strategy evaluation",
    "capital preservation",
  ],
  timeComplexity: "O(n)",
  dependencies: [],
};
