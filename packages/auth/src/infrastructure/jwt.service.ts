import { Clock, Config, Context, Effect, Layer, Option } from "effect";
import { SignJWT, jwtVerify } from "jose";
import { PostgresConnectionPool } from "@0xsignal/shared/db/postgres";
import type { JwtPayload, AuthTokens } from "../domain/session";
import { TokenExpired, TokenInvalid } from "../domain/errors";
import type { UserId } from "../domain/user";
import type { OAuthProvider } from "../domain/oauth-account";

export interface JwtServicePort {
  readonly sign: (payload: { sub: UserId; provider: OAuthProvider }) => Effect.Effect<AuthTokens>;
  readonly verify: (
    token: string,
    expectedType: "access" | "refresh"
  ) => Effect.Effect<JwtPayload, TokenExpired | TokenInvalid>;
  readonly revoke: (jti: string, expiresAt: Date) => Effect.Effect<void>;
  readonly isRevoked: (jti: string) => Effect.Effect<boolean>;
}

export class JwtService extends Context.Service<JwtService, JwtServicePort>()("JwtService") {}

export const JwtServiceLayer: Layer.Layer<JwtService, never, PostgresConnectionPool> = Layer.effect(
  JwtService,
  Effect.gen(function* () {
    const maybeSecret = yield* Config.option(Config.string("JWT_SECRET")).pipe(Effect.orDie);

    if (Option.isNone(maybeSecret)) {
      yield* Effect.logWarning(
        "JWT_SECRET not set — JWT service disabled. Auth endpoints will return 500."
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

    if (pg === null) {
      yield* Effect.logWarning(
        "Postgres not available — JWT service disabled (no token revocation)"
      );
      return JwtService.of({
        sign: ({ sub, provider }: { sub: UserId; provider: OAuthProvider }) =>
          Effect.gen(function* () {
            const nowMillis = yield* Clock.currentTimeMillis;
            const now = Math.floor(nowMillis / 1000);
            const [accessToken, refreshToken] = yield* Effect.all([
              Effect.tryPromise(() =>
                new SignJWT({ sub, provider, jti: crypto.randomUUID(), type: "access" } as any)
                  .setProtectedHeader({ alg: "HS256" })
                  .setIssuedAt(now)
                  .setExpirationTime("15m")
                  .sign(key)
              ).pipe(Effect.orDie),
              Effect.tryPromise(() =>
                new SignJWT({ sub, provider, jti: crypto.randomUUID(), type: "refresh" } as any)
                  .setProtectedHeader({ alg: "HS256" })
                  .setIssuedAt(now)
                  .setExpirationTime("30d")
                  .sign(key)
              ).pipe(Effect.orDie),
            ]);
            return { accessToken, refreshToken, tokenType: "Bearer" as const, expiresIn: 15 * 60 };
          }),
        verify: (token: string, expectedType: "access" | "refresh") =>
          Effect.tryPromise({
            try: async () => {
              const { payload } = await jwtVerify(token, key);
              if ((payload as any).type !== expectedType) {
                throw new Error("Invalid token type");
              }
              return payload as unknown as JwtPayload;
            },
            catch: (e: any) =>
              e?.code === "ERR_JWT_EXPIRED" ? new TokenExpired() : new TokenInvalid(),
          }),
        revoke: () => Effect.void,
        isRevoked: () => Effect.succeed(false),
      });
    }

    return JwtService.of({
      sign: ({ sub, provider }: { sub: UserId; provider: OAuthProvider }) =>
        Effect.gen(function* () {
          const nowMillis = yield* Clock.currentTimeMillis;
          const now = Math.floor(nowMillis / 1000);
          const [accessToken, refreshToken] = yield* Effect.all([
            Effect.tryPromise(() =>
              new SignJWT({ sub, provider, jti: crypto.randomUUID(), type: "access" } as any)
                .setProtectedHeader({ alg: "HS256" })
                .setIssuedAt(now)
                .setExpirationTime("15m")
                .sign(key)
            ).pipe(Effect.orDie),
            Effect.tryPromise(() =>
              new SignJWT({ sub, provider, jti: crypto.randomUUID(), type: "refresh" } as any)
                .setProtectedHeader({ alg: "HS256" })
                .setIssuedAt(now)
                .setExpirationTime("30d")
                .sign(key)
            ).pipe(Effect.orDie),
          ]);
          return { accessToken, refreshToken, tokenType: "Bearer" as const, expiresIn: 15 * 60 };
        }),
      verify: (token: string, expectedType: "access" | "refresh") =>
        Effect.tryPromise({
          try: async () => {
            const { payload } = await jwtVerify(token, key);
            if ((payload as any).type !== expectedType) {
              throw new Error("Invalid token type");
            }
            return payload as unknown as JwtPayload;
          },
          catch: (e: any) =>
            e?.code === "ERR_JWT_EXPIRED" ? new TokenExpired() : new TokenInvalid(),
        }),
      revoke: (jti: string, expiresAt: Date) =>
        Effect.tryPromise(() =>
          pg!.query(
            "INSERT INTO refresh_token_blocklist (jti, expires_at) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            [jti, expiresAt]
          )
        ).pipe(Effect.orDie),
      isRevoked: (jti: string) =>
        Effect.tryPromise(async () => {
          const result = await pg!.query(
            "SELECT 1 FROM refresh_token_blocklist WHERE jti = $1 AND expires_at > NOW()",
            [jti]
          );
          return result.rows.length > 0;
        }).pipe(Effect.orDie),
    });
  })
);
