/** Streaming Types */

import { Data } from "effect";

// Errors
export class BinanceConnectionError extends Data.TaggedError("BinanceConnectionError")<{
  readonly message: string;
  readonly symbol?: string;
}> {}

export class StreamingError extends Data.TaggedError("StreamingError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

// Kline data
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
  readonly isFinal: boolean;
}

// Subscription info
export interface Subscription {
  readonly symbol: string;
  readonly interval: string;
  readonly clientCount: number;
  readonly lastUpdate: number;
}
