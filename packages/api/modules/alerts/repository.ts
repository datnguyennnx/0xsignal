import { Context, Effect, Layer } from "effect";
import { PostgresConnectionPool } from "@0xsignal/auth";
import type { Rule } from "@0xsignal/shared/alerts/index.ts";
import { AlertsErrors, errorMessage, type AlertsError } from "./errors";
import {
  COUNT_DELIVERIES_SINCE_BY_SUBJECT,
  COUNT_RULES_SQL,
  COUNT_UNREAD_DELIVERIES_SQL,
  DELETE_RULE_SQL,
  FIND_RULE_BY_ID_SQL,
  FIND_RULE_BY_SIGNATURE_SQL,
  INSERT_RULE_SQL,
  LIST_ALL_ENABLED_RULES_SQL,
  LIST_DELIVERIES_SQL,
  LIST_RULES_SQL,
  MARK_DELIVERIES_SEEN_SQL,
  UPDATE_RULE_ENABLED_SQL,
  toAlertRuleRow,
  toDeliveryRow,
  type AlertDeliveryDbRow,
  type AlertRuleDbRow,
  type AlertRuleRow,
  type DeliveryRow,
  type Subject,
  type SubjectType,
} from "./table";

const LIST_LIMIT = 100;
const DELIVERY_LIMIT_DEFAULT = 50;

type Pool = NonNullable<import("pg").Pool>;

interface CountRow {
  [column: string]: unknown;
  count: number;
}

export interface NewAlertRule {
  readonly id: string;
  readonly subjectType: SubjectType;
  readonly subjectId: string;
  readonly rule: Rule;
  readonly signature: string;
  readonly createdAtMs: number;
}

export interface AlertsRepositoryPort {
  readonly list: (subject: Subject) => Effect.Effect<AlertRuleRow[], AlertsError>;

  readonly listAllEnabled: () => Effect.Effect<AlertRuleRow[], AlertsError>;

  readonly findById: (
    subject: Subject,
    id: string,
  ) => Effect.Effect<AlertRuleRow | null, AlertsError>;

  readonly findBySignature: (
    subject: Subject,
    signature: string,
  ) => Effect.Effect<AlertRuleRow | null, AlertsError>;

  readonly insert: (input: NewAlertRule) => Effect.Effect<AlertRuleRow, AlertsError>;

  readonly setEnabled: (
    subject: Subject,
    id: string,
    enabled: boolean,
  ) => Effect.Effect<AlertRuleRow | null, AlertsError>;

  readonly remove: (subject: Subject, id: string) => Effect.Effect<boolean, AlertsError>;

  readonly countForSubject: (subject: Subject) => Effect.Effect<number, AlertsError>;

  readonly countDeliveriesSince: (
    subject: Subject,
    sinceMs: number,
  ) => Effect.Effect<number, AlertsError>;

  readonly countDeliveriesForSubjectSince: (
    subjectType: SubjectType,
    subjectId: string,
    sinceMs: number,
  ) => Effect.Effect<number, AlertsError>;
}

export class AlertsRepository extends Context.Service<AlertsRepository, AlertsRepositoryPort>()(
  "AlertsRepository",
) {}

