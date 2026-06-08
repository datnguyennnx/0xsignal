import { Deferred, Effect, Ref } from "effect";
import { type Semaphore, makeUnsafe as makeSemaphoreUnsafe } from "effect/Semaphore";
import { normalizeCandles, parseHlRawCandles, toHlInterval } from "./normalizer";
import { normalizeSymbol } from "./symbol";
import type { Candle } from "@0xsignal/shared";
import type { MarketTimeframe } from "../../../domain/market-data/timeframe";
import { HyperliquidClient } from "./client";
import type { PerpAnnotationResponse } from "@nktkas/hyperliquid/api/info";
import { HyperliquidError, isRateLimitedCause } from "./errors";
import type { TickerPayload, OrderBookPayload, TickerSnapshot } from "./types";
import type { HyperliquidInfoClient } from "./mapping";
import { getTickerSnapshotEffect } from "./mapping";
import { mapTickerFromSnapshot, resolveInternalSymbol, isPerpSymbol } from "./mapping.pure";
import { HyperliquidRateLimiter } from "./rate-limiter";
import { HyperliquidDeduplicationRegistry } from "./dedup";

type RateLimiterSvc = { readonly semaphore: Semaphore };
type DedupRegistrySvc = {
  readonly registryRef: Ref.Ref<Map<string, Deferred.Deferred<any, HyperliquidError>>>;
};

// Standalone provider functions get HyperliquidClient from Context.

const standaloneProvide = <A, E>(
  effect: Effect.Effect<A, E, HyperliquidRateLimiter | HyperliquidDeduplicationRegistry>,
  semaphore?: Semaphore,
  dedupRef?: Ref.Ref<Map<string, Deferred.Deferred<any, HyperliquidError>>>
): Effect.Effect<A, E> => {
  const rs: RateLimiterSvc = semaphore ? { semaphore } : { semaphore: makeSemaphoreUnsafe(6) };
  const ds: DedupRegistrySvc = dedupRef
    ? { registryRef: dedupRef }
    : { registryRef: Ref.makeUnsafe(new Map()) };
  return effect.pipe(
    Effect.provideService(HyperliquidRateLimiter, rs),
    Effect.provideService(HyperliquidDeduplicationRegistry, ds)
  );
};

export const getCandleSnapshot = (
  coin: string,
  interval: MarketTimeframe,
  startTime: number,
  endTime: number
): Effect.Effect<Candle[], HyperliquidError, HyperliquidClient> =>
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;
    const hlInfo = info as unknown as HyperliquidInfoClient;
    const snapshot = yield* standaloneProvide(getTickerSnapshotEffect(hlInfo, coin));
    const internalSymbol = resolveInternalSymbol(snapshot, coin);
    return yield* standaloneProvide(
      Effect.tryPromise({
        try: () =>
          info.candleSnapshot({
            coin: internalSymbol,
            interval: toHlInterval(interval),
            startTime,
            endTime,
          }),
        catch: (cause) =>
          new HyperliquidError({
            message: `Failed to fetch candles for ${coin} (${interval})`,
            cause,
          }),
      }).pipe(Effect.map((candles) => normalizeCandles(parseHlRawCandles(candles))))
    );
  });

export const getAllMids = (): Effect.Effect<
  Record<string, string>,
  HyperliquidError,
  HyperliquidClient
> =>
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;
    return yield* Effect.tryPromise({
      try: () => info.allMids(),
      catch: (cause) =>
        new HyperliquidError({
          message: "Failed to fetch all mids",
          kind: isRateLimitedCause(cause) ? "RATE_LIMITED" : "UPSTREAM",
          cause,
        }),
    });
  });

const fetchTickerOnce = (
  hlInfo: HyperliquidInfoClient
): Effect.Effect<TickerSnapshot, HyperliquidError> =>
  standaloneProvide(getTickerSnapshotEffect(hlInfo));

export const getTicker = (
  symbol: string
): Effect.Effect<TickerPayload, HyperliquidError, HyperliquidClient> =>
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;
    const hlInfo = info as unknown as HyperliquidInfoClient;
    const snapshot = yield* fetchTickerOnce(hlInfo);
    return mapTickerFromSnapshot(snapshot, symbol);
  });

export const getOrderBook = (
  symbol: string,
  depth?: number
): Effect.Effect<OrderBookPayload, HyperliquidError, HyperliquidClient> =>
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;
    const hlInfo = info as unknown as HyperliquidInfoClient;
    const snapshot = yield* fetchTickerOnce(hlInfo);
    const internalSymbol = resolveInternalSymbol(snapshot, symbol);

    const parsedDepth = depth === undefined ? undefined : Math.trunc(depth);
    const nSigFigs: 2 | 3 | 4 | 5 | undefined =
      parsedDepth === 2 || parsedDepth === 3 || parsedDepth === 4 || parsedDepth === 5
        ? parsedDepth
        : undefined;

    const orderbook = yield* Effect.tryPromise({
      try: () => info.l2Book({ coin: internalSymbol, nSigFigs }),
      catch: (cause) =>
        cause instanceof HyperliquidError
          ? cause
          : new HyperliquidError({
              message: `Failed to fetch orderbook for ${symbol}`,
              kind: "UPSTREAM",
              cause,
            }),
    });
    if (!orderbook) {
      return yield* Effect.fail(
        new HyperliquidError({
          message: `Orderbook not available for ${internalSymbol}`,
          kind: "NOT_FOUND",
        })
      );
    }
    return { symbol: normalizeSymbol(symbol), nSigFigs, orderbook };
  });

export const getTradeAnnotation = (
  symbol: string
): Effect.Effect<
  { symbol: string; annotation: PerpAnnotationResponse },
  HyperliquidError,
  HyperliquidClient
> =>
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;
    const hlInfo = info as unknown as HyperliquidInfoClient;
    const snapshot = yield* fetchTickerOnce(hlInfo);
    const internalSymbol = resolveInternalSymbol(snapshot, symbol);
    const isPerp = isPerpSymbol(snapshot, symbol);
    if (!isPerp) {
      return yield* Effect.fail(
        new HyperliquidError({
          message: `Asset not supported or not found in perpetuals universe: ${symbol}`,
          kind: "NOT_FOUND",
        })
      );
    }
    const annotation = yield* Effect.tryPromise({
      try: () => info.perpAnnotation({ coin: internalSymbol }),
      catch: (cause) =>
        cause instanceof HyperliquidError
          ? cause
          : new HyperliquidError({
              message: `Failed to fetch trade annotation for ${symbol}`,
              cause,
            }),
    });
    return { symbol: normalizeSymbol(symbol), annotation };
  });
