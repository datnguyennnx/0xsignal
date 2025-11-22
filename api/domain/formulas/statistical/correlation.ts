import { Effect } from "effect";
import type { FormulaMetadata } from "../core/types";
import { mean } from "../core/math";

// ============================================================================
// CORRELATION COEFFICIENT - Pearson's r
// ============================================================================
// Measures the linear relationship between two variables
//
// Formula:
// r = Σ[(x - x̄)(y - ȳ)] / √[Σ(x - x̄)² × Σ(y - ȳ)²]
//
// Interpretation:
// - r = 1: Perfect positive correlation
// - r = 0: No linear correlation
// - r = -1: Perfect negative correlation
// - |r| > 0.7: Strong correlation
// - |r| < 0.3: Weak correlation
// ============================================================================

export interface CorrelationResult {
  readonly coefficient: number; // Pearson's r (-1 to 1)
  readonly strength: "VERY_STRONG" | "STRONG" | "MODERATE" | "WEAK" | "VERY_WEAK";
  readonly direction: "POSITIVE" | "NEGATIVE" | "NONE";
  readonly rSquared: number; // Coefficient of determination
}

/**
 * Pure function to calculate Pearson Correlation Coefficient
 * @param series1 - First data series
 * @param series2 - Second data series
 */
export const calculateCorrelation = (
  series1: ReadonlyArray<number>,
  series2: ReadonlyArray<number>
): CorrelationResult => {
  const n = Math.min(series1.length, series2.length);
  const x = series1.slice(0, n);
  const y = series2.slice(0, n);

  const meanX = mean([...x]);
  const meanY = mean([...y]);

  // Calculate covariance and standard deviations
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

  // Calculate correlation coefficient
  const denominator = Math.sqrt(varX * varY);
  const coefficient = denominator === 0 ? 0 : covariance / denominator;

  // Determine strength
  const absR = Math.abs(coefficient);
  let strength: "VERY_STRONG" | "STRONG" | "MODERATE" | "WEAK" | "VERY_WEAK";
  if (absR > 0.9) {
    strength = "VERY_STRONG";
  } else if (absR > 0.7) {
    strength = "STRONG";
  } else if (absR > 0.5) {
    strength = "MODERATE";
  } else if (absR > 0.3) {
    strength = "WEAK";
  } else {
    strength = "VERY_WEAK";
  }

  // Determine direction
  let direction: "POSITIVE" | "NEGATIVE" | "NONE";
  if (coefficient > 0.1) {
    direction = "POSITIVE";
  } else if (coefficient < -0.1) {
    direction = "NEGATIVE";
  } else {
    direction = "NONE";
  }

  // R-squared (coefficient of determination)
  const rSquared = coefficient * coefficient;

  return {
    coefficient: Math.round(coefficient * 10000) / 10000,
    strength,
    direction,
    rSquared: Math.round(rSquared * 10000) / 10000,
  };
};

/**
 * Effect-based wrapper for Correlation calculation
 */
export const computeCorrelation = (
  series1: ReadonlyArray<number>,
  series2: ReadonlyArray<number>
): Effect.Effect<CorrelationResult> =>
  Effect.sync(() => calculateCorrelation(series1, series2));

// ============================================================================
// FORMULA METADATA
// ============================================================================

export const CorrelationMetadata: FormulaMetadata = {
  name: "Correlation",
  category: "statistical",
  difficulty: "advanced",
  description: "Pearson Correlation - measures linear relationship between two series",
  requiredInputs: ["series1", "series2"],
  optionalInputs: [],
  minimumDataPoints: 2,
  outputType: "CorrelationResult",
  useCases: [
    "relationship analysis",
    "portfolio diversification",
    "pair trading",
    "factor analysis",
  ],
  timeComplexity: "O(n)",
  dependencies: [],
};
