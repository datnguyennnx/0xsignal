import { Data } from "effect";

/**
 * Exchange-domain failures. The classifier in
 * `application/exchange/error-classification.ts` picks among them as a set, and
 * the HTTP layer maps each to its own status: internal -> 502, validation and
 * insufficient margin -> 400.
 */
export class HyperliquidInternalError extends Data.TaggedError("HyperliquidInternalError")<{
  readonly message: string;
  readonly cause?: unknown;
  readonly symbol?: string;
  readonly endpoint?: string;
  readonly input?: unknown;
}> {}

export class HyperliquidValidationError extends Data.TaggedError("HyperliquidValidationError")<{
  readonly message: string;
  readonly cause?: unknown;
  readonly symbol?: string;
  readonly input?: unknown;
}> {}

export class InsufficientMarginError extends Data.TaggedError("InsufficientMarginError")<{
  readonly message: string;
  readonly symbol?: string;
  readonly required?: string;
  readonly available?: string;
}> {}
