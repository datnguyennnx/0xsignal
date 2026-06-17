/**
 * Chart data point - shared between frontend and backend
 * Used for OHLCV candlestick data
 *
 * NOTE: ChartDataPoint (epoch-based) is purposefully different from Candle (Date-based).
 * Candle = backend domain entity; ChartDataPoint = frontend normalized format.
 */
export interface ChartDataPoint {
  readonly time: number; // Unix timestamp in seconds
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
}
