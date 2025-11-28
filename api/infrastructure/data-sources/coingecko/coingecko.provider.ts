/**
 * CoinGecko Provider
 * Spot price data with schema validation and Effect's Cache for proper concurrent handling
 *
 * OPTIMIZATION:
 * - getPrice looks up from cached topCryptos first to avoid extra API calls
 * - Dynamically builds symbol-to-ID mapping from fetched data
 */

import { Effect, Context, Layer, Data, Cache, Option, Ref } from "effect";
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

// CoinGecko-specific error
export class CoinGeckoError extends Data.TaggedError("CoinGeckoError")<{
  readonly message: string;
  readonly symbol?: string;
}> {}

// Adapter metadata
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

// Transform CoinGecko market item to CryptoPrice
const toCryptoPrice = (coin: CoinGeckoMarketItem): CryptoPrice => ({
  id: coin.id,
  symbol: coin.symbol,
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

// Map errors to DataSourceError
const mapError = (e: unknown, symbol?: string): DataSourceError =>
  new DataSourceError({
    source: "CoinGecko",
    message: e instanceof Error ? e.message : "Unknown error",
    symbol,
  });

// Service interface
export class CoinGeckoService extends Context.Tag("CoinGeckoService")<
  CoinGeckoService,
  {
    readonly info: AdapterInfo;
    readonly getPrice: (symbol: string) => Effect.Effect<CryptoPrice, DataSourceError>;
    readonly getTopCryptos: (limit?: number) => Effect.Effect<CryptoPrice[], DataSourceError>;
  }
>() {}

// Service implementation with Effect's Cache for proper concurrent handling
export const CoinGeckoServiceLive = Layer.effect(
  CoinGeckoService,
  Effect.gen(function* () {
    const http = yield* HttpClientTag;

    // Dynamic symbol-to-ID and ID-to-price mapping built from fetched data
    const symbolMapRef = yield* Ref.make<Map<string, CryptoPrice>>(new Map());

    // Helper: update symbol map from crypto list
    const updateSymbolMap = (cryptos: CryptoPrice[]) =>
      Effect.gen(function* () {
        const map = new Map<string, CryptoPrice>();
        for (const crypto of cryptos) {
          // Index by symbol (lowercase)
          map.set(crypto.symbol.toLowerCase(), crypto);
          // Also index by ID if available
          if (crypto.id) {
            map.set(crypto.id.toLowerCase(), crypto);
          }
        }
        yield* Ref.set(symbolMapRef, map);
        return map;
      });

    // Cache for top cryptos - this is the primary data source
    const topCryptosCache = yield* Cache.make({
      capacity: CACHE_CAPACITY.SINGLE,
      timeToLive: CACHE_TTL.COINGECKO_TOP_CRYPTOS,
      lookup: (limit: number) =>
        Effect.gen(function* () {
          yield* Effect.logInfo(`[CoinGecko] Fetching top ${limit} cryptos`);
          const url = `${API_URLS.COINGECKO}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false&price_change_percentage=24h`;

          const data = yield* http
            .get(url, CoinGeckoMarketsSchema)
            .pipe(Effect.mapError((e) => mapError(e)));

          const cryptos = data.map(toCryptoPrice);

          // Update the symbol map with fresh data
          yield* updateSymbolMap(cryptos);

          yield* Effect.logDebug(`[CoinGecko] Got ${cryptos.length} cryptos, updated symbol map`);
          return cryptos;
        }),
    });

    // Cache for individual prices - looks up from symbol map first
    const priceCache = yield* Cache.make({
      capacity: CACHE_CAPACITY.LARGE,
      timeToLive: CACHE_TTL.COINGECKO_PRICE,
      lookup: (symbol: string) =>
        Effect.gen(function* () {
          const normalizedSymbol = symbol.toLowerCase();

          // First, ensure we have data by triggering topCryptos fetch if needed
          const topCryptos = yield* topCryptosCache
            .get(DEFAULT_LIMITS.TOP_CRYPTOS)
            .pipe(Effect.option);

          // Look up in the symbol map (built from topCryptos)
          const symbolMap = yield* Ref.get(symbolMapRef);
          const found = symbolMap.get(normalizedSymbol);

          if (found) {
            yield* Effect.logDebug(`[CoinGecko] Found ${symbol} in symbol map`);
            return found;
          }

          // If not found in top 100, try fetching more data
          if (
            Option.isNone(topCryptos) ||
            topCryptos.value.length < DEFAULT_LIMITS.TOP_CRYPTOS_EXTENDED
          ) {
            yield* Effect.logDebug(
              `[CoinGecko] ${symbol} not in top ${DEFAULT_LIMITS.TOP_CRYPTOS}, fetching top ${DEFAULT_LIMITS.TOP_CRYPTOS_EXTENDED}`
            );
            const moreCryptos = yield* topCryptosCache
              .get(DEFAULT_LIMITS.TOP_CRYPTOS_EXTENDED)
              .pipe(Effect.option);

            if (Option.isSome(moreCryptos)) {
              const updatedMap = yield* Ref.get(symbolMapRef);
              const foundInMore = updatedMap.get(normalizedSymbol);
              if (foundInMore) {
                yield* Effect.logDebug(
                  `[CoinGecko] Found ${symbol} in top ${DEFAULT_LIMITS.TOP_CRYPTOS_EXTENDED}`
                );
                return foundInMore;
              }
            }
          }

          // Last resort: direct API call using symbol as potential ID
          yield* Effect.logDebug(`[CoinGecko] ${symbol} not in cache, trying direct API`);

          // Try the symbol as-is first (might be an ID like "bitcoin")
          const url = `${API_URLS.COINGECKO}/simple/price?ids=${normalizedSymbol}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`;

          const data = yield* http.getJson(url).pipe(Effect.mapError((e) => mapError(e, symbol)));

          const parsed = data as Record<
            string,
            {
              usd: number;
              usd_market_cap?: number;
              usd_24h_vol?: number;
              usd_24h_change?: number;
            }
          >;

          if (!parsed[normalizedSymbol]) {
            return yield* Effect.fail(
              new DataSourceError({
                source: "CoinGecko",
                message: `Symbol ${symbol} not found. Try using the full name (e.g., 'bitcoin' instead of 'btc')`,
                symbol,
              })
            );
          }

          const price: CryptoPrice = {
            id: normalizedSymbol,
            symbol: normalizedSymbol,
            price: parsed[normalizedSymbol].usd,
            marketCap: parsed[normalizedSymbol].usd_market_cap ?? 0,
            volume24h: parsed[normalizedSymbol].usd_24h_vol ?? 0,
            change24h: parsed[normalizedSymbol].usd_24h_change ?? 0,
            timestamp: new Date(),
          };

          // Add to symbol map for future lookups
          yield* Ref.update(symbolMapRef, (map) => {
            const newMap = new Map(map);
            newMap.set(normalizedSymbol, price);
            return newMap;
          });

          return price;
        }),
    });

    // Pre-warm the cache on service initialization
    yield* Effect.fork(
      topCryptosCache.get(DEFAULT_LIMITS.TOP_CRYPTOS).pipe(
        Effect.tap(() =>
          Effect.logDebug(`[CoinGecko] Pre-warmed top ${DEFAULT_LIMITS.TOP_CRYPTOS} cache`)
        ),
        Effect.catchAll(() => Effect.void)
      )
    );

    return {
      info: COINGECKO_INFO,
      getPrice: (symbol: string) => priceCache.get(symbol),
      getTopCryptos: (limit = DEFAULT_LIMITS.TOP_CRYPTOS) => topCryptosCache.get(limit),
    };
  })
);
