/**
 * Hyperliquid's own `candleSnapshot` ceiling: one request may ask for at most
 * 5000 candles, and a larger range can never be served upstream. Rejecting here
 * also bounds the response body (~500KB) and the weight one request can spend.
 */
export const MAX_RANGE_CANDLES = 5000;
export const MAX_RECENT_CANDLES = 5000;
export const DEFAULT_RECENT_CANDLES = 300;
