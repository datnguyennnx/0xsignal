import { Effect } from "effect";
import type { FormulaMetadata } from "../core/types";
import { calculateEMA } from "./moving-averages";

// ============================================================================
// ADX (Average Directional Index) - Trend Strength Indicator
// ============================================================================
// Measures the strength of a trend (not direction)
// Uses +DI and -DI to calculate directional movement
//
// Formula:
// +DM = High - Previous High (if positive, else 0)
// -DM = Previous Low - Low (if positive, else 0)
// TR = True Range
// +DI = 100 * EMA(+DM) / EMA(TR)
// -DI = 100 * EMA(-DM) / EMA(TR)
// DX = 100 * |+DI - -DI| / (+DI + -DI)
// ADX = EMA(DX)
//
// Interpretation:
// - ADX > 25: Strong trend
// - ADX < 20: Weak trend or ranging
// - ADX > 50: Very strong trend
// - +DI > -DI: Uptrend
// - -DI > +DI: Downtrend
// ============================================================================

export interface ADXResult {
  readonly adx: number; // ADX value (0-100)
  readonly plusDI: number; // +DI value
  readonly minusDI: number; // -DI value
  readonly trendStrength: "VERY_WEAK" | "WEAK" | "MODERATE" | "STRONG" | "VERY_STRONG";
  readonly trendDirection: "BULLISH" | "BEARISH" | "NEUTRAL";
}

/**
 * Pure function to calculate directional movement
 */
const calculateDirectionalMovement = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>
): { plusDM: number[]; minusDM: number[] } => {
  const plusDM: number[] = [];
  const minusDM: number[] = [];

  for (let i = 1; i < highs.length; i++) {
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];

    if (upMove > downMove && upMove > 0) {
      plusDM.push(upMove);
      minusDM.push(0);
    } else if (downMove > upMove && downMove > 0) {
      plusDM.push(0);
      minusDM.push(downMove);
    } else {
      plusDM.push(0);
      minusDM.push(0);
    }
  }

  return { plusDM, minusDM };
};

/**
 * Pure function to calculate True Range series
 */
const calculateTRSeries = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>
): number[] => {
  const trSeries: number[] = [];

  for (let i = 1; i < closes.length; i++) {
    const range1 = highs[i] - lows[i];
    const range2 = Math.abs(highs[i] - closes[i - 1]);
    const range3 = Math.abs(lows[i] - closes[i - 1]);
    trSeries.push(Math.max(range1, range2, range3));
  }

  return trSeries;
};

/**
 * Pure function to calculate ADX
 * @param highs - Array of high prices
 * @param lows - Array of low prices
 * @param closes - Array of closing prices
 * @param period - ADX period (default: 14)
 */
export const calculateADX = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  period: number = 14
): ADXResult => {
  // Calculate directional movement
  const { plusDM, minusDM } = calculateDirectionalMovement(highs, lows);

  // Calculate True Range
  const trSeries = calculateTRSeries(highs, lows, closes);

  // Calculate smoothed +DM, -DM, and TR using EMA
  const smoothedPlusDM = calculateEMA(plusDM, period).value;
  const smoothedMinusDM = calculateEMA(minusDM, period).value;
  const smoothedTR = calculateEMA(trSeries, period).value;

  // Calculate +DI and -DI
  const plusDI = smoothedTR === 0 ? 0 : (100 * smoothedPlusDM) / smoothedTR;
  const minusDI = smoothedTR === 0 ? 0 : (100 * smoothedMinusDM) / smoothedTR;

  // Calculate DX series
  const dxSeries: number[] = [];
  for (let i = period - 1; i < plusDM.length; i++) {
    const windowPlusDM = plusDM.slice(Math.max(0, i - period + 1), i + 1);
    const windowMinusDM = minusDM.slice(Math.max(0, i - period + 1), i + 1);
    const windowTR = trSeries.slice(Math.max(0, i - period + 1), i + 1);

    const avgPlusDM = windowPlusDM.reduce((a, b) => a + b, 0) / windowPlusDM.length;
    const avgMinusDM = windowMinusDM.reduce((a, b) => a + b, 0) / windowMinusDM.length;
    const avgTR = windowTR.reduce((a, b) => a + b, 0) / windowTR.length;

    const pdi = avgTR === 0 ? 0 : (100 * avgPlusDM) / avgTR;
    const mdi = avgTR === 0 ? 0 : (100 * avgMinusDM) / avgTR;

    const dx = pdi + mdi === 0 ? 0 : (100 * Math.abs(pdi - mdi)) / (pdi + mdi);
    dxSeries.push(dx);
  }

  // Calculate ADX (EMA of DX)
  const adx = dxSeries.length > 0 ? calculateEMA(dxSeries, period).value : 0;

  // Determine trend strength
  let trendStrength: "VERY_WEAK" | "WEAK" | "MODERATE" | "STRONG" | "VERY_STRONG";
  if (adx < 20) {
    trendStrength = "VERY_WEAK";
  } else if (adx < 25) {
    trendStrength = "WEAK";
  } else if (adx < 40) {
    trendStrength = "MODERATE";
  } else if (adx < 50) {
    trendStrength = "STRONG";
  } else {
    trendStrength = "VERY_STRONG";
  }

  // Determine trend direction
  let trendDirection: "BULLISH" | "BEARISH" | "NEUTRAL";
  if (plusDI > minusDI + 5) {
    trendDirection = "BULLISH";
  } else if (minusDI > plusDI + 5) {
    trendDirection = "BEARISH";
  } else {
    trendDirection = "NEUTRAL";
  }

  return {
    adx: Math.round(adx * 100) / 100,
    plusDI: Math.round(plusDI * 100) / 100,
    minusDI: Math.round(minusDI * 100) / 100,
    trendStrength,
    trendDirection,
  };
};

/**
 * Effect-based wrapper for ADX calculation
 */
export const computeADX = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  period: number = 14
): Effect.Effect<ADXResult> => Effect.sync(() => calculateADX(highs, lows, closes, period));

// ============================================================================
// FORMULA METADATA
// ============================================================================

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
