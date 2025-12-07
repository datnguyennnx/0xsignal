/** ADX - Real calculation using historical OHLC data */

import { Effect, Match } from "effect";

export interface ADXHistoricalResult {
  readonly adx: number;
  readonly plusDI: number;
  readonly minusDI: number;
  readonly trend: "STRONG" | "MODERATE" | "WEAK" | "NONE";
  readonly direction: "BULLISH" | "BEARISH" | "NEUTRAL";
}

const DEFAULT_PERIOD = 14;

const classifyTrend = Match.type<number>().pipe(
  Match.when(
    (a) => a > 50,
    () => "STRONG" as const
  ),
  Match.when(
    (a) => a > 25,
    () => "MODERATE" as const
  ),
  Match.when(
    (a) => a > 15,
    () => "WEAK" as const
  ),
  Match.orElse(() => "NONE" as const)
);

const classifyDirection = (plusDI: number, minusDI: number) => {
  if (plusDI > minusDI + 5) return "BULLISH" as const;
  if (minusDI > plusDI + 5) return "BEARISH" as const;
  return "NEUTRAL" as const;
};

const calculateADX = (
  highs: readonly number[],
  lows: readonly number[],
  closes: readonly number[],
  period: number
): ADXHistoricalResult => {
  const len = Math.min(highs.length, lows.length, closes.length);

  if (len < period + 1) {
    return {
      adx: 25,
      plusDI: 25,
      minusDI: 25,
      trend: "WEAK",
      direction: "NEUTRAL",
    };
  }

  const tr: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];

  for (let i = 1; i < len; i++) {
    const highDiff = highs[i] - highs[i - 1];
    const lowDiff = lows[i - 1] - lows[i];

    const trueRange = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    tr.push(trueRange);

    if (highDiff > lowDiff && highDiff > 0) {
      plusDM.push(highDiff);
    } else {
      plusDM.push(0);
    }

    if (lowDiff > highDiff && lowDiff > 0) {
      minusDM.push(lowDiff);
    } else {
      minusDM.push(0);
    }
  }

  const smooth = (data: number[], p: number): number[] => {
    if (data.length < p) return [];
    const result: number[] = [];
    let sum = 0;
    for (let i = 0; i < p; i++) sum += data[i];
    result.push(sum);
    for (let i = p; i < data.length; i++) {
      result.push(result[result.length - 1] - result[result.length - 1] / p + data[i]);
    }
    return result;
  };

  const smoothedTR = smooth(tr, period);
  const smoothedPlusDM = smooth(plusDM, period);
  const smoothedMinusDM = smooth(minusDM, period);

  if (smoothedTR.length === 0) {
    return {
      adx: 25,
      plusDI: 25,
      minusDI: 25,
      trend: "WEAK",
      direction: "NEUTRAL",
    };
  }

  const plusDI: number[] = [];
  const minusDI: number[] = [];
  const dx: number[] = [];

  for (let i = 0; i < smoothedTR.length; i++) {
    const pdi = smoothedTR[i] > 0 ? (smoothedPlusDM[i] / smoothedTR[i]) * 100 : 0;
    const mdi = smoothedTR[i] > 0 ? (smoothedMinusDM[i] / smoothedTR[i]) * 100 : 0;
    plusDI.push(pdi);
    minusDI.push(mdi);

    const diSum = pdi + mdi;
    dx.push(diSum > 0 ? (Math.abs(pdi - mdi) / diSum) * 100 : 0);
  }

  const smoothedDX = smooth(dx, period);

  const currentPlusDI = plusDI[plusDI.length - 1];
  const currentMinusDI = minusDI[minusDI.length - 1];
  const currentADX = smoothedDX.length > 0 ? smoothedDX[smoothedDX.length - 1] / period : 25;

  return {
    adx: Math.round(Math.min(100, Math.max(0, currentADX)) * 10) / 10,
    plusDI: Math.round(currentPlusDI * 10) / 10,
    minusDI: Math.round(currentMinusDI * 10) / 10,
    trend: classifyTrend(currentADX),
    direction: classifyDirection(currentPlusDI, currentMinusDI),
  };
};

export const computeADXFromHistory = (
  highs: readonly number[],
  lows: readonly number[],
  closes: readonly number[],
  period: number = DEFAULT_PERIOD
): Effect.Effect<ADXHistoricalResult> =>
  Effect.sync(() => calculateADX(highs, lows, closes, period));
