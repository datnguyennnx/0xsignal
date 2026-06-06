import { Context, Effect, Layer } from "effect";
import * as RedactedNs from "effect/Redacted";
import { PostgresConnectionPool } from "@0xsignal/shared/db/postgres";
import type {
  ApiCredential,
  DecryptedAgentCredential,
  DecryptedEoaCredential,
} from "../../domain/exchange-credential";
import {
  AccountNotFound,
  CredentialNotFound,
  CredentialRevoked,
  CredentialExpired,
  CredentialUnverified,
  EncryptionFailed,
  DuplicateLabel,
} from "../../domain/errors";
import { EncryptionService } from "../encryption.service";
import type { EncryptionServicePort } from "../encryption.service";

// Input types

export interface CreateApiCredentialParams {
  readonly userId: string;
  readonly accountId: string;
  readonly credentialSubtype: "agent" | "eoa" | "hardware";
  readonly label?: string;
  readonly agentAddress?: string;
  /** Plaintext agent private key — will be encrypted before storage */
  readonly agentKey?: RedactedNs.Redacted<string>;
  /** Plaintext EOA private key — will be encrypted before storage */
  readonly eoaKey?: string;
  readonly derivationPath?: string;
  readonly permissions?: readonly string[];
  readonly ipWhitelist?: readonly string[];
  readonly expiresAt?: string;
  readonly encryptionVersion?: number;
  readonly isVerified?: boolean;
  readonly metadata?: Record<string, unknown>;
}

// Port interface

export interface ExchangeCredentialRepoPort {
  readonly create: (
    params: CreateApiCredentialParams
  ) => Effect.Effect<ApiCredential, EncryptionFailed | DuplicateLabel | AccountNotFound>;

  readonly getActiveForAccount: (
    accountId: string,
    userId: string,
    subtype?: string
  ) => Effect.Effect<ApiCredential, CredentialNotFound>;

  readonly getDecryptedAgent: (
    credentialId: string,
    userId: string
  ) => Effect.Effect<
    DecryptedAgentCredential,
    | CredentialNotFound
    | CredentialRevoked
    | CredentialExpired
    | CredentialUnverified
    | EncryptionFailed
    | AccountNotFound
  >;

  readonly getDecryptedEoa: (
    credentialId: string,
    userId: string
  ) => Effect.Effect<
    DecryptedEoaCredential,
    | CredentialNotFound
    | CredentialRevoked
    | CredentialExpired
    | CredentialUnverified
    | EncryptionFailed
    | AccountNotFound
  >;

  readonly rotate: (
    oldId: string,
    newParams: CreateApiCredentialParams
  ) => Effect.Effect<
    ApiCredential,
    CredentialNotFound | AccountNotFound | EncryptionFailed | DuplicateLabel
  >;

  readonly revoke: (
    id: string,
    reason: string,
    userId: string
  ) => Effect.Effect<void, CredentialNotFound>;

  readonly setVerified: (id: string, userId: string) => Effect.Effect<void, CredentialNotFound>;

  readonly markUsed: (id: string) => Effect.Effect<void, never>;

  readonly getForVerification: (
    credentialId: string,
    userId: string
  ) => Effect.Effect<
    {
      readonly privateKey: RedactedNs.Redacted<string>;
      readonly agentAddress: string;
      readonly accountId: string;
      readonly exchangeSlug: string;
      readonly masterWalletAddress: string;
    },
    CredentialNotFound | CredentialRevoked | CredentialExpired | EncryptionFailed | AccountNotFound
  >;

  readonly recordAuditEvent: (
    action: string,
    params: {
      readonly userId: string;
      readonly accountId?: string;
      readonly credentialId?: string;
      readonly context?: Record<string, unknown>;
    }
  ) => Effect.Effect<void, never>;
}

// Context Service

export class ExchangeCredentialRepo extends Context.Service<
  ExchangeCredentialRepo,
  ExchangeCredentialRepoPort
>()("ExchangeCredentialRepo") {}

// Layer

export const ExchangeCredentialRepoLayer: Layer.Layer<
  ExchangeCredentialRepo,
  never,
  PostgresConnectionPool | EncryptionService
> = Layer.effect(
  ExchangeCredentialRepo,
  Effect.gen(function* () {
    const pg = yield* PostgresConnectionPool;
    const enc = yield* EncryptionService;

    if (pg === null) {
      yield* Effect.logWarning(
        "Postgres not available — using in-memory ExchangeCredentialRepo (dev only)"
      );
      return inMemoryExchangeCredentialRepo();
    }

    return pgExchangeCredentialRepo(pg, enc);
  })
);

