import { Effect, Context, Layer, Either } from "effect";
import { validationError, notFoundError, domainError, DomainError } from "./errors";
import type {
  CandlestickRequest,
  DatasetSnapshot,
  Candle,
  CoverageResult,
} from "@schemas/market-data";
import type { MarketDataRepository } from "./ports/market-data-repository";

type MarketTimeframe =
  | "1m"
  | "3m"
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "2h"
  | "4h"
  | "8h"
  | "12h"
  | "1d"
  | "1w";

const MAX_RANGE_CANDLES = 10_000;
const MAX_RECENT_CANDLES = 5000;
const DEFAULT_RECENT_CANDLES = 300;
const CANDLE_TIMING_LOGS_ENABLED = process.env.MODE === "dev";

const logCandleServiceTiming = (payload: Record<string, unknown>) =>
  CANDLE_TIMING_LOGS_ENABLED
    ? Effect.logInfo(JSON.stringify({ event: "candle_service_timing", ...payload }))
    : Effect.succeed(undefined);

const getTimeframeMs = (timeframe: MarketTimeframe): number => {
  switch (timeframe) {
    case "1m":
      return 60 * 1000;
    case "3m":
      return 3 * 60 * 1000;
    case "5m":
      return 5 * 60 * 1000;
    case "15m":
      return 15 * 60 * 1000;
    case "30m":
      return 30 * 60 * 1000;
    case "1h":
      return 60 * 60 * 1000;
    case "2h":
      return 2 * 60 * 60 * 1000;
    case "4h":
      return 4 * 60 * 60 * 1000;
    case "8h":
      return 8 * 60 * 60 * 1000;
    case "12h":
      return 12 * 60 * 60 * 1000;
    case "1d":
      return 24 * 60 * 60 * 1000;
    case "1w":
      return 7 * 24 * 60 * 60 * 1000;
  }
};

const alignRangeToTimeframe = (
  timeframe: MarketTimeframe,
  startTime: Date,
  endTime: Date
): { startTime: Date; endTime: Date } => {
  const timeframeMs = getTimeframeMs(timeframe);
  const alignedStartMs = Math.ceil(startTime.getTime() / timeframeMs) * timeframeMs;
  const alignedEndMs = Math.floor(endTime.getTime() / timeframeMs) * timeframeMs;

  return {
    startTime: new Date(alignedStartMs),
    endTime: new Date(alignedEndMs),
  };
};

export type MarketTicker = {
  readonly symbol: string;
  readonly mid: number | null;
  readonly markPx: number | null;
  readonly midPx: number | null;
  readonly prevDayPx: number | null;
  readonly dayNtlVlm: number | null;
  readonly openInterest: number | null;
  readonly funding: number | null;
};

export type MarketOrderBook = {
  readonly symbol: string;
  readonly nSigFigs?: 2 | 3 | 4 | 5;
  readonly orderbook: unknown;
};

export type MarketTradeAnnotation = {
  readonly symbol: string;
  readonly annotation: unknown;
};

export interface MarketCandleStorePort {
  readonly getCandles: (query: CandleQuery) => Effect.Effect<Candle[], unknown>;
  readonly checkCoverage: (
    symbol: string,
    exchange: string,
    timeframe: MarketTimeframe,
    startTime: Date,
    endTime: Date
  ) => Effect.Effect<CoverageResult, unknown>;
  readonly insertCandles: (
    symbol: string,
    exchange: string,
    timeframe: MarketTimeframe,
    candles: Candle[]
  ) => Effect.Effect<void, unknown>;
}

export interface MarketRemoteProviderPort {
  readonly getCandleSnapshot: (
    symbol: string,
    timeframe: MarketTimeframe,
    startTime: number,
    endTime: number
  ) => Effect.Effect<Candle[], unknown>;
  readonly getMetadata: () => Effect.Effect<unknown, unknown>;
  readonly getTicker?: (symbol: string) => Effect.Effect<MarketTicker, unknown>;
  readonly getOrderBook?: (
    symbol: string,
    depth?: number
  ) => Effect.Effect<MarketOrderBook, unknown>;
  readonly getTradeAnnotation?: (symbol: string) => Effect.Effect<MarketTradeAnnotation, unknown>;
}

