/** CoinGecko Request Batching - Effect Request/Resolver pattern with rate limiting */

import { Effect, Request, RequestResolver, Array as Arr } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import { HttpClientTag } from "../../http/client";
import { RateLimiterTag } from "../../http/rate-limiter";
import { DataSourceError } from "../types";
import { API_URLS } from "../../config/app.config";

const mapError = (e: unknown, context?: string): DataSourceError =>
  new DataSourceError({
    source: "CoinGecko",
    message: e instanceof Error ? e.message : "Unknown error",
    symbol: context,
  });

interface GetCryptoPriceRequest extends Request.Request<CryptoPrice, DataSourceError> {
  readonly _tag: "GetCryptoPriceRequest";
  readonly coinId: string;
}

const GetCryptoPriceRequest = Request.tagged<GetCryptoPriceRequest>("GetCryptoPriceRequest");

interface SimplePriceResponse {
  [key: string]: {
    usd: number;
    usd_market_cap?: number;
    usd_24h_vol?: number;
    usd_24h_change?: number;
  };
}

const createPriceFromSimple = (coinId: string, data: SimplePriceResponse[string]): CryptoPrice => ({
  id: coinId,
  symbol: coinId,
  price: data.usd,
  marketCap: data.usd_market_cap ?? 0,
  volume24h: data.usd_24h_vol ?? 0,
  change24h: data.usd_24h_change ?? 0,
  timestamp: new Date(),
});

const makeBatchedResolver = RequestResolver.makeBatched(
  (requests: ReadonlyArray<GetCryptoPriceRequest>) =>
    Effect.gen(function* () {
      const http = yield* HttpClientTag;
      const rateLimiter = yield* RateLimiterTag;
      const coinIds = Arr.dedupe(requests.map((r) => r.coinId.toLowerCase()));

      if (coinIds.length === 0) {
        return;
      }

      yield* rateLimiter
        .acquire("coingecko")
        .pipe(Effect.catchTag("RateLimitExceeded", () => Effect.void));

      const url = `${API_URLS.COINGECKO}/simple/price?ids=${coinIds.join(",")}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`;

      const result = yield* http.getJson(url).pipe(
        Effect.mapError((e) => mapError(e, coinIds.join(","))),
        Effect.either
      );

      yield* Effect.forEach(
        requests,
        (request) => {
          const normalized = request.coinId.toLowerCase();

          if (result._tag === "Left") {
            return Request.completeEffect(request, Effect.fail(result.left));
          }

          const data = result.right as SimplePriceResponse;
          const priceData = data[normalized];

          if (!priceData) {
            return Request.completeEffect(
              request,
              Effect.fail(
                new DataSourceError({
                  source: "CoinGecko",
                  message: `Price not found: ${request.coinId}`,
                  symbol: request.coinId,
                })
              )
            );
          }

          return Request.completeEffect(
            request,
            Effect.succeed(createPriceFromSimple(normalized, priceData))
          );
        },
        { discard: true }
      );
    })
);

export const GetCryptoPriceResolver = makeBatchedResolver.pipe(
  RequestResolver.contextFromServices(HttpClientTag, RateLimiterTag)
);

export const getCryptoPrice = (coinId: string) =>
  Effect.request(GetCryptoPriceRequest({ coinId }), GetCryptoPriceResolver).pipe(
    Effect.withRequestCaching(true)
  );

export const getCryptoPrices = (coinIds: ReadonlyArray<string>) =>
  Effect.forEach(coinIds, getCryptoPrice, { batching: true });
