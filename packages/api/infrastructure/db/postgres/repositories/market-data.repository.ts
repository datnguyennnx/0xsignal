import { Effect, Layer } from "effect";
import { PostgresConnectionPool } from "../client";
import type { CandlestickRequest, DatasetSnapshot } from "../../../../schemas/market-data";
import { MarketDataRepository } from "../../../../application/ports/market-data-repository";
import { DomainError } from "../../../../application/errors";

const dbError = (method: string, cause: unknown) =>
  new DomainError({
    code: "INTERNAL_ERROR",
    message: `Database error in MarketDataRepository.${method}`,
    cause,
  });

export const MarketDataRepositoryLive = Layer.effect(
  MarketDataRepository,
  Effect.gen(function* () {
    const pool = yield* PostgresConnectionPool;

    return {
      insertCandlestickRequest: (request: CandlestickRequest) =>
        Effect.tryPromise({
          try: async () => {
            const sql = `
        INSERT INTO candlestick_requests (id, session_id, symbol, exchange, base_timeframe, start_time, end_time, adjustments, requested_by_action_id, requested_by_interaction_id, trace_id, span_id, correlation_id, request_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *
      `;
            const result = await pool.query(sql, [
              request.id,
              request.session_id,
              request.symbol,
              request.exchange,
              request.base_timeframe,
              request.start_time,
              request.end_time,
              request.adjustments ? JSON.stringify(request.adjustments) : null,
              request.requested_by_action_id,
              request.requested_by_interaction_id,
              request.trace_id,
              request.span_id,
              request.correlation_id,
              request.request_id,
              request.created_at,
            ]);
            return result.rows[0] as CandlestickRequest;
          },
          catch: (e) => dbError("insertCandlestickRequest", e),
        }),

      insertDatasetSnapshot: (snapshot: DatasetSnapshot) =>
        Effect.tryPromise({
          try: async () => {
            const sql = `
        INSERT INTO dataset_snapshots (id, request_id, symbol, exchange, timeframe, start_time, end_time, query_fingerprint, row_count, checksum, source_series, trace_id, span_id, correlation_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *
      `;
            const result = await pool.query(sql, [
              snapshot.id,
              snapshot.request_id,
              snapshot.symbol,
              snapshot.exchange,
              snapshot.timeframe,
              snapshot.start_time,
              snapshot.end_time,
              snapshot.query_fingerprint,
              snapshot.row_count,
              snapshot.checksum,
              snapshot.source_series ? JSON.stringify(snapshot.source_series) : null,
              snapshot.trace_id,
              snapshot.span_id,
              snapshot.correlation_id,
              snapshot.created_at,
            ]);
            return result.rows[0] as DatasetSnapshot;
          },
          catch: (e) => dbError("insertDatasetSnapshot", e),
        }),

      getDatasetSnapshot: (id: string) =>
        Effect.tryPromise({
          try: async () => {
            const sql = `SELECT * FROM dataset_snapshots WHERE id = $1`;
            const result = await pool.query(sql, [id]);
            return result.rows[0] as DatasetSnapshot | null;
          },
          catch: (e) => dbError("getDatasetSnapshot", e),
        }),
    };
  })
);
