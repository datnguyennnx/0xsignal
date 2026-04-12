/** QuestDB HTTP Client - Native fetch for QuestDB REST API */

import { Config, Context, Effect, Layer } from "effect";
import { Data } from "effect";

export class QuestDBError extends Data.TaggedError("QuestDBError")<{
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

function buildUrl(baseUrl: string, sql: string): string {
  const encoded = encodeURIComponent(sql);
  return `${baseUrl}/exec?query=${encoded}`;
}

export function exec(sql: string): Effect.Effect<QuestDBResponse, QuestDBError> {
  return Effect.flatMap(
    Effect.context() as Effect.Effect<Context.Context<QuestDBClient>>,
    (ctx) => {
      const config = Context.get(ctx, QuestDBClient);
      const url = buildUrl(config.httpUrl, sql);

      return Effect.tryPromise({
        try: () =>
          fetch(url, {
            method: "GET",
            headers: { Accept: "application/json" },
          }).then(async (res) => {
            if (!res.ok) {
              const text = await res.text();
              throw new Error(`QuestDB HTTP ${res.status}: ${text}`);
            }
            return res.json() as Promise<QuestDBResponse>;
          }),
        catch: (cause): QuestDBError =>
          new QuestDBError({
            message: `Failed to execute query: ${sql}`,
            cause,
          }),
      });
    }
  );
}

export function healthCheck(): Effect.Effect<boolean, QuestDBError> {
  return Effect.flatMap(
    Effect.context() as Effect.Effect<Context.Context<QuestDBClient>>,
    (ctx) => {
      const config = Context.get(ctx, QuestDBClient);
      const url = `${config.httpUrl}/health`;

      return Effect.tryPromise({
        try: () => fetch(url, { method: "GET" }).then((res) => res.ok),
        catch: (cause): QuestDBError =>
          new QuestDBError({
            message: `Health check failed`,
            cause,
          }),
      });
    }
  );
}
