import { Effect, Context, Layer } from "effect";
import { validationError, notFoundError, DomainError } from "./errors";
import type {
  CandlestickRequest,
  DatasetSnapshot,
  Candle,
  CoverageResult,
} from "@schemas/market-data";
import type { MarketDataRepository } from "@infrastructure/repositories/market-data-repo";
import { CandleRepository } from "@infrastructure/db/questdb/repositories/candle";
import { HyperliquidProvider } from "@infrastructure/data-sources/hyperliquid/providers";

type MarketTimeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

export type CandleQuery = {
  readonly symbol: string;
  readonly exchange: string;
  readonly timeframe: MarketTimeframe;
  readonly startTime?: Date;
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
    readonly discoverMarkets: () => Effect.Effect<unknown, DomainError>;
    readonly inspectCoverage: (query: CandleQuery) => Effect.Effect<CoverageResult, DomainError>;
  }
>() {}

export const makeMarketDataService = (repo: MarketDataRepository) =>
  Effect.gen(function* () {
    const candleRepo = yield* CandleRepository;
    const hlProvider = yield* HyperliquidProvider;

    /**
     * Internal helper to fill gaps in local storage by fetching from remote Tier 2 (Hyperliquid)
     */
    const fillGaps = (query: CandleQuery, coverage: CoverageResult) =>
      Effect.gen(function* () {
        if (coverage.fullCoverage || query.exchange.toLowerCase() !== "hyperliquid") {
          return coverage;
        }

        for (const window of coverage.missingWindows) {
          let currentStart = window.start.getTime();
          const requestedEnd = window.end.getTime();
          const MAX_BATCH_SIZE = 5000;
          const MAX_LOOPS = 5;

          for (let i = 0; i < MAX_LOOPS; i++) {
            const remoteCandles = yield* hlProvider
              .getCandleSnapshot(query.symbol, query.timeframe, currentStart, requestedEnd)
              .pipe(Effect.mapError((e) => validationError(e.message, e.cause)));

            if (remoteCandles.length === 0) break;

            yield* candleRepo
              .insertCandles(query.symbol, query.exchange, query.timeframe, remoteCandles)
              .pipe(
                Effect.catchAll((e) => Effect.logWarning(`Failed to cache candles: ${e.message}`))
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
          .checkCoverage(
            query.symbol,
            query.exchange,
            query.timeframe,
            query.startTime ?? new Date(0),
            query.endTime ?? new Date()
          )
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
          const startTime = query.startTime ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
          const endTime = query.endTime ?? new Date();

          if (startTime.getTime() > endTime.getTime()) {
            return yield* Effect.fail(validationError("Start time must be before end time"));
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

          // 2. Fill gaps if necessary
          coverage = yield* fillGaps(query, coverage);

          // 3. Fetch final combined results from local store
          const candles = yield* candleRepo
            .getCandles(query)
            .pipe(Effect.mapError((e) => validationError(e.message, e.cause)));

          const provenance = coverage.fullCoverage
            ? "QuestDB (Fully Covered)"
            : `QuestDB (Partial: ${candles.length}/${coverage.expectedCount} rows)`;

          return { candles, provenance, coverage };
        }),

      discoverMarkets: () =>
        hlProvider.getMetadata().pipe(Effect.mapError((e) => validationError(e.message, e.cause))),

      inspectCoverage: (query) =>
        candleRepo
          .checkCoverage(
            query.symbol,
            query.exchange,
            query.timeframe,
            query.startTime ?? new Date(0),
            query.endTime ?? new Date()
          )
          .pipe(Effect.mapError((e) => validationError(e.message, e.cause))),
    });
  });

export const MarketDataServicesLayer = (repo: MarketDataRepository) =>
  Layer.effect(MarketDataServices, makeMarketDataService(repo));
