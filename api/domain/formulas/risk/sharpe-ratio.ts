import { Effect } from "effect";
import type { FormulaMetadata } from "../core/types";
import { mean } from "../core/math";
import { calculateStandardDeviation } from "../statistical/standard-deviation";

// ============================================================================
// SHARPE RATIO - Risk-Adjusted Return Measure
// ============================================================================
// Measures excess return per unit of risk
//
// Formula:
// Sharpe = (R_p - R_f) / σ_p
// where R_p = portfolio return, R_f = risk-free rate, σ_p = standard deviation
//
// Interpretation:
// - Sharpe > 3: Excellent
// - Sharpe > 2: Very good
// - Sharpe > 1: Good
// - Sharpe > 0: Acceptable
// - Sharpe < 0: Poor (losing to risk-free rate)
// ============================================================================

export interface SharpeRatioResult {
  readonly value: number; // Sharpe ratio
  readonly rating: "EXCELLENT" | "VERY_GOOD" | "GOOD" | "ACCEPTABLE" | "POOR";
  readonly excessReturn: number; // Return above risk-free rate
  readonly volatility: number; // Standard deviation of returns
}

/**
 * Pure function to calculate Sharpe Ratio
 * @param returns - Array of period returns
 * @param riskFreeRate - Risk-free rate (default: 0.02 for 2%)
 * @param annualizationFactor - Factor to annualize (default: 252 for daily)
 */
export const calculateSharpeRatio = (
  returns: ReadonlyArray<number>,
  riskFreeRate: number = 0.02,
  annualizationFactor: number = 252
): SharpeRatioResult => {
  // Calculate average return
  const avgReturn = mean([...returns]);

  // Calculate standard deviation
  const stats = calculateStandardDeviation(returns);

  // Annualize return and volatility
  const annualizedReturn = avgReturn * annualizationFactor;
  const annualizedVol = stats.population * Math.sqrt(annualizationFactor);

  // Calculate excess return
  const excessReturn = annualizedReturn - riskFreeRate;

  // Calculate Sharpe ratio
  const sharpe = annualizedVol === 0 ? 0 : excessReturn / annualizedVol;

  // Determine rating
  let rating: "EXCELLENT" | "VERY_GOOD" | "GOOD" | "ACCEPTABLE" | "POOR";
  if (sharpe > 3) {
    rating = "EXCELLENT";
  } else if (sharpe > 2) {
    rating = "VERY_GOOD";
  } else if (sharpe > 1) {
    rating = "GOOD";
  } else if (sharpe > 0) {
    rating = "ACCEPTABLE";
  } else {
    rating = "POOR";
  }

  return {
    value: Math.round(sharpe * 10000) / 10000,
    rating,
    excessReturn: Math.round(excessReturn * 10000) / 10000,
    volatility: Math.round(annualizedVol * 10000) / 10000,
  };
};

/**
 * Effect-based wrapper for Sharpe Ratio calculation
 */
export const computeSharpeRatio = (
  returns: ReadonlyArray<number>,
  riskFreeRate: number = 0.02,
  annualizationFactor: number = 252
): Effect.Effect<SharpeRatioResult> =>
  Effect.sync(() =>
    calculateSharpeRatio(returns, riskFreeRate, annualizationFactor)
  );

// ============================================================================
// FORMULA METADATA
// ============================================================================

export const SharpeRatioMetadata: FormulaMetadata = {
  name: "SharpeRatio",
  category: "risk",
  difficulty: "advanced",
  description: "Sharpe Ratio - risk-adjusted return measure",
  requiredInputs: ["returns"],
  optionalInputs: ["riskFreeRate", "annualizationFactor"],
  minimumDataPoints: 2,
  outputType: "SharpeRatioResult",
  useCases: [
    "performance evaluation",
    "strategy comparison",
    "risk-adjusted returns",
    "portfolio optimization",
  ],
  timeComplexity: "O(n)",
  dependencies: ["StandardDeviation"],
};