export class MarketCandleStore extends Context.Tag("MarketCandleStore")<
  MarketCandleStore,
  MarketCandleStorePort
>() {}

export class MarketRemoteProvider extends Context.Tag("MarketRemoteProvider")<
  MarketRemoteProvider,
  MarketRemoteProviderPort
>() {}

export type CandleQuery = {
  readonly symbol: string;
  readonly exchange: string;
  readonly timeframe: MarketTimeframe;
  readonly startTime?: Date;
  readonly endTime?: Date;
  readonly limit?: number;
  readonly disableLimitForRange?: boolean;
};

export type RecentCandleQuery = {
  readonly symbol: string;
  readonly exchange?: string;
  readonly timeframe: MarketTimeframe;
  readonly endTime?: Date;
  readonly limit?: number;
};

type RequestCandlesticksInput = {
  id: string;
  session_id?: string;
  symbol: string;
  exchange: string;
  base_timeframe: string;
  start_time?: string;
  end_time?: string;
  adjustments?: string | unknown;
  requested_by_action_id?: string;
  requested_by_interaction_id?: string;
  trace_id?: string;
  span_id?: string;
  correlation_id?: string;
};

type CreateDatasetSnapshotInput = {
  id: string;
  request_id: string;
  symbol: string;
  exchange: string;
  timeframe: string;
  start_time: string;
  end_time: string;
  query_fingerprint?: string;
  row_count: number;
  checksum?: string;
  source_series?: string | unknown;
  trace_id?: string;
  span_id?: string;
  correlation_id?: string;
};

export const isCoverageCompleteStrict = (coverage: CoverageResult): boolean =>
  coverage.fullCoverage &&
  coverage.missingWindows.length === 0 &&
  coverage.rowCount >= coverage.expectedCount;

export class MarketDataServices extends Context.Tag("MarketDataServices")<
  MarketDataServices,
  {
    readonly requestCandlesticks: (
      input: RequestCandlesticksInput
    ) => Effect.Effect<CandlestickRequest, DomainError>;
    readonly createDatasetSnapshot: (
      input: CreateDatasetSnapshotInput
    ) => Effect.Effect<DatasetSnapshot, DomainError>;
    readonly getDatasetSnapshot: (id: string) => Effect.Effect<DatasetSnapshot, DomainError>;

    // High-level orchestration
    readonly getCandles: (
      query: CandleQuery
    ) => Effect.Effect<
      { candles: Candle[]; provenance: string; coverage: CoverageResult },
      DomainError
    >;
    readonly getRecentCandles: (
      query: RecentCandleQuery
    ) => Effect.Effect<
      { candles: Candle[]; provenance: string; coverage: CoverageResult },
      DomainError
    >;
    readonly discoverMarkets: () => Effect.Effect<unknown, DomainError>;
    readonly inspectCoverage: (query: CandleQuery) => Effect.Effect<CoverageResult, DomainError>;
    readonly getTicker: (symbol: string) => Effect.Effect<MarketTicker, DomainError>;
    readonly getOrderBook: (
      symbol: string,
      depth?: number
    ) => Effect.Effect<MarketOrderBook, DomainError>;
    readonly getTradeAnnotation: (
      symbol: string
    ) => Effect.Effect<MarketTradeAnnotation, DomainError>;
  }
>() {}

