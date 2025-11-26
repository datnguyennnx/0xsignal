/**
 * CoinGecko Provider
 * Spot price data from CoinGecko API
 */

import { Effect, Context, Layer, Data } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import { HttpService } from "../http.service";
import { Logger } from "../../logging/console.logger";
import { DataSourceError, type AdapterInfo } from "../types";

// ============================================================================
// CoinGecko Error (internal)
// ============================================================================

export class CoinGeckoError extends Data.TaggedError("CoinGeckoError")<{
  readonly message: string;
  readonly symbol?: string;
}> {}

// ============================================================================
// Adapter Info
// ============================================================================

export const COINGECKO_INFO: AdapterInfo = {
  name: "CoinGecko",
  version: "1.0.0",
  capabilities: {
    spotPrices: true,
    futuresPrices: false,
    liquidations: false,
    openInterest: false,
    fundingRates: false,
    heatmap: false,
    historicalData: true,
    realtime: false,
  },
  rateLimit: {
    requestsPerMinute: 30,
  },
};

// ============================================================================
// CoinGecko Service Tag
// ============================================================================

export class CoinGeckoService extends Context.Tag("CoinGeckoService")<
  CoinGeckoService,
  {
    readonly info: AdapterInfo;
    readonly getPrice: (symbol: string) => Effect.Effect<CryptoPrice, DataSourceError>;
    readonly getTopCryptos: (limit?: number) => Effect.Effect<CryptoPrice[], DataSourceError>;
  }
>() {}

// ============================================================================
// CoinGecko Service Implementation
// ============================================================================

export const CoinGeckoServiceLive = Layer.effect(
  CoinGeckoService,
  Effect.gen(function* () {
    const http = yield* HttpService;
    const logger = yield* Logger;

    const mapError = (error: unknown, symbol?: string): DataSourceError =>
      new DataSourceError({
        source: "CoinGecko",
        message: error instanceof Error ? error.message : "Unknown error",
        symbol,
      });

    const getPrice = (symbol: string): Effect.Effect<CryptoPrice, DataSourceError> =>
      Effect.gen(function* () {
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${symbol}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`;

        const response = yield* http.get(url).pipe(Effect.mapError((e) => mapError(e, symbol)));

        const data = response as Record<
          string,
          {
            usd: number;
            usd_market_cap?: number;
            usd_24h_vol?: number;
            usd_24h_change?: number;
          }
        >;

        if (!data[symbol]) {
          return yield* Effect.fail(
            new DataSourceError({
              source: "CoinGecko",
              message: `Symbol ${symbol} not found`,
              symbol,
            })
          );
        }

        return {
          symbol,
          price: data[symbol].usd,
          marketCap: data[symbol].usd_market_cap || 0,
          volume24h: data[symbol].usd_24h_vol || 0,
          change24h: data[symbol].usd_24h_change || 0,
          timestamp: new Date(),
        } as CryptoPrice;
      });

    const getTopCryptos = (limit = 100): Effect.Effect<CryptoPrice[], DataSourceError> =>
      Effect.gen(function* () {
        const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false&price_change_percentage=24h,7d,14d,30d`;

        const response = yield* http.get(url).pipe(Effect.mapError((e) => mapError(e)));

        const data = response as Array<{
          id: string;
          symbol: string;
          current_price: number;
          market_cap: number;
          total_volume: number;
          price_change_percentage_24h: number;
          last_updated: string;
          high_24h: number;
          low_24h: number;
          circulating_supply: number;
          total_supply: number | null;
          max_supply: number | null;
          ath: number;
          ath_change_percentage: number;
          atl: number;
          atl_change_percentage: number;
        }>;

        return data.map(
          (coin): CryptoPrice => ({
            id: coin.id,
            symbol: coin.symbol,
            price: coin.current_price,
            marketCap: coin.market_cap,
            volume24h: coin.total_volume,
            change24h: coin.price_change_percentage_24h || 0,
            timestamp: new Date(coin.last_updated),
            high24h: coin.high_24h,
            low24h: coin.low_24h,
            circulatingSupply: coin.circulating_supply,
            totalSupply: coin.total_supply ?? undefined,
            maxSupply: coin.max_supply ?? undefined,
            ath: coin.ath,
            athChangePercentage: coin.ath_change_percentage,
            atl: coin.atl,
            atlChangePercentage: coin.atl_change_percentage,
          })
        );
      });

    return {
      info: COINGECKO_INFO,
      getPrice,
      getTopCryptos,
    };
  })
);
