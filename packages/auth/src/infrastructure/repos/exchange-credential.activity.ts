import { Effect } from "effect";
import { INSERT_AUDIT_LOG_SQL, MARK_USED_SQL } from "./exchange-credential.sql";

export type CredentialAuditParams = {
  readonly userId: string;
  readonly accountId?: string;
  readonly credentialId?: string;
  readonly context?: Record<string, unknown>;
};

const describeCause = (cause: unknown): string => {
  if (cause instanceof Error) return cause.message;
  if (typeof cause === "string") return cause;
  return "unknown error";
};

export const writeCredentialAudit = (
  pg: NonNullable<import("pg").Pool>,
  action: string,
  params: CredentialAuditParams,
): Effect.Effect<void> =>
  Effect.tryPromise(() =>
    pg.query(INSERT_AUDIT_LOG_SQL, [
      params.userId,
      params.accountId ?? null,
      params.credentialId ?? null,
      action,
      JSON.stringify(params.context ?? {}),
    ]),
  ).pipe(
    Effect.catch((cause: unknown) =>
      Effect.logWarning(`Audit log write failed for action=${action}: ${describeCause(cause)}`),
    ),
    Effect.ignore,
  );

export const markCredentialUsed = (
  pg: NonNullable<import("pg").Pool>,
  credentialId: string,
): Effect.Effect<void> =>
  Effect.tryPromise(() => pg.query(MARK_USED_SQL, [credentialId])).pipe(Effect.ignore);
