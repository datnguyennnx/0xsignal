import { Clock, Effect, Layer, Schedule } from "effect";
import { OrderIntentRepo } from "./intent-repo";
import { ORDER_INTENT_RETENTION_MS } from "./intent";
import {
  guardWithLeaderLock,
  ORDER_INTENT_PRUNE_LOCK_KEY,
  type LeaderLockError,
} from "../../platform/db/leader-lock";

/** Six-hourly is ample for a 30-day window and keeps the DELETE off the request path. */
const ORDER_INTENT_PRUNE_INTERVAL = "6 hours";
/** Let startup migrations create the table before the first prune fires. */
const ORDER_INTENT_PRUNE_STARTUP_DELAY = "30 seconds";

const logPruneFailure = (error: LeaderLockError): Effect.Effect<void> =>
  Effect.logWarning(`[order-intents] retention prune skipped: ${error.message}`);

/**
 * The cutoff is the single retention boundary: the DELETE uses `< cutoff`, so
 * rows exactly one window old survive until the next tick.
 */
export const pruneOnce: Effect.Effect<void, never, OrderIntentRepo> = Effect.gen(function* () {
  const repo = yield* OrderIntentRepo;
  const now = yield* Clock.currentTimeMillis;
  const deleted = yield* repo
    .deleteOlderThan(now - ORDER_INTENT_RETENTION_MS)
    .pipe(
      Effect.catch((error) =>
        Effect.logWarning(`[order-intents] retention prune failed: ${error.message}`).pipe(
          Effect.as(0),
        ),
      ),
    );
  if (deleted > 0) {
    yield* Effect.logInfo(`[order-intents] pruned ${deleted} intents older than 30 days`);
  }
});

export const OrderIntentRetentionLayer: Layer.Layer<never, never, OrderIntentRepo> =
  Layer.effectDiscard(
    Effect.gen(function* () {
      yield* Effect.forkScoped(
        guardWithLeaderLock(ORDER_INTENT_PRUNE_LOCK_KEY, pruneOnce).pipe(
          Effect.delay(ORDER_INTENT_PRUNE_STARTUP_DELAY),
          Effect.catch(logPruneFailure),
          Effect.repeat(Schedule.spaced(ORDER_INTENT_PRUNE_INTERVAL)),
        ),
      );
    }).pipe(Effect.scoped),
  );
