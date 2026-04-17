/** QuestDB HTTP Client - Native fetch for QuestDB REST API */

import { Config, Context, Effect, Layer } from "effect";
import { Data } from "effect";

export class QuestDBError extends Data.TaggedError("QuestDBError")<{
  readonly code: "INTERNAL_ERROR";
  readonly message: string;
  readonly cause?: unknown;
}> {}

export interface QuestDBResponse {
  readonly query: string;
  readonly columns: ReadonlyArray<{ name: string; type: string }>;
  readonly dataset: ReadonlyArray<ReadonlyArray<unknown>>;
  readonly count: number;
}

export interface QuestDBConfig {
  readonly httpUrl: string;
}

export class QuestDBClient extends Context.Tag("QuestDBClient")<QuestDBClient, QuestDBConfig>() {}

const QuestDBConfigLive = Layer.effect(
  QuestDBClient,
  Effect.gen(function* () {
    const httpUrl = yield* Config.string("QUESTDB_HTTP_URL").pipe(
      Config.withDefault("http://localhost:9000")
    );
    return { httpUrl };
  })
);

export const QuestDBClientLayer = QuestDBConfigLive;

/**
 * Execute a SQL query (SELECT) and expect a JSON response.
 * Uses GET for compatibility with all QuestDB versions.
 */
export function query(sql: string): Effect.Effect<QuestDBResponse, QuestDBError, QuestDBClient> {
  return Effect.flatMap(
    Effect.context() as Effect.Effect<Context.Context<QuestDBClient>>,
    (ctx) => {
      const config = Context.get(ctx, QuestDBClient);
      const url = new URL(`${config.httpUrl}/exec`);
      url.searchParams.append("query", sql);

      return Effect.tryPromise({
        try: () =>
          fetch(url.toString(), {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
          }).then(async (res) => {
            const text = await res.text();
            if (!res.ok) {
              throw new Error(`QuestDB Query Error (${res.status}): ${text}`);
            }
            try {
              return JSON.parse(text) as QuestDBResponse;
            } catch (e) {
              throw new Error(
                `Failed to parse QuestDB JSON response. Body: ${text.slice(0, 100)}...`
              );
            }
          }),
        catch: (cause): QuestDBError =>
          new QuestDBError({
            code: "INTERNAL_ERROR",
            message: `Failed to execute query: ${sql.slice(0, 100)}...`,
            cause,
          }),
      });
    }
  );
}

/**
 * Execute a SQL command (DDL/DML) via GET.
 * This ensures compatibility with environments where POST to /exec is disabled.
 */
export function command(sql: string): Effect.Effect<void, QuestDBError, QuestDBClient> {
  return Effect.flatMap(
    Effect.context() as Effect.Effect<Context.Context<QuestDBClient>>,
    (ctx) => {
      const config = Context.get(ctx, QuestDBClient);
      const url = new URL(`${config.httpUrl}/exec`);
      url.searchParams.append("query", sql);

      return Effect.tryPromise({
        try: () =>
          fetch(url.toString(), {
            method: "GET",
          }).then(async (res) => {
            if (!res.ok) {
              const text = await res.text();
              throw new Error(`QuestDB Command Error (${res.status}): ${text}`);
            }
            return;
          }),
        catch: (cause): QuestDBError =>
          new QuestDBError({
            code: "INTERNAL_ERROR",
            message: `Failed to execute command: ${sql.slice(0, 100)}...`,
            cause,
          }),
      });
    }
  );
}

/**
 * Ingest data using Influx Line Protocol (ILP) over HTTP.
 * This is the optimized path for historical candle data.
 */
export function ingest(lines: string[]): Effect.Effect<void, QuestDBError, QuestDBClient> {
  return Effect.flatMap(
    Effect.context() as Effect.Effect<Context.Context<QuestDBClient>>,
    (ctx) => {
      const config = Context.get(ctx, QuestDBClient);
      const url = `${config.httpUrl}/write`;

      return Effect.tryPromise({
        try: () =>
          fetch(url, {
            method: "POST",
            body: lines.join("\n") + "\n",
          }).then(async (res) => {
            if (!res.ok) {
              const text = await res.text();
              throw new Error(`QuestDB Ingestion Error (${res.status}): ${text}`);
            }
            return;
          }),
        catch: (cause): QuestDBError =>
          new QuestDBError({
            code: "INTERNAL_ERROR",
            message: `Failed to ingest ILP data (${lines.length} lines)`,
            cause,
          }),
      });
    }
  );
}

export function healthCheck(): Effect.Effect<boolean, QuestDBError, QuestDBClient> {
  return Effect.flatMap(
    Effect.context() as Effect.Effect<Context.Context<QuestDBClient>>,
    (ctx) => {
      const config = Context.get(ctx, QuestDBClient);
      const url = `${config.httpUrl}/health`;

      return Effect.tryPromise({
        try: () => fetch(url, { method: "GET" }).then((res) => res.ok),
        catch: (cause): QuestDBError =>
          new QuestDBError({
            code: "INTERNAL_ERROR",
            message: `Health check failed`,
            cause,
          }),
      });
    }
  );
}
