import { Effect } from "effect";
import type { FormulaMetadata } from "../core/types";

// ============================================================================
// PARABOLIC SAR (Stop and Reverse) - Trend Following Indicator
// ============================================================================
// Provides entry and exit points by placing dots above or below price
// SAR flips when price crosses the SAR value
//
// Formula:
// SAR(n) = SAR(n-1) + AF × (EP - SAR(n-1))
// where:
// - AF = Acceleration Factor (starts at 0.02, increases by 0.02 each period, max 0.20)
// - EP = Extreme Point (highest high in uptrend, lowest low in downtrend)
//
// Interpretation:
// - SAR below price: Uptrend (bullish)
// - SAR above price: Downtrend (bearish)
// - SAR flip: Potential reversal signal
// ============================================================================

export interface ParabolicSARResult {
  readonly sar: number; // Current SAR value
  readonly trend: "BULLISH" | "BEARISH";
  readonly isReversal: boolean; // True if SAR just flipped
  readonly af: number; // Current acceleration factor
  readonly ep: number; // Current extreme point
}

/**
 * Pure function to calculate Parabolic SAR
 * @param highs - Array of high prices
 * @param lows - Array of low prices
 * @param closes - Array of closing prices
 * @param afStart - Starting acceleration factor (default: 0.02)
 * @param afIncrement - AF increment per period (default: 0.02)
 * @param afMax - Maximum AF (default: 0.20)
 */
export const calculateParabolicSAR = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  afStart: number = 0.02,
  afIncrement: number = 0.02,
  afMax: number = 0.2
): ParabolicSARResult => {
  if (highs.length < 2) {
    return {
      sar: closes[0],
      trend: "BULLISH",
      isReversal: false,
      af: afStart,
      ep: highs[0],
    };
  }

  // Initialize
  let trend: "BULLISH" | "BEARISH" = closes[1] > closes[0] ? "BULLISH" : "BEARISH";
  let sar = trend === "BULLISH" ? lows[0] : highs[0];
  let ep = trend === "BULLISH" ? highs[1] : lows[1];
  let af = afStart;
  let isReversal = false;

  // Calculate SAR for each period
  for (let i = 2; i < closes.length; i++) {
    const prevSAR = sar;
    const prevTrend = trend;

    // Calculate new SAR
    sar = prevSAR + af * (ep - prevSAR);

    // Check for reversal
    if (trend === "BULLISH") {
      // In uptrend, SAR should not be above the last two lows
      sar = Math.min(sar, lows[i - 1], lows[i - 2]);

      // Check if price crossed below SAR (reversal to downtrend)
      if (lows[i] < sar) {
        trend = "BEARISH";
        sar = ep; // SAR becomes the previous EP
        ep = lows[i]; // New EP is current low
        af = afStart; // Reset AF
        isReversal = true;
      } else {
        // Update EP if new high
        if (highs[i] > ep) {
          ep = highs[i];
          af = Math.min(af + afIncrement, afMax);
        }
        isReversal = false;
      }
    } else {
      // In downtrend, SAR should not be below the last two highs
      sar = Math.max(sar, highs[i - 1], highs[i - 2]);

      // Check if price crossed above SAR (reversal to uptrend)
      if (highs[i] > sar) {
        trend = "BULLISH";
        sar = ep; // SAR becomes the previous EP
        ep = highs[i]; // New EP is current high
        af = afStart; // Reset AF
        isReversal = true;
      } else {
        // Update EP if new low
        if (lows[i] < ep) {
          ep = lows[i];
          af = Math.min(af + afIncrement, afMax);
        }
        isReversal = false;
      }
    }
  }

  return {
    sar: Math.round(sar * 100) / 100,
    trend,
    isReversal,
    af: Math.round(af * 1000) / 1000,
    ep: Math.round(ep * 100) / 100,
  };
};

/**
 * Pure function to calculate Parabolic SAR series
 */
export const calculateParabolicSARSeries = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  afStart: number = 0.02,
  afIncrement: number = 0.02,
  afMax: number = 0.2
): ReadonlyArray<{ sar: number; trend: "BULLISH" | "BEARISH" }> => {
  const result: { sar: number; trend: "BULLISH" | "BEARISH" }[] = [];

  if (highs.length < 2) {
    return result;
  }

  // Initialize
  let trend: "BULLISH" | "BEARISH" = closes[1] > closes[0] ? "BULLISH" : "BEARISH";
  let sar = trend === "BULLISH" ? lows[0] : highs[0];
  let ep = trend === "BULLISH" ? highs[1] : lows[1];
  let af = afStart;

  result.push({ sar, trend });

  // Calculate SAR for each period
  for (let i = 2; i < closes.length; i++) {
    const prevSAR = sar;

    // Calculate new SAR
    sar = prevSAR + af * (ep - prevSAR);

    // Check for reversal and update
    if (trend === "BULLISH") {
      sar = Math.min(sar, lows[i - 1], lows[i - 2]);

      if (lows[i] < sar) {
        trend = "BEARISH";
        sar = ep;
        ep = lows[i];
        af = afStart;
      } else {
        if (highs[i] > ep) {
          ep = highs[i];
          af = Math.min(af + afIncrement, afMax);
        }
      }
    } else {
      sar = Math.max(sar, highs[i - 1], highs[i - 2]);

      if (highs[i] > sar) {
        trend = "BULLISH";
        sar = ep;
        ep = highs[i];
        af = afStart;
      } else {
        if (lows[i] < ep) {
          ep = lows[i];
          af = Math.min(af + afIncrement, afMax);
        }
      }
    }

    result.push({ sar, trend });
  }

  return result;
};

/**
 * Effect-based wrapper for Parabolic SAR calculation
 */
export const computeParabolicSAR = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  afStart: number = 0.02,
  afIncrement: number = 0.02,
  afMax: number = 0.2
): Effect.Effect<ParabolicSARResult> =>
  Effect.sync(() => calculateParabolicSAR(highs, lows, closes, afStart, afIncrement, afMax));

// ============================================================================
// FORMULA METADATA
// ============================================================================

export const ParabolicSARMetadata: FormulaMetadata = {
  name: "ParabolicSAR",
  category: "trend",
  difficulty: "beginner",
  description: "Parabolic SAR - stop and reverse trend following indicator",
  requiredInputs: ["highs", "lows", "closes"],
  optionalInputs: ["afStart", "afIncrement", "afMax"],
  minimumDataPoints: 3,
  outputType: "ParabolicSARResult",
  useCases: ["trend following", "stop-loss placement", "reversal detection", "entry/exit signals"],
  timeComplexity: "O(n)",
  dependencies: [],
};
