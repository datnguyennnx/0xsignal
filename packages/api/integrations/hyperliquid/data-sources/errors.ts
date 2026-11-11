import { Data } from "effect";
import { HttpError, TransportError, ValidationError } from "@0xsignal/sdk-hyperliquid";

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
  (cause instanceof HttpError && cause.status === 429) ||
  (cause !== null &&
    cause !== undefined &&
    typeof cause === "object" &&
    "status" in cause &&
    (cause as Record<string, unknown>).status === 429) ||
  (cause instanceof Error && cause.message.includes("429"));

const classifyKind = (cause: unknown): "RATE_LIMITED" | "UPSTREAM" =>
  isRateLimitedCause(cause) ? "RATE_LIMITED" : "UPSTREAM";

const isSdkFailure = (cause: unknown): cause is TransportError | HttpError | ValidationError =>
  cause instanceof TransportError || cause instanceof HttpError || cause instanceof ValidationError;

/**
 * Wrap a message + raw cause into a HyperliquidError with the correct kind.
 * Handles SDK TransportError, HttpError, and ValidationError.
 */
export const toHyperliquidError = (message: string, cause: unknown): HyperliquidError => {
  // Preserve an already-classified failure; re-wrapping would downgrade a
  // RATE_LIMITED refusal to a generic UPSTREAM one.
  if (cause instanceof HyperliquidError) return cause;
  if (isSdkFailure(cause)) {
    return new HyperliquidError({
      message: `${message}: ${cause.message}`,
      kind: classifyKind(cause),
      cause,
    });
  }
  return new HyperliquidError({
    message,
    kind: classifyKind(cause),
    cause,
  });
};
