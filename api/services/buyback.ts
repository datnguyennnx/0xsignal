/**
 * Buyback Service
 * Aggregates protocol buyback data with market cap context
 * Optimized with request deduplication and stale-while-revalidate caching
 */

import { Effect, Context, Layer } from "effect";
import type {
  BuybackSignal,
  BuybackOverview,
  BuybackStrength,
  CategoryBuybackStats,
  ProtocolBuyback,
  ProtocolBuybackDetail,
  DailyRevenuePoint,
  CryptoPrice,
} from "@0xsignal/shared";
import { DefiLlamaService } from "../infrastructure/data-sources/defillama";
import { CoinGeckoService } from "../infrastructure/data-sources/coingecko";
import { CacheService } from "../infrastructure/cache/memory.cache";
import { Logger } from "../infrastructure/logging/console.logger";
import { DataSourceError } from "../infrastructure/data-sources/types";

// ============================================================================
// Buyback Service Interface
// ============================================================================

export interface BuybackService {
  readonly getBuybackSignals: (
    limit?: number
  ) => Effect.Effect<readonly BuybackSignal[], DataSourceError>;
  readonly getBuybackOverview: () => Effect.Effect<BuybackOverview, DataSourceError>;
  readonly getProtocolBuyback: (
    protocol: string
  ) => Effect.Effect<BuybackSignal | null, DataSourceError>;
  readonly getProtocolBuybackDetail: (
    protocol: string
  ) => Effect.Effect<ProtocolBuybackDetail | null, DataSourceError>;
}

export class BuybackServiceTag extends Context.Tag("BuybackService")<
  BuybackServiceTag,
  BuybackService
>() {}

// ============================================================================
// Pure Functions
// ============================================================================

const classifyBuybackStrength = (annualizedRate: number): BuybackStrength => {
  if (annualizedRate <= 0) return "NONE";
  if (annualizedRate < 1) return "LOW";
  if (annualizedRate < 5) return "MODERATE";
  if (annualizedRate < 15) return "HIGH";
  return "VERY_HIGH";
};

const calculateBuybackRate = (revenue: number, marketCap: number): number => {
  if (marketCap <= 0) return 0;
  return (revenue / marketCap) * 100;
};

const calculateAnnualizedRate = (rate30d: number): number => {
  return rate30d * 12;
};

const createBuybackSignal = (
  protocol: ProtocolBuyback,
  marketCap: number,
  price: number
): BuybackSignal => {
  const buybackRate24h = calculateBuybackRate(protocol.revenue24h, marketCap);
  const buybackRate7d = calculateBuybackRate(protocol.revenue7d, marketCap);
  const buybackRate30d = calculateBuybackRate(protocol.revenue30d, marketCap);
  const annualizedBuybackRate = calculateAnnualizedRate(buybackRate30d);

  // Quant metrics
  const annualizedRevenue = protocol.revenue30d * 12;
  const revenueToMcap = marketCap > 0 ? annualizedRevenue / marketCap : 0;
  const impliedPE = annualizedRevenue > 0 ? marketCap / annualizedRevenue : 0;
  const avgDaily7d = protocol.revenue7d / 7;
  const revenueGrowth7d =
    avgDaily7d > 0 ? ((protocol.revenue24h - avgDaily7d) / avgDaily7d) * 100 : 0;

  return {
    protocol: protocol.protocol,
    symbol: protocol.symbol,
    geckoId: protocol.geckoId,
    marketCap,
    price,
    revenue24h: protocol.revenue24h,
    revenue7d: protocol.revenue7d,
    revenue30d: protocol.revenue30d,
    buybackRate24h,
    buybackRate7d,
    buybackRate30d,
    annualizedBuybackRate,
    category: protocol.category,
    chains: protocol.chains,
    logo: protocol.logo,
    url: protocol.url,
    signal: classifyBuybackStrength(annualizedBuybackRate),
    timestamp: new Date(),
    revenueToMcap,
    annualizedRevenue,
    impliedPE,
    revenueGrowth7d,
  };
};

