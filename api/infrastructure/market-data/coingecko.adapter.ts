import { Effect, Context, Layer, Data } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import { Logger } from "../logging/console.logger";

// HTTP Service for API calls
export class HttpService extends Context.Tag("HttpService")<
  HttpService,
  {
    readonly get: (
      url: string,
      headers?: Record<string, string>
    ) => Effect.Effect<unknown, HttpError>;
    readonly post: (
      url: string,
      body: unknown,
      headers?: Record<string, string>
    ) => Effect.Effect<unknown, HttpError>;
  }
>() {}

export class HttpError extends Data.TaggedError("HttpError")<{
  readonly message: string;
  readonly status?: number;
  readonly url?: string;
}> {
  constructor(message: string, status?: number, url?: string) {
    super({ message, status, url });
  }
}

// API Service interfaces
export class CoinGeckoService extends Context.Tag("CoinGeckoService")<
  CoinGeckoService,
  {
    readonly getPrice: (symbol: string) => Effect.Effect<CryptoPrice, CoinGeckoError>;
    readonly getTopCryptos: (limit?: number) => Effect.Effect<CryptoPrice[], CoinGeckoError>;
  }
>() {}

export class CoinGeckoError extends Data.TaggedError("CoinGeckoError")<{
  readonly message: string;
  readonly symbol?: string;
}> {
  constructor(message: string, symbol?: string) {
    super({ message, symbol });
  }
}

// HttpService implementation with logging
export const HttpServiceLive = Layer.effect(
  HttpService,
  Effect.gen(function* () {
    const logger = yield* Logger;

    return {
      get: (url, headers = {}) =>
        Effect.gen(function* () {
          const startTime = Date.now();
          const urlObj = new URL(url);
          const host = urlObj.hostname;
          const path = urlObj.pathname;

          const result = yield* Effect.tryPromise({
            try: async () => {
              const response = await fetch(url, { headers });
              const duration = Date.now() - startTime;

              if (!response.ok) {
                throw new HttpError(
                  `HTTP ${response.status}: ${response.statusText}`,
                  response.status,
                  url
                );
              }

              return { data: await response.json(), status: response.status, duration };
            },
            catch: (error) =>
              error instanceof HttpError
                ? error
                : new HttpError(
                    error instanceof Error ? error.message : "Unknown HTTP error",
                    undefined,
                    url
                  ),
          });

          // Log after the request completes
          yield* logger.info(
            `↗ External API GET ${host}${path} ${result.status} (${result.duration}ms)`
          );

          return result.data;
        }),

      post: (url, body, headers = {}) =>
        Effect.gen(function* () {
          const startTime = Date.now();
          const urlObj = new URL(url);
          const host = urlObj.hostname;
          const path = urlObj.pathname;

          const result = yield* Effect.tryPromise({
            try: async () => {
              const response = await fetch(url, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  ...headers,
                },
                body: JSON.stringify(body),
              });
              const duration = Date.now() - startTime;

              if (!response.ok) {
                throw new HttpError(
                  `HTTP ${response.status}: ${response.statusText}`,
                  response.status,
                  url
                );
              }

              return { data: await response.json(), status: response.status, duration };
            },
            catch: (error) =>
              error instanceof HttpError
                ? error
                : new HttpError(
                    error instanceof Error ? error.message : "Unknown HTTP error",
                    undefined,
                    url
                  ),
          });

          // Log after the request completes
          yield* logger.info(
            `↗ External API POST ${host}${path} ${result.status} (${result.duration}ms)`
          );

          return result.data;
        }),
    };
  })
);

export const CoinGeckoServiceLive = Layer.effect(
  CoinGeckoService,
  Effect.gen(function* () {
    const http = yield* HttpService;

    const getPrice = (symbol: string) =>
      Effect.gen(function* () {
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${symbol}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`;
        const response = yield* http.get(url);

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
          return yield* Effect.fail(new CoinGeckoError(`Symbol ${symbol} not found`, symbol));
        }

        return {
          symbol,
          price: data[symbol].usd,
          marketCap: data[symbol].usd_market_cap || 0,
          volume24h: data[symbol].usd_24h_vol || 0,
          change24h: data[symbol].usd_24h_change || 0,
          timestamp: new Date(),
        } as CryptoPrice;
      }).pipe(Effect.mapError((error) => new CoinGeckoError(error.message, undefined)));

    const getTopCryptos = (limit = 100) =>
      Effect.gen(function* () {
        const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false&price_change_percentage=24h,7d,14d,30d`;
        const response = yield* http.get(url);

        const data = response as Array<{
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
      }).pipe(Effect.mapError((error) => new CoinGeckoError(error.message, undefined)));

    return {
      getPrice,
      getTopCryptos,
    };
  })
);
