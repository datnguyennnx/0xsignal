import { Effect } from "effect";
import type {
  ApiCredential,
  DecryptedAgentCredential,
  DecryptedEoaCredential,
} from "../../domain/exchange-credential";
import {
  type AccountNotFound,
  CredentialExpired,
  CredentialNotFound,
  CredentialRevoked,
  CredentialUnverified,
  type EncryptionFailed,
} from "../../domain/errors";
import type { EncryptionServicePort } from "../encryption.service";
import { markCredentialUsed, writeCredentialAudit } from "./exchange-credential.activity";
import { decryptCredentialKey } from "./exchange-credential.keys";
import { mapCredentialRow, type CredentialRow } from "./exchange-credential.mapper";
import {
  ACTIVE_CREDENTIAL_FOR_SUBTYPE_SQL,
  ACTIVE_CREDENTIAL_SQL,
  AGENT_CREDENTIAL_DETAIL_SQL,
  CREDENTIAL_DETAIL_SQL,
} from "./exchange-credential.sql";
import { resolveMasterWallet } from "./shared/pg-utils";

export type CredentialDetailRow = CredentialRow & {
  readonly node_type: string | null;
  readonly account_wallet_address: string | null;
  readonly exchange_slug: string;
};

type CredentialReadError =
  | CredentialNotFound
  | CredentialRevoked
  | CredentialExpired
  | CredentialUnverified
  | EncryptionFailed
  | AccountNotFound;

const isPresent = (value: string | null | undefined): value is string =>
  value !== undefined && value !== null && value !== "";

const isExpired = (row: CredentialDetailRow): boolean =>
  row.expires_at !== null && new Date(row.expires_at) < new Date();

const assertSubtype = (
  row: CredentialDetailRow,
  credentialId: string,
  expected: "agent" | "eoa",
): Effect.Effect<void, CredentialNotFound> =>
  row.credential_subtype === expected
    ? Effect.void
    : Effect.fail(new CredentialNotFound({ credentialId }));

const assertUsable = (
  row: CredentialDetailRow,
  credentialId: string,
): Effect.Effect<void, CredentialRevoked | CredentialExpired> => {
  if (row.is_revoked) return Effect.fail(new CredentialRevoked({ credentialId }));
  if (isExpired(row)) return Effect.fail(new CredentialExpired({ credentialId }));
  return Effect.void;
};

const assertVerified = (
  row: CredentialDetailRow,
  credentialId: string,
): Effect.Effect<void, CredentialUnverified> =>
  row.is_verified ? Effect.void : Effect.fail(new CredentialUnverified({ credentialId }));

const queryDetail = (
  pg: NonNullable<import("pg").Pool>,
  sql: string,
  credentialId: string,
  userId: string,
): Effect.Effect<CredentialDetailRow, CredentialNotFound> =>
  Effect.gen(function* () {
    const result = yield* Effect.tryPromise(() =>
      pg.query<CredentialDetailRow>(sql, [credentialId, userId]),
    ).pipe(Effect.orDie);
    const row = result.rows[0];
    if (row === undefined) {
      return yield* Effect.fail(new CredentialNotFound({ credentialId }));
    }
    return row;
  });

const loadAgentDetail = (
  pg: NonNullable<import("pg").Pool>,
  credentialId: string,
  userId: string,
): Effect.Effect<CredentialDetailRow, CredentialNotFound> =>
  queryDetail(pg, AGENT_CREDENTIAL_DETAIL_SQL, credentialId, userId);

const loadCredentialDetail = (
  pg: NonNullable<import("pg").Pool>,
  credentialId: string,
  userId: string,
): Effect.Effect<CredentialDetailRow, CredentialNotFound> =>
  queryDetail(pg, CREDENTIAL_DETAIL_SQL, credentialId, userId);

