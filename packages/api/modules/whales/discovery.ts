import { Duration, Effect, Layer, Schedule } from "effect";
import { WhaleService } from "./index";
import { WhaleConfig } from "./config";
import { asRecord } from "../../shared/parsing";
import { guardWithLeaderLock, WHALE_DISCOVERY_LOCK_KEY } from "../../platform/db/leader-lock";

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

/**
 * A finite tick: discover candidate wallets and refresh their positions, then
 * end. `catch` logs a failed tick and `repeat` schedules the next one, so a
 * transient error pauses discovery instead of stopping it silently. Only the
 * leader runs the tick; a follower skips it without crashing.
 */
export const WhaleDiscoveryLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const config = yield* WhaleConfig;
    const service = yield* WhaleService;

    yield* Effect.forkScoped(
      guardWithLeaderLock(
        WHALE_DISCOVERY_LOCK_KEY,
        service.discoverAndRefreshPositions().pipe(
          Effect.catch((error) => {
            const cause = describeCause(error.cause);
            return Effect.logWarning(
              `[whale] discovery tick failed, retrying: ${error.message}${cause.length > 0 ? ` (cause: ${cause})` : ""}`,
            );
          }),
        ),
      ).pipe(
        Effect.catch((error) =>
          Effect.logWarning(`[whale] discovery skipped, not the leader: ${error.message}`),
        ),
        Effect.repeat(Schedule.spaced(Duration.millis(config.pollIntervalMs))),
      ),
    );
  }),
);
