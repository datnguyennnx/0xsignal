/** Beta - Systematic risk measure with functional patterns */
// Beta = Cov(R_asset, R_market) / Var(R_market)

import { Effect, Match, Array as Arr, pipe } from "effect";
import type { FormulaMetadata } from "../core/types";
import { mean } from "../core/math";

export interface BetaResult {
  readonly value: number;
  readonly interpretation: "DEFENSIVE" | "NEUTRAL" | "AGGRESSIVE" | "INVERSE";
  readonly correlation: number;
  readonly volatilityRatio: number;
}

// Interpretation classification
const classifyInterpretation = Match.type<number>().pipe(
  Match.when(
    (v) => v < 0,
    () => "INVERSE" as const
  ),
  Match.when(
    (v) => v < 0.8,
    () => "DEFENSIVE" as const
  ),
  Match.when(
    (v) => v < 1.2,
    () => "NEUTRAL" as const
  ),
  Match.orElse(() => "AGGRESSIVE" as const)
);

// Round to 4 decimal places
const round4 = (n: number): number => Math.round(n * 10000) / 10000;

// Statistics accumulator
interface StatsAccum {
  readonly covariance: number;
  readonly marketVariance: number;
  readonly assetVariance: number;
}

// Calculate statistics using Arr.reduce
const calculateStats = (
  asset: ReadonlyArray<number>,
  market: ReadonlyArray<number>,
  meanAsset: number,
  meanMarket: number
): StatsAccum =>
  pipe(
    Arr.zipWith(asset, market, (a, m) => ({
      assetDev: a - meanAsset,
      marketDev: m - meanMarket,
    })),
    Arr.reduce(
      { covariance: 0, marketVariance: 0, assetVariance: 0 },
      (acc, { assetDev, marketDev }) => ({
        covariance: acc.covariance + assetDev * marketDev,
        marketVariance: acc.marketVariance + marketDev * marketDev,
        assetVariance: acc.assetVariance + assetDev * assetDev,
      })
    )
  );

// Calculate Beta
export const calculateBeta = (
  assetReturns: ReadonlyArray<number>,
  marketReturns: ReadonlyArray<number>
): BetaResult => {
  const n = Math.min(assetReturns.length, marketReturns.length);
  const asset = Arr.take(assetReturns, n);
  const market = Arr.take(marketReturns, n);
  const meanAsset = mean([...asset]);
  const meanMarket = mean([...market]);

  const stats = calculateStats(asset, market, meanAsset, meanMarket);
  const covariance = stats.covariance / n;
  const marketVariance = stats.marketVariance / n;
  const assetVariance = stats.assetVariance / n;

  const beta = marketVariance === 0 ? 0 : covariance / marketVariance;
  const assetStd = Math.sqrt(assetVariance);
  const marketStd = Math.sqrt(marketVariance);
  const correlation = assetStd * marketStd === 0 ? 0 : covariance / (assetStd * marketStd);
  const volatilityRatio = marketStd === 0 ? 0 : assetStd / marketStd;

  return {
    value: round4(beta),
    interpretation: classifyInterpretation(beta),
    correlation: round4(correlation),
    volatilityRatio: round4(volatilityRatio),
  };
};

// Effect-based wrapper
export const computeBeta = (
  assetReturns: ReadonlyArray<number>,
  marketReturns: ReadonlyArray<number>
): Effect.Effect<BetaResult> => Effect.sync(() => calculateBeta(assetReturns, marketReturns));

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
