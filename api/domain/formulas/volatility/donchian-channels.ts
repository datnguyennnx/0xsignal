import { Effect } from "effect";
import type { FormulaMetadata } from "../core/types";

// ============================================================================
// DONCHIAN CHANNELS - Breakout Indicator
// ============================================================================
// Identifies the highest high and lowest low over a given period
// Used for breakout trading and trend following
//
// Formula:
// Upper Channel = Highest High over N periods
// Lower Channel = Lowest Low over N periods
// Middle Channel = (Upper + Lower) / 2
//
// Interpretation:
// - Price breaks above upper: Bullish breakout
// - Price breaks below lower: Bearish breakout
// - Price at middle: Neutral/consolidation
// - Channel width indicates volatility
// ============================================================================

export interface DonchianChannelsResult {
  readonly upper: number; // Highest high
  readonly middle: number; // Midpoint
  readonly lower: number; // Lowest low
  readonly width: number; // Normalized channel width
  readonly position: number; // Price position within channels (0-1)
  readonly signal: "BULLISH_BREAKOUT" | "BEARISH_BREAKOUT" | "NEUTRAL";
}

/**
 * Pure function to calculate Donchian Channels
 * @param highs - Array of high prices
 * @param lows - Array of low prices
 * @param closes - Array of closing prices
 * @param period - Lookback period (default: 20)
 */
export const calculateDonchianChannels = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  period: number = 20
): DonchianChannelsResult => {
  // Get the last period values
  const recentHighs = highs.slice(-period);
  const recentLows = lows.slice(-period);

  // Calculate upper and lower channels
  const upper = Math.max(...recentHighs);
  const lower = Math.min(...recentLows);

  // Calculate middle channel
  const middle = (upper + lower) / 2;

  // Calculate normalized width
  const width = ((upper - lower) / middle) * 100;

  // Calculate price position within channels (0 = lower, 1 = upper)
  const currentPrice = closes[closes.length - 1];
  const position = (currentPrice - lower) / (upper - lower);

  // Determine signal
  let signal: "BULLISH_BREAKOUT" | "BEARISH_BREAKOUT" | "NEUTRAL";
  if (currentPrice >= upper) {
    signal = "BULLISH_BREAKOUT";
  } else if (currentPrice <= lower) {
    signal = "BEARISH_BREAKOUT";
  } else {
    signal = "NEUTRAL";
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
 * Pure function to calculate Donchian Channels series
 */
export const calculateDonchianChannelsSeries = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  period: number = 20
): {
  readonly upper: ReadonlyArray<number>;
  readonly middle: ReadonlyArray<number>;
  readonly lower: ReadonlyArray<number>;
} => {
  const upperSeries: number[] = [];
  const middleSeries: number[] = [];
  const lowerSeries: number[] = [];

  for (let i = period - 1; i < highs.length; i++) {
    const windowHighs = highs.slice(i - period + 1, i + 1);
    const windowLows = lows.slice(i - period + 1, i + 1);

    const upper = Math.max(...windowHighs);
    const lower = Math.min(...windowLows);
    const middle = (upper + lower) / 2;

    upperSeries.push(upper);
    middleSeries.push(middle);
    lowerSeries.push(lower);
  }

  return {
    upper: upperSeries,
    middle: middleSeries,
    lower: lowerSeries,
  };
};

/**
 * Effect-based wrapper for Donchian Channels calculation
 */
export const computeDonchianChannels = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  period: number = 20
): Effect.Effect<DonchianChannelsResult> =>
  Effect.sync(() => calculateDonchianChannels(highs, lows, closes, period));

// ============================================================================
// FORMULA METADATA
// ============================================================================

export const DonchianChannelsMetadata: FormulaMetadata = {
  name: "DonchianChannels",
  category: "volatility",
  difficulty: "beginner",
  description: "Donchian Channels - highest high and lowest low over a period",
  requiredInputs: ["highs", "lows", "closes"],
  optionalInputs: ["period"],
  minimumDataPoints: 20,
  outputType: "DonchianChannelsResult",
  useCases: [
    "breakout detection",
    "trend following",
    "support/resistance levels",
    "volatility measurement",
  ],
  timeComplexity: "O(n * k)",
  dependencies: [],
};
