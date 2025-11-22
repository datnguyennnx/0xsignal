import { Effect } from "effect";
import type { FormulaMetadata } from "../core/types";

// ============================================================================
// PARKINSON VOLATILITY - High-Low Range Estimator
// ============================================================================
// More efficient volatility estimator using high-low range
// Less sensitive to opening gaps than close-to-close volatility
//
// Formula:
// Parkinson = √[(1/(4×ln(2))) × (1/N) × Σ(ln(High/Low))²]
// Annualized = Parkinson × √(252)
//
// Interpretation:
// - More efficient than historical volatility (uses intraday range)
// - Assumes no overnight gaps
// - Better for continuous trading markets
// ============================================================================

export interface ParkinsonVolatilityResult {
  readonly value: number; // Annualized volatility (%)
  readonly dailyVol: number; // Daily volatility
  readonly level: "VERY_LOW" | "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH";
}

/**
 * Pure function to calculate Parkinson Volatility
 * @param highs - Array of high prices
 * @param lows - Array of low prices
 * @param period - Lookback period (default: 30)
 * @param annualizationFactor - Factor to annualize (default: 252)
 */
export const calculateParkinsonVolatility = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  period: number = 30,
  annualizationFactor: number = 252
): ParkinsonVolatilityResult => {
  // Get recent data
  const recentHighs = highs.slice(-period);
  const recentLows = lows.slice(-period);

  // Calculate sum of squared log(high/low)
  let sumSquaredLogHL = 0;
  for (let i = 0; i < period; i++) {
    const logHL = Math.log(recentHighs[i] / recentLows[i]);
    sumSquaredLogHL += logHL * logHL;
  }

  // Parkinson constant: 1 / (4 * ln(2))
  const parkinsonConstant = 1 / (4 * Math.log(2));

  // Calculate daily Parkinson volatility
  const dailyVol = Math.sqrt(parkinsonConstant * (sumSquaredLogHL / period));

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
 * Pure function to calculate Parkinson Volatility series
 */
export const calculateParkinsonVolatilitySeries = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  period: number = 30,
  annualizationFactor: number = 252
): ReadonlyArray<number> => {
  const volSeries: number[] = [];
  const parkinsonConstant = 1 / (4 * Math.log(2));

  for (let i = period - 1; i < highs.length; i++) {
    const windowHighs = highs.slice(i - period + 1, i + 1);
    const windowLows = lows.slice(i - period + 1, i + 1);

    let sumSquaredLogHL = 0;
    for (let j = 0; j < period; j++) {
      const logHL = Math.log(windowHighs[j] / windowLows[j]);
      sumSquaredLogHL += logHL * logHL;
    }

    const dailyVol = Math.sqrt(parkinsonConstant * (sumSquaredLogHL / period));
    const annualizedVol = dailyVol * Math.sqrt(annualizationFactor) * 100;
    volSeries.push(annualizedVol);
  }

  return volSeries;
};

/**
 * Effect-based wrapper for Parkinson Volatility calculation
 */
export const computeParkinsonVolatility = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  period: number = 30,
  annualizationFactor: number = 252
): Effect.Effect<ParkinsonVolatilityResult> =>
  Effect.sync(() =>
    calculateParkinsonVolatility(highs, lows, period, annualizationFactor)
  );

// ============================================================================
// FORMULA METADATA
// ============================================================================

export const ParkinsonVolatilityMetadata: FormulaMetadata = {
  name: "ParkinsonVolatility",
  category: "volatility",
  difficulty: "intermediate",
  description:
    "Parkinson Volatility - efficient estimator using high-low range",
  requiredInputs: ["highs", "lows"],
  optionalInputs: ["period", "annualizationFactor"],
  minimumDataPoints: 30,
  outputType: "ParkinsonVolatilityResult",
  useCases: [
    "efficient volatility estimation",
    "intraday volatility measurement",
    "option pricing",
    "risk management",
  ],
  timeComplexity: "O(n * k)",
  dependencies: [],
};
