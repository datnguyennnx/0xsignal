/**
 * Market Analysis
 * Batch analysis with optimized concurrency
 */

import { Effect, Array as Arr } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import type { AssetAnalysis, MarketOverview } from "../domain/types";
import { analyzeAsset } from "./analyze-asset";

// Analyze multiple assets with bounded concurrency
export const analyzeMarket = (
  prices: ReadonlyArray<CryptoPrice>
): Effect.Effect<ReadonlyArray<AssetAnalysis>, never> =>
  Effect.forEach(prices, analyzeAsset, { concurrency: 10 });

// Create market overview from analyses
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

// Filter high confidence signals
export const filterHighConfidence = (
  analyses: ReadonlyArray<AssetAnalysis>,
  minConfidence: number = 70
): ReadonlyArray<AssetAnalysis> => analyses.filter((a) => a.confidence >= minConfidence);

// Rank by quality score (confidence - risk/2)
export const rankByQuality = (
  analyses: ReadonlyArray<AssetAnalysis>
): ReadonlyArray<AssetAnalysis> =>
  [...analyses].sort((a, b) => {
    const qualityA = a.confidence - a.riskScore / 2;
    const qualityB = b.confidence - b.riskScore / 2;
    return qualityB - qualityA;
  });

// Group analyses by signal type
export const groupBySignal = (
  analyses: ReadonlyArray<AssetAnalysis>
): Record<string, AssetAnalysis[]> => Arr.groupBy(analyses, (a) => a.overallSignal);

// Get top movers (highest absolute change)
export const getTopMovers = (
  analyses: ReadonlyArray<AssetAnalysis>,
  limit: number = 10
): ReadonlyArray<AssetAnalysis> =>
  [...analyses]
    .sort((a, b) => Math.abs(b.price.change24h) - Math.abs(a.price.change24h))
    .slice(0, limit);
