import { Cause, Effect } from "effect";
import type { RouteEnvironment } from "./contracts";

const internalErrorResponse = (): Response =>
  new Response(JSON.stringify({ error: "Internal server error" }), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });

// Typed failures keep their own status via the router; only defects and
// interruptions are indistinguishable from a crash and become 500s here.
export const withDefectGuard = <E, R>(
  effect: Effect.Effect<Response, E, R>,
): Effect.Effect<Response, E, R> =>
  effect.pipe(
    Effect.catchCause((cause) =>
      Cause.hasDies(cause) || Cause.hasInterrupts(cause)
        ? Effect.succeed(internalErrorResponse())
        : Effect.failCause(cause),
    ),
  );

// Auth routes handle their own errors internally; always returns a Response.
export const adaptAuthRoute =
  (
    handler: (request: Request) => Effect.Effect<Response, never, RouteEnvironment>,
  ): ((request: Request, url: URL) => Effect.Effect<Response, never, RouteEnvironment>) =>
  (request) =>
    withDefectGuard(handler(request));
