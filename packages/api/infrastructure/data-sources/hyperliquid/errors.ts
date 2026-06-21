import { Data } from "effect";
import { TransportError } from "@nktkas/hyperliquid";

export class HyperliquidError extends Data.TaggedError("HyperliquidError")<{
  readonly message: string;
  readonly kind?: "BAD_REQUEST" | "NOT_FOUND" | "UPSTREAM" | "RATE_LIMITED";
  readonly cause?: unknown;
}> {}

/**
 * Detect 429 rate-limit errors from raw Promise rejection causes.
 */
export const isRateLimitedCause = (cause: unknown): boolean =>
  (cause !== null &&
    cause !== undefined &&
    typeof cause === "object" &&
    "status" in cause &&
    (cause as Record<string, unknown>).status === 429) ||
  (cause instanceof Error && cause.message.includes("429"));

/**
 * Wrap a message + raw cause into a HyperliquidError with the correct kind.
 * Handles SDK v0.33.0 TransportError, ApiRequestError, and HTTP 429.
 * Import ApiRequestError from @nktkas/hyperliquid if needed in callers.
 */
export const toHyperliquidError = (message: string, cause: unknown): HyperliquidError => {
  if (cause instanceof TransportError) {
    return new HyperliquidError({
      message: `${message}: ${cause.message}`,
      kind: isRateLimitedCause(cause) ? "RATE_LIMITED" : "UPSTREAM",
      cause,
    });
  }
  return new HyperliquidError({
    message,
    kind: isRateLimitedCause(cause) ? "RATE_LIMITED" : "UPSTREAM",
    cause,
  });
};
