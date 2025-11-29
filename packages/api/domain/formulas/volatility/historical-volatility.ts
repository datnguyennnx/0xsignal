/** Historical Volatility - Annualized standard deviation of log returns */
// HV = StdDev(Log Returns) * sqrt(252)

import { Effect, Match, Array as Arr, pipe } from "effect";
import type { FormulaMetadata } from "../core/types";

export interface HistoricalVolatilityResult {
  readonly value: number;
  readonly dailyVol: number;
  readonly level: "VERY_LOW" | "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH";
}

// Volatility level classification
const classifyLevel = Match.type<number>().pipe(
  Match.when(
    (v) => v < 10,
    () => "VERY_LOW" as const
  ),
  Match.when(
    (v) => v < 20,
    () => "LOW" as const
  ),
  Match.when(
    (v) => v < 40,
    () => "MODERATE" as const
  ),
  Match.when(
    (v) => v < 60,
    () => "HIGH" as const
  ),
  Match.orElse(() => "VERY_HIGH" as const)
);

// Round helpers
const round2 = (n: number): number => Math.round(n * 100) / 100;
const round4 = (n: number): number => Math.round(n * 10000) / 10000;

// Calculate log returns using Arr.zipWith
const calculateLogReturns = (closes: ReadonlyArray<number>): ReadonlyArray<number> =>
  pipe(
    Arr.zipWith(Arr.drop(closes, 1), Arr.dropRight(closes, 1), (curr, prev) =>
      Math.log(curr / prev)
    )
  );

// Calculate variance from returns
const calculateVariance = (returns: ReadonlyArray<number>): number => {
  const meanReturn =
    pipe(
      returns,
      Arr.reduce(0, (a, b) => a + b)
    ) / returns.length;
  return (
    pipe(
      returns,
      Arr.map((r) => Math.pow(r - meanReturn, 2)),
      Arr.reduce(0, (a, b) => a + b)
    ) / returns.length
  );
};

// Calculate Historical Volatility
export const calculateHistoricalVolatility = (
  closes: ReadonlyArray<number>,
  period: number = 30,
  annualizationFactor: number = 252
): HistoricalVolatilityResult => {
  const logReturns = calculateLogReturns(closes);
  const recentReturns = Arr.takeRight(logReturns, period);
  const variance = calculateVariance(recentReturns);
  const dailyVol = Math.sqrt(variance);
  const annualizedVol = dailyVol * Math.sqrt(annualizationFactor) * 100;

  return {
    value: round2(annualizedVol),
    dailyVol: round4(dailyVol),
    level: classifyLevel(annualizedVol),
  };
};

// Calculate HV series using Arr.makeBy
export const calculateHistoricalVolatilitySeries = (
  closes: ReadonlyArray<number>,
  period: number = 30,
  annualizationFactor: number = 252
): ReadonlyArray<number> => {
  const logReturns = calculateLogReturns(closes);
  const sqrtFactor = Math.sqrt(annualizationFactor) * 100;

  return pipe(
    Arr.makeBy(logReturns.length - period + 1, (i) => {
      const window = Arr.take(Arr.drop(logReturns, i), period);
      const variance = calculateVariance(window);
      return Math.sqrt(variance) * sqrtFactor;
    })
  );
};

// Effect-based wrapper
export const computeHistoricalVolatility = (
  closes: ReadonlyArray<number>,
  period: number = 30,
  annualizationFactor: number = 252
): Effect.Effect<HistoricalVolatilityResult> =>
  Effect.sync(() => calculateHistoricalVolatility(closes, period, annualizationFactor));

export const HistoricalVolatilityMetadata: FormulaMetadata = {
  name: "HistoricalVolatility",
  category: "volatility",
  difficulty: "intermediate",
  description: "Historical Volatility - annualized standard deviation of log returns",
  requiredInputs: ["closes"],
  optionalInputs: ["period", "annualizationFactor"],
  minimumDataPoints: 31,
  outputType: "HistoricalVolatilityResult",
  useCases: ["risk measurement", "option pricing", "position sizing", "volatility trading"],
  timeComplexity: "O(n * k)",
  dependencies: [],
};