const createCategoryStats = (
  signals: readonly BuybackSignal[]
): Record<string, CategoryBuybackStats> => {
  const categoryMap = new Map<string, BuybackSignal[]>();

  for (const signal of signals) {
    const existing = categoryMap.get(signal.category) || [];
    categoryMap.set(signal.category, [...existing, signal]);
  }

  const result: Record<string, CategoryBuybackStats> = {};

  for (const [category, categorySignals] of categoryMap) {
    const totalRevenue24h = categorySignals.reduce((sum, s) => sum + s.revenue24h, 0);
    const avgBuybackRate =
      categorySignals.reduce((sum, s) => sum + s.annualizedBuybackRate, 0) / categorySignals.length;

    result[category] = {
      category,
      protocolCount: categorySignals.length,
      totalRevenue24h,
      averageBuybackRate: avgBuybackRate,
    };
  }

  return result;
};

// ============================================================================
// Cache Keys & TTLs
// ============================================================================

const CACHE_KEYS = {
  protocols: "buyback-protocols-raw",
  cryptos: "buyback-cryptos-raw",
  signals: (limit: number) => `buyback-signals-${limit}`,
  overview: "buyback-overview",
  protocol: (p: string) => `buyback-protocol-${p}`,
  detail: (p: string) => `buyback-detail-${p}`,
} as const;

// Longer TTLs since this data doesn't change frequently
const CACHE_TTL = {
  rawData: 600_000, // 10 minutes for raw API data
  computed: 300_000, // 5 minutes for computed results
} as const;

// ============================================================================
// Buyback Service Implementation
// ============================================================================

