/** Covariance - Joint variability measure with functional patterns */
// Cov(X,Y) = Sum[(x - mean_x)(y - mean_y)] / N

import { Effect, Match, Array as Arr, pipe } from "effect";
import type { FormulaMetadata } from "../core/types";
import { mean } from "../core/math";

export interface CovarianceResult {
  readonly value: number;
  readonly relationship: "POSITIVE" | "NEGATIVE" | "NONE";
  readonly normalized: number;
}

// Relationship classification
const classifyRelationship = Match.type<number>().pipe(
  Match.when(
    (v) => v > 0.01,
    () => "POSITIVE" as const
  ),
  Match.when(
    (v) => v < -0.01,
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

// Calculate Covariance
export const calculateCovariance = (
  series1: ReadonlyArray<number>,
  series2: ReadonlyArray<number>
): CovarianceResult => {
  const n = Math.min(series1.length, series2.length);
  const x = Arr.take(series1, n);
  const y = Arr.take(series2, n);
  const meanX = mean([...x]);
  const meanY = mean([...y]);

  const stats = calculateStats(x, y, meanX, meanY);
  const covariance = stats.covariance / n;
  const stdX = Math.sqrt(stats.varX / n);
  const stdY = Math.sqrt(stats.varY / n);
  const normalized = stdX * stdY === 0 ? 0 : covariance / (stdX * stdY);

  return {
    value: round4(covariance),
    relationship: classifyRelationship(covariance),
    normalized: round4(normalized),
  };
};

// Effect-based wrapper
export const computeCovariance = (
  series1: ReadonlyArray<number>,
  series2: ReadonlyArray<number>
): Effect.Effect<CovarianceResult> => Effect.sync(() => calculateCovariance(series1, series2));

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
