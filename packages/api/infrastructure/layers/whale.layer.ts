import { Duration, Effect, Layer, Schedule } from "effect";
import type { HttpClient } from "effect/unstable/http";
import type { PostgresConnectionPool } from "@0xsignal/auth";
import { WhaleService } from "../../application/whales/contracts";
import { whaleServiceLayer } from "../../application/whales/service";
import { WhaleConfig, WhaleConfigLayer } from "../config/whale.config";
import type { HyperliquidClient } from "../data-sources/hyperliquid/client";
import { WhaleSourcesLayer } from "../data-sources/hyperliquid/whale-source";
import { ensureWhaleSchema } from "../db/schema/whale.schema";
import { WhaleRepoLayer } from "../repos/whale.repo";

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
  while (
    current !== null &&
    typeof current === "object" &&
    "cause" in current &&
    (current as { cause?: unknown }).cause !== undefined &&
    guard < 20
  ) {
    current = (current as { cause?: unknown }).cause;
    guard += 1;
  }
  const message =
    current instanceof Error
      ? current.message
      : current !== null && typeof current === "object" && "message" in current
        ? String((current as { message?: unknown }).message)
        : String(current);
  const pg = current as { code?: unknown; detail?: unknown; constraint?: unknown };
  const fields: string[] = [];
  if (pg.code !== undefined) fields.push(`code=${String(pg.code)}`);
  if (pg.detail !== undefined) fields.push(`detail=${String(pg.detail)}`);
  if (pg.constraint !== undefined) fields.push(`constraint=${String(pg.constraint)}`);
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
    Effect.catch((error) =>
      Effect.logWarning(`[whale] schema initialization skipped: ${error.message}`),
    ),
  ),
);

const WhaleServiceWithInfra = whaleServiceLayer.pipe(
  Layer.provide(Layer.mergeAll(WhaleSourcesLayer, WhaleRepoLayer)),
);

const WhaleStartupLayer = Layer.mergeAll(
  WhaleSchemaLayer,
  WhaleDiscoveryLayer.pipe(Layer.provide(WhaleServiceWithInfra)),
);

export const WhaleLayer: Layer.Layer<
  WhaleService,
  never,
  PostgresConnectionPool | HyperliquidClient | HttpClient.HttpClient
> = Layer.mergeAll(WhaleServiceWithInfra, WhaleStartupLayer).pipe(
  Layer.provideMerge(WhaleConfigLayer.pipe(Layer.orDie)),
);
