import { Context, Effect, Layer } from "effect";
import { PostgresConnectionPool } from "@0xsignal/shared/db/postgres";
import type { OAuthAccount, OAuthProfile } from "../../domain/oauth-account";
import type { UserId } from "../../domain/user";

export interface OAuthAccountRepoPort {
  readonly findByProvider: (
    provider: string,
    providerUserId: string,
  ) => Effect.Effect<OAuthAccount | null>;
  readonly findByUserId: (userId: UserId) => Effect.Effect<OAuthAccount | null>;
  readonly upsert: (profile: OAuthProfile, userId: UserId) => Effect.Effect<OAuthAccount>;
  readonly createWithUser: (profile: OAuthProfile) => Effect.Effect<{ userId: string }>;
  readonly updateDisplayName: (userId: UserId, displayName: string) => Effect.Effect<void>;
}

export class OAuthAccountRepo extends Context.Service<OAuthAccountRepo, OAuthAccountRepoPort>()(
  "OAuthAccountRepo",
) {}

export const OAuthAccountRepoLayer: Layer.Layer<OAuthAccountRepo, never, PostgresConnectionPool> =
  Layer.effect(
    OAuthAccountRepo,
    Effect.gen(function* () {
      const pg = yield* PostgresConnectionPool;
      if (pg === null) {
        yield* Effect.logWarning(
          "Postgres not available — using in-memory OAuth account repo (dev only)",
        );

        const memoryAccounts = new Map<string, OAuthAccount>();

        const makeId = () => crypto.randomUUID();
        const makeUserId = (id: string) => id as UserId;

        return OAuthAccountRepo.of({
          findByProvider: (provider, providerUserId) =>
            Effect.sync(() => {
              const key = `${provider}:${providerUserId}`;
              return memoryAccounts.get(key) ?? null;
            }),

          upsert: (profile, userId) =>
            Effect.sync(() => {
              const key = `${profile.provider}:${profile.providerUserId}`;
              const now = new Date();
              const existing = memoryAccounts.get(key);
              if (existing) {
                const updated: OAuthAccount = {
                  ...existing,
                  email: profile.email ?? existing.email,
                  displayName: profile.displayName ?? existing.displayName,
                  avatarUrl: profile.avatarUrl ?? existing.avatarUrl,
                  updatedAt: now,
                };
                memoryAccounts.set(key, updated);
                return updated;
              }
              const newAccount: OAuthAccount = {
                id: makeId(),
                userId,
                provider: profile.provider,
                providerUserId: profile.providerUserId,
                email: profile.email,
                displayName: profile.displayName,
                avatarUrl: profile.avatarUrl,
                createdAt: now,
                updatedAt: now,
              };
              memoryAccounts.set(key, newAccount);
              return newAccount;
            }),

          findByUserId: (userId) =>
            Effect.sync(() => {
              for (const account of memoryAccounts.values()) {
                if (account.userId === userId) return account;
              }
              return null;
            }),

          createWithUser: (profile) =>
            Effect.sync(() => {
              const key = `${profile.provider}:${profile.providerUserId}`;
              const existing = memoryAccounts.get(key);
              if (existing) {
                return { userId: existing.userId };
              }
              const userId = makeUserId(makeId());
              const now = new Date();
              const newAccount: OAuthAccount = {
                id: makeId(),
                userId,
                provider: profile.provider,
                providerUserId: profile.providerUserId,
                email: profile.email,
                displayName: profile.displayName,
                avatarUrl: profile.avatarUrl,
                createdAt: now,
                updatedAt: now,
              };
              memoryAccounts.set(key, newAccount);
              return { userId };
            }),

          updateDisplayName: (userId, displayName) =>
            Effect.sync(() => {
              for (const [key, account] of memoryAccounts) {
                if (account.userId === userId) {
                  memoryAccounts.set(key, {
                    ...account,
                    displayName,
                    updatedAt: new Date(),
                  });
                  return;
                }
              }
            }),
        });
      }

      const mapRow = (row: any): OAuthAccount => ({
        id: row.id as string,
        userId: row.user_id as UserId,
        provider: row.provider as "google" | "github",
        providerUserId: row.provider_user_id,
        email: row.email ?? null,
        displayName: row.display_name ?? null,
        avatarUrl: row.avatar_url ?? null,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      });

      return OAuthAccountRepo.of({
        findByProvider: (provider, providerUserId) =>
          Effect.tryPromise(async () => {
            const result = await pg!.query(
              "SELECT * FROM oauth_accounts WHERE provider = $1 AND provider_user_id = $2",
              [provider, providerUserId],
            );
            return result.rows.length > 0 ? mapRow(result.rows[0]) : null;
          }).pipe(Effect.orDie),

        findByUserId: (userId) =>
          Effect.tryPromise(async () => {
            const result = await pg!.query(
              "SELECT * FROM oauth_accounts WHERE user_id = $1 LIMIT 1",
              [userId],
            );
            return result.rows.length > 0 ? mapRow(result.rows[0]) : null;
          }).pipe(Effect.orDie),

        upsert: (profile, userId) =>
          Effect.tryPromise(async () => {
            const result = await pg!.query(
              `INSERT INTO oauth_accounts (user_id, provider, provider_user_id, email, display_name, avatar_url)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (provider, provider_user_id)
             DO UPDATE SET email = EXCLUDED.email, display_name = EXCLUDED.display_name, avatar_url = EXCLUDED.avatar_url
             RETURNING *`,
              [
                userId,
                profile.provider,
                profile.providerUserId,
                profile.email,
                profile.displayName,
                profile.avatarUrl,
              ],
            );
            return mapRow(result.rows[0]);
          }).pipe(Effect.orDie),

        createWithUser: (profile) =>
          Effect.tryPromise(async () => {
            const result = await pg!.query(
              `WITH new_user AS (
               INSERT INTO users (status, created_at, updated_at)
               SELECT 'active', NOW(), NOW()
               WHERE NOT EXISTS (
                 SELECT 1 FROM oauth_accounts WHERE provider = $1 AND provider_user_id = $2
               )
               RETURNING id
             ),
             existing_user AS (
               SELECT user_id AS id FROM oauth_accounts WHERE provider = $1 AND provider_user_id = $2
             ),
             user_id AS (
               SELECT id FROM new_user UNION ALL SELECT id FROM existing_user LIMIT 1
             )
             INSERT INTO oauth_accounts (user_id, provider, provider_user_id, email, display_name, avatar_url, updated_at)
             SELECT user_id.id, $1, $2, $3, $4, $5, NOW()
             FROM user_id
             ON CONFLICT (provider, provider_user_id) DO UPDATE SET
               email = EXCLUDED.email,
               display_name = EXCLUDED.display_name,
               avatar_url = EXCLUDED.avatar_url,
               updated_at = NOW()
             RETURNING user_id`,
              [
                profile.provider,
                profile.providerUserId,
                profile.email,
                profile.displayName,
                profile.avatarUrl,
              ],
            );
            return { userId: result.rows[0].user_id };
          }).pipe(Effect.orDie),

        updateDisplayName: (userId, displayName) =>
          Effect.tryPromise(async () => {
            await pg!.query("UPDATE oauth_accounts SET display_name = $1 WHERE user_id = $2", [
              displayName,
              userId,
            ]);
          }).pipe(Effect.orDie),
      });
    }),
  );
