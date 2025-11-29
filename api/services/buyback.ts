/** Buyback Service - Protocol buyback analysis with tracing */

import { Effect, Context, Layer, Cache, Option, pipe, Array as Arr } from "effect";
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

// Create signal from protocol data using Option
const createSignalFromProtocol = (
  protocolData: { geckoId: string | null },
  priceMap: Map<string, { marketCap: number; price: number }>,
  createFn: (mcap: number, price: number) => BuybackSignal
): BuybackSignal | null =>
  pipe(
    Option.fromNullable(protocolData.geckoId),
    Option.flatMap((geckoId) => Option.fromNullable(priceMap.get(geckoId))),
    Option.filter((data) => data.marketCap > 0),
    Option.map((data) => createFn(data.marketCap, data.price)),
    Option.getOrNull
  );

// Transform daily fees to revenue points
const toDailyRevenue = (
  dailyFees: readonly { date: number; fees: number }[]
): DailyRevenuePoint[] => Arr.map(dailyFees, (d) => ({ date: d.date, revenue: d.fees }));

export const BuybackServiceLive = Layer.effect(
  BuybackServiceTag,
  Effect.gen(function* () {
    const defiLlama = yield* DefiLlamaService;
    const coinGecko = yield* CoinGeckoService;

    const signalsCache = yield* Cache.make({
      capacity: CACHE_CAPACITY.SINGLE,
      timeToLive: CACHE_TTL.BUYBACK_SIGNALS,
      lookup: (limit: number) =>
        Effect.gen(function* () {
          const { protocols, cryptos } = yield* Effect.all(
            {
              protocols: defiLlama.getProtocolsWithRevenue(),
              cryptos: coinGecko.getTopCryptos(DEFAULT_LIMITS.TOP_CRYPTOS_EXTENDED),
            },
            { concurrency: 2 }
          );
          return computeBuybackSignals(protocols, buildPriceMap(cryptos), limit);
        }),
    });

    const overviewCache = yield* Cache.make({
      capacity: 1,
      timeToLive: CACHE_TTL.BUYBACK_OVERVIEW,
      lookup: (_: "overview") =>
        signalsCache.get(DEFAULT_LIMITS.TOP_CRYPTOS).pipe(Effect.map(createBuybackOverview)),
    });

    const protocolCache = yield* Cache.make({
      capacity: CACHE_CAPACITY.DEFAULT,
      timeToLive: CACHE_TTL.BUYBACK_PROTOCOL,
      lookup: (protocol: string) =>
        Effect.gen(function* () {
          const { protocolData, cryptos } = yield* Effect.all(
            {
              protocolData: defiLlama.getProtocolFees(protocol),
              cryptos: coinGecko.getTopCryptos(DEFAULT_LIMITS.TOP_CRYPTOS_EXTENDED),
            },
            { concurrency: 2 }
          );
          return createSignalFromProtocol(protocolData, buildPriceMap(cryptos), (mcap, price) =>
            createBuybackSignal(protocolData, mcap, price)
          );
        }),
    });

    const detailCache = yield* Cache.make({
      capacity: CACHE_CAPACITY.DEFAULT,
      timeToLive: CACHE_TTL.BUYBACK_PROTOCOL,
      lookup: (protocol: string) =>
        Effect.gen(function* () {
          const { detail, cryptos } = yield* Effect.all(
            {
              detail: defiLlama.getProtocolFeesDetail(protocol),
              cryptos: coinGecko.getTopCryptos(DEFAULT_LIMITS.TOP_CRYPTOS_EXTENDED),
            },
            { concurrency: 2 }
          );
          return pipe(
            createSignalFromProtocol(detail.protocol, buildPriceMap(cryptos), (mcap, price) =>
              createBuybackSignal(detail.protocol, mcap, price)
            ),
            Option.fromNullable,
            Option.map(
              (signal) =>
                ({
                  signal,
                  dailyRevenue: toDailyRevenue(detail.dailyFees),
                  revenueSource: detail.revenueSource,
                  methodology: detail.methodology,
                }) as ProtocolBuybackDetail
            ),
            Option.getOrNull
          );
        }),
    });

    return {
      getBuybackSignals: (limit = DEFAULT_LIMITS.BUYBACK_SIGNALS) =>
        pipe(
          signalsCache.get(limit),
          Effect.withSpan("buyback.signals", { attributes: { limit } })
        ),
      getBuybackOverview: () =>
        pipe(overviewCache.get("overview"), Effect.withSpan("buyback.overview")),
      getProtocolBuyback: (protocol) =>
        pipe(
          protocolCache.get(protocol),
          Effect.withSpan("buyback.protocol", { attributes: { protocol } })
        ),
      getProtocolBuybackDetail: (protocol) =>
        pipe(
          detailCache.get(protocol),
          Effect.withSpan("buyback.protocolDetail", { attributes: { protocol } })
        ),
    };
  })
);
