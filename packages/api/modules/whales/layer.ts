import { Duration, Effect, Layer, Schedule } from "effect";
import { WhaleService } from "./index";
import { makeWhaleService } from "./service";
import { WhaleConfig, WhaleConfigLayer } from "./config";
import type { WhaleRepo } from "./repo";
import type { WhaleSources } from "./sources";
import { asRecord } from "../../shared/parsing";
import { WhaleSourcesLayer } from "../../integrations/hyperliquid/data-sources/whale-source";
import { ensureWhaleSchema } from "./table";
import { WhaleRepoLayer } from "./repo.pg";

export const whaleServiceLayer: Layer.Layer<
  WhaleService,
  never,
  WhaleRepo | WhaleSources | WhaleConfig
> = Layer.effect(WhaleService, makeWhaleService());

const asText = (value: unknown): string | undefined =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? String(value)
    : undefined;

const causeOf = (value: unknown): unknown => {
  const record = asRecord(value);
  return record === null ? undefined : record.cause;
};

const messageOf = (value: unknown): string => {
  if (value instanceof Error) return value.message;
  const record = asRecord(value);
  if (record !== null && "message" in record) return String(record.message);
  return String(value);
};

// `discoverAndRefreshPositions` is a finite tick: it discovers candidate wallets
// and refreshes their positions, then ends. `catch` logs a failed tick and
// `repeat` runs the next tick after `pollIntervalMs`, so a transient error
// pauses discovery instead of stopping it silently.
// Walk the nested `.cause` chain to the deepest error, then append the PG
// diagnostics that carry the real failure (code/detail/constraint).
const describeCause = (cause: unknown): string => {
  if (cause === undefined || cause === null) return "";
  let current: unknown = cause;
  let guard = 0;
  while (guard < 20) {
    const next = causeOf(current);
    if (next === undefined) break;
    current = next;
    guard += 1;
  }
  const message = messageOf(current);
  const record = asRecord(current);
  const fields: string[] = [];
  if (record !== null) {
    for (const key of ["code", "detail", "constraint"]) {
      const text = asText(record[key]);
      if (text !== undefined) fields.push(`${key}=${text}`);
    }
  }
  return fields.length > 0 ? `${message} [${fields.join(", ")}]` : message;
};

const WhaleDiscoveryLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const config = yield* WhaleConfig;
    const service = yield* WhaleService;

    yield* Effect.forkScoped(
      service.discoverAndRefreshPositions().pipe(
        Effect.catch((error) => {
          const cause = describeCause(error.cause);
          return Effect.logWarning(
            `[whale] discovery tick failed, retrying: ${error.message}${cause.length > 0 ? ` (cause: ${cause})` : ""}`,
          );
        }),
        Effect.repeat(Schedule.spaced(Duration.millis(config.pollIntervalMs))),
      ),
    );
  }),
);

const WhaleSchemaLayer = Layer.effectDiscard(
  ensureWhaleSchema.pipe(
    Effect.tapError((error) =>
      Effect.logWarning(`[whale] schema initialization skipped: ${error.message}`),
    ),
    Effect.ignore,
  ),
);

const WhaleServiceWithInfra = whaleServiceLayer.pipe(
  Layer.provide(Layer.mergeAll(WhaleSourcesLayer, WhaleRepoLayer)),
);

const WhaleStartupLayer = Layer.mergeAll(
  WhaleSchemaLayer,
  WhaleDiscoveryLayer.pipe(Layer.provide(WhaleServiceWithInfra)),
);

export const WhaleLayer = Layer.mergeAll(WhaleServiceWithInfra, WhaleStartupLayer).pipe(
  Layer.provideMerge(WhaleConfigLayer.pipe(Layer.orDie)),
);
