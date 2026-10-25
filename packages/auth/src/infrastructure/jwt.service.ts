import { Clock, Config, Context, Effect, Layer, Option } from "effect";
import { SignJWT, jwtVerify } from "jose";
import type { JWTPayload } from "jose";
import { PostgresConnectionPool } from "./db/postgres";
import type { JwtPayload, AuthTokens } from "../domain/session";
import { TokenExpired, TokenInvalid } from "../domain/errors";
import { makeUserId } from "../domain/user";
import type { UserId } from "../domain/user";
import type { OAuthProvider } from "../domain/oauth-account";

type TokenType = "access" | "refresh";

interface TokenClaims {
  readonly sub: UserId;
  readonly provider: OAuthProvider;
  readonly jti: string;
  readonly type: TokenType;
}

const signToken = (key: Uint8Array, claims: TokenClaims, ttl: string, issuedAt: number) =>
  new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(issuedAt)
    .setExpirationTime(ttl)
    .sign(key);

const isExpiredError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { readonly code?: unknown }).code === "ERR_JWT_EXPIRED";

const isOAuthProvider = (value: unknown): value is OAuthProvider =>
  value === "google" || value === "github";

/**
 * Narrows a verified JWT payload into the claims this package issues, or null when a
 * required claim is absent or of the wrong type.
 */
const toJwtPayload = (payload: JWTPayload): JwtPayload | null => {
  const { sub, jti, iat, exp, provider } = payload;
  if (
    typeof sub !== "string" ||
    typeof jti !== "string" ||
    typeof iat !== "number" ||
    typeof exp !== "number" ||
    !isOAuthProvider(provider)
  ) {
    return null;
  }
  return { sub: makeUserId(sub), provider, jti, iat, exp };
};

export interface JwtServicePort {
  readonly sign: (payload: { sub: UserId; provider: OAuthProvider }) => Effect.Effect<AuthTokens>;
  readonly verify: (
    token: string,
    expectedType: "access" | "refresh",
  ) => Effect.Effect<JwtPayload, TokenExpired | TokenInvalid>;
  readonly revoke: (jti: string, expiresAt: Date) => Effect.Effect<void>;
  readonly isRevoked: (jti: string) => Effect.Effect<boolean>;
}

export class JwtService extends Context.Service<JwtService, JwtServicePort>()("JwtService") {}

export const JwtServiceLayer: Layer.Layer<JwtService, never, PostgresConnectionPool> = Layer.effect(
  JwtService,
  Effect.gen(function* () {
    const maybeSecret = yield* Config.option(Config.String("JWT_SECRET")).pipe(Effect.orDie);

    if (Option.isNone(maybeSecret)) {
      yield* Effect.logWarning(
        "JWT_SECRET not set — JWT service disabled. Auth endpoints will return 500.",
      );
      return JwtService.of({
        sign: () => Effect.die(new Error("JWT_SECRET not configured")),
        verify: () => Effect.die(new Error("JWT_SECRET not configured")),
        revoke: () => Effect.die(new Error("JWT_SECRET not configured")),
        isRevoked: () => Effect.die(new Error("JWT_SECRET not configured")),
      });
    }

    const secret = maybeSecret.value;
    const key = new TextEncoder().encode(secret);
    const pg = yield* PostgresConnectionPool;

    const signTokens = ({
      sub,
      provider,
    }: {
      readonly sub: UserId;
      readonly provider: OAuthProvider;
    }): Effect.Effect<AuthTokens> =>
      Effect.gen(function* () {
        const nowMillis = yield* Clock.currentTimeMillis;
        const now = Math.floor(nowMillis / 1000);
        const [accessToken, refreshToken] = yield* Effect.all([
          Effect.tryPromise(() =>
            signToken(key, { sub, provider, jti: crypto.randomUUID(), type: "access" }, "15m", now),
          ).pipe(Effect.orDie),
          Effect.tryPromise(() =>
            signToken(
              key,
              { sub, provider, jti: crypto.randomUUID(), type: "refresh" },
              "30d",
              now,
            ),
          ).pipe(Effect.orDie),
        ]);
        return { accessToken, refreshToken, tokenType: "Bearer" as const, expiresIn: 15 * 60 };
      });

    const verifyToken = (
      token: string,
      expectedType: TokenType,
    ): Effect.Effect<JwtPayload, TokenExpired | TokenInvalid> =>
      Effect.tryPromise({
        try: async (): Promise<JwtPayload> => {
          const { payload } = await jwtVerify(token, key);
          if (payload.type !== expectedType) {
            throw new Error("Invalid token type");
          }
          const claims = toJwtPayload(payload);
          if (claims === null) {
            throw new Error("Invalid token claims");
          }
          return claims;
        },
        catch: (error: unknown) =>
          isExpiredError(error) ? new TokenExpired() : new TokenInvalid(),
      });

    if (pg === null) {
      yield* Effect.logWarning(
        "Postgres not available — JWT service disabled (no token revocation)",
      );
      return JwtService.of({
        sign: signTokens,
        verify: verifyToken,
        revoke: () => Effect.void,
        isRevoked: () => Effect.succeed(false),
      });
    }

    return JwtService.of({
      sign: signTokens,
      verify: verifyToken,
      revoke: (jti: string, expiresAt: Date) =>
        Effect.tryPromise(() =>
          pg.query(
            "INSERT INTO refresh_token_blocklist (jti, expires_at) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            [jti, expiresAt],
          ),
        ).pipe(Effect.orDie),
      isRevoked: (jti: string) =>
        Effect.tryPromise(async () => {
          const result = await pg.query(
            "SELECT 1 FROM refresh_token_blocklist WHERE jti = $1 AND expires_at > NOW()",
            [jti],
          );
          return result.rows.length > 0;
        }).pipe(Effect.orDie),
    });
  }),
);
