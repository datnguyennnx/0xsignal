/** Data Sources Aggregator - Combines multiple providers */

import { Effect, Context, Layer } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import { CoinGeckoService } from "./coingecko";
import { DataSourceError, type AdapterInfo } from "./types";

export interface AggregatedDataService {
  readonly getPrice: (symbol: string) => Effect.Effect<CryptoPrice, DataSourceError>;
  readonly getTopCryptos: (limit?: number) => Effect.Effect<CryptoPrice[], DataSourceError>;
  readonly getSources: () => readonly AdapterInfo[];
}

export class AggregatedDataServiceTag extends Context.Tag("AggregatedDataService")<
  AggregatedDataServiceTag,
  AggregatedDataService
>() {}

export const AggregatedDataServiceLive = Layer.effect(
  AggregatedDataServiceTag,
  Effect.gen(function* () {
    const coinGecko = yield* CoinGeckoService;

    return {
      // Spot (CoinGecko)
      getPrice: (symbol) => coinGecko.getPrice(symbol),
      getTopCryptos: (limit = 100) => coinGecko.getTopCryptos(limit),

      // Metadata
      getSources: () => [coinGecko.info] as const,
    };
  })
);
