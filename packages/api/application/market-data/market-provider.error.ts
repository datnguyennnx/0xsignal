import { Data } from "effect";

export class MarketProviderError extends Data.TaggedError("MarketProviderError")<{
  readonly kind: "NOT_FOUND" | "UPSTREAM" | "RATE_LIMITED" | "BAD_REQUEST" | "INTERNAL";
  readonly message: string;
  readonly cause?: unknown;
}> {}
