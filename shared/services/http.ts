import { Effect, Context, Layer } from "effect";
import type { CryptoPrice, MarketMetrics, CoinGeckoCoinResponse, CoinGeckoGlobalResponse, CoinGeckoTrendingResponse } from "../types/crypto";

// HTTP Service for API calls
export class HttpService extends Context.Tag("HttpService")<
  HttpService,
  {
    readonly get: (url: string, headers?: Record<string, string>) => Effect.Effect<unknown, HttpError>;
    readonly post: (url: string, body: unknown, headers?: Record<string, string>) => Effect.Effect<unknown, HttpError>;
  }
>() {}

export class HttpError {
  readonly _tag = "HttpError";
  constructor(
    readonly message: string,
    readonly status?: number,
    readonly url?: string
  ) {}
}

// API Service interfaces
export class CoinGeckoService extends Context.Tag("CoinGeckoService")<
  CoinGeckoService,
  {
    readonly getPrice: (symbol: string) => Effect.Effect<CryptoPrice, CoinGeckoError>;
    readonly getTopCryptos: (limit?: number) => Effect.Effect<CryptoPrice[], CoinGeckoError>;
    readonly getMarketMetrics: (symbol: string) => Effect.Effect<MarketMetrics, CoinGeckoError>;
    readonly getGlobalMetrics: () => Effect.Effect<CoinGeckoGlobalResponse, CoinGeckoError>;
    readonly getTrending: () => Effect.Effect<CoinGeckoTrendingResponse, CoinGeckoError>;
    readonly getDetailedCoin: (symbol: string) => Effect.Effect<CoinGeckoCoinResponse, CoinGeckoError>;
  }
>() {}

export class CoinGeckoError {
  readonly _tag = "CoinGeckoError";
  constructor(readonly message: string, readonly symbol?: string) {}
}

// HttpService implementation
export const HttpServiceLive = Layer.succeed(HttpService, {
  get: (url, headers = {}) =>
    Effect.tryPromise({
      try: async () => {
        const response = await fetch(url, { headers });
        if (!response.ok) {
          throw new HttpError(`HTTP ${response.status}: ${response.statusText}`, response.status, url);
        }
        return await response.json();
      },
      catch: (error) =>
        error instanceof HttpError
          ? error
          : new HttpError(error instanceof Error ? error.message : "Unknown HTTP error", undefined, url)
    }),

  post: (url, body, headers = {}) =>
    Effect.tryPromise({
      try: async () => {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          throw new HttpError(`HTTP ${response.status}: ${response.statusText}`, response.status, url);
        }
        return await response.json();
      },
      catch: (error) =>
        error instanceof HttpError
          ? error
          : new HttpError(error instanceof Error ? error.message : "Unknown HTTP error", undefined, url)
    }),
});

