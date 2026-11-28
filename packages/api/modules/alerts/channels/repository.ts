import { Context, Effect, Layer } from "effect";
import { PostgresConnectionPool } from "@0xsignal/auth";
import { AlertsErrors, type AlertsError } from "../errors";
import type { Subject, SubjectType } from "../table";
import {
  CONSUME_LINK_CODE_SQL,
  COUNT_CHANNELS_BY_SUBJECT_SQL,
  DELETE_CHANNEL_BY_ID_AND_SUBJECT_SQL,
  INSERT_LINK_CODE_SQL,
  LIST_CHANNELS_BY_SUBJECT_SQL,
  SELECT_CHANNELS_FOR_SUBJECTS_SQL,
  TOUCH_CHANNEL_ERROR_SQL,
  TOUCH_CHANNEL_SENT_SQL,
  UPSERT_CHANNEL_SQL,
  toChannelRow,
  toConsumedLinkRow,
  toSubjectChannelRow,
  type ChannelDbRow,
  type ChannelName,
  type ChannelRow,
  type ChannelSubjectDbRow,
  type ConsumedLinkRow,
  type LinkCodeDbRow,
  type SubjectChannelRow,
} from "./table";

type Pool = NonNullable<import("pg").Pool>;

interface CountRow {
  [column: string]: unknown;
  count: number;
}

interface InsertLinkCodeInput {
  readonly code: string;
  readonly subjectType: SubjectType;
  readonly subjectId: string;
  readonly channel: ChannelName;
  readonly expiresAtMs: number;
}

interface UpsertChannelInput {
  readonly subjectType: SubjectType;
  readonly subjectId: string;
  readonly channel: ChannelName;
  readonly destination: string;
  readonly label: string;
  readonly verifiedAtMs: number;
}

export interface ChannelsRepositoryPort {
  readonly insertLinkCode: (input: InsertLinkCodeInput) => Effect.Effect<void, AlertsError>;

  readonly consumeLinkCode: (
    code: string,
    nowMs: number,
  ) => Effect.Effect<ConsumedLinkRow | null, AlertsError>;

  readonly upsertChannel: (input: UpsertChannelInput) => Effect.Effect<ChannelRow, AlertsError>;

  readonly listBySubject: (subject: Subject) => Effect.Effect<ChannelRow[], AlertsError>;

  readonly remove: (subject: Subject, id: string) => Effect.Effect<boolean, AlertsError>;

  readonly countBySubject: (subject: Subject) => Effect.Effect<number, AlertsError>;

  readonly touchSent: (id: string) => Effect.Effect<void, AlertsError>;

  readonly touchError: (id: string, message: string) => Effect.Effect<void, AlertsError>;

  readonly forSubjects: (
    subjects: readonly Subject[],
  ) => Effect.Effect<SubjectChannelRow[], AlertsError>;
}

export class ChannelsRepository extends Context.Service<
  ChannelsRepository,
  ChannelsRepositoryPort
>()("ChannelsRepository") {}

function pgChannelsRepository(pool: Pool): ChannelsRepositoryPort {
  return {
    insertLinkCode: (input) =>
      Effect.tryPromise({
        try: async () => {
          await pool.query(INSERT_LINK_CODE_SQL, [
            input.code,
            input.subjectType,
            input.subjectId,
            input.channel,
            input.expiresAtMs,
          ]);
        },
        catch: (cause) =>
          new AlertsErrors.Db({ message: "Failed to create alert link code", cause }),
      }),

    consumeLinkCode: (code, nowMs) =>
      Effect.tryPromise({
        try: async () => {
          const result = await pool.query<LinkCodeDbRow>(CONSUME_LINK_CODE_SQL, [code, nowMs]);
          const row = result.rows.at(0);
          return row === undefined ? null : toConsumedLinkRow(row);
        },
        catch: (cause) =>
          new AlertsErrors.Db({ message: "Failed to consume alert link code", cause }),
      }),

    upsertChannel: (input) =>
      Effect.tryPromise({
        try: async () => {
          const result = await pool.query<ChannelDbRow>(UPSERT_CHANNEL_SQL, [
            input.subjectType,
            input.subjectId,
            input.channel,
            input.destination,
            input.label,
            input.verifiedAtMs,
          ]);
          const row = result.rows.at(0);
          if (row === undefined) {
            throw new Error(`alert channel upsert returned no row for ${input.channel}`);
          }
          return toChannelRow(row);
        },
        catch: (cause) => new AlertsErrors.Db({ message: "Failed to save alert channel", cause }),
      }),

    listBySubject: (subject) =>
      Effect.tryPromise({
        try: async () => {
          const result = await pool.query<ChannelDbRow>(LIST_CHANNELS_BY_SUBJECT_SQL, [
            subject.type,
            subject.id,
          ]);
          return result.rows.map(toChannelRow);
        },
        catch: (cause) => new AlertsErrors.Db({ message: "Failed to list alert channels", cause }),
      }),

    remove: (subject, id) =>
      Effect.tryPromise({
        try: async () => {
          const result = await pool.query(DELETE_CHANNEL_BY_ID_AND_SUBJECT_SQL, [
            id,
            subject.type,
            subject.id,
          ]);
          return (result.rowCount ?? 0) > 0;
        },
        catch: (cause) => new AlertsErrors.Db({ message: "Failed to delete alert channel", cause }),
      }),

    countBySubject: (subject) =>
      Effect.tryPromise({
        try: async () => {
          const result = await pool.query<CountRow>(COUNT_CHANNELS_BY_SUBJECT_SQL, [
            subject.type,
            subject.id,
          ]);
          return result.rows.at(0)?.count ?? 0;
        },
        catch: (cause) => new AlertsErrors.Db({ message: "Failed to count alert channels", cause }),
      }),

    touchSent: (id) =>
      Effect.tryPromise({
        try: async () => {
          await pool.query(TOUCH_CHANNEL_SENT_SQL, [id]);
        },
        catch: (cause) =>
          new AlertsErrors.Db({ message: "Failed to mark alert channel sent", cause }),
      }),

    touchError: (id, message) =>
      Effect.tryPromise({
        try: async () => {
          await pool.query(TOUCH_CHANNEL_ERROR_SQL, [id, message]);
        },
        catch: (cause) =>
          new AlertsErrors.Db({ message: "Failed to record alert channel error", cause }),
      }),

    forSubjects: (subjects) =>
      Effect.gen(function* () {
        if (subjects.length === 0) return [];

        const rows = yield* Effect.tryPromise({
          try: async () => {
            const result = await pool.query<ChannelSubjectDbRow>(SELECT_CHANNELS_FOR_SUBJECTS_SQL, [
              subjects.map((subject) => subject.type),
              subjects.map((subject) => subject.id),
            ]);
            return result.rows;
          },
          catch: (cause) =>
            new AlertsErrors.Db({ message: "Failed to load alert channels for subjects", cause }),
        });

        return rows.map((row) => toSubjectChannelRow(row));
      }),
  };
}

export const ChannelsRepositoryLayer: Layer.Layer<
  ChannelsRepository,
  never,
  PostgresConnectionPool
> = Layer.effect(
  ChannelsRepository,
  Effect.gen(function* () {
    const pool = yield* PostgresConnectionPool;

    if (pool === null) {
      return yield* Effect.die(
        new Error("PostgresConnectionPool required but was null — provide a proper pool"),
      );
    }

    return pgChannelsRepository(pool);
  }),
);
