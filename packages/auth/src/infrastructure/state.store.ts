import { Clock, Context, Effect, Layer } from "effect";
import { PostgresConnectionPool } from "@0xsignal/shared/db/postgres";
import { OAuthStateExpired, OAuthStateMismatch, TokenInvalid } from "../domain/errors";
import type { OAuthProvider } from "../domain/oauth-account";

interface AuthCodeData {
  readonly code: string;
  readonly userId: string;
  readonly provider: OAuthProvider;
}

export interface AuthCodeStorePort {
  readonly save: (data: AuthCodeData) => Effect.Effect<void>;
  readonly consume: (code: string) => Effect.Effect<AuthCodeData, TokenInvalid>;
}

export class AuthCodeStore extends Context.Service<AuthCodeStore, AuthCodeStorePort>()(
  "AuthCodeStore",
) {}

export const AuthCodeStoreLayer: Layer.Layer<AuthCodeStore, never, PostgresConnectionPool> =
  Layer.effect(
    AuthCodeStore,
    Effect.gen(function* () {
      const pg = yield* PostgresConnectionPool;
      if (pg === null) {
        const memoryCodes = new Map<string, AuthCodeData & { expiresAt: Date }>();
        return AuthCodeStore.of({
          save: ({ code, userId, provider }) =>
            Effect.gen(function* () {
              const nowMillis = yield* Clock.currentTimeMillis;
              memoryCodes.set(code, {
                code,
                userId,
                provider,
                expiresAt: new Date(nowMillis + 30 * 1000),
              });
            }),
          consume: (code) =>
            Effect.gen(function* () {
              const found = memoryCodes.get(code);
              if (!found) {
                return yield* Effect.fail(new TokenInvalid());
              }
              memoryCodes.delete(code);
              if (found.expiresAt < new Date()) {
                return yield* Effect.fail(new TokenInvalid());
              }
              return { code, userId: found.userId, provider: found.provider };
            }),
        });
      }

      return AuthCodeStore.of({
        save: ({ code, userId, provider }: AuthCodeData) =>
          Effect.tryPromise(() =>
            pg.query(
              "INSERT INTO auth_codes (code, user_id, provider, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL '30 seconds')",
              [code, userId, provider],
            ),
          ).pipe(Effect.orDie),

        consume: (code: string) =>
          Effect.gen(function* () {
            const result = yield* Effect.tryPromise(() =>
              pg.query(
                "DELETE FROM auth_codes WHERE code = $1 RETURNING user_id, provider, expires_at",
                [code],
              ),
            ).pipe(Effect.orDie);

            if (result.rows.length === 0) {
              return yield* Effect.fail(new TokenInvalid());
            }

            const row = result.rows[0];
            if (new Date(row.expires_at) < new Date()) {
              return yield* Effect.fail(new TokenInvalid());
            }

            return {
              code,
              userId: row.user_id,
              provider: row.provider as OAuthProvider,
            };
          }),
      });
    }),
  );

interface OAuthStateData {
  readonly state: string;
  readonly provider: OAuthProvider;
  readonly redirectUrl: string | null;
  readonly codeVerifier: string | null;
}

export interface OAuthStateStorePort {
  readonly save: (data: OAuthStateData) => Effect.Effect<void>;
  readonly consume: (
    state: string,
  ) => Effect.Effect<OAuthStateData, OAuthStateExpired | OAuthStateMismatch>;
}

export class OAuthStateStore extends Context.Service<OAuthStateStore, OAuthStateStorePort>()(
  "OAuthStateStore",
) {}

export const OAuthStateStoreLayer: Layer.Layer<OAuthStateStore, never, PostgresConnectionPool> =
  Layer.effect(
    OAuthStateStore,
    Effect.gen(function* () {
      const pg = yield* PostgresConnectionPool;
      if (pg === null) {
        return yield* Effect.die(
          new Error("OAuthStateStore requires Postgres — set DATABASE_URL or POSTGRES_URL"),
        );
      }

      return OAuthStateStore.of({
        save: ({ state, provider, redirectUrl, codeVerifier }: OAuthStateData) =>
          Effect.gen(function* () {
            yield* Effect.tryPromise(() =>
              pg.query(
                "INSERT INTO oauth_states (state, provider, redirect_url, code_verifier, expires_at) VALUES ($1, $2, $3, $4, NOW() + INTERVAL '10 minutes')",
                [state, provider, redirectUrl, codeVerifier ?? ""],
              ),
            ).pipe(Effect.orDie);
          }),

        consume: (state: string) =>
          Effect.gen(function* () {
            const result = yield* Effect.tryPromise(() =>
              pg.query(
                "DELETE FROM oauth_states WHERE state = $1 RETURNING provider, redirect_url, code_verifier, expires_at",
                [state],
              ),
            ).pipe(Effect.orDie);

            if (result.rows.length === 0) {
              return yield* Effect.fail(new OAuthStateMismatch());
            }

            const row = result.rows[0];
            if (new Date(row.expires_at) < new Date()) {
              return yield* Effect.fail(new OAuthStateExpired());
            }

            return {
              state,
              provider: row.provider as OAuthProvider,
              redirectUrl: row.redirect_url,
              codeVerifier:
                row.code_verifier === "" || row.code_verifier === null ? null : row.code_verifier,
            } as const;
          }),
      });
    }),
  );
