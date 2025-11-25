import { Data } from "effect";

// Re-export chart types from shared package
export type { ChartDataPoint, BinanceKline, Subscription } from "@0xsignal/shared";

// Streaming-specific error types
export class BinanceConnectionError extends Data.TaggedError("BinanceConnectionError")<{
  readonly message: string;
  readonly symbol?: string;
}> {}

export class StreamingError extends Data.TaggedError("StreamingError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}
