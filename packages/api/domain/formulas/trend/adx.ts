/** ADX (Average Directional Index) - Trend Strength Indicator */
// ADX measures trend strength (not direction), +DI/-DI indicate direction

import { Effect, Match, pipe } from "effect";
import type { FormulaMetadata } from "../core/types";
import { calculateEMA } from "./moving-averages";

export interface ADXResult {
  readonly adx: number;
  readonly plusDI: number;
  readonly minusDI: number;
  readonly trendStrength: "VERY_WEAK" | "WEAK" | "MODERATE" | "STRONG" | "VERY_STRONG";
  readonly trendDirection: "BULLISH" | "BEARISH" | "NEUTRAL";
}

// Trend strength classification
const classifyTrendStrength = Match.type<number>().pipe(
  Match.when(
    (a) => a < 20,
    () => "VERY_WEAK" as const
  ),
  Match.when(
    (a) => a < 25,
    () => "WEAK" as const
  ),
  Match.when(
    (a) => a < 40,
    () => "MODERATE" as const
  ),
  Match.when(
    (a) => a < 50,
    () => "STRONG" as const
  ),
  Match.orElse(() => "VERY_STRONG" as const)
);

// Trend direction classification
const classifyTrendDirection = (
  plusDI: number,
  minusDI: number
): "BULLISH" | "BEARISH" | "NEUTRAL" =>
  pipe(
    Match.value({ diff: plusDI - minusDI }),
    Match.when(
      ({ diff }) => diff > 5,
      () => "BULLISH" as const
    ),
    Match.when(
      ({ diff }) => diff < -5,
      () => "BEARISH" as const
    ),
    Match.orElse(() => "NEUTRAL" as const)
  );

// Safe division
const safeDivide = (num: number, denom: number, fallback = 0): number =>
  denom === 0 ? fallback : num / denom;

// Calculate directional movement for a single bar
const calcDM = (upMove: number, downMove: number): { plusDM: number; minusDM: number } =>
  pipe(
    Match.value({ upMove, downMove }),
    Match.when(
      ({ upMove, downMove }) => upMove > downMove && upMove > 0,
      ({ upMove }) => ({ plusDM: upMove, minusDM: 0 })
    ),
    Match.when(
      ({ upMove, downMove }) => downMove > upMove && downMove > 0,
      ({ downMove }) => ({ plusDM: 0, minusDM: downMove })
    ),
    Match.orElse(() => ({ plusDM: 0, minusDM: 0 }))
  );

// Calculate directional movement series
const calculateDirectionalMovement = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>
): { plusDM: number[]; minusDM: number[] } => {
  const result = highs.slice(1).map((high, i) => {
    const upMove = high - highs[i];
    const downMove = lows[i] - lows[i + 1];
    return calcDM(upMove, downMove);
  });
  return {
    plusDM: result.map((r) => r.plusDM),
    minusDM: result.map((r) => r.minusDM),
  };
};

// Calculate True Range series
const calculateTRSeries = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>
): number[] =>
  closes
    .slice(1)
    .map((_, i) =>
      Math.max(
        highs[i + 1] - lows[i + 1],
        Math.abs(highs[i + 1] - closes[i]),
        Math.abs(lows[i + 1] - closes[i])
      )
    );

// Calculate ADX
export const calculateADX = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  period: number = 14
): ADXResult => {
  const { plusDM, minusDM } = calculateDirectionalMovement(highs, lows);
  const trSeries = calculateTRSeries(highs, lows, closes);

  const smoothedPlusDM = calculateEMA(plusDM, period).value;
  const smoothedMinusDM = calculateEMA(minusDM, period).value;
  const smoothedTR = calculateEMA(trSeries, period).value;

  const plusDI = safeDivide(100 * smoothedPlusDM, smoothedTR);
  const minusDI = safeDivide(100 * smoothedMinusDM, smoothedTR);

  // Calculate DX series
  const dxSeries = Array.from({ length: plusDM.length - period + 1 }, (_, idx) => {
    const i = idx + period - 1;
    const windowPlusDM = plusDM.slice(Math.max(0, i - period + 1), i + 1);
    const windowMinusDM = minusDM.slice(Math.max(0, i - period + 1), i + 1);
    const windowTR = trSeries.slice(Math.max(0, i - period + 1), i + 1);

    const avgPlusDM = windowPlusDM.reduce((a, b) => a + b, 0) / windowPlusDM.length;
    const avgMinusDM = windowMinusDM.reduce((a, b) => a + b, 0) / windowMinusDM.length;
    const avgTR = windowTR.reduce((a, b) => a + b, 0) / windowTR.length;

    const pdi = safeDivide(100 * avgPlusDM, avgTR);
    const mdi = safeDivide(100 * avgMinusDM, avgTR);
    return safeDivide(100 * Math.abs(pdi - mdi), pdi + mdi);
  });

  const adx = dxSeries.length > 0 ? calculateEMA(dxSeries, period).value : 0;

  return {
    adx: Math.round(adx * 100) / 100,
    plusDI: Math.round(plusDI * 100) / 100,
    minusDI: Math.round(minusDI * 100) / 100,
    trendStrength: classifyTrendStrength(adx),
    trendDirection: classifyTrendDirection(plusDI, minusDI),
  };
};

// Effect-based wrapper
export const computeADX = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  period: number = 14
): Effect.Effect<ADXResult> => Effect.sync(() => calculateADX(highs, lows, closes, period));

export const ADXMetadata: FormulaMetadata = {
  name: "ADX",
  category: "trend",
  difficulty: "beginner",
  description: "Average Directional Index - measures trend strength",
  requiredInputs: ["highs", "lows", "closes"],
  optionalInputs: ["period"],
  minimumDataPoints: 28,
  outputType: "ADXResult",
  useCases: [
    "trend strength measurement",
    "trend identification",
    "filter for trading signals",
    "market regime detection",
  ],
  timeComplexity: "O(n)",
  dependencies: ["EMA"],
};
