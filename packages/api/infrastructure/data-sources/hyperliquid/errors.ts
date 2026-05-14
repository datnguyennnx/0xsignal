import { Data } from "effect";

export class HyperliquidError extends Data.TaggedError("HyperliquidError")<{
  readonly message: string;
  readonly kind?: "BAD_REQUEST" | "NOT_FOUND" | "UPSTREAM" | "RATE_LIMITED";
  readonly cause?: unknown;
}> {}

/**
 * Detect 429 rate-limit errors from raw Promise rejection causes.
 * Handles both HTTP Response-like objects (with `.status`) and Error instances.
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
 * Maps HTTP 429 to "RATE_LIMITED", everything else to "UPSTREAM".
 */
export const toHyperliquidError = (message: string, cause: unknown): HyperliquidError =>
  new HyperliquidError({
    message,
    kind: isRateLimitedCause(cause) ? "RATE_LIMITED" : "UPSTREAM",
    cause,
  });
