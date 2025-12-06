/** Asset Context Service - Cross-domain data aggregation */

import { Effect, Context, Layer, Cache, pipe, Array as Arr } from "effect";
import type {
  AssetContext,
  TreasuryContext,
  LiquidationContext,
  DerivativesContext,
  ContextOptions,
  LiquidationData,
  OpenInterestData,
  FundingRateData,
} from "@0xsignal/shared";
import { AnalysisServiceTag } from "./analysis";
import { BinanceService } from "../infrastructure/data-sources/binance";
import { TreasuryService } from "../infrastructure/data-sources/coingecko/treasury.provider";
import type { TreasurySummary } from "../domain/treasury/types";
import { CACHE_TTL, CACHE_CAPACITY } from "../infrastructure/config/app.config";
import {
  computeRiskContext,
  classifyLiquidationRisk,
  classifyDominantSide,
  classifyFundingBias,
  generateInsights,
} from "../domain/context";

const normalizeSymbol = (s: string) => s.toLowerCase().replace("usdt", "");

const symbolToCoinId = (symbol: string): string | null => {
  const map: Record<string, string> = {
    btc: "bitcoin",
    eth: "ethereum",
    bitcoin: "bitcoin",
    ethereum: "ethereum",
  };
  return map[normalizeSymbol(symbol)] ?? null;
};

const buildTreasuryContext = (summary: TreasurySummary): TreasuryContext => {
  const signal =
    summary.netChange30d > 5
      ? "strong_buy"
      : summary.netChange30d > 0
        ? "buy"
        : summary.netChange30d < -5
          ? "strong_sell"
          : summary.netChange30d < 0
            ? "sell"
            : "neutral";

  return {
    hasInstitutionalHoldings: summary.entityCount > 0,
    totalHoldingsUsd: summary.totalValueUsd,
    entityCount: summary.entityCount,
    percentOfSupply: summary.marketCapDominance,
    netChange30d: summary.netChange30d,
    accumulationSignal: signal,
    topHolders: pipe(
      summary.topHolders,
      Arr.take(3),
      Arr.map((h) => ({
        name: h.entityName,
        holdingsUsd: h.currentValueUsd,
        percentOfSupply: h.percentOfSupply,
      }))
    ),
  };
};

const buildLiquidationContext = (
  liqData: LiquidationData,
  _currentPrice: number
): LiquidationContext => ({
  hasLiquidationData: true,
  nearbyLiquidationRisk: classifyLiquidationRisk(liqData.totalLiquidationUsd),
  dominantSide: classifyDominantSide(liqData.liquidationRatio),
  liquidationRatio: liqData.liquidationRatio,
  totalLiquidationUsd24h: liqData.totalLiquidationUsd,
  dangerZones: [],
});

const buildDerivativesContext = (
  oi: OpenInterestData,
  funding: FundingRateData
): DerivativesContext => ({
  openInterestUsd: oi.openInterestUsd,
  oiChange24h: oi.changePercent24h,
  fundingRate: funding.fundingRate,
  fundingBias: classifyFundingBias(funding.fundingRate),
});

export interface ContextService {
  readonly getAssetContext: (
    symbol: string,
    options?: ContextOptions
  ) => Effect.Effect<AssetContext, Error>;
}

export class ContextServiceTag extends Context.Tag("ContextService")<
  ContextServiceTag,
  ContextService
>() {}

export const ContextServiceLive = Layer.effect(
  ContextServiceTag,
  Effect.gen(function* () {
    const analysis = yield* AnalysisServiceTag;
    const binance = yield* BinanceService;
    const treasury = yield* TreasuryService;

    const fetchTreasury = (coinId: string) =>
      treasury.getHoldingsByCoin(coinId).pipe(
        Effect.map((s): TreasurySummary | null => s),
        Effect.catchAll(() => Effect.succeed(null))
      );

    const fetchLiquidation = (symbol: string) =>
      binance.getLiquidations(symbol, "24h").pipe(
        Effect.map((l): LiquidationData | null => l),
        Effect.catchAll(() => Effect.succeed(null))
      );

    const fetchOI = (symbol: string) =>
      binance.getOpenInterest(symbol).pipe(
        Effect.map((o): OpenInterestData | null => o),
        Effect.catchAll(() => Effect.succeed(null))
      );

    const fetchFunding = (symbol: string) =>
      binance.getFundingRate(symbol).pipe(
        Effect.map((f): FundingRateData | null => f),
        Effect.catchAll(() => Effect.succeed(null))
      );

    const buildContext = (
      symbol: string,
      options: ContextOptions = {}
    ): Effect.Effect<AssetContext, Error> =>
      Effect.gen(function* () {
        const normalized = normalizeSymbol(symbol);
        const coinId = symbolToCoinId(symbol);
        const binanceSymbol = `${normalized.toUpperCase()}USDT`;

        const analysisResult = yield* analysis
          .analyzeSymbol(normalized)
          .pipe(Effect.mapError((e) => new Error(e.message)));

        const includeTreasury = options.includeTreasury !== false && coinId !== null;
        const includeLiquidation = options.includeLiquidation !== false;
        const includeDerivatives = options.includeDerivatives !== false;

        const [treasuryData, liqData, oiData, fundingData] = yield* Effect.all(
          [
            includeTreasury && coinId ? fetchTreasury(coinId) : Effect.succeed(null),
            includeLiquidation ? fetchLiquidation(binanceSymbol) : Effect.succeed(null),
            includeDerivatives ? fetchOI(binanceSymbol) : Effect.succeed(null),
            includeDerivatives ? fetchFunding(binanceSymbol) : Effect.succeed(null),
          ],
          { concurrency: "unbounded" }
        );

        const treasuryCtx = treasuryData ? buildTreasuryContext(treasuryData) : null;
        const liquidationCtx = liqData
          ? buildLiquidationContext(liqData, analysisResult.price.price)
          : null;
        const derivativesCtx =
          oiData && fundingData ? buildDerivativesContext(oiData, fundingData) : null;

        const riskContext = computeRiskContext(
          analysisResult.riskScore,
          liquidationCtx,
          treasuryCtx
        );
        const insights = generateInsights(
          analysisResult.overallSignal,
          riskContext,
          treasuryCtx,
          liquidationCtx,
          derivativesCtx
        );

        return {
          symbol: analysisResult.symbol,
          timestamp: analysisResult.timestamp,
          price: analysisResult.price.price,
          priceChange24h: analysisResult.price.change24h,
          marketCap: analysisResult.price.marketCap,
          volume24h: analysisResult.price.volume24h,
          signal: analysisResult.overallSignal,
          confidence: analysisResult.confidence,
          regime: analysisResult.strategyResult.regime,
          direction: analysisResult.entrySignal.direction,
          noise: analysisResult.noise,
          riskContext,
          treasury: treasuryCtx,
          liquidation: liquidationCtx,
          derivatives: derivativesCtx,
          recommendation: analysisResult.recommendation,
          actionableInsights: insights,
        };
      });

    const cache = yield* Cache.make({
      capacity: CACHE_CAPACITY.LARGE,
      timeToLive: CACHE_TTL.ANALYSIS,
      lookup: (key: string) => {
        const [symbol, opts] = key.split("|");
        const options: ContextOptions = opts ? JSON.parse(opts) : {};
        return buildContext(symbol, options);
      },
    });

    return {
      getAssetContext: (symbol, options = {}) => {
        const key = `${symbol}|${JSON.stringify(options)}`;
        return cache.get(key);
      },
    };
  })
);
