import { Data } from "effect";
import { TransportError } from "@nktkas/hyperliquid";

export class HyperliquidError extends Data.TaggedError("HyperliquidError")<{
  readonly message: string;
  readonly kind?: "BAD_REQUEST" | "NOT_FOUND" | "UPSTREAM" | "RATE_LIMITED";
  readonly reason?: SymbolResolutionReason | undefined;
  readonly symbol?: string | undefined;
  readonly tried?: ReadonlyArray<string> | undefined;
  readonly dexes?: ReadonlyArray<string> | undefined;
  readonly candidates?: ReadonlyArray<string> | undefined;
  readonly resolved?: string | undefined;
  readonly cause?: unknown;
}> {}

export type SymbolResolutionReason = "NOT_FOUND" | "AMBIGUOUS" | "DELISTED";

export class TickerSnapshotError extends Data.TaggedError("TickerSnapshotError")<{
  readonly message: string;
  readonly kind: "BAD_REQUEST" | "NOT_FOUND";
  readonly reason?: SymbolResolutionReason | undefined;
  readonly symbol?: string | undefined;
  readonly tried?: ReadonlyArray<string> | undefined;
  readonly dexes?: ReadonlyArray<string> | undefined;
  readonly candidates?: ReadonlyArray<string> | undefined;
  readonly resolved?: string | undefined;
}> {}

/**
 * Detect 429 rate-limit errors from raw Promise rejection causes.
 */
const isRateLimitedCause = (cause: unknown): boolean =>
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
  // Preserve an already-classified failure; re-wrapping would downgrade a
  // RATE_LIMITED refusal to a generic UPSTREAM one.
  if (cause instanceof HyperliquidError) return cause;
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
