import { Effect } from "effect";
import { AuthService } from "../application/auth.service";
import type { Session } from "../domain/session";

export const withAuth =
  <E>(handler: (session: Session) => Effect.Effect<Response, E, AuthService>) =>
  (request: Request): Effect.Effect<Response, never, AuthService> =>
    Effect.gen(function* () {
      const authService = yield* AuthService;
      const token =
        request.headers.get("Authorization")?.replace("Bearer ", "") ??
        parseCookie(request.headers.get("cookie") ?? "", "access_token");

      if (!token) {
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
        Effect.catch(() => Effect.succeed({ _tag: "error" as const }))
      );

      if (sessionResult._tag === "suspended") {
        return new Response(JSON.stringify({ error: "Forbidden: Account suspended" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (sessionResult._tag === "error") {
        return new Response(JSON.stringify({ error: "Token invalid or expired" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const session = sessionResult.session;

      return yield* handler(session).pipe(
        Effect.catch(() =>
          Effect.succeed(
            new Response(JSON.stringify({ error: "Internal error" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            })
          )
        )
      );
    });

function parseCookie(cookieHeader: string, name: string): string | undefined {
  return cookieHeader
    .split(";")
    .find((c) => c.trim().startsWith(`${name}=`))
    ?.split("=")[1]
    ?.trim();
}
