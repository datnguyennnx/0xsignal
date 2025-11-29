/** Linear Regression - Least squares line fitting with functional patterns */
// y = mx + b, m = Cov(X,Y) / Var(X), b = mean_y - m * mean_x

import { Effect, Array as Arr, pipe } from "effect";
import type { FormulaMetadata } from "../core/types";
import { mean } from "../core/math";

export interface LinearRegressionResult {
  readonly slope: number;
  readonly intercept: number;
  readonly rSquared: number;
  readonly correlation: number;
  readonly predict: (x: number) => number;
}

// Round to 4 decimal places
const round4 = (n: number): number => Math.round(n * 10000) / 10000;

// Statistics accumulator
interface StatsAccum {
  readonly numerator: number;
  readonly denominator: number;
  readonly ssTotal: number;
}

// Calculate regression statistics using Arr.reduce
const calculateRegressionStats = (
  x: ReadonlyArray<number>,
  y: ReadonlyArray<number>,
  meanX: number,
  meanY: number
): StatsAccum =>
  pipe(
    Arr.zipWith(x, y, (xi, yi) => ({ dx: xi - meanX, dy: yi - meanY })),
    Arr.reduce({ numerator: 0, denominator: 0, ssTotal: 0 }, (acc, { dx, dy }) => ({
      numerator: acc.numerator + dx * dy,
      denominator: acc.denominator + dx * dx,
      ssTotal: acc.ssTotal + dy * dy,
    }))
  );

// Calculate residual sum of squares
const calculateSSResidual = (
  x: ReadonlyArray<number>,
  y: ReadonlyArray<number>,
  slope: number,
  intercept: number
): number =>
  pipe(
    Arr.zipWith(x, y, (xi, yi) => {
      const predicted = slope * xi + intercept;
      const residual = yi - predicted;
      return residual * residual;
    }),
    Arr.reduce(0, (a, b) => a + b)
  );

// Calculate Linear Regression
export const calculateLinearRegression = (
  xValues: ReadonlyArray<number>,
  yValues: ReadonlyArray<number>
): LinearRegressionResult => {
  const n = Math.min(xValues.length, yValues.length);
  const x = Arr.take(xValues, n);
  const y = Arr.take(yValues, n);
  const meanX = mean([...x]);
  const meanY = mean([...y]);

  const stats = calculateRegressionStats(x, y, meanX, meanY);
  const slope = stats.denominator === 0 ? 0 : stats.numerator / stats.denominator;
  const intercept = meanY - slope * meanX;

  const ssResidual = calculateSSResidual(x, y, slope, intercept);
  const rSquared = stats.ssTotal === 0 ? 0 : 1 - ssResidual / stats.ssTotal;
  const correlation = Math.sqrt(Math.abs(rSquared)) * (slope >= 0 ? 1 : -1);
  const predict = (xVal: number): number => slope * xVal + intercept;

  return {
    slope: round4(slope),
    intercept: round4(intercept),
    rSquared: round4(rSquared),
    correlation: round4(correlation),
    predict,
  };
};

// Effect-based wrapper
export const computeLinearRegression = (
  xValues: ReadonlyArray<number>,
  yValues: ReadonlyArray<number>
): Effect.Effect<LinearRegressionResult> =>
  Effect.sync(() => calculateLinearRegression(xValues, yValues));

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
