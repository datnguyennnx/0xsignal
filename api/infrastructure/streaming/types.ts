// ============================================================================
// STREAMING TYPES - FUNCTIONAL APPROACH
// ============================================================================
// Type definitions for WebSocket streaming system
// ============================================================================

import { Data } from "effect";

/**
 * Binance kline (candlestick) data
 */
export interface BinanceKline {
  readonly symbol: string;
  readonly interval: string;
  readonly openTime: number;
  readonly closeTime: number;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
  readonly trades: number;
  readonly isClosed: boolean;
}

/**
 * Chart data point for frontend
 */
export interface ChartDataPoint {
  readonly time: number; // Unix timestamp in seconds
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
}

/**
 * WebSocket connection state
 */
export type ConnectionState = "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "ERROR";

/**
 * Subscription info
 */
export interface Subscription {
  readonly symbol: string;
  readonly interval: string;
  readonly clientCount: number;
  readonly lastUpdate: number;
}

/**
 * WebSocket errors
 */
export class BinanceConnectionError extends Data.TaggedError("BinanceConnectionError")<{
  readonly message: string;
  readonly symbol?: string;
}> {}

export class SubscriptionError extends Data.TaggedError("SubscriptionError")<{
  readonly message: string;
  readonly symbol: string;
}> {}

export class ClientDisconnectError extends Data.TaggedError("ClientDisconnectError")<{
  readonly message: string;
  readonly clientId: string;
}> {}
