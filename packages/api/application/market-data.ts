import { Effect } from "effect";
import { validationError, notFoundError, DomainError } from "./errors";
import type { CandlestickRequest, DatasetSnapshot } from "../schemas/market-data";
import type { MarketDataRepository } from "../infrastructure/repositories/market-data-repo";

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

export interface MarketDataServices {
  requestCandlesticks(
    input: RequestCandlesticksInput
  ): Effect.Effect<CandlestickRequest, DomainError, never>;
  createDatasetSnapshot(
    input: CreateDatasetSnapshotInput
  ): Effect.Effect<DatasetSnapshot, DomainError, never>;
  getDatasetSnapshot(id: string): Effect.Effect<DatasetSnapshot, DomainError, never>;
}

export const makeMarketDataService = (repo: MarketDataRepository): MarketDataServices => ({
  requestCandlesticks: (
    input: RequestCandlesticksInput
  ): Effect.Effect<CandlestickRequest, DomainError, never> =>
    Effect.tryPromise({
      try: () =>
        repo.insertCandlestickRequest({
          id: input.id,
          session_id: input.session_id,
          symbol: input.symbol,
          exchange: input.exchange,
          base_timeframe: input.base_timeframe,
          start_time: input.start_time,
          end_time: input.end_time,
          adjustments: input.adjustments,
          requested_by_action_id: input.requested_by_action_id,
          trace_id: input.trace_id,
          span_id: input.span_id,
          correlation_id: input.correlation_id,
          created_at: new Date().toISOString(),
        }),
      catch: (e) => validationError("Failed to request candlesticks", e),
    }),

  createDatasetSnapshot: (
    input: CreateDatasetSnapshotInput
  ): Effect.Effect<DatasetSnapshot, DomainError, never> =>
    Effect.tryPromise({
      try: () =>
        repo.insertDatasetSnapshot({
          id: input.id,
          request_id: input.request_id,
          symbol: input.symbol,
          exchange: input.exchange,
          timeframe: input.timeframe,
          start_time: input.start_time,
          end_time: input.end_time,
          query_fingerprint: input.query_fingerprint,
          row_count: input.row_count,
          checksum: input.checksum,
          source_series: input.source_series,
          trace_id: input.trace_id,
          span_id: input.span_id,
          correlation_id: input.correlation_id,
          created_at: new Date().toISOString(),
        }),
      catch: (e) => validationError("Failed to create dataset snapshot", e),
    }),

  getDatasetSnapshot: (id: string): Effect.Effect<DatasetSnapshot, DomainError, never> =>
    Effect.gen(function* () {
      const snapshot = yield* Effect.tryPromise({
        try: () => repo.getDatasetSnapshot(id),
        catch: (e) => validationError("Failed to get dataset snapshot", e),
      });
      if (!snapshot) {
        return yield* Effect.fail(notFoundError(`Dataset snapshot ${id} not found`));
      }
      return snapshot;
    }),
});
