import { Clock, Effect, Layer, Schedule } from "effect";
import { CalendarRepo } from "./repo";
import {
  ECONOMIC_EVENT_PRUNE_LOCK_KEY,
  guardWithLeaderLock,
  type LeaderLockError,
} from "../../platform/db/leader-lock";

/** Macro calendars only ever surface forward windows; six months of history is ample. */
export const ECONOMIC_EVENT_RETENTION_MS = 180 * 24 * 60 * 60 * 1000;

/** Six-hourly keeps the DELETE off the request path. */
const ECONOMIC_EVENT_PRUNE_INTERVAL = "6 hours";
/** Let startup migrations create the table before the first prune fires. */
const ECONOMIC_EVENT_PRUNE_STARTUP_DELAY = "30 seconds";

const logPruneFailure = (error: LeaderLockError): Effect.Effect<void> =>
  Effect.logWarning(`[calendar] retention prune skipped: ${error.message}`);

/**
 * The cutoff is the single retention boundary: the DELETE uses `< cutoff`, so
 * rows exactly one window old survive until the next tick.
 */
export const pruneOnce: Effect.Effect<void, never, CalendarRepo> = Effect.gen(function* () {
  const repo = yield* CalendarRepo;
  const now = yield* Clock.currentTimeMillis;
  const deleted = yield* repo
    .deleteOlderThan(now - ECONOMIC_EVENT_RETENTION_MS)
    .pipe(
      Effect.catch((error) =>
        Effect.logWarning(`[calendar] retention prune failed: ${error.message}`).pipe(Effect.as(0)),
      ),
    );
  if (deleted > 0) {
    yield* Effect.logInfo(`[calendar] pruned ${deleted} events older than 180 days`);
  }
});

export const CalendarRetentionLayer: Layer.Layer<never, never, CalendarRepo> = Layer.effectDiscard(
  Effect.gen(function* () {
    yield* Effect.forkScoped(
      guardWithLeaderLock(ECONOMIC_EVENT_PRUNE_LOCK_KEY, pruneOnce).pipe(
        Effect.delay(ECONOMIC_EVENT_PRUNE_STARTUP_DELAY),
        Effect.catch(logPruneFailure),
        Effect.repeat(Schedule.spaced(ECONOMIC_EVENT_PRUNE_INTERVAL)),
      ),
    );
  }).pipe(Effect.scoped),
);
