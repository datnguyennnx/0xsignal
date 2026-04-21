import { Effect, Either } from "effect";
import type { CoverageResult } from "../../schemas/market-data";
import type { CandleQuery } from "./types";
import type { DomainError } from "../errors";
import type { MarketCandleStorePort, MarketRemoteProviderPort } from "./contracts";
import { isCoverageCompleteStrict } from "./policies";

type MapInfraError = (fallbackMessage: string) => (error: unknown) => DomainError;

export const createCoverageRefresh = (candleRepo: MarketCandleStorePort) => {
  return (
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
          if (isCoverageCompleteStrict(coverage) || attempt >= maxAttempts) {
            return Effect.succeed(coverage);
          }

          return Effect.sleep("150 millis").pipe(Effect.flatMap(() => loop(attempt + 1)));
        })
      );

    return loop(1);
  };
};

export const createGapFillWorkflow = (
  candleRepo: MarketCandleStorePort,
  remoteProvider: MarketRemoteProviderPort,
  mapInfraError: MapInfraError
) => {
  return (query: CandleQuery, coverage: CoverageResult, startTime: Date, endTime: Date) =>
    Effect.gen(function* () {
      if (isCoverageCompleteStrict(coverage) || query.exchange.toLowerCase() !== "hyperliquid") {
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
            .pipe(Effect.mapError(mapInfraError("Failed to fetch remote candles")), Effect.either);

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
              Effect.catchAll((error) =>
                Effect.logWarning(
                  `Failed to cache candles: ${error instanceof Error ? error.message : String(error)}`
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

      return yield* candleRepo
        .checkCoverage(query.symbol, query.exchange, query.timeframe, startTime, endTime)
        .pipe(Effect.catchAll(() => Effect.succeed(coverage)));
    });
};
