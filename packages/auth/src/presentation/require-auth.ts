import { Cause, Effect, Match, Option } from "effect";
import { AuthService } from "../application/auth.service";
import type { Session } from "../domain/session";

const isPresent = (value: string | undefined): value is string =>
  value !== undefined && value !== "";

type StatusError = {
  readonly status: number;
  readonly message?: string | undefined;
  readonly code?: string | undefined;
};

const isStatusError = (error: unknown): error is StatusError =>
  typeof error === "object" &&
  error !== null &&
  "status" in error &&
  typeof error.status === "number";

const internalErrorResponse = (): Response =>
  new Response(JSON.stringify({ error: "Internal error" }), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });

const toErrorResponse = (error: unknown): Response => {
  if (!isStatusError(error)) return internalErrorResponse();
  const body: Record<string, unknown> = { error: error.message ?? "Internal error" };
  if (error.code !== undefined && error.code !== "") {
    body.code = error.code;
  }
  return new Response(JSON.stringify(body), {
    status: error.status,
    headers: { "Content-Type": "application/json" },
  });
};

const toFailureResponse = (cause: Cause.Cause<unknown>): Response => {
  if (Cause.hasDies(cause) || Cause.hasInterrupts(cause)) return internalErrorResponse();
  const failure = Cause.findErrorOption(cause);
  return Option.isSome(failure) ? toErrorResponse(failure.value) : internalErrorResponse();
};

export const withAuth =
  <E>(handler: (session: Session) => Effect.Effect<Response, E, AuthService>) =>
  (request: Request): Effect.Effect<Response, never, AuthService> =>
    Effect.gen(function* () {
      const authService = yield* AuthService;
      const authorizationHeader = request.headers.get("Authorization");
      const bearerToken = authorizationHeader?.replace(/^Bearer\s+/, "");
      const cookieToken = request.headers.get("cookie")?.match(/access_token=([^;]+)/)?.[1];
      const token = isPresent(bearerToken) ? bearerToken : cookieToken;

      if (!isPresent(token)) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const sessionResult = yield* authService.verifyToken(token).pipe(
        Effect.map((session) => ({ _tag: "ok" as const, session })),
        Effect.catchTags({
          UserSuspended: (err) =>
            Effect.succeed({ _tag: "suspended" as const, userId: err.userId }),
        }),
        Effect.catch(() => Effect.succeed({ _tag: "error" as const })),
      );

      return yield* Match.value(sessionResult).pipe(
        Match.when({ _tag: "suspended" }, () =>
          Effect.succeed(
            new Response(JSON.stringify({ error: "Forbidden: Account suspended" }), {
              status: 403,
              headers: { "Content-Type": "application/json" },
            }),
          ),
        ),
        Match.when({ _tag: "error" }, () =>
          Effect.succeed(
            new Response(JSON.stringify({ error: "Token invalid or expired" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            }),
          ),
        ),
        Match.orElse((s) =>
          handler(s.session).pipe(
            Effect.catchCause((cause) => Effect.succeed(toFailureResponse(cause))),
          ),
        ),
      );
    });
