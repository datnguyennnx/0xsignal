import { Clock, Context, Effect, Layer } from "effect";
import { PostgresConnectionPool } from "./db/postgres";
import { TokenInvalid } from "../domain/errors";
import type { OAuthProvider } from "../domain/oauth-account";

export { OAuthStateStore, OAuthStateStoreLayer } from "./oauth-state.store";

interface AuthCodeData {
  readonly code: string;
  readonly userId: string;
  readonly provider: OAuthProvider;
}

type AuthCodeRow = {
  readonly user_id: string;
  readonly provider: OAuthProvider;
  readonly expires_at: Date | string;
};

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
              pg.query<AuthCodeRow>(
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
              provider: row.provider,
            };
          }),
      });
    }),
  );
