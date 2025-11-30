/** CoinGecko Provider - Spot price data with caching and functional patterns */

import { Effect, Context, Layer, Data, Cache, Ref, Option, pipe, Array as Arr } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import { HttpClientTag } from "../../http/client";
import { CoinGeckoMarketsSchema, type CoinGeckoMarketItem } from "../../http/schemas";
import { DataSourceError, type AdapterInfo } from "../types";
import {
  API_URLS,
  CACHE_TTL,
  CACHE_CAPACITY,
  RATE_LIMITS,
  DEFAULT_LIMITS,
} from "../../config/app.config";

export class CoinGeckoError extends Data.TaggedError("CoinGeckoError")<{
  readonly message: string;
  readonly symbol?: string;
}> {}

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
  rateLimit: { requestsPerMinute: RATE_LIMITS.COINGECKO },
};

const toCryptoPrice = (coin: CoinGeckoMarketItem): CryptoPrice => ({
  id: coin.id,
  symbol: coin.symbol,
  name: coin.name,
  image: coin.image,
  price: coin.current_price,
  marketCap: coin.market_cap,
  volume24h: coin.total_volume,
  change24h: coin.price_change_percentage_24h ?? 0,
  timestamp: new Date(coin.last_updated),
  high24h: coin.high_24h ?? undefined,
  low24h: coin.low_24h ?? undefined,
  circulatingSupply: coin.circulating_supply ?? undefined,
  totalSupply: coin.total_supply ?? undefined,
  maxSupply: coin.max_supply ?? undefined,
  ath: coin.ath ?? undefined,
  athChangePercentage: coin.ath_change_percentage ?? undefined,
  atl: coin.atl ?? undefined,
  atlChangePercentage: coin.atl_change_percentage ?? undefined,
});

const mapError = (e: unknown, symbol?: string): DataSourceError =>
  new DataSourceError({
    source: "CoinGecko",
    message: e instanceof Error ? e.message : "Unknown error",
    symbol,
  });

// Build symbol map from cryptos using functional approach
const buildSymbolMap = (cryptos: readonly CryptoPrice[]): Map<string, CryptoPrice> => {
  const entries: [string, CryptoPrice][] = pipe(
    cryptos,
    Arr.flatMap((c): [string, CryptoPrice][] => {
      const base: [string, CryptoPrice][] = [[c.symbol.toLowerCase(), c]];
      return c.id ? [...base, [c.id.toLowerCase(), c]] : base;
    })
  );
  return new Map(entries);
};

// Lookup price from map using Option
const lookupFromMap = (map: Map<string, CryptoPrice>, key: string): Option.Option<CryptoPrice> =>
  Option.fromNullable(map.get(key));

// Create price from API response
const createPriceFromApi = (
  normalized: string,
  data: { usd: number; usd_market_cap?: number; usd_24h_vol?: number; usd_24h_change?: number }
): CryptoPrice => ({
  id: normalized,
  symbol: normalized,
  price: data.usd,
  marketCap: data.usd_market_cap ?? 0,
  volume24h: data.usd_24h_vol ?? 0,
  change24h: data.usd_24h_change ?? 0,
  timestamp: new Date(),
});

export class CoinGeckoService extends Context.Tag("CoinGeckoService")<
  CoinGeckoService,
  {
    readonly info: AdapterInfo;
    readonly getPrice: (symbol: string) => Effect.Effect<CryptoPrice, DataSourceError>;
    readonly getTopCryptos: (limit?: number) => Effect.Effect<CryptoPrice[], DataSourceError>;
    readonly getCoinId: (symbol: string) => Effect.Effect<string | null, never>;
  }
>() {}

export const CoinGeckoServiceLive = Layer.effect(
  CoinGeckoService,
  Effect.gen(function* () {
    const http = yield* HttpClientTag;
    const symbolMapRef = yield* Ref.make<Map<string, CryptoPrice>>(new Map());

    const updateSymbolMap = (cryptos: CryptoPrice[]) =>
      Ref.set(symbolMapRef, buildSymbolMap(cryptos));

    const topCryptosCache = yield* Cache.make({
      capacity: CACHE_CAPACITY.SINGLE,
      timeToLive: CACHE_TTL.COINGECKO_TOP_CRYPTOS,
      lookup: (limit: number) =>
        Effect.gen(function* () {
          const url = `${API_URLS.COINGECKO}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false&price_change_percentage=24h`;
          const data = yield* http.get(url, CoinGeckoMarketsSchema).pipe(Effect.mapError(mapError));
          const cryptos = Arr.map(data, toCryptoPrice);
          yield* updateSymbolMap(cryptos);
          return cryptos;
        }),
    });

    const priceCache = yield* Cache.make({
      capacity: CACHE_CAPACITY.LARGE,
      timeToLive: CACHE_TTL.COINGECKO_PRICE,
      lookup: (symbol: string) =>
        Effect.gen(function* () {
          const normalized = symbol.toLowerCase();

          // Load top cryptos and check map
          yield* topCryptosCache.get(DEFAULT_LIMITS.TOP_CRYPTOS).pipe(Effect.option);
          const symbolMap = yield* Ref.get(symbolMapRef);

          // Try from cached map
          const fromMap = lookupFromMap(symbolMap, normalized);
          if (Option.isSome(fromMap)) return fromMap.value;

          // Try extended list
          yield* topCryptosCache.get(DEFAULT_LIMITS.TOP_CRYPTOS_EXTENDED).pipe(Effect.option);
          const updated = yield* Ref.get(symbolMapRef);
          const fromExtended = lookupFromMap(updated, normalized);
          if (Option.isSome(fromExtended)) return fromExtended.value;

          // Direct API fallback
          const url = `${API_URLS.COINGECKO}/simple/price?ids=${normalized}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`;
          const data = yield* http.getJson(url).pipe(Effect.mapError((e) => mapError(e, symbol)));
          const parsed = data as Record<
            string,
            { usd: number; usd_market_cap?: number; usd_24h_vol?: number; usd_24h_change?: number }
          >;

          return yield* pipe(
            Option.fromNullable(parsed[normalized]),
            Option.match({
              onNone: () =>
                Effect.fail(
                  new DataSourceError({
                    source: "CoinGecko",
                    message: `Symbol ${symbol} not found`,
                    symbol,
                  })
                ),
              onSome: (priceData) =>
                Effect.gen(function* () {
                  const price = createPriceFromApi(normalized, priceData);
                  yield* Ref.update(symbolMapRef, (m) => new Map(m).set(normalized, price));
                  return price;
                }),
            })
          );
        }),
    });

    // Pre-warm
    yield* Effect.fork(
      topCryptosCache.get(DEFAULT_LIMITS.TOP_CRYPTOS).pipe(Effect.catchAll(() => Effect.void))
    );

    return {
      info: COINGECKO_INFO,
      getPrice: (symbol) => priceCache.get(symbol),
      getTopCryptos: (limit = DEFAULT_LIMITS.TOP_CRYPTOS) => topCryptosCache.get(limit),
      getCoinId: (symbol: string) =>
        Effect.gen(function* () {
          const normalized = symbol.toLowerCase();
          // Ensure symbol map is populated
          yield* topCryptosCache.get(DEFAULT_LIMITS.TOP_CRYPTOS).pipe(Effect.option);
          const symbolMap = yield* Ref.get(symbolMapRef);
          const found = lookupFromMap(symbolMap, normalized);
          return Option.isSome(found) ? (found.value.id ?? null) : null;
        }),
    };
  })
);
