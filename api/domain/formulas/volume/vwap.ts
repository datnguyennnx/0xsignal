import { Effect } from "effect";
import type { FormulaMetadata } from "../core/types";

// ============================================================================
// VWAP (Volume Weighted Average Price) - Intraday Benchmark
// ============================================================================
// Average price weighted by volume, used as a benchmark for execution quality
// Resets daily in traditional markets
//
// Formula:
// VWAP = Σ(Typical Price × Volume) / Σ(Volume)
// Typical Price = (High + Low + Close) / 3
//
// Interpretation:
// - Price above VWAP: Bullish, buying above average
// - Price below VWAP: Bearish, selling below average
// - VWAP acts as support/resistance
// ============================================================================

export interface VWAPResult {
  readonly value: number; // VWAP value
  readonly position: "ABOVE" | "BELOW" | "AT";
  readonly deviation: number; // Percentage deviation from VWAP
}

/**
 * Pure function to calculate VWAP
 * @param highs - Array of high prices
 * @param lows - Array of low prices
 * @param closes - Array of closing prices
 * @param volumes - Array of volumes
 */
export const calculateVWAP = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  volumes: ReadonlyArray<number>
): VWAPResult => {
  let cumulativePV = 0;
  let cumulativeVolume = 0;

  // Calculate cumulative price × volume and cumulative volume
  for (let i = 0; i < closes.length; i++) {
    const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
    cumulativePV += typicalPrice * volumes[i];
    cumulativeVolume += volumes[i];
  }

  // Calculate VWAP
  const vwap = cumulativeVolume === 0 ? 0 : cumulativePV / cumulativeVolume;

  // Determine position relative to VWAP
  const currentPrice = closes[closes.length - 1];
  let position: "ABOVE" | "BELOW" | "AT";
  if (currentPrice > vwap * 1.001) {
    position = "ABOVE";
  } else if (currentPrice < vwap * 0.999) {
    position = "BELOW";
  } else {
    position = "AT";
  }

  // Calculate deviation
  const deviation = vwap === 0 ? 0 : ((currentPrice - vwap) / vwap) * 100;

  return {
    value: Math.round(vwap * 100) / 100,
    position,
    deviation: Math.round(deviation * 100) / 100,
  };
};

/**
 * Pure function to calculate VWAP series
 */
export const calculateVWAPSeries = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  volumes: ReadonlyArray<number>
): ReadonlyArray<number> => {
  const vwapSeries: number[] = [];
  let cumulativePV = 0;
  let cumulativeVolume = 0;

  for (let i = 0; i < closes.length; i++) {
    const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
    cumulativePV += typicalPrice * volumes[i];
    cumulativeVolume += volumes[i];

    const vwap = cumulativeVolume === 0 ? 0 : cumulativePV / cumulativeVolume;
    vwapSeries.push(vwap);
  }

  return vwapSeries;
};

/**
 * Effect-based wrapper for VWAP calculation
 */
export const computeVWAP = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  volumes: ReadonlyArray<number>
): Effect.Effect<VWAPResult> => Effect.sync(() => calculateVWAP(highs, lows, closes, volumes));

// ============================================================================
// FORMULA METADATA
// ============================================================================

export const VWAPMetadata: FormulaMetadata = {
  name: "VWAP",
  category: "volume",
  difficulty: "intermediate",
  description: "Volume Weighted Average Price - volume-weighted benchmark",
  requiredInputs: ["highs", "lows", "closes", "volumes"],
  optionalInputs: [],
  minimumDataPoints: 1,
  outputType: "VWAPResult",
  useCases: [
    "execution benchmark",
    "support/resistance levels",
    "institutional trading reference",
    "mean reversion trading",
  ],
  timeComplexity: "O(n)",
  dependencies: [],
};