function pgAlertsRepository(pool: Pool): AlertsRepositoryPort {
  return {
    list: (subject) =>
      Effect.gen(function* () {
        const rows = yield* Effect.tryPromise({
          try: async () => {
            const result = await pool.query<AlertRuleDbRow>(LIST_RULES_SQL, [
              subject.type,
              subject.id,
              LIST_LIMIT,
            ]);
            return result.rows;
          },
          catch: (cause) => new AlertsErrors.Db({ message: "Failed to list alert rules", cause }),
        });

        const decoded = decodeRuleRows(rows);
        yield* reportSkipped(decoded.skipped, decoded.firstFailure);
        return decoded.rules;
      }),

    listAllEnabled: () =>
      Effect.gen(function* () {
        const rows = yield* Effect.tryPromise({
          try: async () => {
            const result = await pool.query<AlertRuleDbRow>(LIST_ALL_ENABLED_RULES_SQL);
            return result.rows;
          },
          catch: (cause) =>
            new AlertsErrors.Db({ message: "Failed to load enabled alert rules", cause }),
        });

        const decoded = decodeRuleRows(rows);
        yield* reportSkipped(decoded.skipped, decoded.firstFailure);
        return decoded.rules;
      }),

    findById: (subject, id) =>
      Effect.tryPromise({
        try: () => queryOne(pool, FIND_RULE_BY_ID_SQL, [id, subject.type, subject.id]),
        catch: (cause) => new AlertsErrors.Db({ message: "Failed to load alert rule", cause }),
      }),

    findBySignature: (subject, signature) =>
      Effect.tryPromise({
        try: () =>
          queryOne(pool, FIND_RULE_BY_SIGNATURE_SQL, [subject.type, subject.id, signature]),
        catch: (cause) =>
          new AlertsErrors.Db({ message: "Failed to load alert rule by signature", cause }),
      }),

    insert: (input) =>
      Effect.tryPromise({
        try: () => insertRule(pool, input),
        catch: (cause) => new AlertsErrors.Db({ message: "Failed to create alert rule", cause }),
      }),

    setEnabled: (subject, id, enabled) =>
      Effect.tryPromise({
        try: () => queryOne(pool, UPDATE_RULE_ENABLED_SQL, [enabled, id, subject.type, subject.id]),
        catch: (cause) => new AlertsErrors.Db({ message: "Failed to update alert rule", cause }),
      }),

    remove: (subject, id) =>
      Effect.tryPromise({
        try: async () => {
          const result = await pool.query(DELETE_RULE_SQL, [id, subject.type, subject.id]);
          return (result.rowCount ?? 0) > 0;
        },
        catch: (cause) => new AlertsErrors.Db({ message: "Failed to delete alert rule", cause }),
      }),

    countForSubject: (subject) =>
      Effect.tryPromise({
        try: () => countRows(pool, COUNT_RULES_SQL, [subject.type, subject.id]),
        catch: (cause) => new AlertsErrors.Db({ message: "Failed to count alert rules", cause }),
      }),

    countDeliveriesSince: (subject, sinceMs) =>
      countDeliveriesSinceBySubject(pool, subject.type, subject.id, sinceMs),

    countDeliveriesForSubjectSince: (subjectType, subjectId, sinceMs) =>
      countDeliveriesSinceBySubject(pool, subjectType, subjectId, sinceMs),
  };
}

interface DecodedRuleRows {
  readonly rules: AlertRuleRow[];
  readonly skipped: number;
  readonly firstFailure: string;
}

function decodeRuleRows(rows: AlertRuleDbRow[]): DecodedRuleRows {
  const rules: AlertRuleRow[] = [];
  let skipped = 0;
  let firstFailure = "";

  for (const row of rows) {
    try {
      rules.push(toAlertRuleRow(row));
    } catch (cause) {
      skipped += 1;
      if (firstFailure === "") firstFailure = errorMessage(cause);
    }
  }

  return { rules, skipped, firstFailure };
}

const reportSkipped = (skipped: number, firstFailure: string): Effect.Effect<void> =>
  skipped === 0
    ? Effect.void
    : Effect.logWarning(
        `[alerts] skipped ${skipped} stored rule(s) that no longer validate: ${firstFailure}`,
      );

async function insertRule(pool: Pool, input: NewAlertRule): Promise<AlertRuleRow> {
  const result = await pool.query<AlertRuleDbRow>(INSERT_RULE_SQL, insertParams(input));
  const inserted = result.rows.at(0);
  if (inserted !== undefined) return toAlertRuleRow(inserted);

  const existing = await pool.query<AlertRuleDbRow>(FIND_RULE_BY_SIGNATURE_SQL, [
    input.subjectType,
    input.subjectId,
    input.signature,
  ]);
  const row = existing.rows.at(0);
  if (row === undefined) {
    throw new Error(`alert rule insert conflicted without a row for signature ${input.signature}`);
  }
  return toAlertRuleRow(row);
}