export const BuybackServiceLive = Layer.effect(
  BuybackServiceTag,
  Effect.gen(function* () {
    const defiLlama = yield* DefiLlamaService;
    const coinGecko = yield* CoinGeckoService;
    const cache = yield* CacheService;
    const logger = yield* Logger;

    // Shared data fetchers with deduplication
    const fetchProtocols = (): Effect.Effect<ProtocolBuyback[], DataSourceError> =>
      cache.getOrFetch(
        CACHE_KEYS.protocols,
        defiLlama.getProtocolsWithRevenue(),
        CACHE_TTL.rawData
      );

    const fetchCryptos = (): Effect.Effect<CryptoPrice[], DataSourceError> =>
      cache.getOrFetch(CACHE_KEYS.cryptos, coinGecko.getTopCryptos(250), CACHE_TTL.rawData);

    // Build price map from cached cryptos
    const getPriceMap = (): Effect.Effect<
      Map<string, { marketCap: number; price: number }>,
      DataSourceError
    > =>
      fetchCryptos().pipe(
        Effect.map(
          (cryptos) =>
            new Map(
              cryptos
                .filter((c) => c.id && c.marketCap > 0)
                .map((c) => [c.id!, { marketCap: c.marketCap, price: c.price }])
            )
        )
      );

    // Core signal computation (reused by signals and overview)
    const computeSignals = (
      protocols: ProtocolBuyback[],
      priceMap: Map<string, { marketCap: number; price: number }>,
      limit: number
    ): BuybackSignal[] => {
      const signals: BuybackSignal[] = [];

      for (const protocol of protocols) {
        if (!protocol.geckoId) continue;

        const cryptoData = priceMap.get(protocol.geckoId);
        if (!cryptoData) continue;

        const signal = createBuybackSignal(protocol, cryptoData.marketCap, cryptoData.price);

        if (signal.annualizedBuybackRate > 0) {
          signals.push(signal);
        }
      }

      return signals
        .sort((a, b) => b.annualizedBuybackRate - a.annualizedBuybackRate)
        .slice(0, limit);
    };

    const getBuybackSignals = (
      limit: number = 50
    ): Effect.Effect<readonly BuybackSignal[], DataSourceError> =>
      cache.getOrFetch(
        CACHE_KEYS.signals(limit),
        Effect.gen(function* () {
          yield* logger.info(`Computing buyback signals (limit: ${limit})`);

          // Fetch both data sources concurrently with deduplication
          const [protocols, priceMap] = yield* Effect.all([fetchProtocols(), getPriceMap()], {
            concurrency: "unbounded",
          });

          const signals = computeSignals(protocols, priceMap, limit);

          yield* logger.info(`Found ${signals.length} protocols with buyback signals`);

          return signals;
        }),
        CACHE_TTL.computed
      );

    const getBuybackOverview = (): Effect.Effect<BuybackOverview, DataSourceError> =>
      cache.getOrFetch(
        CACHE_KEYS.overview,
        Effect.gen(function* () {
          yield* logger.info("Computing buyback overview");

          // Fetch raw data (will be deduplicated if signals are also being fetched)
          const [protocols, priceMap] = yield* Effect.all([fetchProtocols(), getPriceMap()], {
            concurrency: "unbounded",
          });

          // Compute signals for overview (use 100 for stats)
          const signals = computeSignals(protocols, priceMap, 100);

          const totalRevenue24h = signals.reduce((sum, s) => sum + s.revenue24h, 0);
          const totalRevenue7d = signals.reduce((sum, s) => sum + s.revenue7d, 0);
          const averageBuybackRate =
            signals.length > 0
              ? signals.reduce((sum, s) => sum + s.annualizedBuybackRate, 0) / signals.length
              : 0;

          const overview: BuybackOverview = {
            totalProtocols: signals.length,
            totalRevenue24h,
            totalRevenue7d,
            averageBuybackRate,
            topBuybackProtocols: signals.slice(0, 10),
            byCategory: createCategoryStats(signals),
            timestamp: new Date(),
          };

          return overview;
        }),
        CACHE_TTL.computed
      );

    const getProtocolBuyback = (
      protocol: string
    ): Effect.Effect<BuybackSignal | null, DataSourceError> =>
      cache.getOrFetch(
        CACHE_KEYS.protocol(protocol),
        Effect.gen(function* () {
          yield* logger.info(`Fetching buyback data for: ${protocol}`);

          // Fetch protocol data and price map concurrently
          const [protocolData, priceMap] = yield* Effect.all(
            [defiLlama.getProtocolFees(protocol), getPriceMap()],
            { concurrency: "unbounded" }
          );

          if (!protocolData.geckoId) {
            return null;
          }

          const cryptoData = priceMap.get(protocolData.geckoId);
          if (!cryptoData || cryptoData.marketCap <= 0) {
            return null;
          }

          return createBuybackSignal(protocolData, cryptoData.marketCap, cryptoData.price);
        }),
        CACHE_TTL.computed
      );

    const getProtocolBuybackDetail = (
      protocol: string
    ): Effect.Effect<ProtocolBuybackDetail | null, DataSourceError> =>
      cache.getOrFetch(
        CACHE_KEYS.detail(protocol),
        Effect.gen(function* () {
          yield* logger.info(`Fetching buyback detail for: ${protocol}`);

          // Fetch both in parallel
          const [detail, priceMap] = yield* Effect.all(
            [defiLlama.getProtocolFeesDetail(protocol), getPriceMap()],
            { concurrency: "unbounded" }
          );

          if (!detail.protocol.geckoId) {
            return null;
          }

          const cryptoData = priceMap.get(detail.protocol.geckoId);

          if (!cryptoData || cryptoData.marketCap <= 0) {
            return null;
          }

          const signal = createBuybackSignal(
            detail.protocol,
            cryptoData.marketCap,
            cryptoData.price
          );

          const dailyRevenue: DailyRevenuePoint[] = detail.dailyFees.map((d) => ({
            date: d.date,
            revenue: d.fees,
          }));

          return {
            signal,
            dailyRevenue,
            revenueSource: detail.revenueSource,
            methodology: detail.methodology,
          };
        }),
        CACHE_TTL.computed
      );

    // Warmup cache on service initialization
    yield* Effect.forkDaemon(
      Effect.gen(function* () {
        yield* Effect.sleep("1 second");
        yield* logger.info("Warming up buyback cache...");
        yield* cache.warmup(
          CACHE_KEYS.protocols,
          defiLlama.getProtocolsWithRevenue(),
          CACHE_TTL.rawData
        );
        yield* cache.warmup(CACHE_KEYS.cryptos, coinGecko.getTopCryptos(250), CACHE_TTL.rawData);
      }).pipe(Effect.catchAll(() => Effect.void))
    );

    return {
      getBuybackSignals,
      getBuybackOverview,
      getProtocolBuyback,
      getProtocolBuybackDetail,
    };
  })
);