// DB row mapping

const ts = (v: any): string => (v instanceof Date ? v.toISOString() : v != null ? String(v) : v);

const mapCredentialRow = (row: any): ApiCredential => ({
  id: row.id,
  accountId: row.account_id,
  userId: row.user_id,
  credentialSubtype: row.credential_subtype,
  label: row.label,
  agentAddress: row.agent_address ?? undefined,
  encAgentKey: row.enc_agent_key ?? undefined,
  encEoaKey: row.enc_eoa_key ?? undefined,
  derivationPath: row.derivation_path ?? undefined,
  permissions: row.permissions ?? [],
  ipWhitelist: row.ip_whitelist ?? undefined,
  expiresAt: row.expires_at != null ? ts(row.expires_at) : undefined,
  lastUsedAt: row.last_used_at != null ? ts(row.last_used_at) : undefined,
  isActive: row.is_active,
  isRevoked: row.is_revoked,
  revokedAt: row.revoked_at != null ? ts(row.revoked_at) : undefined,
  revokedReason: row.revoked_reason ?? undefined,
  rotatedFrom: row.rotated_from ?? undefined,
  encryptionVersion: row.encryption_version,
  isVerified: row.is_verified,
  verifiedAt: row.verified_at != null ? ts(row.verified_at) : undefined,
  metadata: row.metadata ?? {},
  createdAt: ts(row.created_at),
  updatedAt: ts(row.updated_at),
});

// In-memory implementation (dev mode, no real encryption)

