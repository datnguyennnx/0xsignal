import { Context, Data, type Effect, type Stream } from "effect";
import type { WhaleLeaderboardRow, WhalePosition, WhaleTrade } from "@0xsignal/shared";

export type WhaleSourceKind = "trade-stream" | "position-poller" | "leaderboard";

/** An upstream whale source failed for a reason other than rate limiting. */
export class WhaleSourceUnavailableError extends Data.TaggedError("WhaleSourceUnavailableError")<{
  readonly message: string;
  readonly source: WhaleSourceKind;
  readonly cause?: unknown;
}> {}

/** An upstream whale source refused the call because its rate budget is spent. */
export class WhaleSourceRateLimitedError extends Data.TaggedError("WhaleSourceRateLimitedError")<{
  readonly message: string;
  readonly source: WhaleSourceKind;
  readonly cause?: unknown;
}> {}

export type WhaleSourceError = WhaleSourceUnavailableError | WhaleSourceRateLimitedError;

interface WhaleTradeStreamPort {
  readonly trades: () => Stream.Stream<WhaleTrade, WhaleSourceError>;
}

interface WhalePositionPollerPort {
  readonly pollPositions: (addresses: string[]) => Effect.Effect<
    {
      readonly positions: readonly WhalePosition[];
      /** Addresses fetched successfully; a wallet that failed is absent. */
      readonly succeededAddresses: readonly string[];
    },
    WhaleSourceError
  >;
}

interface WhaleLeaderboardPort {
  readonly fetchLeaderboard: () => Effect.Effect<readonly WhaleLeaderboardRow[], WhaleSourceError>;
}

/** Every upstream a whale ingest pass can read from. */
export type WhaleSourceProvider =
  | {
      readonly kind: "trade-stream";
      readonly stream: WhaleTradeStreamPort;
    }
  | {
      readonly kind: "position-poller";
      readonly poller: WhalePositionPollerPort;
    }
  | {
      readonly kind: "leaderboard";
      readonly leaderboard: WhaleLeaderboardPort;
    };

export class WhaleSources extends Context.Service<WhaleSources, readonly WhaleSourceProvider[]>()(
  "WhaleSources",
) {}
