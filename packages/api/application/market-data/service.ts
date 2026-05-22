import { Clock, Effect, Layer } from "effect";
import { DomainError } from "../errors";
import type { CoverageResult } from "@0xsignal/shared";
import { MarketCandleStore, MarketDataService, MarketRemoteProvider } from "./contracts";
import type { RecentCandleQuery } from "./types";
import { alignRangeToTimeframe } from "./range-alignment";
import { getTimeframeMs } from "../../domain/market-data/timeframe";
import {
  DEFAULT_RECENT_CANDLES,
  MAX_RANGE_CANDLES,
  MAX_RECENT_CANDLES,
  normalizeCandles,
} from "./policies";
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

          const candles = yield* candleRepo
            .getCandles({
              ...query,
              startTime,
              endTime,
              disableLimitForRange: Boolean(query.startTime && query.endTime),
            })
            .pipe(Effect.mapError(mapMarketInfraError("Failed to load candles")));

          const normalizedCandles = normalizeCandles(candles);

          const coverage: CoverageResult = {
            hasData: normalizedCandles.length > 0,
            rowCount: normalizedCandles.length,
            expectedCount: requestedRangeCount,
            fullCoverage: normalizedCandles.length >= requestedRangeCount,
            missingWindows: [],
          };

          return { candles: normalizedCandles, provenance: "QuestDB", coverage };
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

          const normalizedCandles = normalizeCandles(snapshotCandles).slice(-expectedCount);
          const coverage: CoverageResult = {
            hasData: normalizedCandles.length > 0,
            rowCount: normalizedCandles.length,
            expectedCount,
            fullCoverage: normalizedCandles.length === expectedCount,
            missingWindows: [],
          };

          const provenance = coverage.fullCoverage
            ? "Hyperliquid Snapshot (Recent via Backend)"
            : coverage.hasData
              ? `Hyperliquid Snapshot (Recent Partial: ${coverage.rowCount}/${coverage.expectedCount} rows)`
              : "No recent data available";

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

      getTicker: (symbol) =>
        typeof remoteProvider.getTicker === "function"
          ? remoteProvider
              .getTicker(symbol)
              .pipe(Effect.mapError(mapMarketInfraError("Failed to get ticker")))
          : Effect.fail(
              new DomainError({
                code: "NOT_FOUND",
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
                code: "NOT_FOUND",
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
                code: "NOT_FOUND",
                message: "Trade annotation is not available in this runtime",
              })
            ),
    });
  });

export const marketDataServiceLayer = Layer.effect(
  MarketDataService,
  Effect.gen(function* () {
    return yield* makeMarketDataService();
  })
);