function inMemoryExchangeCredentialRepo(): ExchangeCredentialRepoPort {
  const credentials = new Map<string, ApiCredential>();
  const auditLogs: Array<Record<string, unknown>> = [];

  const writeAudit = (
    action: string,
    params: {
      userId: string;
      accountId?: string;
      credentialId?: string;
      context?: Record<string, unknown>;
    }
  ): Effect.Effect<void, never> =>
    Effect.sync(() => {
      auditLogs.push({
        id: crypto.randomUUID(),
        action,
        user_id: params.userId,
        account_id: params.accountId ?? null,
        credential_id: params.credentialId ?? null,
        context: params.context ?? {},
        occurred_at: new Date().toISOString(),
      });
    });

  // In-memory stubs — real resolution happens in PG path
  const resolveExchangeSlug = (): Effect.Effect<string, AccountNotFound> =>
    Effect.sync(() => "hyperliquid");

  const resolveMasterWallet = (): Effect.Effect<string, AccountNotFound> =>
    Effect.sync(() => "0x0000000000000000000000000000000000000000");

  return {
    create: (params) =>
      Effect.gen(function* () {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();

        const credential: ApiCredential = {
          id,
          accountId: params.accountId,
          userId: params.userId,
          credentialSubtype: params.credentialSubtype,
          label: params.label ?? "",
          agentAddress: params.credentialSubtype === "agent" ? params.agentAddress : undefined,
          encAgentKey:
            params.credentialSubtype === "agent"
              ? params.agentKey
                ? RedactedNs.value(params.agentKey)
                : undefined
              : undefined,
          encEoaKey: params.credentialSubtype === "eoa" ? params.eoaKey : undefined,
          derivationPath:
            params.credentialSubtype === "hardware" ? params.derivationPath : undefined,
          permissions: [...(params.permissions ?? [])],
          ipWhitelist: params.ipWhitelist ? [...params.ipWhitelist] : undefined,
          expiresAt: params.expiresAt,
          lastUsedAt: undefined,
          isActive: true,
          isRevoked: false,
          revokedAt: undefined,
          revokedReason: undefined,
          rotatedFrom: undefined,
          encryptionVersion: params.encryptionVersion ?? 1,
          isVerified: params.isVerified ?? false,
          verifiedAt: undefined,
          metadata: params.metadata ?? {},
          createdAt: now,
          updatedAt: now,
        };

        credentials.set(id, credential);

        yield* writeAudit("created", {
          userId: params.userId,
          accountId: params.accountId,
          credentialId: id,
        });

        return credential;
      }),

    getActiveForAccount: (accountId, userId, subtype) =>
      Effect.gen(function* () {
        for (const cred of credentials.values()) {
          if (
            cred.accountId === accountId &&
            cred.userId === userId &&
            cred.isActive &&
            !cred.isRevoked &&
            (!subtype || cred.credentialSubtype === subtype)
          ) {
            return cred;
          }
        }
        return yield* Effect.fail(
          new CredentialNotFound({ credentialId: `${accountId}/${subtype ?? "*"}` })
        );
      }),

    getDecryptedAgent: (credentialId, userId) =>
      Effect.gen(function* () {
        const cred = credentials.get(credentialId);
        if (!cred || cred.userId !== userId) {
          return yield* Effect.fail(new CredentialNotFound({ credentialId }));
        }

        if (cred.isRevoked) {
          return yield* Effect.fail(new CredentialRevoked({ credentialId }));
        }

        if (cred.expiresAt && new Date(cred.expiresAt) < new Date()) {
          return yield* Effect.fail(new CredentialExpired({ credentialId }));
        }

        if (!cred.isVerified) {
          return yield* Effect.fail(new CredentialUnverified({ credentialId }));
        }

        const privateKey = RedactedNs.make(cred.encAgentKey ?? "");
        const walletAddress = yield* resolveMasterWallet();
        const exchangeSlug = yield* resolveExchangeSlug();

        yield* writeAudit("read", {
          userId: cred.userId,
          accountId: cred.accountId,
          credentialId: cred.id,
        });

        const decrypted: DecryptedAgentCredential = {
          privateKey,
          walletAddress,
          vaultAddress: undefined,
          agentAddress: cred.agentAddress ?? "",
          exchange: exchangeSlug,
          permissions: cred.permissions ?? [],
        };
        return decrypted;
      }),

    getDecryptedEoa: (credentialId, userId) =>
      Effect.gen(function* () {
        const cred = credentials.get(credentialId);
        if (!cred || cred.userId !== userId) {
          return yield* Effect.fail(new CredentialNotFound({ credentialId }));
        }

        if (cred.isRevoked) {
          return yield* Effect.fail(new CredentialRevoked({ credentialId }));
        }

        if (cred.expiresAt && new Date(cred.expiresAt) < new Date()) {
          return yield* Effect.fail(new CredentialExpired({ credentialId }));
        }

        if (!cred.isVerified) {
          return yield* Effect.fail(new CredentialUnverified({ credentialId }));
        }

        const privateKey = RedactedNs.make(cred.encEoaKey ?? "");
        const walletAddress = yield* resolveMasterWallet();
        const exchangeSlug = yield* resolveExchangeSlug();

        yield* writeAudit("read", {
          userId: cred.userId,
          accountId: cred.accountId,
          credentialId: cred.id,
        });

        const decrypted: DecryptedEoaCredential = {
          privateKey,
          walletAddress,
          exchange: exchangeSlug,
        };
        return decrypted;
      }),

    rotate: (oldId, newParams) =>
      Effect.gen(function* () {
        const oldCred = credentials.get(oldId);
        if (!oldCred) {
          return yield* Effect.fail(new CredentialNotFound({ credentialId: oldId }));
        }

        credentials.set(oldId, {
          ...oldCred,
          isActive: false,
          updatedAt: new Date().toISOString(),
        });

        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const newCred: ApiCredential = {
          id,
          accountId: newParams.accountId,
          userId: newParams.userId,
          credentialSubtype: newParams.credentialSubtype,
          label: newParams.label ?? "",
          agentAddress:
            newParams.credentialSubtype === "agent" ? newParams.agentAddress : undefined,
          encAgentKey:
            newParams.credentialSubtype === "agent"
              ? newParams.agentKey
                ? RedactedNs.value(newParams.agentKey)
                : undefined
              : undefined,
          encEoaKey: newParams.credentialSubtype === "eoa" ? newParams.eoaKey : undefined,
          derivationPath:
            newParams.credentialSubtype === "hardware" ? newParams.derivationPath : undefined,
          permissions: [...(newParams.permissions ?? [])],
          ipWhitelist: newParams.ipWhitelist ? [...newParams.ipWhitelist] : undefined,
          expiresAt: newParams.expiresAt,
          lastUsedAt: undefined,
          isActive: true,
          isRevoked: false,
          revokedAt: undefined,
          revokedReason: undefined,
          rotatedFrom: oldId,
          encryptionVersion: newParams.encryptionVersion ?? 1,
          isVerified: newParams.isVerified ?? false,
          verifiedAt: undefined,
          metadata: newParams.metadata ?? {},
          createdAt: now,
          updatedAt: now,
        };
        credentials.set(id, newCred);

        yield* writeAudit("rotated", {
          userId: newParams.userId,
          accountId: newParams.accountId,
          credentialId: id,
          context: { oldCredentialId: oldId },
        });

        return newCred;
      }),

    revoke: (id, reason, userId) =>
      Effect.gen(function* () {
        const cred = credentials.get(id);
        if (!cred) {
          return yield* Effect.fail(new CredentialNotFound({ credentialId: id }));
        }
        const now = new Date().toISOString();
        credentials.set(id, {
          ...cred,
          isRevoked: true,
          revokedAt: now,
          revokedReason: reason,
          updatedAt: now,
        });

        yield* writeAudit("revoked", {
          userId,
          credentialId: id,
          context: { reason },
        });
      }),

    setVerified: (id, userId) =>
      Effect.gen(function* () {
        const cred = credentials.get(id);
        if (!cred) {
          return yield* Effect.fail(new CredentialNotFound({ credentialId: id }));
        }
        const now = new Date().toISOString();
        credentials.set(id, {
          ...cred,
          isVerified: true,
          verifiedAt: now,
          updatedAt: now,
        });

        yield* writeAudit("verified", { userId, credentialId: id });
      }),

    markUsed: (id) =>
      Effect.sync(() => {
        const cred = credentials.get(id);
        if (cred) {
          credentials.set(id, {
            ...cred,
            lastUsedAt: new Date().toISOString(),
          });
        }
      }),

    getForVerification: (credentialId, userId) =>
      Effect.gen(function* () {
        const cred = credentials.get(credentialId);
        if (!cred || cred.userId !== userId) {
          return yield* Effect.fail(new CredentialNotFound({ credentialId }));
        }

        if (cred.isRevoked) {
          return yield* Effect.fail(new CredentialRevoked({ credentialId }));
        }

        if (cred.expiresAt && new Date(cred.expiresAt) < new Date()) {
          return yield* Effect.fail(new CredentialExpired({ credentialId }));
        }

        if (cred.credentialSubtype !== "agent") {
          return yield* Effect.fail(new CredentialNotFound({ credentialId }));
        }

        const privateKey = RedactedNs.make(cred.encAgentKey ?? "");
        const masterWalletAddress = yield* resolveMasterWallet();

        return {
          privateKey,
          agentAddress: cred.agentAddress ?? "",
          accountId: cred.accountId,
          exchangeSlug: "hyperliquid",
          masterWalletAddress,
        };
      }),

    recordAuditEvent: (action, params) =>
      Effect.sync(() => {
        auditLogs.push({
          id: crypto.randomUUID(),
          action,
          user_id: params.userId,
          account_id: params.accountId ?? null,
          credential_id: params.credentialId ?? null,
          context: params.context ?? {},
          occurred_at: new Date().toISOString(),
        });
      }),
  };
}