export const CoinGeckoServiceLive = Layer.effect(
  CoinGeckoService,
  Effect.gen(function* () {
    const http = yield* HttpService;

    const getPrice = (symbol: string) =>
      Effect.gen(function* () {
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${symbol}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`;
        const response = yield* http.get(url);

        const data = response as Record<string, {
          usd: number;
          usd_market_cap?: number;
          usd_24h_vol?: number;
          usd_24h_change?: number;
        }>;

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
      }).pipe(
        Effect.mapError((error) => new CoinGeckoError(error.message, undefined))
      );

    const getTopCryptos = (limit = 100) =>
      Effect.gen(function* () {
        const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false&price_change_percentage=24h,7d,14d,30d`;
        const response = yield* http.get(url);

        const data = response as CoinGeckoCoinResponse[];
        return data.map((coin): CryptoPrice => ({
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
        }));
      }).pipe(
        Effect.mapError((error) => new CoinGeckoError(error.message, undefined))
      );

    const getDetailedCoin = (symbol: string) =>
      Effect.gen(function* () {
        const url = `https://api.coingecko.com/api/v3/coins/${symbol}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=true`;
        const response = yield* http.get(url);

        const data = response as {
          id: string;
          symbol: string;
          name: string;
          market_data: {
            current_price: { usd: number };
            market_cap: { usd: number };
            total_volume: { usd: number };
            price_change_percentage_24h: number;
            high_24h: { usd: number };
            low_24h: { usd: number };
            circulating_supply: number;
            total_supply: number | null;
            max_supply: number | null;
            ath: { usd: number };
            ath_change_percentage: { usd: number };
            atl: { usd: number };
            atl_change_percentage: { usd: number };
            sparkline_7d: { price: number[] };
            price_change_percentage_7d: number;
            price_change_percentage_14d: number;
            price_change_percentage_30d: number;
          };
          last_updated: string;
        };

        return {
          id: data.id,
          symbol: data.symbol,
          name: data.name,
          current_price: data.market_data.current_price.usd,
          market_cap: data.market_data.market_cap.usd,
          market_cap_rank: 0, // Would need separate call for rank
          fully_diluted_valuation: null,
          total_volume: data.market_data.total_volume.usd,
          high_24h: data.market_data.high_24h.usd,
          low_24h: data.market_data.low_24h.usd,
          price_change_24h: 0,
          price_change_percentage_24h: data.market_data.price_change_percentage_24h,
          market_cap_change_24h: 0,
          market_cap_change_percentage_24h: 0,
          circulating_supply: data.market_data.circulating_supply,
          total_supply: data.market_data.total_supply,
          max_supply: data.market_data.max_supply,
          ath: data.market_data.ath.usd,
          ath_change_percentage: data.market_data.ath_change_percentage.usd,
          ath_date: "",
          atl: data.market_data.atl.usd,
          atl_change_percentage: data.market_data.atl_change_percentage.usd,
          atl_date: "",
          last_updated: data.last_updated,
          sparkline_in_7d: { price: data.market_data.sparkline_7d.price },
          price_change_percentage_7d_in_currency: data.market_data.price_change_percentage_7d,
          price_change_percentage_14d_in_currency: data.market_data.price_change_percentage_14d,
          price_change_percentage_30d_in_currency: data.market_data.price_change_percentage_30d,
        } as CoinGeckoCoinResponse;
      }).pipe(
        Effect.mapError((error) => new CoinGeckoError(error.message, symbol))
      );

    const getMarketMetrics = (symbol: string) =>
      Effect.gen(function* () {
        // Get detailed coin data for metrics calculation
        const coinData = yield* getDetailedCoin(symbol);

        // Calculate volatility from 7-day sparkline data
        const prices = coinData.sparkline_in_7d?.price || [];
        const volatility = prices.length > 1
          ? calculateVolatility(prices)
          : 0.5; // Default volatility

        // Calculate liquidity score based on volume/market cap ratio
        const volumeToMarketCapRatio = coinData.total_volume / coinData.market_cap;
        const liquidityScore = Math.min(volumeToMarketCapRatio * 100, 1); // Normalize to 0-1

        // Calculate price to ATH/ATL ratios
        const priceToATH = coinData.current_price / coinData.ath;
        const priceToATL = coinData.current_price / coinData.atl;

        return {
          symbol,
          volatility,
          liquidityScore,
          volumeToMarketCapRatio,
          priceToATH,
          priceToATL,
          timestamp: new Date(coinData.last_updated),
        } as MarketMetrics;
      }).pipe(
        Effect.mapError((error) => new CoinGeckoError(error.message, symbol))
      );

    const getGlobalMetrics = () =>
      Effect.gen(function* () {
        const url = `https://api.coingecko.com/api/v3/global`;
        const response = yield* http.get(url);
        return response as CoinGeckoGlobalResponse;
      }).pipe(
        Effect.mapError((error) => new CoinGeckoError(error.message, undefined))
      );

    const getTrending = () =>
      Effect.gen(function* () {
        const url = `https://api.coingecko.com/api/v3/search/trending`;
        const response = yield* http.get(url);
        return response as CoinGeckoTrendingResponse;
      }).pipe(
        Effect.mapError((error) => new CoinGeckoError(error.message, undefined))
      );

    return {
      getPrice,
      getTopCryptos,
      getDetailedCoin,
      getMarketMetrics,
      getGlobalMetrics,
      getTrending
    };
  })
);

// Helper function to calculate volatility from price data
const calculateVolatility = (prices: number[]): number => {
  if (prices.length < 2) return 0;

  // Calculate daily returns
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }

  // Calculate standard deviation of returns
  const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
  const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;

  return Math.sqrt(variance);
};

