/** Pearson Correlation Coefficient - Linear relationship measure */
// r = Cov(X,Y) / (StdDev(X) * StdDev(Y))

import { Effect, Match, Array as Arr, pipe } from "effect";
import type { FormulaMetadata } from "../core/types";
import { mean } from "../core/math";

export interface CorrelationResult {
  readonly coefficient: number;
  readonly strength: "VERY_STRONG" | "STRONG" | "MODERATE" | "WEAK" | "VERY_WEAK";
  readonly direction: "POSITIVE" | "NEGATIVE" | "NONE";
  readonly rSquared: number;
}

// Strength classification
const classifyStrength = Match.type<number>().pipe(
  Match.when(
    (v) => v > 0.9,
    () => "VERY_STRONG" as const
  ),
  Match.when(
    (v) => v > 0.7,
    () => "STRONG" as const
  ),
  Match.when(
    (v) => v > 0.5,
    () => "MODERATE" as const
  ),
  Match.when(
    (v) => v > 0.3,
    () => "WEAK" as const
  ),
  Match.orElse(() => "VERY_WEAK" as const)
);

// Direction classification
const classifyDirection = Match.type<number>().pipe(
  Match.when(
    (v) => v > 0.1,
    () => "POSITIVE" as const
  ),
  Match.when(
    (v) => v < -0.1,
    () => "NEGATIVE" as const
  ),
  Match.orElse(() => "NONE" as const)
);

// Round to 4 decimal places
const round4 = (n: number): number => Math.round(n * 10000) / 10000;

// Statistics accumulator
interface StatsAccum {
  readonly covariance: number;
  readonly varX: number;
  readonly varY: number;
}

// Calculate statistics using Arr.reduce
const calculateStats = (
  x: ReadonlyArray<number>,
  y: ReadonlyArray<number>,
  meanX: number,
  meanY: number
): StatsAccum =>
  pipe(
    Arr.zipWith(x, y, (xi, yi) => ({ dx: xi - meanX, dy: yi - meanY })),
    Arr.reduce({ covariance: 0, varX: 0, varY: 0 }, (acc, { dx, dy }) => ({
      covariance: acc.covariance + dx * dy,
      varX: acc.varX + dx * dx,
      varY: acc.varY + dy * dy,
    }))
  );

// Calculate Pearson Correlation
export const calculateCorrelation = (
  series1: ReadonlyArray<number>,
  series2: ReadonlyArray<number>
): CorrelationResult => {
  const n = Math.min(series1.length, series2.length);
  const x = Arr.take(series1, n);
  const y = Arr.take(series2, n);
  const meanX = mean([...x]);
  const meanY = mean([...y]);

  const stats = calculateStats(x, y, meanX, meanY);
  const denominator = Math.sqrt(stats.varX * stats.varY);
  const coefficient = denominator === 0 ? 0 : stats.covariance / denominator;
  const rSquared = coefficient * coefficient;

  return {
    coefficient: round4(coefficient),
    strength: classifyStrength(Math.abs(coefficient)),
    direction: classifyDirection(coefficient),
    rSquared: round4(rSquared),
  };
};

// Effect-based wrapper
export const computeCorrelation = (
  series1: ReadonlyArray<number>,
  series2: ReadonlyArray<number>
): Effect.Effect<CorrelationResult> => Effect.sync(() => calculateCorrelation(series1, series2));

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
