import { Clock, Config, Effect, Layer } from "effect";
import { DomainError } from "../errors";
import type { CoverageResult } from "../../schemas/market-data";
import { MarketDataRepository } from "../ports/market-data-repository";
import { MarketCandleStore, MarketDataServices, MarketRemoteProvider } from "./contracts";
import type { RecentCandleQuery } from "./types";
import { alignRangeToTimeframe } from "./range-alignment";
import { getTimeframeMs } from "../../domain/market-data/timeframe";
import {
  DEFAULT_RECENT_CANDLES,
  MAX_RANGE_CANDLES,
  MAX_RECENT_CANDLES,
  isCoverageCompleteStrict,
  normalizeCandles,
} from "./policies";
import { mapMarketInfraError } from "./error-mapping";
import { createCoverageRefresh, createGapFillWorkflow } from "./coverage-workflows";

const isDevMode: Effect.Effect<string, never> = Config.string("MODE").pipe(
  Effect.catchAll(() => Effect.succeed("production"))
);

const logCandleServiceTiming = (payload: Record<string, unknown>) =>
  Effect.gen(function* () {
    const mode = yield* isDevMode;
    if (mode === "dev") {
      yield* Effect.logInfo(JSON.stringify({ event: "candle_service_timing", ...payload }));
    }
  });

