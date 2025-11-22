import { Effect } from "effect";
import type { FormulaMetadata } from "../core/types";

// ============================================================================
// HISTORICAL VOLATILITY - Standard Deviation of Returns
// ============================================================================
// Measures the dispersion of returns over a period
// Annualized to provide a standardized volatility measure
//
// Formula:
// Log Return = ln(Price[i] / Price[i-1])
// Volatility = StdDev(Log Returns) × √(252) for daily data
//
// Interpretation:
// - High volatility: Large price swings, higher risk
// - Low volatility: Stable prices, lower risk
// - Used for option pricing and risk management
// ============================================================================

export interface HistoricalVolatilityResult {
  readonly value: number; // Annualized volatility (%)
  readonly dailyVol: number; // Daily volatility
  readonly level: "VERY_LOW" | "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH";
}

/**
 * Pure function to calculate Historical Volatility
 * @param closes - Array of closing prices
 * @param period - Lookback period (default: 30)
 * @param annualizationFactor - Factor to annualize (default: 252 for daily data)
 */
export const calculateHistoricalVolatility = (
  closes: ReadonlyArray<number>,
  period: number = 30,
  annualizationFactor: number = 252
): HistoricalVolatilityResult => {
  // Calculate log returns
  const logReturns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const logReturn = Math.log(closes[i] / closes[i - 1]);
    logReturns.push(logReturn);
  }

  // Get recent returns
  const recentReturns = logReturns.slice(-period);

  // Calculate mean return
  const meanReturn =
    recentReturns.reduce((a, b) => a + b, 0) / recentReturns.length;

  // Calculate variance
  const variance =
    recentReturns
      .map((r) => Math.pow(r - meanReturn, 2))
      .reduce((a, b) => a + b, 0) / recentReturns.length;

  // Calculate standard deviation (daily volatility)
  const dailyVol = Math.sqrt(variance);

  // Annualize volatility
  const annualizedVol = dailyVol * Math.sqrt(annualizationFactor) * 100;

  // Determine volatility level
  let level: "VERY_LOW" | "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH";
  if (annualizedVol < 10) {
    level = "VERY_LOW";
  } else if (annualizedVol < 20) {
    level = "LOW";
  } else if (annualizedVol < 40) {
    level = "MODERATE";
  } else if (annualizedVol < 60) {
    level = "HIGH";
  } else {
    level = "VERY_HIGH";
  }

  return {
    value: Math.round(annualizedVol * 100) / 100,
    dailyVol: Math.round(dailyVol * 10000) / 10000,
    level,
  };
};

/**
 * Pure function to calculate Historical Volatility series
 */
export const calculateHistoricalVolatilitySeries = (
  closes: ReadonlyArray<number>,
  period: number = 30,
  annualizationFactor: number = 252
): ReadonlyArray<number> => {
  const volSeries: number[] = [];

  // Calculate log returns
  const logReturns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    logReturns.push(Math.log(closes[i] / closes[i - 1]));
  }

  // Calculate volatility for each window
  for (let i = period - 1; i < logReturns.length; i++) {
    const window = logReturns.slice(i - period + 1, i + 1);
    const mean = window.reduce((a, b) => a + b, 0) / period;
    const variance =
      window.map((r) => Math.pow(r - mean, 2)).reduce((a, b) => a + b, 0) /
      period;
    const vol = Math.sqrt(variance) * Math.sqrt(annualizationFactor) * 100;
    volSeries.push(vol);
  }

  return volSeries;
};

/**
 * Effect-based wrapper for Historical Volatility calculation
 */
export const computeHistoricalVolatility = (
  closes: ReadonlyArray<number>,
  period: number = 30,
  annualizationFactor: number = 252
): Effect.Effect<HistoricalVolatilityResult> =>
  Effect.sync(() =>
    calculateHistoricalVolatility(closes, period, annualizationFactor)
  );

// ============================================================================
// FORMULA METADATA
// ============================================================================

export const HistoricalVolatilityMetadata: FormulaMetadata = {
  name: "HistoricalVolatility",
  category: "volatility",
  difficulty: "intermediate",
  description:
    "Historical Volatility - annualized standard deviation of log returns",
  requiredInputs: ["closes"],
  optionalInputs: ["period", "annualizationFactor"],
  minimumDataPoints: 31,
  outputType: "HistoricalVolatilityResult",
  useCases: [
    "risk measurement",
    "option pricing",
    "position sizing",
    "volatility trading",
  ],
  timeComplexity: "O(n * k)",
  dependencies: [],
};
