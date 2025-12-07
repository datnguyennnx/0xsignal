/** Market Analysis - Batch analysis with OHLCV data */

import { Effect, Array as Arr } from "effect";
import type { CryptoPrice, ChartDataPoint } from "@0xsignal/shared";
import type { AssetAnalysis, MarketOverview } from "../domain/types";
import { analyzeAsset } from "./analyze-asset";
import { ChartDataService, type ChartDataClient } from "../infrastructure/data-sources/binance";

const CONCURRENCY = 5;

export const analyzeMarket = (
  prices: ReadonlyArray<CryptoPrice>,
  chartService: ChartDataClient
): Effect.Effect<ReadonlyArray<AssetAnalysis>, never> =>
  Effect.forEach(
    prices,
    (price) => analyzeAsset(price).pipe(Effect.provideService(ChartDataService, chartService)),
    { concurrency: CONCURRENCY, batching: true }
  );

export const createMarketOverview = (analyses: ReadonlyArray<AssetAnalysis>): MarketOverview => ({
  totalAnalyzed: analyses.length,
  highRiskAssets: analyses.filter((a) => a.riskScore > 70).map((a) => a.symbol),
  averageRiskScore:
    analyses.length > 0
      ? Math.round(analyses.reduce((sum, a) => sum + a.riskScore, 0) / analyses.length)
      : 0,
  timestamp: new Date(),
});

export const filterHighConfidence = (
  analyses: ReadonlyArray<AssetAnalysis>,
  minConfidence = 70
): ReadonlyArray<AssetAnalysis> => analyses.filter((a) => a.confidence >= minConfidence);

export const rankByQuality = (
  analyses: ReadonlyArray<AssetAnalysis>
): ReadonlyArray<AssetAnalysis> =>
  [...analyses].sort((a, b) => b.confidence - b.riskScore / 2 - (a.confidence - a.riskScore / 2));

export const groupBySignal = (
  analyses: ReadonlyArray<AssetAnalysis>
): Record<string, AssetAnalysis[]> => Arr.groupBy(analyses, (a) => a.overallSignal);

export const getTopMovers = (
  analyses: ReadonlyArray<AssetAnalysis>,
  limit = 10
): ReadonlyArray<AssetAnalysis> =>
  [...analyses]
    .sort((a, b) => Math.abs(b.price.change24h) - Math.abs(a.price.change24h))
    .slice(0, limit);
