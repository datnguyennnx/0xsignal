import { Effect } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import type { AssetAnalysis, MarketOverview } from "../domain/types";
import { analyzeAsset } from "./analyze-asset";

export const analyzeMarket = (
  prices: ReadonlyArray<CryptoPrice>
): Effect.Effect<ReadonlyArray<AssetAnalysis>, never> =>
  Effect.forEach(prices, (price) => analyzeAsset(price), { concurrency: "unbounded" });

export const createMarketOverview = (analyses: ReadonlyArray<AssetAnalysis>): MarketOverview => {
  const highRiskAssets = analyses.filter((a) => a.riskScore > 70).map((a) => a.symbol);

  const averageRiskScore =
    analyses.length > 0
      ? Math.round(analyses.reduce((sum, a) => sum + a.riskScore, 0) / analyses.length)
      : 0;

  return {
    totalAnalyzed: analyses.length,
    highRiskAssets,
    averageRiskScore,
    timestamp: new Date(),
  };
};

export const filterHighConfidence = (
  analyses: ReadonlyArray<AssetAnalysis>,
  minConfidence: number = 70
): ReadonlyArray<AssetAnalysis> => analyses.filter((a) => a.confidence >= minConfidence);

export const rankByQuality = (
  analyses: ReadonlyArray<AssetAnalysis>
): ReadonlyArray<AssetAnalysis> =>
  [...analyses].sort((a, b) => {
    const qualityA = a.confidence - a.riskScore / 2;
    const qualityB = b.confidence - b.riskScore / 2;
    return qualityB - qualityA;
  });
