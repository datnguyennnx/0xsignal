import { Effect } from "effect";
import type { FormulaMetadata } from "../core/types";
import { calculateEMA } from "../trend/moving-averages";
import { calculateATR } from "./atr";

// ============================================================================
// KELTNER CHANNELS - Volatility-Based Trend Indicator
// ============================================================================
// Uses EMA and ATR to create dynamic support/resistance channels
//
// Formula:
// Middle Line = EMA(Close, period)
// Upper Channel = EMA + (multiplier × ATR)
// Lower Channel = EMA - (multiplier × ATR)
//
// Interpretation:
// - Price above upper channel: Strong uptrend
// - Price below lower channel: Strong downtrend
// - Price within channels: Range-bound
// - Channel width indicates volatility
// ============================================================================

export interface KeltnerChannelsResult {
  readonly upper: number;
  readonly middle: number;
  readonly lower: number;
  readonly width: number; // Normalized channel width
  readonly position: number; // Price position within channels (0-1)
  readonly signal: "ABOVE" | "WITHIN" | "BELOW";
}

/**
 * Pure function to calculate Keltner Channels
 * @param closes - Array of closing prices
 * @param highs - Array of high prices
 * @param lows - Array of low prices
 * @param period - EMA period (default: 20)
 * @param multiplier - ATR multiplier (default: 2)
 */
export const calculateKeltnerChannels = (
  closes: ReadonlyArray<number>,
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  period: number = 20,
  multiplier: number = 2
): KeltnerChannelsResult => {
  // Calculate middle line (EMA of closes)
  const ema = calculateEMA(closes, period);
  const middle = ema.value;

  // Calculate ATR
  const atr = calculateATR(highs, lows, closes, period);

  // Calculate upper and lower channels
  const upper = middle + multiplier * atr.value;
  const lower = middle - multiplier * atr.value;

  // Calculate normalized width
  const width = ((upper - lower) / middle) * 100;

  // Calculate price position within channels (0 = lower, 1 = upper)
  const currentPrice = closes[closes.length - 1];
  const position = (currentPrice - lower) / (upper - lower);

  // Determine signal
  let signal: "ABOVE" | "WITHIN" | "BELOW";
  if (currentPrice > upper) {
    signal = "ABOVE";
  } else if (currentPrice < lower) {
    signal = "BELOW";
  } else {
    signal = "WITHIN";
  }

  return {
    upper: Math.round(upper * 100) / 100,
    middle: Math.round(middle * 100) / 100,
    lower: Math.round(lower * 100) / 100,
    width: Math.round(width * 100) / 100,
    position: Math.round(position * 1000) / 1000,
    signal,
  };
};

/**
 * Pure function to calculate Keltner Channels series
 */
export const calculateKeltnerChannelsSeries = (
  closes: ReadonlyArray<number>,
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  period: number = 20,
  multiplier: number = 2
): {
  readonly upper: ReadonlyArray<number>;
  readonly middle: ReadonlyArray<number>;
  readonly lower: ReadonlyArray<number>;
} => {
  const upperSeries: number[] = [];
  const middleSeries: number[] = [];
  const lowerSeries: number[] = [];

  for (let i = period; i < closes.length; i++) {
    const windowCloses = closes.slice(0, i + 1);
    const windowHighs = highs.slice(0, i + 1);
    const windowLows = lows.slice(0, i + 1);

    const result = calculateKeltnerChannels(
      windowCloses,
      windowHighs,
      windowLows,
      period,
      multiplier
    );

    upperSeries.push(result.upper);
    middleSeries.push(result.middle);
    lowerSeries.push(result.lower);
  }

  return {
    upper: upperSeries,
    middle: middleSeries,
    lower: lowerSeries,
  };
};

/**
 * Effect-based wrapper for Keltner Channels calculation
 */
export const computeKeltnerChannels = (
  closes: ReadonlyArray<number>,
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  period: number = 20,
  multiplier: number = 2
): Effect.Effect<KeltnerChannelsResult> =>
  Effect.sync(() =>
    calculateKeltnerChannels(closes, highs, lows, period, multiplier)
  );

// ============================================================================
// FORMULA METADATA
// ============================================================================

export const KeltnerChannelsMetadata: FormulaMetadata = {
  name: "KeltnerChannels",
  category: "volatility",
  difficulty: "beginner",
  description:
    "Keltner Channels - volatility-based channels using EMA and ATR",
  requiredInputs: ["closes", "highs", "lows"],
  optionalInputs: ["period", "multiplier"],
  minimumDataPoints: 21,
  outputType: "KeltnerChannelsResult",
  useCases: [
    "trend identification",
    "breakout detection",
    "support/resistance levels",
    "volatility analysis",
  ],
  timeComplexity: "O(n)",
  dependencies: ["EMA", "ATR"],
};
