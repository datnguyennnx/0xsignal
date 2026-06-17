import { Effect, Match } from "effect";
import * as RedactedNs from "effect/Redacted";
import type {
  DecryptedAgentCredential,
  DecryptedEoaCredential,
} from "../../domain/exchange-credential";
import {
  AccountNotFound,
  CredentialNotFound,
  CredentialRevoked,
  CredentialExpired,
  CredentialUnverified,
  DuplicateLabel,
} from "../../domain/errors";
import type { EncryptionServicePort } from "../encryption.service";
import type { ExchangeCredentialRepoPort } from "./exchange-credential.repo";
import { isPgUniqueViolation, resolveMasterWallet } from "./shared/pg-utils";
import { mapCredentialRow } from "./exchange-credential.mapper";

export function pgExchangeCredentialRepo(
  pg: NonNullable<import("pg").Pool>,
  enc: EncryptionServicePort,
): ExchangeCredentialRepoPort {
  const writeAudit = (
    action: string,
    params: {
      userId: string;
      accountId?: string;
      credentialId?: string;
      context?: Record<string, unknown>;
    },
  ): Effect.Effect<void, never> =>
    Effect.tryPromise(() =>
      pg.query(
        `INSERT INTO credential_audit_log
         (user_id, account_id, credential_id, action, context)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [
          params.userId,
          params.accountId ?? null,
          params.credentialId ?? null,
          action,
          JSON.stringify(params.context ?? {}),
        ],
      ),
    ).pipe(
      Effect.catch((cause: unknown) =>
        Effect.logWarning(`Audit log write failed for action=${action}: ${cause}`),
      ),
      Effect.ignore,
    );

  const markUsed = (credentialId: string): Effect.Effect<void, never> =>
    Effect.tryPromise(() =>
      pg.query("UPDATE api_credentials SET last_used_at = NOW() WHERE id = $1", [credentialId]),
    ).pipe(Effect.ignore);

  return {
    create: (params) =>
      Effect.gen(function* () {
        const accountCheck = yield* Effect.tryPromise(() =>
          pg.query("SELECT id FROM exchange_accounts WHERE id = $1", [params.accountId]),
        ).pipe(Effect.orDie);
        if (accountCheck.rows.length === 0) {
          return yield* Effect.fail(new AccountNotFound({ accountId: params.accountId }));
        }

        let encAgentKey: string | undefined;
        let encEoaKey: string | undefined;

        if (params.credentialSubtype === "agent" && params.agentKey) {
          encAgentKey = yield* enc.encrypt(RedactedNs.value(params.agentKey));
        }
        if (params.credentialSubtype === "eoa" && params.eoaKey) {
          encEoaKey = yield* enc.encrypt(params.eoaKey);
        }

        const insertResult = yield* Effect.tryPromise(async () => {
          const result = await pg.query(
            `INSERT INTO api_credentials
             (account_id, user_id, credential_subtype, label,
              agent_address, enc_agent_key, enc_eoa_key,
              derivation_path, permissions, ip_whitelist,
              expires_at, encryption_version, is_verified, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
             RETURNING *`,
            [
              params.accountId,
              params.userId,
              params.credentialSubtype,
              params.label ?? "",
              params.credentialSubtype === "agent" ? (params.agentAddress ?? null) : null,
              encAgentKey ?? null,
              encEoaKey ?? null,
              params.credentialSubtype === "hardware" ? (params.derivationPath ?? null) : null,
              params.permissions ?? [],
              params.ipWhitelist ?? null,
              params.expiresAt ?? null,
              params.encryptionVersion ?? 1,
              params.isVerified ?? false,
              JSON.stringify(params.metadata ?? {}),
            ],
          );
          return result.rows[0];
        }).pipe(
          Effect.catch((error: unknown) => {
            if (isPgUniqueViolation(error)) {
              return Effect.fail(new DuplicateLabel({ label: params.label ?? "" }));
            }
            return Effect.die(error);
          }),
        );

        yield* writeAudit("created", {
          userId: params.userId,
          accountId: params.accountId,
          credentialId: insertResult.id,
        });

        return mapCredentialRow(insertResult);
      }),

    getActiveForAccount: (accountId, userId, subtype) =>
      Effect.tryPromise(async () => {
        if (subtype) {
          const result = await pg.query(
            `SELECT ac.* FROM api_credentials ac
             JOIN exchange_accounts ea ON ea.id = ac.account_id AND ea.user_id = $2
             WHERE ac.account_id = $1
               AND ac.credential_subtype = $3
               AND ac.is_active = true
               AND ac.is_revoked = false
             LIMIT 1`,
            [accountId, userId, subtype],
          );
          if (result.rows.length === 0) {
            throw new CredentialNotFound({
              credentialId: `${accountId}/${subtype}`,
            });
          }
          return mapCredentialRow(result.rows[0]);
        }

        const result = await pg.query(
          `SELECT ac.* FROM api_credentials ac
           JOIN exchange_accounts ea ON ea.id = ac.account_id AND ea.user_id = $2
           WHERE ac.account_id = $1
             AND ac.is_active = true
             AND ac.is_revoked = false
           ORDER BY ac.created_at DESC
           LIMIT 1`,
          [accountId, userId],
        );
        if (result.rows.length === 0) {
          throw new CredentialNotFound({
            credentialId: `${accountId}/*`,
          });
        }
        return mapCredentialRow(result.rows[0]);
      }).pipe(
        Effect.catch(
          (error: unknown): Effect.Effect<never, CredentialNotFound, never> =>
            Match.value(error).pipe(
              Match.when({ _tag: "CredentialNotFound" }, (e) =>
                Effect.fail(e as CredentialNotFound),
              ),
              Match.orElse(() => Effect.die(error)),
            ),
        ),
      ),

    getDecryptedAgent: (credentialId, userId) =>
      Effect.scoped(
        Effect.gen(function* () {
          const rows = yield* Effect.tryPromise(() =>
            pg.query(
              `SELECT ac.*,
                    ea.node_type,
                    ea.wallet_address AS account_wallet_address,
                    ea.parent_id AS account_parent_id,
                    e.slug AS exchange_slug
             FROM api_credentials ac
             JOIN exchange_accounts ea ON ea.id = ac.account_id
             JOIN exchanges e ON e.id = ea.exchange_id
             WHERE ac.id = $1 AND ac.user_id = $2`,
              [credentialId, userId],
            ),
          ).pipe(Effect.orDie);

          if (rows.rows.length === 0) {
            return yield* Effect.fail(new CredentialNotFound({ credentialId }));
          }
          const row = rows.rows[0];
          const credential = mapCredentialRow(row);

          if (credential.credentialSubtype !== "agent") {
            return yield* Effect.fail(new CredentialNotFound({ credentialId }));
          }

          if (row.is_revoked) {
            return yield* Effect.fail(new CredentialRevoked({ credentialId }));
          }

          if (row.expires_at) {
            const expiresAt = new Date(row.expires_at);
            if (expiresAt < new Date()) {
              return yield* Effect.fail(new CredentialExpired({ credentialId }));
            }
          }

          if (!row.is_verified) {
            return yield* Effect.fail(new CredentialUnverified({ credentialId }));
          }

          if (!row.enc_agent_key) {
            return yield* Effect.die(new Error("Missing enc_agent_key for agent credential"));
          }
          const decryptedKey = yield* enc.decrypt(row.enc_agent_key);
          const privateKey = RedactedNs.make(decryptedKey);

          const walletAddress = yield* resolveMasterWallet(pg, row.account_id);

          let vaultAddress: string | undefined;
          if (row.node_type === "sub" || row.node_type === "vault") {
            vaultAddress = row.account_wallet_address;
          }

          yield* writeAudit("read", {
            userId,
            credentialId,
            accountId: row.account_id,
            context: { resolvedWallet: true },
          });

          yield* Effect.forkScoped(markUsed(credentialId));

          const result: DecryptedAgentCredential = {
            privateKey,
            walletAddress,
            vaultAddress,
            agentAddress: row.agent_address ?? "",
            exchange: row.exchange_slug,
            permissions: row.permissions ?? [],
          };
          return result;
        }),
      ),

    getDecryptedEoa: (credentialId, userId) =>
      Effect.scoped(
        Effect.gen(function* () {
          const rows = yield* Effect.tryPromise(() =>
            pg.query(
              `SELECT ac.*,
                    ea.wallet_address AS account_wallet_address,
                    e.slug AS exchange_slug
             FROM api_credentials ac
             JOIN exchange_accounts ea ON ea.id = ac.account_id
             JOIN exchanges e ON e.id = ea.exchange_id
             WHERE ac.id = $1 AND ac.user_id = $2`,
              [credentialId, userId],
            ),
          ).pipe(Effect.orDie);

          if (rows.rows.length === 0) {
            return yield* Effect.fail(new CredentialNotFound({ credentialId }));
          }
          const row = rows.rows[0];

          if (row.credential_subtype !== "eoa") {
            return yield* Effect.fail(new CredentialNotFound({ credentialId }));
          }

          if (row.is_revoked) {
            return yield* Effect.fail(new CredentialRevoked({ credentialId }));
          }

          if (row.expires_at) {
            const expiresAt = new Date(row.expires_at);
            if (expiresAt < new Date()) {
              return yield* Effect.fail(new CredentialExpired({ credentialId }));
            }
          }

          if (!row.is_verified) {
            return yield* Effect.fail(new CredentialUnverified({ credentialId }));
          }

          if (!row.enc_eoa_key) {
            return yield* Effect.die(new Error("Missing enc_eoa_key for EOA credential"));
          }
          const decryptedKey = yield* enc.decrypt(row.enc_eoa_key);
          const privateKey = RedactedNs.make(decryptedKey);

          const walletAddress = yield* resolveMasterWallet(pg, row.account_id);

          yield* writeAudit("read", {
            userId,
            credentialId,
            accountId: row.account_id,
            context: { resolvedWallet: true },
          });

          yield* Effect.forkScoped(markUsed(credentialId));

          const result: DecryptedEoaCredential = {
            privateKey,
            walletAddress,
            exchange: row.exchange_slug,
          };
          return result;
        }),
      ),

    rotate: (oldId, newParams) =>
      Effect.gen(function* () {
        const oldCheck = yield* Effect.tryPromise(() =>
          pg.query("SELECT id FROM api_credentials WHERE id = $1 AND user_id = $2", [
            oldId,
            newParams.userId,
          ]),
        ).pipe(Effect.orDie);
        if (oldCheck.rows.length === 0) {
          return yield* Effect.fail(new CredentialNotFound({ credentialId: oldId }));
        }

        const accountCheck = yield* Effect.tryPromise(() =>
          pg.query("SELECT id FROM exchange_accounts WHERE id = $1", [newParams.accountId]),
        ).pipe(Effect.orDie);
        if (accountCheck.rows.length === 0) {
          return yield* Effect.fail(new AccountNotFound({ accountId: newParams.accountId }));
        }

        let encAgentKey: string | undefined;
        let encEoaKey: string | undefined;
        if (newParams.credentialSubtype === "agent" && newParams.agentKey) {
          encAgentKey = yield* enc.encrypt(RedactedNs.value(newParams.agentKey));
        }
        if (newParams.credentialSubtype === "eoa" && newParams.eoaKey) {
          encEoaKey = yield* enc.encrypt(newParams.eoaKey);
        }

        const newRow = yield* Effect.tryPromise(async () => {
          await pg.query("BEGIN");
          try {
            await pg.query("UPDATE api_credentials SET is_active = false WHERE id = $1", [oldId]);

            const insertResult = await pg.query(
              `INSERT INTO api_credentials
               (account_id, user_id, credential_subtype, label,
                agent_address, enc_agent_key, enc_eoa_key,
                derivation_path, permissions, ip_whitelist,
                expires_at, encryption_version, is_verified, metadata,
                rotated_from)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15)
               RETURNING *`,
              [
                newParams.accountId,
                newParams.userId,
                newParams.credentialSubtype,
                newParams.label ?? "",
                newParams.credentialSubtype === "agent" ? (newParams.agentAddress ?? null) : null,
                encAgentKey ?? null,
                encEoaKey ?? null,
                newParams.credentialSubtype === "hardware"
                  ? (newParams.derivationPath ?? null)
                  : null,
                newParams.permissions ?? [],
                newParams.ipWhitelist ?? null,
                newParams.expiresAt ?? null,
                newParams.encryptionVersion ?? 1,
                newParams.isVerified ?? false,
                JSON.stringify(newParams.metadata ?? {}),
                oldId,
              ],
            );

            await pg.query("COMMIT");
            return insertResult.rows[0];
          } catch (e) {
            await pg.query("ROLLBACK");
            throw e;
          }
        }).pipe(
          Effect.catch((error: unknown) => {
            if (isPgUniqueViolation(error)) {
              return Effect.fail(new DuplicateLabel({ label: newParams.label ?? "" }));
            }
            return Effect.die(error);
          }),
        );

        yield* writeAudit("rotated", {
          userId: newParams.userId,
          accountId: newParams.accountId,
          credentialId: newRow.id,
          context: { oldCredentialId: oldId },
        });

        return mapCredentialRow(newRow);
      }),

    revoke: (id, reason, userId) =>
      Effect.tryPromise(async () => {
        const result = await pg.query(
          `UPDATE api_credentials
           SET is_revoked = true, revoked_at = NOW(), revoked_reason = $1
           WHERE id = $2 AND user_id = $3
           RETURNING id`,
          [reason, id, userId],
        );
        if (result.rows.length === 0) {
          throw new CredentialNotFound({ credentialId: id });
        }
      }).pipe(
        Effect.tap(() =>
          writeAudit("revoked", {
            userId,
            credentialId: id,
            context: { reason },
          }),
        ),
        Effect.catch(
          (error: unknown): Effect.Effect<never, CredentialNotFound, never> =>
            Match.value(error).pipe(
              Match.when({ _tag: "CredentialNotFound" }, (e) =>
                Effect.fail(e as CredentialNotFound),
              ),
              Match.orElse(() => Effect.die(error)),
            ),
        ),
      ),

    setVerified: (id, userId) =>
      Effect.tryPromise(async () => {
        const result = await pg.query(
          `UPDATE api_credentials
           SET is_verified = true, verified_at = NOW()
           WHERE id = $1 AND user_id = $2
           RETURNING id`,
          [id, userId],
        );
        if (result.rows.length === 0) {
          throw new CredentialNotFound({ credentialId: id });
        }
      }).pipe(
        Effect.tap(() => writeAudit("verified", { userId, credentialId: id })),
        Effect.catch(
          (error: unknown): Effect.Effect<never, CredentialNotFound, never> =>
            Match.value(error).pipe(
              Match.when({ _tag: "CredentialNotFound" }, (e) =>
                Effect.fail(e as CredentialNotFound),
              ),
              Match.orElse(() => Effect.die(error)),
            ),
        ),
      ),

    markUsed: (id) =>
      Effect.tryPromise(() =>
        pg.query("UPDATE api_credentials SET last_used_at = NOW() WHERE id = $1", [id]),
      ).pipe(Effect.ignore),

    getForVerification: (credentialId, userId) =>
      Effect.gen(function* () {
        const rows = yield* Effect.tryPromise(() =>
          pg.query(
            `SELECT ac.*,
                    ea.wallet_address AS account_wallet_address,
                    e.slug AS exchange_slug
             FROM api_credentials ac
             JOIN exchange_accounts ea ON ea.id = ac.account_id
             JOIN exchanges e ON e.id = ea.exchange_id
             WHERE ac.id = $1 AND ac.user_id = $2`,
            [credentialId, userId],
          ),
        ).pipe(Effect.orDie);

        if (rows.rows.length === 0) {
          return yield* Effect.fail(new CredentialNotFound({ credentialId }));
        }
        const row = rows.rows[0];

        if (row.credential_subtype !== "agent") {
          return yield* Effect.fail(new CredentialNotFound({ credentialId }));
        }

        if (row.is_revoked) {
          return yield* Effect.fail(new CredentialRevoked({ credentialId }));
        }

        if (row.expires_at) {
          const expiresAt = new Date(row.expires_at);
          if (expiresAt < new Date()) {
            return yield* Effect.fail(new CredentialExpired({ credentialId }));
          }
        }

        if (!row.enc_agent_key) {
          return yield* Effect.die(new Error("Missing enc_agent_key for agent credential"));
        }
        const decryptedKey = yield* enc.decrypt(row.enc_agent_key);
        const privateKey = RedactedNs.make(decryptedKey);

        const masterWalletAddress = yield* resolveMasterWallet(pg, row.account_id);

        return {
          privateKey,
          agentAddress: row.agent_address ?? "",
          accountId: row.account_id,
          exchangeSlug: row.exchange_slug,
          masterWalletAddress,
        };
      }),

    recordAuditEvent: (action, params) =>
      Effect.tryPromise(() =>
        pg.query(
          `INSERT INTO credential_audit_log
           (user_id, account_id, credential_id, action, context)
           VALUES ($1, $2, $3, $4, $5::jsonb)`,
          [
            params.userId,
            params.accountId ?? null,
            params.credentialId ?? null,
            action,
            JSON.stringify(params.context ?? {}),
          ],
        ),
      ).pipe(
        Effect.catch((cause: unknown) =>
          Effect.logWarning(`Audit log write failed for action=${action}: ${cause}`),
        ),
        Effect.ignore,
      ),
  };
}

// mapCredentialRow and ts extracted to exchange-credential.mapper.ts
