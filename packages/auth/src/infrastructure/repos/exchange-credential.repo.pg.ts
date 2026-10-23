import { Effect } from "effect";
import { AccountNotFound, CredentialNotFound, DuplicateLabel } from "../../domain/errors";
import type { EncryptionServicePort } from "../encryption.service";
import type { ExchangeCredentialRepoPort } from "./exchange-credential.repo";
import { markCredentialUsed, writeCredentialAudit } from "./exchange-credential.activity";
import { encryptCredentialSecrets } from "./exchange-credential.keys";
import { mapCredentialRow, type CredentialRow } from "./exchange-credential.mapper";
import {
  readActiveCredential,
  readDecryptedAgent,
  readDecryptedEoa,
  readForVerification,
} from "./exchange-credential.read";
import {
  DEACTIVATE_CREDENTIAL_SQL,
  REVOKE_CREDENTIAL_SQL,
  SELECT_ACCOUNT_ID_SQL,
  SELECT_CREDENTIAL_OWNER_SQL,
  VERIFY_CREDENTIAL_SQL,
  buildCreateCredentialQuery,
  buildRotateCredentialQuery,
} from "./exchange-credential.sql";
import { isPgUniqueViolation } from "./shared/pg-utils";

type IdRow = { readonly id: string };

const assertAccountExists = (
  pg: NonNullable<import("pg").Pool>,
  accountId: string,
): Effect.Effect<void, AccountNotFound> =>
  Effect.tryPromise(() => pg.query<IdRow>(SELECT_ACCOUNT_ID_SQL, [accountId])).pipe(
    Effect.orDie,
    Effect.flatMap((result) =>
      result.rows.length === 0 ? Effect.fail(new AccountNotFound({ accountId })) : Effect.void,
    ),
  );

const assertCredentialOwned = (
  pg: NonNullable<import("pg").Pool>,
  credentialId: string,
  userId: string,
): Effect.Effect<void, CredentialNotFound> =>
  Effect.tryPromise(() =>
    pg.query<IdRow>(SELECT_CREDENTIAL_OWNER_SQL, [credentialId, userId]),
  ).pipe(
    Effect.orDie,
    Effect.flatMap((result) =>
      result.rows.length === 0
        ? Effect.fail(new CredentialNotFound({ credentialId }))
        : Effect.void,
    ),
  );

export function pgExchangeCredentialRepo(
  pg: NonNullable<import("pg").Pool>,
  enc: EncryptionServicePort,
): ExchangeCredentialRepoPort {
  return {
    create: (params) =>
      Effect.gen(function* () {
        yield* assertAccountExists(pg, params.accountId);

        const secrets = yield* encryptCredentialSecrets(enc, params);
        const query = buildCreateCredentialQuery(params, secrets);

        const inserted = yield* Effect.tryPromise(async () => {
          const result = await pg.query<CredentialRow>(query.text, query.values);
          return result.rows[0];
        }).pipe(
          Effect.catch((error: unknown) => {
            if (isPgUniqueViolation(error)) {
              return Effect.fail(new DuplicateLabel({ label: params.label ?? "" }));
            }
            return Effect.die(error);
          }),
        );

        yield* writeCredentialAudit(pg, "created", {
          userId: params.userId,
          accountId: params.accountId,
          credentialId: inserted.id,
        });

        return mapCredentialRow(inserted);
      }),

    getActiveForAccount: (accountId, userId, subtype) =>
      readActiveCredential(pg, accountId, userId, subtype),

    getDecryptedAgent: (credentialId, userId) => readDecryptedAgent(pg, enc, credentialId, userId),

    getDecryptedEoa: (credentialId, userId) => readDecryptedEoa(pg, enc, credentialId, userId),

    rotate: (oldId, newParams) =>
      Effect.gen(function* () {
        yield* assertCredentialOwned(pg, oldId, newParams.userId);
        yield* assertAccountExists(pg, newParams.accountId);

        const secrets = yield* encryptCredentialSecrets(enc, newParams);
        const query = buildRotateCredentialQuery(oldId, newParams, secrets);

        const newRow = yield* Effect.tryPromise(async () => {
          await pg.query("BEGIN");
          try {
            await pg.query(DEACTIVATE_CREDENTIAL_SQL, [oldId]);

            const insertResult = await pg.query<CredentialRow>(query.text, query.values);

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

        yield* writeCredentialAudit(pg, "rotated", {
          userId: newParams.userId,
          accountId: newParams.accountId,
          credentialId: newRow.id,
          context: { oldCredentialId: oldId },
        });

        return mapCredentialRow(newRow);
      }),

    revoke: (id, reason, userId) =>
      Effect.tryPromise(async () => {
        const result = await pg.query<IdRow>(REVOKE_CREDENTIAL_SQL, [reason, id, userId]);
        if (result.rows.length === 0) {
          throw new CredentialNotFound({ credentialId: id });
        }
      }).pipe(
        Effect.tap(() =>
          writeCredentialAudit(pg, "revoked", {
            userId,
            credentialId: id,
            context: { reason },
          }),
        ),
        Effect.catch((error: unknown) =>
          error instanceof CredentialNotFound ? Effect.fail(error) : Effect.die(error),
        ),
      ),

    setVerified: (id, userId) =>
      Effect.tryPromise(async () => {
        const result = await pg.query<IdRow>(VERIFY_CREDENTIAL_SQL, [id, userId]);
        if (result.rows.length === 0) {
          throw new CredentialNotFound({ credentialId: id });
        }
      }).pipe(
        Effect.tap(() => writeCredentialAudit(pg, "verified", { userId, credentialId: id })),
        Effect.catch((error: unknown) =>
          error instanceof CredentialNotFound ? Effect.fail(error) : Effect.die(error),
        ),
      ),

    markUsed: (id) => markCredentialUsed(pg, id),

    getForVerification: (credentialId, userId) =>
      readForVerification(pg, enc, credentialId, userId),

    recordAuditEvent: (action, params) => writeCredentialAudit(pg, action, params),
  };
}
