import { query } from "../db/postgres/client";
import type { CandlestickRequest, DatasetSnapshot } from "../../schemas/market-data";

export interface MarketDataRepository {
  insertCandlestickRequest(request: CandlestickRequest): Promise<CandlestickRequest>;
  getCandlestickRequest(id: string): Promise<CandlestickRequest | null>;
  insertDatasetSnapshot(snapshot: DatasetSnapshot): Promise<DatasetSnapshot>;
  getDatasetSnapshot(id: string): Promise<DatasetSnapshot | null>;
}

export const postgresMarketDataRepository: MarketDataRepository = {
  async insertCandlestickRequest(request: CandlestickRequest): Promise<CandlestickRequest> {
    const sql = `
      INSERT INTO candlestick_requests (id, session_id, symbol, exchange, base_timeframe, start_time, end_time, adjustments, requested_by_action_id, trace_id, span_id, correlation_id, request_id, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;
    const result = await query(sql, [
      request.id,
      request.session_id,
      request.symbol,
      request.exchange,
      request.base_timeframe,
      request.start_time,
      request.end_time,
      request.adjustments ? JSON.stringify(request.adjustments) : null,
      request.requested_by_action_id,
      request.trace_id,
      request.span_id,
      request.correlation_id,
      request.request_id,
      request.created_at,
    ]);
    return result.rows[0] as CandlestickRequest;
  },

  async getCandlestickRequest(id: string): Promise<CandlestickRequest | null> {
    const sql = `SELECT * FROM candlestick_requests WHERE id = $1`;
    const result = await query(sql, [id]);
    return result.rows[0] as CandlestickRequest | null;
  },

  async insertDatasetSnapshot(snapshot: DatasetSnapshot): Promise<DatasetSnapshot> {
    const sql = `
      INSERT INTO dataset_snapshots (id, request_id, symbol, exchange, timeframe, start_time, end_time, query_fingerprint, row_count, checksum, source_series, trace_id, span_id, correlation_id, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `;
    const result = await query(sql, [
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

  async getDatasetSnapshot(id: string): Promise<DatasetSnapshot | null> {
    const sql = `SELECT * FROM dataset_snapshots WHERE id = $1`;
    const result = await query(sql, [id]);
    return result.rows[0] as DatasetSnapshot | null;
  },
};