// Postgres implementation

function pgExchangeCredentialRepo(
  pg: NonNullable<import("pg").Pool>,
  enc: EncryptionServicePort
): ExchangeCredentialRepoPort {
  // Audit log helper (append-only, never fails caller)

  const writeAudit = (
    action: string,
    params: {
      userId: string;
      accountId?: string;
      credentialId?: string;
      context?: Record<string, unknown>;
    }
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
        ]
      )
    ).pipe(
      Effect.catch((cause: unknown) =>
        Effect.logWarning(`Audit log write failed for action=${action}: ${cause}`)
      ),
      Effect.ignore
    );

  // Same logic as ExchangeAccountRepo

  const resolveMasterWallet = (accountId: string): Effect.Effect<string, AccountNotFound> =>
    Effect.tryPromise(async () => {
      const result = await pg.query(
        `WITH RECURSIVE chain AS (
           SELECT id, parent_id, node_type, wallet_address
           FROM exchange_accounts WHERE id = $1
           UNION ALL
           SELECT ea.id, ea.parent_id, ea.node_type, ea.wallet_address
           FROM exchange_accounts ea
           INNER JOIN chain c ON c.parent_id = ea.id
         )
         SELECT wallet_address FROM chain WHERE node_type = 'wallet' LIMIT 1`,
        [accountId]
      );
      if (result.rows.length === 0) {
        throw new AccountNotFound({
          accountId: `master-wallet:${accountId}`,
        });
      }
      return result.rows[0].wallet_address;
    }).pipe(
      Effect.catch((error: unknown) => {
        if (error instanceof AccountNotFound) return Effect.fail(error);
        return Effect.die(error);
      })
    );

  // markUsed (fire-and-forget)

  const markUsed = (credentialId: string): Effect.Effect<void, never> =>
    Effect.tryPromise(() =>
      pg.query("UPDATE api_credentials SET last_used_at = NOW() WHERE id = $1", [credentialId])
    ).pipe(Effect.ignore);

  const isUniqueViolation = (error: unknown): boolean =>
    typeof error === "object" && error !== null && (error as any).code === "23505";

  return {
    create: (params) =>
      Effect.gen(function* () {
        const accountCheck = yield* Effect.tryPromise(() =>
          pg.query("SELECT id FROM exchange_accounts WHERE id = $1", [params.accountId])
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
            ]
          );
          return result.rows[0];
        }).pipe(
          Effect.catch((error: unknown) => {
            if (isUniqueViolation(error)) {
              return Effect.fail(new DuplicateLabel({ label: params.label ?? "" }));
            }
            return Effect.die(error);
          })
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
            [accountId, userId, subtype]
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
          [accountId, userId]
        );
        if (result.rows.length === 0) {
          throw new CredentialNotFound({
            credentialId: `${accountId}/*`,
          });
        }
        return mapCredentialRow(result.rows[0]);
      }).pipe(
        Effect.catch((error: unknown) => {
          if (error instanceof CredentialNotFound) return Effect.fail(error);
          return Effect.die(error);
        })
      ),

    getDecryptedAgent: (credentialId, userId) =>
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
            [credentialId, userId]
          )
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

        const walletAddress = yield* resolveMasterWallet(row.account_id);

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

        yield* Effect.forkDetach(markUsed(credentialId));

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

    getDecryptedEoa: (credentialId, userId) =>
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
            [credentialId, userId]
          )
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

        const walletAddress = yield* resolveMasterWallet(row.account_id);

        yield* writeAudit("read", {
          userId,
          credentialId,
          accountId: row.account_id,
          context: { resolvedWallet: true },
        });

        yield* Effect.forkDetach(markUsed(credentialId));

        const result: DecryptedEoaCredential = {
          privateKey,
          walletAddress,
          exchange: row.exchange_slug,
        };
        return result;
      }),

    rotate: (oldId, newParams) =>
      Effect.gen(function* () {
        const oldCheck = yield* Effect.tryPromise(() =>
          pg.query("SELECT id FROM api_credentials WHERE id = $1 AND user_id = $2", [
            oldId,
            newParams.userId,
          ])
        ).pipe(Effect.orDie);
        if (oldCheck.rows.length === 0) {
          return yield* Effect.fail(new CredentialNotFound({ credentialId: oldId }));
        }

        const accountCheck = yield* Effect.tryPromise(() =>
          pg.query("SELECT id FROM exchange_accounts WHERE id = $1", [newParams.accountId])
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

        // Atomic: deactivate + insert
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
              ]
            );

            await pg.query("COMMIT");
            return insertResult.rows[0];
          } catch (e) {
            await pg.query("ROLLBACK");
            throw e;
          }
        }).pipe(
          Effect.catch((error: unknown) => {
            if (isUniqueViolation(error)) {
              return Effect.fail(new DuplicateLabel({ label: newParams.label ?? "" }));
            }
            return Effect.die(error);
          })
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
          [reason, id, userId]
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
          })
        ),
        Effect.catch((error: unknown) => {
          if (error instanceof CredentialNotFound) return Effect.fail(error);
          return Effect.die(error);
        })
      ),

    setVerified: (id, userId) =>
      Effect.tryPromise(async () => {
        const result = await pg.query(
          `UPDATE api_credentials
           SET is_verified = true, verified_at = NOW()
           WHERE id = $1 AND user_id = $2
           RETURNING id`,
          [id, userId]
        );
        if (result.rows.length === 0) {
          throw new CredentialNotFound({ credentialId: id });
        }
      }).pipe(
        Effect.tap(() => writeAudit("verified", { userId, credentialId: id })),
        Effect.catch((error: unknown) => {
          if (error instanceof CredentialNotFound) return Effect.fail(error);
          return Effect.die(error);
        })
      ),

    markUsed: (id) =>
      Effect.tryPromise(() =>
        pg.query("UPDATE api_credentials SET last_used_at = NOW() WHERE id = $1", [id])
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
            [credentialId, userId]
          )
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

        const masterWalletAddress = yield* resolveMasterWallet(row.account_id);

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
          ]
        )
      ).pipe(
        Effect.catch((cause: unknown) =>
          Effect.logWarning(`Audit log write failed for action=${action}: ${cause}`)
        ),
        Effect.ignore
      ),
  };
}
