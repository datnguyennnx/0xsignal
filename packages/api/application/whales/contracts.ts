import { Context, Data, type Effect } from "effect";
import type { WhalePosition, WhalePositionsQuery } from "@0xsignal/shared";

export class WhaleServiceError extends Data.TaggedError("WhaleServiceError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export interface WhaleServicePort {
  readonly discoverAndRefreshPositions: () => Effect.Effect<void, WhaleServiceError>;
  readonly queryPositions: (q: WhalePositionsQuery) => Effect.Effect<
    {
      readonly positions: readonly WhalePosition[];
      readonly nextCursor?: string | null;
    },
    WhaleServiceError
  >;
}

export class WhaleService extends Context.Service<WhaleService, WhaleServicePort>()(
  "WhaleService",
) {}
