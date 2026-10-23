/**
 * Maximum candles returned in a single range query.
 * 10,000 candles at ~100 bytes each = ~1MB response body.
 * For larger ranges, clients should paginate using start_time/end_time.
 * NOTE: Current implementation buffers the full response in memory before sending.
 * For production with >10K candles, implement Transfer-Encoding chunked
 * or cursor-based pagination to avoid OOM under concurrent requests.
 */
export const MAX_RANGE_CANDLES = 10_000;
export const MAX_RECENT_CANDLES = 5000;
export const DEFAULT_RECENT_CANDLES = 300;
