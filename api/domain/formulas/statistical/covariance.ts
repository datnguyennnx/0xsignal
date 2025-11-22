import { Effect } from "effect";
import type { FormulaMetadata } from "../core/types";
import { mean } from "../core/math";

// ============================================================================
// COVARIANCE - Measure of Joint Variability
// ============================================================================
// Measures how two variables change together
//
// Formula:
// Cov(X,Y) = Σ[(x - x̄)(y - ȳ)] / N
//
// Interpretation:
// - Cov > 0: Variables tend to move together
// - Cov < 0: Variables tend to move in opposite directions
// - Cov = 0: No linear relationship
// - Magnitude depends on scale of variables
// ============================================================================

export interface CovarianceResult {
  readonly value: number; // Covariance value
  readonly relationship: "POSITIVE" | "NEGATIVE" | "NONE";
  readonly normalized: number; // Normalized covariance (-1 to 1)
}

/**
 * Pure function to calculate Covariance
 * @param series1 - First data series
 * @param series2 - Second data series
 */
export const calculateCovariance = (
  series1: ReadonlyArray<number>,
  series2: ReadonlyArray<number>
): CovarianceResult => {
  const n = Math.min(series1.length, series2.length);
  const x = series1.slice(0, n);
  const y = series2.slice(0, n);

  const meanX = mean([...x]);
  const meanY = mean([...y]);

  // Calculate covariance
  let covariance = 0;
  let varX = 0;
  let varY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    covariance += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }

  covariance /= n;

  // Determine relationship
  let relationship: "POSITIVE" | "NEGATIVE" | "NONE";
  if (covariance > 0.01) {
    relationship = "POSITIVE";
  } else if (covariance < -0.01) {
    relationship = "NEGATIVE";
  } else {
    relationship = "NONE";
  }

  // Normalized covariance (correlation coefficient)
  const stdX = Math.sqrt(varX / n);
  const stdY = Math.sqrt(varY / n);
  const normalized = stdX * stdY === 0 ? 0 : covariance / (stdX * stdY);

  return {
    value: Math.round(covariance * 10000) / 10000,
    relationship,
    normalized: Math.round(normalized * 10000) / 10000,
  };
};

/**
 * Effect-based wrapper for Covariance calculation
 */
export const computeCovariance = (
  series1: ReadonlyArray<number>,
  series2: ReadonlyArray<number>
): Effect.Effect<CovarianceResult> =>
  Effect.sync(() => calculateCovariance(series1, series2));

// ============================================================================
// FORMULA METADATA
// ============================================================================

export const CovarianceMetadata: FormulaMetadata = {
  name: "Covariance",
  category: "statistical",
  difficulty: "advanced",
  description: "Covariance - measures joint variability of two series",
  requiredInputs: ["series1", "series2"],
  optionalInputs: [],
  minimumDataPoints: 2,
  outputType: "CovarianceResult",
  useCases: [
    "portfolio analysis",
    "risk management",
    "relationship measurement",
    "diversification analysis",
  ],
  timeComplexity: "O(n)",
  dependencies: [],
};
