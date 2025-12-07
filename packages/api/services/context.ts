/** Asset Context Service - Cross-domain data aggregation */

import { Effect, Context, Layer, Cache, pipe, Array as Arr, Duration } from "effect";
import type {
  AssetContext,
  TreasuryContext,
  DerivativesContext,
  LiquidationContext,
  ContextOptions,
  OpenInterestData,
  FundingRateData,
} from "@0xsignal/shared";
import { AnalysisServiceTag } from "./analysis";
import { BinanceService } from "../infrastructure/data-sources/binance";
import { TreasuryService } from "../infrastructure/data-sources/coingecko/treasury.provider";
import { CoinGeckoService } from "../infrastructure/data-sources/coingecko";
import type { TreasurySummary } from "../domain/treasury/types";
import { CACHE_TTL, CACHE_CAPACITY } from "../infrastructure/config/app.config";
import { computeRiskContext, classifyFundingBias, generateInsights } from "../domain/context";

const normalizeSymbol = (s: string) => s.toLowerCase().replace("usdt", "");

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
    const coinGecko = yield* CoinGeckoService;

    const resolveCoinId = (symbol: string) => coinGecko.getCoinId(symbol);

    const fetchTreasury = (coinId: string) =>
      treasury.getHoldingsByCoin(coinId).pipe(
        Effect.map((s): TreasurySummary | null => s),
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
        const binanceSymbol = `${normalized.toUpperCase()}USDT`;

        const [analysisResult, coinId] = yield* Effect.all(
          [
            analysis.analyzeSymbol(normalized).pipe(Effect.mapError((e) => new Error(e.message))),
            resolveCoinId(symbol),
          ],
          { concurrency: 2 }
        );

        const includeTreasury = options.includeTreasury !== false && coinId !== null;
        const includeDerivatives = options.includeDerivatives !== false;

        const [treasuryData, oiData, fundingData] = yield* Effect.all(
          [
            includeTreasury && coinId
              ? fetchTreasury(coinId).pipe(
                  Effect.timeout(Duration.seconds(3)),
                  Effect.catchAll(() => Effect.succeed(null))
                )
              : Effect.succeed(null),
            includeDerivatives
              ? fetchOI(binanceSymbol).pipe(
                  Effect.timeout(Duration.seconds(2)),
                  Effect.catchAll(() => Effect.succeed(null))
                )
              : Effect.succeed(null),
            includeDerivatives
              ? fetchFunding(binanceSymbol).pipe(
                  Effect.timeout(Duration.seconds(2)),
                  Effect.catchAll(() => Effect.succeed(null))
                )
              : Effect.succeed(null),
          ],
          { concurrency: "unbounded" }
        );

        const treasuryCtx = treasuryData ? buildTreasuryContext(treasuryData) : null;
        const derivativesCtx =
          oiData && fundingData ? buildDerivativesContext(oiData, fundingData) : null;

        const riskContext = computeRiskContext(analysisResult.riskScore, null, treasuryCtx);
        const insights = generateInsights(
          analysisResult.overallSignal,
          riskContext,
          treasuryCtx,
          null,
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
          liquidation: null,
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
