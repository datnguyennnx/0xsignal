import { Clock, Effect } from "effect";
import { NotFoundError, ValidationError } from "../../shared/errors";
import type { CoverageResult } from "@0xsignal/shared";
import { MarketCandleStore, MarketDataService, MarketRemoteProvider } from "./index";
import type { RecentCandleQuery } from "./types";
import { alignRangeToTimeframe } from "./range-alignment";
import { getTimeframeMs } from "./timeframe";
import { DEFAULT_RECENT_CANDLES, MAX_RANGE_CANDLES, MAX_RECENT_CANDLES } from "./policies";
import { mapMarketInfraError } from "./error-mapping";

export const makeMarketDataService = () =>
  Effect.gen(function* () {
    const candleRepo = yield* MarketCandleStore;
    const remoteProvider = yield* MarketRemoteProvider;

    return MarketDataService.of({
      getCandles: (query) =>
        Effect.gen(function* () {
          const startedAt = yield* Clock.currentTimeMillis;
          const requestedStartTime = query.startTime ?? new Date(startedAt - 24 * 60 * 60 * 1000);
          const requestedEndTime = query.endTime ?? new Date(startedAt);
          const { startTime, endTime } = alignRangeToTimeframe(
            query.timeframe,
            requestedStartTime,
            requestedEndTime,
          );

          if (startTime.getTime() > endTime.getTime()) {
            return yield* Effect.fail(
              new ValidationError({
                message: "Start time must be before end time",
              }),
            );
          }

          const requestedRangeCount =
            Math.floor(
              (endTime.getTime() - startTime.getTime()) / getTimeframeMs(query.timeframe),
            ) + 1;
          if (requestedRangeCount > MAX_RANGE_CANDLES) {
            return yield* Effect.fail(
              new ValidationError({
                message: `Requested range is too large (${requestedRangeCount} candles). Maximum is ${MAX_RANGE_CANDLES}.`,
              }),
            );
          }

          const candles = yield* candleRepo
            .getCandles({
              ...query,
              startTime,
              endTime,
              disableLimitForRange: Boolean(query.startTime && query.endTime),
            })
            .pipe(Effect.mapError(mapMarketInfraError("Failed to load candles")));

          const coverage: CoverageResult = {
            hasData: candles.length > 0,
            rowCount: candles.length,
            expectedCount: requestedRangeCount,
            fullCoverage: candles.length >= requestedRangeCount,
            missingWindows: [],
          };

          return { candles, provenance: "Candle Store", coverage };
        }),

      getRecentCandles: (query: RecentCandleQuery) =>
        Effect.gen(function* () {
          const startedAt = yield* Clock.currentTimeMillis;
          const exchange = query.exchange ?? "Hyperliquid";
          if (exchange.toLowerCase() !== "hyperliquid") {
            return yield* Effect.fail(
              new ValidationError({
                message: "Recent candle snapshots are currently supported only for Hyperliquid",
              }),
            );
          }

          const requestedLimit = query.limit ?? DEFAULT_RECENT_CANDLES;
          if (!Number.isFinite(requestedLimit) || requestedLimit <= 0) {
            return yield* Effect.fail(
              new ValidationError({
                message: "limit must be a positive integer",
              }),
            );
          }
          if (requestedLimit > MAX_RECENT_CANDLES) {
            return yield* Effect.fail(
              new ValidationError({
                message: `limit is too large (${requestedLimit}). Maximum is ${MAX_RECENT_CANDLES}.`,
              }),
            );
          }

          const endTime = query.endTime ?? new Date(startedAt);
          const expectedCount = Math.trunc(requestedLimit);
          const startTime = new Date(
            endTime.getTime() - expectedCount * getTimeframeMs(query.timeframe),
          );

          const snapshotCandles = yield* candleRepo
            .getCandles({
              symbol: query.symbol,
              exchange,
              timeframe: query.timeframe,
              startTime,
              endTime,
              disableLimitForRange: true,
            })
            .pipe(Effect.mapError(mapMarketInfraError("Failed to load recent candles")));

          const recentCandles = snapshotCandles.slice(-expectedCount);
          const coverage: CoverageResult = {
            hasData: recentCandles.length > 0,
            rowCount: recentCandles.length,
            expectedCount,
            fullCoverage: recentCandles.length === expectedCount,
            missingWindows: [],
          };

          const provenance = coverage.fullCoverage
            ? "Hyperliquid Snapshot (Recent via Backend)"
            : coverage.hasData
              ? `Hyperliquid Snapshot (Recent Partial: ${coverage.rowCount}/${coverage.expectedCount} rows)`
              : "No recent data available";

          return {
            candles: recentCandles,
            provenance,
            coverage,
          };
        }),

      discoverMarkets: () =>
        remoteProvider
          .getAggregatedMarkets()
          .pipe(Effect.mapError(mapMarketInfraError("Failed to discover markets"))),

      getTicker: (symbol) =>
        typeof remoteProvider.getTicker === "function"
          ? remoteProvider
              .getTicker(symbol)
              .pipe(Effect.mapError(mapMarketInfraError("Failed to get ticker")))
          : Effect.fail(
              new NotFoundError({
                message: "Ticker is not available in this runtime",
              }),
            ),

      getOrderBook: (symbol, depth) =>
        typeof remoteProvider.getOrderBook === "function"
          ? remoteProvider
              .getOrderBook(symbol, depth)
              .pipe(Effect.mapError(mapMarketInfraError("Failed to get orderbook")))
          : Effect.fail(
              new NotFoundError({
                message: "Orderbook is not available in this runtime",
              }),
            ),

      getTradeAnnotation: (symbol) =>
        typeof remoteProvider.getTradeAnnotation === "function"
          ? remoteProvider
              .getTradeAnnotation(symbol)
              .pipe(Effect.mapError(mapMarketInfraError("Failed to get trade annotation")))
          : Effect.fail(
              new NotFoundError({
                message: "Trade annotation is not available in this runtime",
              }),
            ),
    });
  });
