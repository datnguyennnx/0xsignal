import { Effect } from "effect";
import type { FormulaMetadata } from "../core/types";

// ============================================================================
// GARMAN-KLASS VOLATILITY - OHLC-Based Estimator
// ============================================================================
// Most efficient volatility estimator using OHLC data
// Extends Parkinson by incorporating opening and closing prices
//
// Formula:
// GK = √[(1/N) × Σ(0.5×(ln(H/L))² - (2×ln(2)-1)×(ln(C/O))²)]
// Annualized = GK × √(252)
//
// Interpretation:
// - Most efficient unbiased estimator
// - Uses all OHLC information
// - Assumes Brownian motion with zero drift
// - 7.4x more efficient than close-to-close
// ============================================================================

export interface GarmanKlassVolatilityResult {
  readonly value: number; // Annualized volatility (%)
  readonly dailyVol: number; // Daily volatility
  readonly level: "VERY_LOW" | "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH";
  readonly efficiency: number; // Relative to close-to-close
}

/**
 * Pure function to calculate Garman-Klass Volatility
 * @param opens - Array of opening prices
 * @param highs - Array of high prices
 * @param lows - Array of low prices
 * @param closes - Array of closing prices
 * @param period - Lookback period (default: 30)
 * @param annualizationFactor - Factor to annualize (default: 252)
 */
export const calculateGarmanKlassVolatility = (
  opens: ReadonlyArray<number>,
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  period: number = 30,
  annualizationFactor: number = 252
): GarmanKlassVolatilityResult => {
  // Get recent data
  const recentOpens = opens.slice(-period);
  const recentHighs = highs.slice(-period);
  const recentLows = lows.slice(-period);
  const recentCloses = closes.slice(-period);

  // Garman-Klass constant: 2×ln(2) - 1
  const gkConstant = 2 * Math.log(2) - 1;

  // Calculate sum of GK components
  let sumGK = 0;
  for (let i = 0; i < period; i++) {
    const logHL = Math.log(recentHighs[i] / recentLows[i]);
    const logCO = Math.log(recentCloses[i] / recentOpens[i]);

    const gkComponent = 0.5 * logHL * logHL - gkConstant * logCO * logCO;
    sumGK += gkComponent;
  }

  // Calculate daily GK volatility
  const dailyVol = Math.sqrt(sumGK / period);

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

  // GK is approximately 7.4x more efficient than close-to-close
  const efficiency = 7.4;

  return {
    value: Math.round(annualizedVol * 100) / 100,
    dailyVol: Math.round(dailyVol * 10000) / 10000,
    level,
    efficiency,
  };
};

/**
 * Pure function to calculate Garman-Klass Volatility series
 */
export const calculateGarmanKlassVolatilitySeries = (
  opens: ReadonlyArray<number>,
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  period: number = 30,
  annualizationFactor: number = 252
): ReadonlyArray<number> => {
  const volSeries: number[] = [];
  const gkConstant = 2 * Math.log(2) - 1;

  for (let i = period - 1; i < opens.length; i++) {
    const windowOpens = opens.slice(i - period + 1, i + 1);
    const windowHighs = highs.slice(i - period + 1, i + 1);
    const windowLows = lows.slice(i - period + 1, i + 1);
    const windowCloses = closes.slice(i - period + 1, i + 1);

    let sumGK = 0;
    for (let j = 0; j < period; j++) {
      const logHL = Math.log(windowHighs[j] / windowLows[j]);
      const logCO = Math.log(windowCloses[j] / windowOpens[j]);
      sumGK += 0.5 * logHL * logHL - gkConstant * logCO * logCO;
    }

    const dailyVol = Math.sqrt(sumGK / period);
    const annualizedVol = dailyVol * Math.sqrt(annualizationFactor) * 100;
    volSeries.push(annualizedVol);
  }

  return volSeries;
};

/**
 * Effect-based wrapper for Garman-Klass Volatility calculation
 */
export const computeGarmanKlassVolatility = (
  opens: ReadonlyArray<number>,
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  period: number = 30,
  annualizationFactor: number = 252
): Effect.Effect<GarmanKlassVolatilityResult> =>
  Effect.sync(() =>
    calculateGarmanKlassVolatility(opens, highs, lows, closes, period, annualizationFactor)
  );

// ============================================================================
// FORMULA METADATA
// ============================================================================

export const GarmanKlassVolatilityMetadata: FormulaMetadata = {
  name: "GarmanKlassVolatility",
  category: "volatility",
  difficulty: "intermediate",
  description: "Garman-Klass Volatility - most efficient OHLC-based estimator",
  requiredInputs: ["opens", "highs", "lows", "closes"],
  optionalInputs: ["period", "annualizationFactor"],
  minimumDataPoints: 30,
  outputType: "GarmanKlassVolatilityResult",
  useCases: [
    "efficient volatility estimation",
    "option pricing",
    "risk management",
    "high-frequency trading",
  ],
  timeComplexity: "O(n * k)",
  dependencies: [],
};
