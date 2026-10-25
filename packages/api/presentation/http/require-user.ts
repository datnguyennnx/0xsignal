import { Effect } from "effect";

// withAuth already rejects unauthenticated requests, so a missing id here is a
// wiring defect rather than a client error.
export const requireUserId = (userId: string | undefined): Effect.Effect<string> =>
  userId === undefined || userId === ""
    ? Effect.die(new Error("route invoked without an authenticated session"))
    : Effect.succeed(userId);
