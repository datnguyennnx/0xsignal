import { Effect } from "effect";
import type { FormulaMetadata } from "../core/types";

// ============================================================================
// OBV (On-Balance Volume) - Volume Momentum Indicator
// ============================================================================
// Cumulative volume indicator that adds/subtracts volume based on price direction
// Used to confirm price trends and predict reversals
//
// Formula:
// If Close > Previous Close: OBV = Previous OBV + Volume
// If Close < Previous Close: OBV = Previous OBV - Volume
// If Close = Previous Close: OBV = Previous OBV
//
// Interpretation:
// - Rising OBV: Buying pressure, confirms uptrend
// - Falling OBV: Selling pressure, confirms downtrend
// - OBV divergence from price: Potential reversal signal
// ============================================================================

export interface OBVResult {
  readonly value: number; // Current OBV value
  readonly trend: "ACCUMULATION" | "DISTRIBUTION" | "NEUTRAL";
  readonly momentum: number; // Rate of change in OBV
}

/**
 * Pure function to calculate OBV
 * @param closes - Array of closing prices
 * @param volumes - Array of volumes
 */
export const calculateOBV = (
  closes: ReadonlyArray<number>,
  volumes: ReadonlyArray<number>
): OBVResult => {
  let obv = 0;
  const obvSeries: number[] = [0];

  // Calculate OBV series
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) {
      obv += volumes[i];
    } else if (closes[i] < closes[i - 1]) {
      obv -= volumes[i];
    }
    // If equal, OBV stays the same
    obvSeries.push(obv);
  }

  // Determine trend based on recent OBV movement
  const recentOBV = obvSeries.slice(-10);
  const obvChange = recentOBV[recentOBV.length - 1] - recentOBV[0];

  let trend: "ACCUMULATION" | "DISTRIBUTION" | "NEUTRAL";
  if (obvChange > 0) {
    trend = "ACCUMULATION";
  } else if (obvChange < 0) {
    trend = "DISTRIBUTION";
  } else {
    trend = "NEUTRAL";
  }

  // Calculate momentum (rate of change)
  const momentum =
    obvSeries.length > 1
      ? ((obvSeries[obvSeries.length - 1] - obvSeries[obvSeries.length - 2]) /
          Math.abs(obvSeries[obvSeries.length - 2] || 1)) *
        100
      : 0;

  return {
    value: Math.round(obv),
    trend,
    momentum: Math.round(momentum * 100) / 100,
  };
};

/**
 * Pure function to calculate OBV series
 */
export const calculateOBVSeries = (
  closes: ReadonlyArray<number>,
  volumes: ReadonlyArray<number>
): ReadonlyArray<number> => {
  let obv = 0;
  const obvSeries: number[] = [0];

  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) {
      obv += volumes[i];
    } else if (closes[i] < closes[i - 1]) {
      obv -= volumes[i];
    }
    obvSeries.push(obv);
  }

  return obvSeries;
};

/**
 * Effect-based wrapper for OBV calculation
 */
export const computeOBV = (
  closes: ReadonlyArray<number>,
  volumes: ReadonlyArray<number>
): Effect.Effect<OBVResult> => Effect.sync(() => calculateOBV(closes, volumes));

// ============================================================================
// FORMULA METADATA
// ============================================================================

export const OBVMetadata: FormulaMetadata = {
  name: "OBV",
  category: "volume",
  difficulty: "intermediate",
  description: "On-Balance Volume - cumulative volume momentum indicator",
  requiredInputs: ["closes", "volumes"],
  optionalInputs: [],
  minimumDataPoints: 2,
  outputType: "OBVResult",
  useCases: [
    "trend confirmation",
    "divergence detection",
    "accumulation/distribution analysis",
    "volume momentum",
  ],
  timeComplexity: "O(n)",
  dependencies: [],
};
