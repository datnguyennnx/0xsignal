import { Context, Effect, Layer } from "effect";
import { PostgresConnectionPool } from "./db/postgres";
import { OAuthStateExpired, OAuthStateMismatch } from "../domain/errors";
import type { OAuthProvider } from "../domain/oauth-account";

interface OAuthStateData {
  readonly state: string;
  readonly provider: OAuthProvider;
  readonly redirectUrl: string | null;
  readonly codeVerifier: string | null;
}

type OAuthStateRow = {
  readonly provider: OAuthProvider;
  readonly redirect_url: string | null;
  readonly code_verifier: string | null;
  readonly expires_at: Date | string;
};

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
              pg.query<OAuthStateRow>(
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
              provider: row.provider,
              redirectUrl: row.redirect_url,
              codeVerifier:
                row.code_verifier === "" || row.code_verifier === null ? null : row.code_verifier,
            };
          }),
      });
    }),
  );