export const makeMarketDataService = (repo: MarketDataRepository) =>
  Effect.gen(function* () {
    const candleRepo = yield* MarketCandleStore;
    const remoteProvider = yield* MarketRemoteProvider;
    const isCoverageComplete = (coverage: CoverageResult): boolean =>
      isCoverageCompleteStrict(coverage);
    const refreshCoverage = createCoverageRefresh(candleRepo);
    const fillGaps = createGapFillWorkflow(candleRepo, remoteProvider, mapMarketInfraError);

    return MarketDataServices.of({
      requestCandlesticks: (input) =>
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis;
          return yield* repo
            .insertCandlestickRequest({ ...input, created_at: new Date(now).toISOString() })
            .pipe(
              Effect.mapError(
                (e) =>
                  new DomainError({
                    code: "VALIDATION_ERROR",
                    message: "Failed to request candlesticks",
                    cause: e,
                  })
              )
            );
        }),

      createDatasetSnapshot: (input) =>
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis;
          return yield* repo
            .insertDatasetSnapshot({ ...input, created_at: new Date(now).toISOString() })
            .pipe(
              Effect.mapError(
                (e) =>
                  new DomainError({
                    code: "VALIDATION_ERROR",
                    message: "Failed to create dataset snapshot",
                    cause: e,
                  })
              )
            );
        }),

      getDatasetSnapshot: (id) =>
        Effect.gen(function* () {
          const snapshot = yield* repo.getDatasetSnapshot(id).pipe(
            Effect.mapError(
              (e) =>
                new DomainError({
                  code: "VALIDATION_ERROR",
                  message: "Failed to get dataset snapshot",
                  cause: e,
                })
            )
          );
          if (!snapshot)
            return yield* Effect.fail(
              new DomainError({ code: "NOT_FOUND", message: `Snapshot ${id} not found` })
            );
          return snapshot;
        }),

      getCandles: (query) =>
        Effect.gen(function* () {
          const startedAt = yield* Clock.currentTimeMillis;
          const requestedStartTime = query.startTime ?? new Date(startedAt - 24 * 60 * 60 * 1000);
          const requestedEndTime = query.endTime ?? new Date(startedAt);
          const { startTime, endTime } = alignRangeToTimeframe(
            query.timeframe,
            requestedStartTime,
            requestedEndTime
          );

          if (startTime.getTime() > endTime.getTime()) {
            return yield* Effect.fail(
              new DomainError({
                code: "VALIDATION_ERROR",
                message: "Start time must be before end time",
              })
            );
          }

          const requestedRangeCount =
            Math.floor(
              (endTime.getTime() - startTime.getTime()) / getTimeframeMs(query.timeframe)
            ) + 1;
          if (requestedRangeCount > MAX_RANGE_CANDLES) {
            return yield* Effect.fail(
              new DomainError({
                code: "VALIDATION_ERROR",
                message: `Requested range is too large (${requestedRangeCount} candles). Maximum is ${MAX_RANGE_CANDLES}.`,
              })
            );
          }

          let coverage = yield* candleRepo
            .checkCoverage(query.symbol, query.exchange, query.timeframe, startTime, endTime)
            .pipe(Effect.mapError(mapMarketInfraError("QuestDB coverage check failed")));
          const initialCoverageAt = yield* Clock.currentTimeMillis;

          coverage = yield* fillGaps(query, coverage, startTime, endTime);
          const fillGapsAt = yield* Clock.currentTimeMillis;

          if (!isCoverageComplete(coverage) && query.exchange.toLowerCase() === "hyperliquid") {
            coverage = yield* refreshCoverage(query, startTime, endTime);
          }
          const refreshedCoverageAt = yield* Clock.currentTimeMillis;

          const candles = yield* candleRepo
            .getCandles({
              ...query,
              startTime,
              endTime,
              disableLimitForRange: Boolean(query.startTime && query.endTime),
            })
            .pipe(Effect.mapError(mapMarketInfraError("Failed to load candles")));
          const storeFetchAt = yield* Clock.currentTimeMillis;

          const normalizedCandles = normalizeCandles(candles);
          const normalizedAt = yield* Clock.currentTimeMillis;

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

      getRecentCandles: (query: RecentCandleQuery) =>
        Effect.gen(function* () {
          const startedAt = yield* Clock.currentTimeMillis;
          const exchange = query.exchange ?? "Hyperliquid";
          if (exchange.toLowerCase() !== "hyperliquid") {
            return yield* Effect.fail(
              new DomainError({
                code: "VALIDATION_ERROR",
                message: "Recent candle snapshots are currently supported only for Hyperliquid",
              })
            );
          }

          const requestedLimit = query.limit ?? DEFAULT_RECENT_CANDLES;
          if (!Number.isFinite(requestedLimit) || requestedLimit <= 0) {
            return yield* Effect.fail(
              new DomainError({
                code: "VALIDATION_ERROR",
                message: "limit must be a positive integer",
              })
            );
          }
          if (requestedLimit > MAX_RECENT_CANDLES) {
            return yield* Effect.fail(
              new DomainError({
                code: "VALIDATION_ERROR",
                message: `limit is too large (${requestedLimit}). Maximum is ${MAX_RECENT_CANDLES}.`,
              })
            );
          }

          const endTime = query.endTime ?? new Date(startedAt);
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
            .pipe(Effect.mapError(mapMarketInfraError("Failed to fetch recent candle snapshot")));
          const remoteAt = yield* Clock.currentTimeMillis;

          const normalizedCandles = normalizeCandles(snapshotCandles).slice(-expectedCount);
          const normalizedAt = yield* Clock.currentTimeMillis;
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
          .getAggregatedMarkets()
          .pipe(Effect.mapError(mapMarketInfraError("Failed to discover markets"))),

      inspectCoverage: (query) =>
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis;
          return yield* candleRepo
            .checkCoverage(
              query.symbol,
              query.exchange,
              query.timeframe,
              query.startTime ?? new Date(0),
              query.endTime ?? new Date(now)
            )
            .pipe(Effect.mapError(mapMarketInfraError("Failed to inspect coverage")));
        }),

      getTicker: (symbol) =>
        typeof remoteProvider.getTicker === "function"
          ? remoteProvider
              .getTicker(symbol)
              .pipe(Effect.mapError(mapMarketInfraError("Failed to get ticker")))
          : Effect.fail(
              new DomainError({
                code: "VALIDATION_ERROR",
                message: "Ticker is not available in this runtime",
              })
            ),

      getOrderBook: (symbol, depth) =>
        typeof remoteProvider.getOrderBook === "function"
          ? remoteProvider
              .getOrderBook(symbol, depth)
              .pipe(Effect.mapError(mapMarketInfraError("Failed to get orderbook")))
          : Effect.fail(
              new DomainError({
                code: "VALIDATION_ERROR",
                message: "Orderbook is not available in this runtime",
              })
            ),

      getTradeAnnotation: (symbol) =>
        typeof remoteProvider.getTradeAnnotation === "function"
          ? remoteProvider
              .getTradeAnnotation(symbol)
              .pipe(Effect.mapError(mapMarketInfraError("Failed to get trade annotation")))
          : Effect.fail(
              new DomainError({
                code: "VALIDATION_ERROR",
                message: "Trade annotation is not available in this runtime",
              })
            ),
    });
  });

export const MarketDataServicesLive = Layer.effect(
  MarketDataServices,
  Effect.gen(function* () {
    const repo = yield* MarketDataRepository;
    return yield* makeMarketDataService(repo);
  })
);
