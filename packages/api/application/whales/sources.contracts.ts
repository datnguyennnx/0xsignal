import { Context, type Effect, type Stream } from "effect";
import type { WhaleLeaderboardRow, WhalePosition, WhaleTrade } from "@0xsignal/shared";

/** The minimum an upstream failure must expose: the application only logs it. */
interface WhaleSourceFailure {
  readonly message: string;
}

interface WhaleTradeStreamPort {
  readonly trades: () => Stream.Stream<WhaleTrade, WhaleSourceFailure>;
}

interface WhalePositionPollerPort {
  readonly pollPositions: (addresses: string[]) => Effect.Effect<
    {
      readonly positions: readonly WhalePosition[];
      /** Addresses fetched successfully; a wallet that failed is absent. */
      readonly succeededAddresses: readonly string[];
    },
    WhaleSourceFailure
  >;
}

interface WhaleLeaderboardPort {
  readonly fetchLeaderboard: () => Effect.Effect<
    readonly WhaleLeaderboardRow[],
    WhaleSourceFailure
  >;
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
