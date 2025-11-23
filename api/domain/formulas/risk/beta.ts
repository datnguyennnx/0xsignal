import { Effect } from "effect";
import type { FormulaMetadata } from "../core/types";
import { mean } from "../core/math";

// ============================================================================
// BETA - Systematic Risk Measure
// ============================================================================
// Measures sensitivity of an asset's returns to market returns
//
// Formula:
// β = Cov(R_asset, R_market) / Var(R_market)
//
// Interpretation:
// - β = 1: Moves with market
// - β > 1: More volatile than market
// - β < 1: Less volatile than market
// - β < 0: Moves opposite to market
// ============================================================================

export interface BetaResult {
  readonly value: number; // Beta coefficient
  readonly interpretation: "DEFENSIVE" | "NEUTRAL" | "AGGRESSIVE" | "INVERSE";
  readonly correlation: number; // Correlation with market
  readonly volatilityRatio: number; // Asset vol / Market vol
}

/**
 * Pure function to calculate Beta
 * @param assetReturns - Asset returns
 * @param marketReturns - Market/benchmark returns
 */
export const calculateBeta = (
  assetReturns: ReadonlyArray<number>,
  marketReturns: ReadonlyArray<number>
): BetaResult => {
  const n = Math.min(assetReturns.length, marketReturns.length);
  const asset = assetReturns.slice(0, n);
  const market = marketReturns.slice(0, n);

  const meanAsset = mean([...asset]);
  const meanMarket = mean([...market]);

  // Calculate covariance and variance
  let covariance = 0;
  let marketVariance = 0;
  let assetVariance = 0;

  for (let i = 0; i < n; i++) {
    const assetDev = asset[i] - meanAsset;
    const marketDev = market[i] - meanMarket;
    covariance += assetDev * marketDev;
    marketVariance += marketDev * marketDev;
    assetVariance += assetDev * assetDev;
  }

  covariance /= n;
  marketVariance /= n;
  assetVariance /= n;

  // Calculate beta
  const beta = marketVariance === 0 ? 0 : covariance / marketVariance;

  // Determine interpretation
  let interpretation: "DEFENSIVE" | "NEUTRAL" | "AGGRESSIVE" | "INVERSE";
  if (beta < 0) {
    interpretation = "INVERSE";
  } else if (beta < 0.8) {
    interpretation = "DEFENSIVE";
  } else if (beta < 1.2) {
    interpretation = "NEUTRAL";
  } else {
    interpretation = "AGGRESSIVE";
  }

  // Calculate correlation
  const assetStd = Math.sqrt(assetVariance);
  const marketStd = Math.sqrt(marketVariance);
  const correlation = assetStd * marketStd === 0 ? 0 : covariance / (assetStd * marketStd);

  // Calculate volatility ratio
  const volatilityRatio = marketStd === 0 ? 0 : assetStd / marketStd;

  return {
    value: Math.round(beta * 10000) / 10000,
    interpretation,
    correlation: Math.round(correlation * 10000) / 10000,
    volatilityRatio: Math.round(volatilityRatio * 10000) / 10000,
  };
};

/**
 * Effect-based wrapper for Beta calculation
 */
export const computeBeta = (
  assetReturns: ReadonlyArray<number>,
  marketReturns: ReadonlyArray<number>
): Effect.Effect<BetaResult> => Effect.sync(() => calculateBeta(assetReturns, marketReturns));

// ============================================================================
// FORMULA METADATA
// ============================================================================

export const BetaMetadata: FormulaMetadata = {
  name: "Beta",
  category: "risk",
  difficulty: "advanced",
  description: "Beta - systematic risk relative to market",
  requiredInputs: ["assetReturns", "marketReturns"],
  optionalInputs: [],
  minimumDataPoints: 2,
  outputType: "BetaResult",
  useCases: [
    "systematic risk measurement",
    "portfolio construction",
    "CAPM analysis",
    "hedging strategies",
  ],
  timeComplexity: "O(n)",
  dependencies: [],
};
