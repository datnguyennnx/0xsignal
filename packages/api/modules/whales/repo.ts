import { Context, Data, type Effect } from "effect";
import type { WhalePosition, WhalePositionsQuery } from "@0xsignal/shared";

export class WhaleRepoError extends Data.TaggedError("WhaleRepoError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export interface WhalePositionKey {
  readonly userAddress: string;
  readonly coin: string;
}

export interface WhalePositionsPage {
  readonly positions: readonly WhalePosition[];
  readonly nextCursor?: string | null;
}

export interface WhaleRepoPort {
  readonly upsertPositions: (
    positions: readonly WhalePosition[],
  ) => Effect.Effect<number, WhaleRepoError>;

  readonly deleteClosedPositions: (
    keys: readonly WhalePositionKey[],
  ) => Effect.Effect<number, WhaleRepoError>;

  readonly queryPositions: (
    q: WhalePositionsQuery,
  ) => Effect.Effect<WhalePositionsPage, WhaleRepoError>;

  readonly deletePositionsForAddresses: (
    addresses: readonly string[],
  ) => Effect.Effect<number, WhaleRepoError>;

  readonly pruneStalePositions: (before: Date) => Effect.Effect<number, WhaleRepoError>;
}

export class WhaleRepo extends Context.Service<WhaleRepo, WhaleRepoPort>()("WhaleRepo") {}
