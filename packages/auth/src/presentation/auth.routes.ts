import { Config, Effect, Match, Option, Schema } from "effect";
import { AuthService } from "../application/auth.service";
import type { OAuthProvider } from "../domain/oauth-account";
import { withAuth } from "./require-auth";
import { AuthMeResponseSchema } from "./auth.schemas";

type AuthMeResponse = Schema.Schema.Type<typeof AuthMeResponseSchema>;

const TokenExchangeSchema = Schema.Struct({
  code: Schema.String,
});

const ProfileUpdateSchema = Schema.Struct({
  displayName: Schema.String,
});

type Route = {
  readonly method: "GET" | "POST";
  readonly path: string;
  readonly handler: (request: Request) => Effect.Effect<Response, never, AuthService>;
};

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

const parseProvider = (url: URL): OAuthProvider | null => {
  const parts = url.pathname.split("/");
  const provider = parts[parts.length - 2];
  if (provider === "google" || provider === "github") return provider;
  return null;
};

const FRONTEND_URL_DEFAULT = "http://localhost:5173";

export const buildAuthRoutes = (): readonly Route[] => [
  {
    method: "GET",
    path: "/api/auth/:provider/login",
    handler: (request) =>
      Effect.gen(function* () {
        const authService = yield* AuthService;
        const url = new URL(request.url);
        const provider = parseProvider(url);
        if (!provider) {
          return json({ error: "Invalid provider" }, 400);
        }
        const result = yield* authService.getAuthorizationUrl({ provider });
        return new Response(null, {
          status: 302,
          headers: { Location: result.url },
        });
      }).pipe(Effect.catch(() => Effect.succeed(json({ error: "Authentication failed" }, 500)))),
  },
  {
    method: "GET",
    path: "/api/auth/:provider/callback",
    handler: (request) =>
      Effect.gen(function* () {
        const authService = yield* AuthService;
        const url = new URL(request.url);
        const provider = parseProvider(url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (!provider || !code || !state) {
          return json({ error: "Missing required parameters" }, 400);
        }

        const result = yield* authService.handleCallback({ provider, code, state });

        const frontendUrl = yield* Config.string("FRONTEND_URL").pipe(
          Effect.catch(() => Effect.succeed(FRONTEND_URL_DEFAULT)),
        );

        const normalizedFrontend = frontendUrl.replace(/\/+$/, "");

        return new Response(null, {
          status: 302,
          headers: {
            Location: `${normalizedFrontend}/auth/callback?code=${encodeURIComponent(result.code)}`,
          },
        });
      }).pipe(
        Effect.catch((error) =>
          Match.value(error).pipe(
            Match.when({ _tag: "OAuthCallbackFailed" }, () =>
              Effect.succeed(json({ error: "OAuth provider error" }, 502)),
            ),
            Match.when({ _tag: "OAuthStateMismatch" }, () =>
              Effect.succeed(json({ error: "State mismatch" }, 400)),
            ),
            Match.when({ _tag: "OAuthStateExpired" }, () =>
              Effect.succeed(json({ error: "State expired" }, 400)),
            ),
            Match.when({ _tag: "UserSuspended" }, () =>
              Effect.succeed(json({ error: "Account suspended" }, 403)),
            ),
            Match.orElse(() => Effect.succeed(json({ error: "Authentication failed" }, 500))),
          ),
        ),
      ),
  },
  {
    method: "POST",
    path: "/api/auth/token",
    handler: (request) =>
      Effect.gen(function* () {
        const authService = yield* AuthService;
        const raw = yield* Effect.tryPromise(() => request.json()).pipe(
          Effect.catch(() => Effect.succeed({} as any)),
        );
        const decoded = Schema.decodeUnknownOption(TokenExchangeSchema)(raw);
        if (Option.isNone(decoded)) {
          return json({ error: "Missing code" }, 400);
        }
        const { code } = decoded.value;
        const tokens = yield* authService.exchangeCode(code);

        const frontendUrl = yield* Config.string("FRONTEND_URL").pipe(
          Effect.catch(() => Effect.succeed(FRONTEND_URL_DEFAULT)),
        );
        const normalizedFrontend = frontendUrl.replace(/\/+$/, "");
        const isDev =
          normalizedFrontend.includes("localhost") || normalizedFrontend.includes("127.0.0.1");
        const secureFlag = isDev ? "" : " Secure;";
        const cookie = `refresh_token=${tokens.refreshToken}; HttpOnly;${secureFlag} SameSite=Strict; Path=/api/auth; Max-Age=2592000`;

        return json(
          {
            accessToken: tokens.accessToken,
            tokenType: "Bearer",
            expiresIn: tokens.expiresIn,
          },
          200,
          { "Set-Cookie": cookie },
        );
      }).pipe(Effect.catch(() => Effect.succeed(json({ error: "Invalid or expired code" }, 400)))),
  },
  {
    method: "POST",
    path: "/api/auth/refresh",
    handler: (request) =>
      Effect.gen(function* () {
        const authService = yield* AuthService;
        const cookieHeader = request.headers.get("cookie") ?? "";
        const refreshToken = parseCookie(cookieHeader, "refresh_token");
        if (!refreshToken) {
          return json({ error: "No refresh token" }, 401);
        }

        const tokens = yield* authService.refreshTokens(refreshToken);

        const frontendUrl = yield* Config.string("FRONTEND_URL").pipe(
          Effect.catch(() => Effect.succeed(FRONTEND_URL_DEFAULT)),
        );
        const normalizedFrontend = frontendUrl.replace(/\/+$/, "");
        const isDev =
          normalizedFrontend.includes("localhost") || normalizedFrontend.includes("127.0.0.1");
        const secureFlag = isDev ? "" : " Secure;";
        const cookie = `refresh_token=${tokens.refreshToken}; HttpOnly;${secureFlag} SameSite=Strict; Path=/api/auth; Max-Age=2592000`;

        return json(
          {
            accessToken: tokens.accessToken,
            tokenType: "Bearer",
            expiresIn: tokens.expiresIn,
          },
          200,
          { "Set-Cookie": cookie },
        );
      }).pipe(
        Effect.catch(() => {
          const cookie = `refresh_token=; HttpOnly; SameSite=Strict; Path=/api/auth; Max-Age=0`;
          return Effect.succeed(json({ error: "Session expired" }, 401, { "Set-Cookie": cookie }));
        }),
      ),
  },
  {
    method: "POST",
    path: "/api/auth/logout",
    handler: (request) =>
      Effect.gen(function* () {
        const authService = yield* AuthService;
        const cookieHeader = request.headers.get("cookie") ?? "";
        const refreshToken = parseCookie(cookieHeader, "refresh_token");
        if (refreshToken) {
          yield* Effect.catch(authService.logout(refreshToken), () => Effect.succeed(undefined));
        }
        const cookie = `refresh_token=; HttpOnly; SameSite=Strict; Path=/api/auth; Max-Age=0`;
        return json({ message: "Logged out" }, 200, { "Set-Cookie": cookie });
      }),
  },
  {
    method: "GET",
    path: "/api/auth/me",
    handler: (request) =>
      withAuth((session) =>
        Effect.gen(function* () {
          const authService = yield* AuthService;
          const profile = yield* authService.getProfile(session.userId);
          const body: AuthMeResponse = {
            userId: session.userId,
            provider: session.provider,
            avatarUrl: profile?.avatarUrl ?? null,
            displayName: profile?.displayName ?? null,
          };
          return json(body);
        }),
      )(request),
  },
  {
    method: "POST",
    path: "/api/auth/me/profile",
    handler: (request) =>
      withAuth((session) =>
        Effect.gen(function* () {
          const authService = yield* AuthService;
          const raw = yield* Effect.tryPromise(() => request.json()).pipe(
            Effect.catch(() => Effect.succeed({} as any)),
          );
          const decoded = Schema.decodeUnknownOption(ProfileUpdateSchema)(raw);
          if (Option.isNone(decoded)) {
            return json({ error: "Display name is required" }, 400);
          }
          const displayName = decoded.value.displayName.trim();
          if (displayName.length > 100) {
            return json({ error: "Display name must be 100 characters or fewer" }, 400);
          }
          const profile = yield* authService.updateProfile(session.userId, { displayName });
          return json({ data: profile });
        }),
      )(request),
  },
];

function parseCookie(cookieHeader: string, name: string): string | undefined {
  return cookieHeader
    .split(";")
    .find((c) => c.trim().startsWith(`${name}=`))
    ?.split("=")[1]
    ?.trim();
}