export const readActiveCredential = (
  pg: NonNullable<import("pg").Pool>,
  accountId: string,
  userId: string,
  subtype: string | undefined,
): Effect.Effect<ApiCredential, CredentialNotFound> =>
  Effect.tryPromise(async () => {
    if (isPresent(subtype)) {
      const result = await pg.query<CredentialRow>(ACTIVE_CREDENTIAL_FOR_SUBTYPE_SQL, [
        accountId,
        userId,
        subtype,
      ]);
      if (result.rows.length === 0) {
        throw new CredentialNotFound({ credentialId: `${accountId}/${subtype}` });
      }
      return mapCredentialRow(result.rows[0]);
    }

    const result = await pg.query<CredentialRow>(ACTIVE_CREDENTIAL_SQL, [accountId, userId]);
    if (result.rows.length === 0) {
      throw new CredentialNotFound({ credentialId: `${accountId}/*` });
    }
    return mapCredentialRow(result.rows[0]);
  }).pipe(
    Effect.catch((error: unknown) =>
      error instanceof CredentialNotFound ? Effect.fail(error) : Effect.die(error),
    ),
  );

export const readDecryptedAgent = (
  pg: NonNullable<import("pg").Pool>,
  enc: EncryptionServicePort,
  credentialId: string,
  userId: string,
): Effect.Effect<DecryptedAgentCredential, CredentialReadError> =>
  Effect.scoped(
    Effect.gen(function* () {
      const row = yield* loadAgentDetail(pg, credentialId, userId);
      yield* assertSubtype(row, credentialId, "agent");
      yield* assertUsable(row, credentialId);
      yield* assertVerified(row, credentialId);

      const privateKey = yield* decryptCredentialKey(
        enc,
        row.enc_agent_key,
        "Missing enc_agent_key for agent credential",
      );
      const walletAddress = yield* resolveMasterWallet(pg, row.account_id);
      const vaultAddress =
        row.node_type === "sub" || row.node_type === "vault"
          ? (row.account_wallet_address ?? undefined)
          : undefined;

      yield* writeCredentialAudit(pg, "read", {
        userId,
        credentialId,
        accountId: row.account_id,
        context: { resolvedWallet: true },
      });

      yield* Effect.forkScoped(markCredentialUsed(pg, credentialId));

      const credential: DecryptedAgentCredential = {
        privateKey,
        walletAddress,
        ...(vaultAddress !== undefined && { vaultAddress }),
        agentAddress: row.agent_address ?? "",
        exchange: row.exchange_slug,
        permissions: row.permissions ?? [],
      };
      return credential;
    }),
  );

export const readDecryptedEoa = (
  pg: NonNullable<import("pg").Pool>,
  enc: EncryptionServicePort,
  credentialId: string,
  userId: string,
): Effect.Effect<DecryptedEoaCredential, CredentialReadError> =>
  Effect.scoped(
    Effect.gen(function* () {
      const row = yield* loadCredentialDetail(pg, credentialId, userId);
      yield* assertSubtype(row, credentialId, "eoa");
      yield* assertUsable(row, credentialId);
      yield* assertVerified(row, credentialId);

      const privateKey = yield* decryptCredentialKey(
        enc,
        row.enc_eoa_key,
        "Missing enc_eoa_key for EOA credential",
      );
      const walletAddress = yield* resolveMasterWallet(pg, row.account_id);

      yield* writeCredentialAudit(pg, "read", {
        userId,
        credentialId,
        accountId: row.account_id,
        context: { resolvedWallet: true },
      });

      yield* Effect.forkScoped(markCredentialUsed(pg, credentialId));

      return {
        privateKey,
        walletAddress,
        exchange: row.exchange_slug,
      } satisfies DecryptedEoaCredential;
    }),
  );

export const readForVerification = (
  pg: NonNullable<import("pg").Pool>,
  enc: EncryptionServicePort,
  credentialId: string,
  userId: string,
) =>
  Effect.gen(function* () {
    const row = yield* loadCredentialDetail(pg, credentialId, userId);
    yield* assertSubtype(row, credentialId, "agent");
    yield* assertUsable(row, credentialId);

    const privateKey = yield* decryptCredentialKey(
      enc,
      row.enc_agent_key,
      "Missing enc_agent_key for agent credential",
    );
    const masterWalletAddress = yield* resolveMasterWallet(pg, row.account_id);

    return {
      privateKey,
      agentAddress: row.agent_address ?? "",
      accountId: row.account_id,
      exchangeSlug: row.exchange_slug,
      masterWalletAddress,
    };
  });