function insertParams(input: NewAlertRule): unknown[] {
  return [
    input.id,
    input.subjectType,
    input.subjectId,
    input.rule.name,
    input.rule.kind,
    JSON.stringify(input.rule.condition),
    JSON.stringify(input.rule),
    input.signature,
    input.rule.enabled,
    input.rule.targets,
    input.rule.for_seconds,
    input.rule.cooldown_seconds,
    input.rule.expires_at ?? null,
    new Date(input.createdAtMs),
  ];
}

async function queryOne(pool: Pool, sql: string, params: unknown[]): Promise<AlertRuleRow | null> {
  const result = await pool.query<AlertRuleDbRow>(sql, params);
  const row = result.rows.at(0);
  return row === undefined ? null : toAlertRuleRow(row);
}

async function countRows(pool: Pool, sql: string, params: unknown[]): Promise<number> {
  const result = await pool.query<CountRow>(sql, params);
  return result.rows.at(0)?.count ?? 0;
}

function clampDeliveryLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return DELIVERY_LIMIT_DEFAULT;
  return Math.min(LIST_LIMIT, Math.max(1, Math.trunc(limit)));
}

const countDeliveriesSinceBySubject = (
  pool: Pool,
  subjectType: SubjectType,
  subjectId: string,
  sinceMs: number,
): Effect.Effect<number, AlertsError> =>
  Effect.tryPromise({
    try: () =>
      countRows(pool, COUNT_DELIVERIES_SINCE_BY_SUBJECT, [
        subjectType,
        subjectId,
        Math.trunc(sinceMs),
      ]),
    catch: (cause) => new AlertsErrors.Db({ message: "Failed to count alert deliveries", cause }),
  });

export const listDeliveries = (
  pool: Pool,
  subject: Subject,
  limit?: number,
): Effect.Effect<DeliveryRow[], AlertsError> =>
  Effect.tryPromise({
    try: async () => {
      const result = await pool.query<AlertDeliveryDbRow>(LIST_DELIVERIES_SQL, [
        subject.type,
        subject.id,
        clampDeliveryLimit(limit),
      ]);
      return result.rows.map(toDeliveryRow);
    },
    catch: (cause) => new AlertsErrors.Db({ message: "Failed to list alert deliveries", cause }),
  });

export const countUnreadDeliveries = (
  pool: Pool,
  subject: Subject,
): Effect.Effect<number, AlertsError> =>
  Effect.tryPromise({
    try: () => countRows(pool, COUNT_UNREAD_DELIVERIES_SQL, [subject.type, subject.id]),
    catch: (cause) =>
      new AlertsErrors.Db({ message: "Failed to count unread alert deliveries", cause }),
  });

export const markDeliveriesSeen = (
  pool: Pool,
  subject: Subject,
  now: number,
): Effect.Effect<void, AlertsError> =>
  Effect.tryPromise({
    try: async () => {
      await pool.query(MARK_DELIVERIES_SEEN_SQL, [subject.type, subject.id, Math.trunc(now)]);
    },
    catch: (cause) =>
      new AlertsErrors.Db({ message: "Failed to mark alert deliveries seen", cause }),
  });

export const AlertsRepositoryLayer: Layer.Layer<AlertsRepository, never, PostgresConnectionPool> =
  Layer.effect(
    AlertsRepository,
    Effect.gen(function* () {
      const pool = yield* PostgresConnectionPool;

      if (pool === null) {
        return yield* Effect.die(
          new Error("PostgresConnectionPool required but was null — provide a proper pool"),
        );
      }

      return pgAlertsRepository(pool);
    }),
  );
