/** Garman-Klass Volatility - Most efficient OHLC-based estimator */
// GK = sqrt[(1/N) * Sum(0.5*(ln(H/L))^2 - (2*ln(2)-1)*(ln(C/O))^2)] * sqrt(252)

import { Effect, Match, Array as Arr, pipe } from "effect";
import type { FormulaMetadata } from "../core/types";

export interface GarmanKlassVolatilityResult {
  readonly value: number;
  readonly dailyVol: number;
  readonly level: "VERY_LOW" | "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH";
  readonly efficiency: number;
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

// GK constant
const GK_CONSTANT = 2 * Math.log(2) - 1;

// OHLC data point
interface OHLCPoint {
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
}

// Calculate GK sum using Arr.reduce
const calculateGKSum = (data: ReadonlyArray<OHLCPoint>): number =>
  pipe(
    data,
    Arr.map(({ open, high, low, close }) => {
      const logHL = Math.log(high / low);
      const logCO = Math.log(close / open);
      return 0.5 * logHL * logHL - GK_CONSTANT * logCO * logCO;
    }),
    Arr.reduce(0, (a, b) => a + b)
  );

// Zip OHLC arrays into points
const zipOHLC = (
  opens: ReadonlyArray<number>,
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>
): ReadonlyArray<OHLCPoint> =>
  pipe(
    Arr.zipWith(opens, highs, (open, high) => ({ open, high })),
    Arr.zipWith(lows, (oh, low) => ({ ...oh, low })),
    Arr.zipWith(closes, (ohl, close) => ({ ...ohl, close }))
  );

// Calculate Garman-Klass Volatility
export const calculateGarmanKlassVolatility = (
  opens: ReadonlyArray<number>,
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  period: number = 30,
  annualizationFactor: number = 252
): GarmanKlassVolatilityResult => {
  const recentData = zipOHLC(
    Arr.takeRight(opens, period),
    Arr.takeRight(highs, period),
    Arr.takeRight(lows, period),
    Arr.takeRight(closes, period)
  );

  const sumGK = calculateGKSum(recentData);
  const dailyVol = Math.sqrt(sumGK / period);
  const annualizedVol = dailyVol * Math.sqrt(annualizationFactor) * 100;

  return {
    value: round2(annualizedVol),
    dailyVol: round4(dailyVol),
    level: classifyLevel(annualizedVol),
    efficiency: 7.4,
  };
};

// Calculate GK series using Arr.makeBy
export const calculateGarmanKlassVolatilitySeries = (
  opens: ReadonlyArray<number>,
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  period: number = 30,
  annualizationFactor: number = 252
): ReadonlyArray<number> => {
  const sqrtFactor = Math.sqrt(annualizationFactor) * 100;

  return pipe(
    Arr.makeBy(opens.length - period + 1, (i) => {
      const windowData = zipOHLC(
        Arr.take(Arr.drop(opens, i), period),
        Arr.take(Arr.drop(highs, i), period),
        Arr.take(Arr.drop(lows, i), period),
        Arr.take(Arr.drop(closes, i), period)
      );
      const sumGK = calculateGKSum(windowData);
      const dailyVol = Math.sqrt(sumGK / period);
      return dailyVol * sqrtFactor;
    })
  );
};

// Effect-based wrapper
export const computeGarmanKlassVolatility = (
  opens: ReadonlyArray<number>,
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  period: number = 30,
  annualizationFactor: number = 252
): Effect.Effect<GarmanKlassVolatilityResult> =>
  Effect.sync(() =>
    calculateGarmanKlassVolatility(opens, highs, lows, closes, period, annualizationFactor)
  );

export const GarmanKlassVolatilityMetadata: FormulaMetadata = {
  name: "GarmanKlassVolatility",
  category: "volatility",
  difficulty: "intermediate",
  description: "Garman-Klass Volatility - most efficient OHLC-based estimator",
  requiredInputs: ["opens", "highs", "lows", "closes"],
  optionalInputs: ["period", "annualizationFactor"],
  minimumDataPoints: 30,
  outputType: "GarmanKlassVolatilityResult",
  useCases: [
    "efficient volatility estimation",
    "option pricing",
    "risk management",
    "high-frequency trading",
  ],
  timeComplexity: "O(n * k)",
  dependencies: [],
};
