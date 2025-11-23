import { Effect } from "effect";
import type { FormulaMetadata } from "../core/types";
import { mean } from "../core/math";

// ============================================================================
// LINEAR REGRESSION - Least Squares Regression
// ============================================================================
// Fits a linear model to data using least squares method
//
// Formula:
// y = mx + b
// m = Σ[(x - x̄)(y - ȳ)] / Σ(x - x̄)²
// b = ȳ - m × x̄
// R² = 1 - (SS_res / SS_tot)
//
// Interpretation:
// - m (slope): Rate of change
// - b (intercept): Y value when X = 0
// - R²: Proportion of variance explained (0-1)
// - R² > 0.7: Strong fit
// ============================================================================

export interface LinearRegressionResult {
  readonly slope: number; // m
  readonly intercept: number; // b
  readonly rSquared: number; // Coefficient of determination
  readonly correlation: number; // Pearson's r
  readonly predict: (x: number) => number; // Prediction function
}

/**
 * Pure function to calculate Linear Regression
 * @param xValues - Independent variable
 * @param yValues - Dependent variable
 */
export const calculateLinearRegression = (
  xValues: ReadonlyArray<number>,
  yValues: ReadonlyArray<number>
): LinearRegressionResult => {
  const n = Math.min(xValues.length, yValues.length);
  const x = xValues.slice(0, n);
  const y = yValues.slice(0, n);

  const meanX = mean([...x]);
  const meanY = mean([...y]);

  // Calculate slope and intercept
  let numerator = 0;
  let denominator = 0;
  let ssTotal = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    denominator += dx * dx;
    ssTotal += dy * dy;
  }

  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = meanY - slope * meanX;

  // Calculate R-squared
  let ssResidual = 0;
  for (let i = 0; i < n; i++) {
    const predicted = slope * x[i] + intercept;
    const residual = y[i] - predicted;
    ssResidual += residual * residual;
  }

  const rSquared = ssTotal === 0 ? 0 : 1 - ssResidual / ssTotal;

  // Calculate correlation coefficient
  const correlation = Math.sqrt(Math.abs(rSquared)) * (slope >= 0 ? 1 : -1);

  // Prediction function
  const predict = (xVal: number): number => slope * xVal + intercept;

  return {
    slope: Math.round(slope * 10000) / 10000,
    intercept: Math.round(intercept * 10000) / 10000,
    rSquared: Math.round(rSquared * 10000) / 10000,
    correlation: Math.round(correlation * 10000) / 10000,
    predict,
  };
};

/**
 * Effect-based wrapper for Linear Regression calculation
 */
export const computeLinearRegression = (
  xValues: ReadonlyArray<number>,
  yValues: ReadonlyArray<number>
): Effect.Effect<LinearRegressionResult> =>
  Effect.sync(() => calculateLinearRegression(xValues, yValues));

// ============================================================================
// FORMULA METADATA
// ============================================================================

export const LinearRegressionMetadata: FormulaMetadata = {
  name: "LinearRegression",
  category: "statistical",
  difficulty: "advanced",
  description: "Linear Regression - least squares line fitting",
  requiredInputs: ["xValues", "yValues"],
  optionalInputs: [],
  minimumDataPoints: 2,
  outputType: "LinearRegressionResult",
  useCases: ["trend analysis", "forecasting", "relationship modeling", "price prediction"],
  timeComplexity: "O(n)",
  dependencies: [],
};
