import { Effect } from "effect";
import type { FormulaMetadata } from "../core/types";

// ============================================================================
// A/D LINE (Accumulation/Distribution Line) - Volume Flow Indicator
// ============================================================================
// Cumulative indicator that uses volume flow to assess buying/selling pressure
// Combines price and volume to show money flow
//
// Formula:
// Money Flow Multiplier = ((Close - Low) - (High - Close)) / (High - Low)
// Money Flow Volume = Money Flow Multiplier × Volume
// A/D Line = Previous A/D + Money Flow Volume
//
// Interpretation:
// - Rising A/D: Accumulation (buying pressure)
// - Falling A/D: Distribution (selling pressure)
// - A/D divergence from price: Potential reversal
// ============================================================================

export interface ADLineResult {
  readonly value: number; // Current A/D Line value
  readonly trend: "ACCUMULATION" | "DISTRIBUTION" | "NEUTRAL";
  readonly momentum: number; // Rate of change
}

/**
 * Pure function to calculate Money Flow Multiplier
 */
const calculateMoneyFlowMultiplier = (high: number, low: number, close: number): number => {
  const range = high - low;
  if (range === 0) return 0;
  return (close - low - (high - close)) / range;
};

/**
 * Pure function to calculate A/D Line
 * @param highs - Array of high prices
 * @param lows - Array of low prices
 * @param closes - Array of closing prices
 * @param volumes - Array of volumes
 */
export const calculateADLine = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  volumes: ReadonlyArray<number>
): ADLineResult => {
  let adLine = 0;
  const adSeries: number[] = [0];

  // Calculate A/D Line series
  for (let i = 0; i < closes.length; i++) {
    const mfm = calculateMoneyFlowMultiplier(highs[i], lows[i], closes[i]);
    const mfv = mfm * volumes[i];
    adLine += mfv;
    adSeries.push(adLine);
  }

  // Determine trend based on recent A/D movement
  const recentAD = adSeries.slice(-10);
  const adChange = recentAD[recentAD.length - 1] - recentAD[0];

  let trend: "ACCUMULATION" | "DISTRIBUTION" | "NEUTRAL";
  if (adChange > 0) {
    trend = "ACCUMULATION";
  } else if (adChange < 0) {
    trend = "DISTRIBUTION";
  } else {
    trend = "NEUTRAL";
  }

  // Calculate momentum
  const momentum =
    adSeries.length > 1
      ? ((adSeries[adSeries.length - 1] - adSeries[adSeries.length - 2]) /
          Math.abs(adSeries[adSeries.length - 2] || 1)) *
        100
      : 0;

  return {
    value: Math.round(adLine),
    trend,
    momentum: Math.round(momentum * 100) / 100,
  };
};

/**
 * Pure function to calculate A/D Line series
 */
export const calculateADLineSeries = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  volumes: ReadonlyArray<number>
): ReadonlyArray<number> => {
  let adLine = 0;
  const adSeries: number[] = [0];

  for (let i = 0; i < closes.length; i++) {
    const mfm = calculateMoneyFlowMultiplier(highs[i], lows[i], closes[i]);
    const mfv = mfm * volumes[i];
    adLine += mfv;
    adSeries.push(adLine);
  }

  return adSeries;
};

/**
 * Effect-based wrapper for A/D Line calculation
 */
export const computeADLine = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  volumes: ReadonlyArray<number>
): Effect.Effect<ADLineResult> => Effect.sync(() => calculateADLine(highs, lows, closes, volumes));

// ============================================================================
// FORMULA METADATA
// ============================================================================

export const ADLineMetadata: FormulaMetadata = {
  name: "ADLine",
  category: "volume",
  difficulty: "intermediate",
  description: "Accumulation/Distribution Line - volume flow indicator for buying/selling pressure",
  requiredInputs: ["highs", "lows", "closes", "volumes"],
  optionalInputs: [],
  minimumDataPoints: 1,
  outputType: "ADLineResult",
  useCases: [
    "accumulation/distribution analysis",
    "divergence detection",
    "trend confirmation",
    "money flow tracking",
  ],
  timeComplexity: "O(n)",
  dependencies: [],
};
