/** Parkinson Volatility - High-low range estimator with functional patterns */
// PV = sqrt[(1/(4*ln(2))) * (1/N) * Sum(ln(H/L)^2)] * sqrt(252)

import { Effect, Match, Array as Arr, pipe } from "effect";
import type { FormulaMetadata } from "../core/types";

export interface ParkinsonVolatilityResult {
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

// Parkinson constant
const PARKINSON_CONSTANT = 1 / (4 * Math.log(2));

// Calculate sum of squared log H/L using Arr.zipWith and Arr.reduce
const calculateSumSquaredLogHL = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>
): number =>
  pipe(
    Arr.zipWith(highs, lows, (h, l) => {
      const logHL = Math.log(h / l);
      return logHL * logHL;
    }),
    Arr.reduce(0, (a, b) => a + b)
  );

// Calculate Parkinson Volatility
export const calculateParkinsonVolatility = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  period: number = 30,
  annualizationFactor: number = 252
): ParkinsonVolatilityResult => {
  const recentHighs = Arr.takeRight(highs, period);
  const recentLows = Arr.takeRight(lows, period);
  const sumSquaredLogHL = calculateSumSquaredLogHL(recentHighs, recentLows);
  const dailyVol = Math.sqrt(PARKINSON_CONSTANT * (sumSquaredLogHL / period));
  const annualizedVol = dailyVol * Math.sqrt(annualizationFactor) * 100;

  return {
    value: round2(annualizedVol),
    dailyVol: round4(dailyVol),
    level: classifyLevel(annualizedVol),
  };
};

// Calculate Parkinson series using Arr.makeBy
export const calculateParkinsonVolatilitySeries = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  period: number = 30,
  annualizationFactor: number = 252
): ReadonlyArray<number> => {
  const sqrtFactor = Math.sqrt(annualizationFactor) * 100;

  return pipe(
    Arr.makeBy(highs.length - period + 1, (i) => {
      const windowHighs = Arr.take(Arr.drop(highs, i), period);
      const windowLows = Arr.take(Arr.drop(lows, i), period);
      const sumSquaredLogHL = calculateSumSquaredLogHL(windowHighs, windowLows);
      const dailyVol = Math.sqrt(PARKINSON_CONSTANT * (sumSquaredLogHL / period));
      return dailyVol * sqrtFactor;
    })
  );
};

// Effect-based wrapper
export const computeParkinsonVolatility = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  period: number = 30,
  annualizationFactor: number = 252
): Effect.Effect<ParkinsonVolatilityResult> =>
  Effect.sync(() => calculateParkinsonVolatility(highs, lows, period, annualizationFactor));

export const ParkinsonVolatilityMetadata: FormulaMetadata = {
  name: "ParkinsonVolatility",
  category: "volatility",
  difficulty: "intermediate",
  description: "Parkinson Volatility - efficient estimator using high-low range",
  requiredInputs: ["highs", "lows"],
  optionalInputs: ["period", "annualizationFactor"],
  minimumDataPoints: 30,
  outputType: "ParkinsonVolatilityResult",
  useCases: [
    "efficient volatility estimation",
    "intraday volatility measurement",
    "option pricing",
    "risk management",
  ],
  timeComplexity: "O(n * k)",
  dependencies: [],
};
