import { Data } from "effect";

/**
 * Tagged error emitted when the SDK rejects an order payload as invalid
 * (valibot validation failure, bad structure, unsupported values).
 *
 * Maps to HTTP 400 Bad Request.
 */
export class HyperliquidValidationError extends Data.TaggedError("HyperliquidValidationError")<{
  readonly message: string;
  readonly cause?: unknown;
  readonly symbol?: string;
  readonly input?: unknown;
}> {}

/**
 * Tagged error emitted when the exchange API explicitly rejects the order
 * because the account does not have enough margin to cover the position.
 *
 * Maps to HTTP 400 Bad Request.
 */
export class InsufficientMarginError extends Data.TaggedError("InsufficientMarginError")<{
  readonly message: string;
  readonly symbol?: string;
  readonly required?: string;
  readonly available?: string;
}> {}

/**
 * Tagged error emitted for unexpected SDK/transport failures that cannot be
 * classified as user-actionable errors (network timeouts, unknown errors).
 *
 * Maps to HTTP 502 Bad Gateway.
 */
export class HyperliquidInternalError extends Data.TaggedError("HyperliquidInternalError")<{
  readonly message: string;
  readonly cause?: unknown;
  readonly symbol?: string;
  readonly endpoint?: string;
  readonly input?: unknown;
}> {}
