import { Clock, Context, Effect } from "effect";
import type { Candle } from "@0xsignal/shared";
import { MarketProviderError } from "./market-provider.error";
import type { MarketRemoteProviderPort } from "./market-remote-provider";
import type { CandleQuery } from "./types";
import type { CandleCachePort } from "./candle-cache";
import { getTimeframeMs } from "./timeframe";

export interface MarketCandleStorePort {
  readonly getCandles: (query: CandleQuery) => Effect.Effect<Candle[], MarketProviderError>;
}

export class MarketCandleStore extends Context.Service<MarketCandleStore, MarketCandleStorePort>()(
  "MarketCandleStore",
) {}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const toMillis = (timestamp: Candle["timestamp"]): number => new Date(timestamp).getTime();

const isClosed = (openMs: number, intervalMs: number, nowMs: number): boolean =>
  openMs + intervalMs <= nowMs;

type Segment = { readonly start: number; readonly end: number };

/**
 * Walks the requested open times and groups the ones the table does not hold
 * into contiguous intervals. This keeps the tail fetch minimal even after a
 * gap or a request that starts before the cached range.
 */
const missingSegments = (
  startOpen: number,
  endOpen: number,
  intervalMs: number,
  cachedOpenTimes: ReadonlySet<number>,
): Segment[] => {
  const segments: Segment[] = [];
  let segmentStart: number | null = null;

  for (let open = startOpen; open <= endOpen; open += intervalMs) {
    if (!cachedOpenTimes.has(open)) {
      segmentStart ??= open;
      continue;
    }
    if (segmentStart !== null) {
      segments.push({ start: segmentStart, end: open - intervalMs });
      segmentStart = null;
    }
  }

  if (segmentStart !== null) segments.push({ start: segmentStart, end: endOpen });
  return segments;
};

const mergeCandles = (
  cached: readonly Candle[],
  fetched: readonly Candle[],
  startOpen: number,
  endOpen: number,
): Candle[] => {
  const byOpen = new Map<number, Candle>();
  for (const candle of [...cached, ...fetched]) {
    const open = toMillis(candle.timestamp);
    if (open >= startOpen && open <= endOpen) byOpen.set(open, candle);
  }
  return Array.from(byOpen.entries())
    .toSorted(([a], [b]) => a - b)
    .map(([, candle]) => candle);
};

const cacheFailure = (error: { readonly message: string }): MarketProviderError =>
  new MarketProviderError({
    kind: "INTERNAL",
    message: error.message,
    cause: error,
  });

/**
 * Closed candles are immutable: serve them from Postgres and fetch only the
 * open times the table does not yet hold. The in-progress candle is never
 * stored, so each read refetches that single candle from Hyperliquid.
 */
export const makeCandleStore = (
  cache: CandleCachePort,
  provider: MarketRemoteProviderPort,
): MarketCandleStorePort => ({
  getCandles: (query) =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      const intervalMs = getTimeframeMs(query.timeframe);
      const startOpen =
        Math.ceil((query.startTime?.getTime() ?? now - ONE_DAY_MS) / intervalMs) * intervalMs;
      const endOpen = Math.floor((query.endTime?.getTime() ?? now) / intervalMs) * intervalMs;

      if (startOpen > endOpen) return [];

      const cached = yield* cache
        .readRange(query.symbol, query.timeframe, startOpen, endOpen)
        .pipe(Effect.mapError(cacheFailure));

      const cachedOpenTimes = new Set<number>();
      for (const candle of cached) {
        const open = toMillis(candle.timestamp);
        if (open >= startOpen && open <= endOpen) cachedOpenTimes.add(open);
      }

      const fetched: Candle[] = [];
      for (const segment of missingSegments(startOpen, endOpen, intervalMs, cachedOpenTimes)) {
        const candles = yield* provider.getCandleSnapshot(
          query.symbol,
          query.timeframe,
          segment.start,
          segment.end + intervalMs - 1,
        );
        fetched.push(...candles);

        const closed = candles.filter((candle) =>
          isClosed(toMillis(candle.timestamp), intervalMs, now),
        );
        if (closed.length > 0) {
          yield* cache
            .upsert(query.symbol, query.timeframe, closed)
            .pipe(Effect.mapError(cacheFailure));
        }
      }

      return mergeCandles(cached, fetched, startOpen, endOpen);
    }),
});
