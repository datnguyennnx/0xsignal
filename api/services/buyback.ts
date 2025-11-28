/**
 * Buyback Service
 * Orchestrates data fetching and delegates business logic to domain layer
 */

import { Effect, Context, Layer, Cache } from "effect";
import type {
  BuybackSignal,
  BuybackOverview,
  ProtocolBuybackDetail,
  DailyRevenuePoint,
} from "@0xsignal/shared";
import { DefiLlamaService } from "../infrastructure/data-sources/defillama";
import { CoinGeckoService } from "../infrastructure/data-sources/coingecko";
import { DataSourceError } from "../infrastructure/data-sources/types";
import {
  buildPriceMap,
  computeBuybackSignals,
  createBuybackOverview,
  createBuybackSignal,
} from "../domain/buyback";
import { CACHE_TTL, CACHE_CAPACITY, DEFAULT_LIMITS } from "../infrastructure/config/app.config";

// Service interface
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

// Service implementation - orchestrates fetching, delegates logic to domain
export const BuybackServiceLive = Layer.effect(
  BuybackServiceTag,
  Effect.gen(function* () {
    const defiLlama = yield* DefiLlamaService;
    const coinGecko = yield* CoinGeckoService;

    // Cache for buyback signals
    const signalsCache = yield* Cache.make({
      capacity: CACHE_CAPACITY.SINGLE,
      timeToLive: CACHE_TTL.BUYBACK_SIGNALS,
      lookup: (limit: number) =>
        Effect.gen(function* () {
          yield* Effect.logInfo(`[Buyback] Computing signals (limit: ${limit})`);

          // Fetch data concurrently
          const [protocols, cryptos] = yield* Effect.all(
            [
              defiLlama.getProtocolsWithRevenue(),
              coinGecko.getTopCryptos(DEFAULT_LIMITS.TOP_CRYPTOS_EXTENDED),
            ],
            { concurrency: 2 }
          );

          // Delegate to domain logic
          const priceMap = buildPriceMap(cryptos);
          const signals = computeBuybackSignals(protocols, priceMap, limit);

          yield* Effect.logDebug(`[Buyback] Found ${signals.length} protocols with signals`);
          return signals;
        }),
    });

    // Cache for buyback overview
    const overviewCache = yield* Cache.make({
      capacity: 1,
      timeToLive: CACHE_TTL.BUYBACK_OVERVIEW,
      lookup: (_: "overview") =>
        Effect.gen(function* () {
          yield* Effect.logInfo("[Buyback] Computing overview");
          const signals = yield* signalsCache.get(DEFAULT_LIMITS.TOP_CRYPTOS);
          return createBuybackOverview(signals);
        }),
    });

    // Cache for single protocol buyback
    const protocolCache = yield* Cache.make({
      capacity: CACHE_CAPACITY.DEFAULT,
      timeToLive: CACHE_TTL.BUYBACK_PROTOCOL,
      lookup: (protocol: string) =>
        Effect.gen(function* () {
          yield* Effect.logDebug(`[Buyback] Fetching protocol: ${protocol}`);

          const [protocolData, cryptos] = yield* Effect.all(
            [
              defiLlama.getProtocolFees(protocol),
              coinGecko.getTopCryptos(DEFAULT_LIMITS.TOP_CRYPTOS_EXTENDED),
            ],
            { concurrency: 2 }
          );

          if (!protocolData.geckoId) return null;

          const priceMap = buildPriceMap(cryptos);
          const data = priceMap.get(protocolData.geckoId);
          if (!data || data.marketCap <= 0) return null;

          return createBuybackSignal(protocolData, data.marketCap, data.price);
        }),
    });

    // Cache for protocol detail
    const detailCache = yield* Cache.make({
      capacity: CACHE_CAPACITY.DEFAULT,
      timeToLive: CACHE_TTL.BUYBACK_PROTOCOL,
      lookup: (protocol: string) =>
        Effect.gen(function* () {
          yield* Effect.logDebug(`[Buyback] Fetching detail: ${protocol}`);

          const [detail, cryptos] = yield* Effect.all(
            [
              defiLlama.getProtocolFeesDetail(protocol),
              coinGecko.getTopCryptos(DEFAULT_LIMITS.TOP_CRYPTOS_EXTENDED),
            ],
            { concurrency: 2 }
          );

          if (!detail.protocol.geckoId) return null;

          const priceMap = buildPriceMap(cryptos);
          const data = priceMap.get(detail.protocol.geckoId);
          if (!data || data.marketCap <= 0) return null;

          const signal = createBuybackSignal(detail.protocol, data.marketCap, data.price);
          const dailyRevenue: DailyRevenuePoint[] = detail.dailyFees.map((d) => ({
            date: d.date,
            revenue: d.fees,
          }));

          return {
            signal,
            dailyRevenue,
            revenueSource: detail.revenueSource,
            methodology: detail.methodology,
          } as ProtocolBuybackDetail;
        }),
    });

    return {
      getBuybackSignals: (limit = DEFAULT_LIMITS.BUYBACK_SIGNALS) => signalsCache.get(limit),
      getBuybackOverview: () => overviewCache.get("overview"),
      getProtocolBuyback: (protocol: string) => protocolCache.get(protocol),
      getProtocolBuybackDetail: (protocol: string) => detailCache.get(protocol),
    };
  })
);