export const makeMarketDataService = (repo: MarketDataRepository) =>
  Effect.gen(function* () {
    const candleRepo = yield* MarketCandleStore;
    const remoteProvider = yield* MarketRemoteProvider;
    const mapInfraError = (fallbackMessage: string) => (error: unknown) => {
      if (error instanceof DomainError) {
        return error;
      }

      if (typeof error === "object" && error !== null) {
        const candidate = error as {
          message?: unknown;
          kind?: unknown;
        };
        const message = typeof candidate.message === "string" ? candidate.message : fallbackMessage;

        if (candidate.kind === "BAD_REQUEST") {
          return validationError(message, error);
        }

        if (candidate.kind === "NOT_FOUND") {
          return notFoundError(message, error);
        }

        if (candidate.kind === "UPSTREAM") {
          return domainError("INTERNAL_ERROR", message, error);
        }

        return validationError(message, error);
      }

      return validationError(fallbackMessage, error);
    };

    const isCoverageComplete = (coverage: CoverageResult): boolean =>
      isCoverageCompleteStrict(coverage);

    const normalizeCandles = (candles: Candle[]): Candle[] => {
      const hasOnlyValidTimestamps = candles.every(
        (candle) => candle.timestamp instanceof Date && Number.isFinite(candle.timestamp.getTime())
      );

      if (!hasOnlyValidTimestamps) {
        return candles;
      }

      const byTimestamp = new Map<number, Candle>();
      for (const candle of candles) {
        byTimestamp.set(candle.timestamp.getTime(), candle);
      }

      return Array.from(byTimestamp.entries())
        .sort(([left], [right]) => left - right)
        .map(([, candle]) => candle);
    };

    const refreshCoverage = (
      query: CandleQuery,
      startTime: Date,
      endTime: Date,
      maxAttempts = 3
    ): Effect.Effect<CoverageResult, never> => {
      const checkOnce = () =>
        candleRepo
          .checkCoverage(query.symbol, query.exchange, query.timeframe, startTime, endTime)
          .pipe(
            Effect.catchAll(() =>
              Effect.succeed({
                hasData: false,
                rowCount: 0,
                expectedCount: 0,
                fullCoverage: false,
                missingWindows: [{ start: startTime, end: endTime }],
              } satisfies CoverageResult)
            )
          );

      const loop = (attempt: number): Effect.Effect<CoverageResult, never> =>
        checkOnce().pipe(
          Effect.flatMap((coverage) => {
            if (isCoverageComplete(coverage) || attempt >= maxAttempts) {
              return Effect.succeed(coverage);
            }

            return Effect.sleep("150 millis").pipe(Effect.flatMap(() => loop(attempt + 1)));
          })
        );

      return loop(1);
    };

    /**
     * Internal helper to fill gaps in local storage by fetching from remote Tier 2 (Hyperliquid)
     */
    const fillGaps = (
      query: CandleQuery,
      coverage: CoverageResult,
      startTime: Date,
      endTime: Date
    ) =>
      Effect.gen(function* () {
        if (isCoverageComplete(coverage) || query.exchange.toLowerCase() !== "hyperliquid") {
          return coverage;
        }

        for (const window of coverage.missingWindows) {
          let currentStart = window.start.getTime();
          const requestedEnd = window.end.getTime();
          const MAX_BATCH_SIZE = 5000;
          const MAX_LOOPS = 5;

          for (let i = 0; i < MAX_LOOPS; i++) {
            const remoteResult = yield* remoteProvider
              .getCandleSnapshot(query.symbol, query.timeframe, currentStart, requestedEnd)
              .pipe(
                Effect.mapError(mapInfraError("Failed to fetch remote candles")),
                Effect.either
              );

            if (Either.isLeft(remoteResult)) {
              yield* Effect.logWarning(
                `Skipping remote gap fill for ${query.symbol} (${query.timeframe}) due to upstream error: ${remoteResult.left.message}`
              );
              break;
            }

            const remoteCandles = remoteResult.right;

            if (remoteCandles.length === 0) break;

            yield* candleRepo
              .insertCandles(query.symbol, query.exchange, query.timeframe, remoteCandles)
              .pipe(
                Effect.catchAll((e) =>
                  Effect.logWarning(
                    `Failed to cache candles: ${e instanceof Error ? e.message : String(e)}`
                  )
                )
              );

            const lastCandleTime = remoteCandles[remoteCandles.length - 1].timestamp.getTime();
            if (remoteCandles.length < MAX_BATCH_SIZE || lastCandleTime >= requestedEnd) {
              break;
            }
            currentStart = lastCandleTime + 1;
          }
        }

        // Re-calculate coverage after filling gaps
        return yield* candleRepo
          .checkCoverage(query.symbol, query.exchange, query.timeframe, startTime, endTime)
          .pipe(Effect.catchAll(() => Effect.succeed(coverage)));
      });

    return MarketDataServices.of({
      requestCandlesticks: (input) =>
        Effect.tryPromise({
          try: () =>
            repo.insertCandlestickRequest({ ...input, created_at: new Date().toISOString() }),
          catch: (e) => validationError("Failed to request candlesticks", e),
        }),

      createDatasetSnapshot: (input) =>
        Effect.tryPromise({
          try: () => repo.insertDatasetSnapshot({ ...input, created_at: new Date().toISOString() }),
          catch: (e) => validationError("Failed to create dataset snapshot", e),
        }),

      getDatasetSnapshot: (id) =>
        Effect.gen(function* () {
          const snapshot = yield* Effect.tryPromise({
            try: () => repo.getDatasetSnapshot(id),
            catch: (e) => validationError("Failed to get dataset snapshot", e),
          });
          if (!snapshot) return yield* Effect.fail(notFoundError(`Snapshot ${id} not found`));
          return snapshot;
        }),

      getCandles: (query) =>
        Effect.gen(function* () {
          const startedAt = Date.now();
          const requestedStartTime = query.startTime ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
          const requestedEndTime = query.endTime ?? new Date();
          const { startTime, endTime } = alignRangeToTimeframe(
            query.timeframe,
            requestedStartTime,
            requestedEndTime
          );

          if (startTime.getTime() > endTime.getTime()) {
            return yield* Effect.fail(validationError("Start time must be before end time"));
          }

          const requestedRangeCount =
            Math.floor(
              (endTime.getTime() - startTime.getTime()) / getTimeframeMs(query.timeframe)
            ) + 1;
          if (requestedRangeCount > MAX_RANGE_CANDLES) {
            return yield* Effect.fail(
              validationError(
                `Requested range is too large (${requestedRangeCount} candles). Maximum is ${MAX_RANGE_CANDLES}.`
              )
            );
          }

          // 1. Inspect initial coverage
          const fallbackCoverage: CoverageResult = {
            hasData: false,
            rowCount: 0,
            expectedCount: 0,
            fullCoverage: false,
            missingWindows: [{ start: startTime, end: endTime }],
          };

          let coverage = yield* candleRepo
            .checkCoverage(query.symbol, query.exchange, query.timeframe, startTime, endTime)
            .pipe(Effect.catchAll(() => Effect.succeed(fallbackCoverage)));
          const initialCoverageAt = Date.now();

          // 2. Fill gaps if necessary
          coverage = yield* fillGaps(query, coverage, startTime, endTime);
          const fillGapsAt = Date.now();

          if (!isCoverageComplete(coverage) && query.exchange.toLowerCase() === "hyperliquid") {
            coverage = yield* refreshCoverage(query, startTime, endTime);
          }
          const refreshedCoverageAt = Date.now();

          // 3. Fetch final combined results from local store
          const candles = yield* candleRepo
            .getCandles({
              ...query,
              startTime,
              endTime,
              disableLimitForRange: Boolean(query.startTime && query.endTime),
            })
            .pipe(Effect.mapError(mapInfraError("Failed to load candles")));
          const storeFetchAt = Date.now();

          const normalizedCandles = normalizeCandles(candles);
          const normalizedAt = Date.now();

          const provenance = isCoverageComplete(coverage)
            ? "QuestDB (Fully Covered)"
            : `QuestDB (Partial: ${normalizedCandles.length}/${coverage.expectedCount} rows)`;

          yield* logCandleServiceTiming({
            route: "getCandles",
            symbol: query.symbol,
            exchange: query.exchange,
            timeframe: query.timeframe,
            initial_coverage_ms: initialCoverageAt - startedAt,
            fill_gaps_ms: fillGapsAt - initialCoverageAt,
            refresh_coverage_ms: refreshedCoverageAt - fillGapsAt,
            store_fetch_ms: storeFetchAt - refreshedCoverageAt,
            normalize_ms: normalizedAt - storeFetchAt,
            total_ms: normalizedAt - startedAt,
            row_count: normalizedCandles.length,
            expected_count: coverage.expectedCount,
            full_coverage: coverage.fullCoverage,
            missing_windows: coverage.missingWindows.length,
          });

          return { candles: normalizedCandles, provenance, coverage };
        }),

      getRecentCandles: (query) =>
        Effect.gen(function* () {
          const startedAt = Date.now();
          const exchange = query.exchange ?? "Hyperliquid";
          if (exchange.toLowerCase() !== "hyperliquid") {
            return yield* Effect.fail(
              validationError(
                "Recent candle snapshots are currently supported only for Hyperliquid"
              )
            );
          }

          const requestedLimit = query.limit ?? DEFAULT_RECENT_CANDLES;
          if (!Number.isFinite(requestedLimit) || requestedLimit <= 0) {
            return yield* Effect.fail(validationError("limit must be a positive integer"));
          }
          if (requestedLimit > MAX_RECENT_CANDLES) {
            return yield* Effect.fail(
              validationError(
                `limit is too large (${requestedLimit}). Maximum is ${MAX_RECENT_CANDLES}.`
              )
            );
          }

          const endTime = query.endTime ?? new Date();
          const expectedCount = Math.trunc(requestedLimit);
          const startTime = new Date(
            endTime.getTime() - (expectedCount - 1) * getTimeframeMs(query.timeframe)
          );

          const snapshotCandles = yield* remoteProvider
            .getCandleSnapshot(
              query.symbol,
              query.timeframe,
              startTime.getTime(),
              endTime.getTime()
            )
            .pipe(Effect.mapError(mapInfraError("Failed to fetch recent candle snapshot")));
          const remoteAt = Date.now();

          const normalizedCandles = normalizeCandles(snapshotCandles).slice(-expectedCount);
          const normalizedAt = Date.now();
          const coverage: CoverageResult = {
            hasData: normalizedCandles.length > 0,
            rowCount: normalizedCandles.length,
            expectedCount,
            fullCoverage: normalizedCandles.length === expectedCount,
            missingWindows: [],
          };

          const provenance = coverage.fullCoverage
            ? "Hyperliquid Snapshot (Recent via Backend)"
            : `Hyperliquid Snapshot (Recent Partial: ${coverage.rowCount}/${coverage.expectedCount} rows)`;

          yield* logCandleServiceTiming({
            route: "getRecentCandles",
            symbol: query.symbol,
            exchange,
            timeframe: query.timeframe,
            remote_fetch_ms: remoteAt - startedAt,
            normalize_ms: normalizedAt - remoteAt,
            total_ms: normalizedAt - startedAt,
            row_count: normalizedCandles.length,
            expected_count: expectedCount,
            full_coverage: coverage.fullCoverage,
          });

          return {
            candles: normalizedCandles,
            provenance,
            coverage,
          };
        }),

      discoverMarkets: () =>
        remoteProvider
          .getMetadata()
          .pipe(Effect.mapError(mapInfraError("Failed to discover markets"))),

      inspectCoverage: (query) =>
        candleRepo
          .checkCoverage(
            query.symbol,
            query.exchange,
            query.timeframe,
            query.startTime ?? new Date(0),
            query.endTime ?? new Date()
          )
          .pipe(Effect.mapError(mapInfraError("Failed to inspect coverage"))),

      getTicker: (symbol) =>
        typeof remoteProvider.getTicker === "function"
          ? remoteProvider
              .getTicker(symbol)
              .pipe(Effect.mapError(mapInfraError("Failed to get ticker")))
          : Effect.fail(validationError("Ticker is not available in this runtime")),

      getOrderBook: (symbol, depth) =>
        typeof remoteProvider.getOrderBook === "function"
          ? remoteProvider
              .getOrderBook(symbol, depth)
              .pipe(Effect.mapError(mapInfraError("Failed to get orderbook")))
          : Effect.fail(validationError("Orderbook is not available in this runtime")),

      getTradeAnnotation: (symbol) =>
        typeof remoteProvider.getTradeAnnotation === "function"
          ? remoteProvider
              .getTradeAnnotation(symbol)
              .pipe(Effect.mapError(mapInfraError("Failed to get trade annotation")))
          : Effect.fail(validationError("Trade annotation is not available in this runtime")),
    });
  });

export const MarketDataServicesLayer = (repo: MarketDataRepository) =>
  Layer.effect(MarketDataServices, makeMarketDataService(repo));
