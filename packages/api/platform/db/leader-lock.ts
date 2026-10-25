import { Context, Data, Effect, Layer, Option } from "effect";
import { PostgresConnectionPool } from "@0xsignal/auth";

/**
 * Advisory-lock keys are process-independent, so every instance of a job must
 * use the same number. They are fixed contract values, not configuration.
 */
export const MARKETS_REFRESH_LOCK_KEY = 41_001;
export const WHALE_DISCOVERY_LOCK_KEY = 41_002;
export const ORDER_INTENT_PRUNE_LOCK_KEY = 41_003;

export class LeaderLockError extends Data.TaggedError("LeaderLockError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export interface LeaderLockPort {
  readonly runExclusive: <A, E, R>(
    key: number,
    effect: Effect.Effect<A, E, R>,
  ) => Effect.Effect<Option.Option<A>, E | LeaderLockError, R>;
}

export class LeaderLock extends Context.Service<LeaderLock, LeaderLockPort>()("LeaderLock") {}

type PoolClient = import("pg").PoolClient;
type Pool = NonNullable<import("pg").Pool>;

const lockError = (message: string, cause: unknown): LeaderLockError =>
  new LeaderLockError({ message, cause });

const acquireClient = (pool: Pool): Effect.Effect<PoolClient, LeaderLockError> =>
  Effect.tryPromise({
    try: () => pool.connect(),
    catch: (cause) => lockError("Could not acquire a leadership connection", cause),
  });

const tryLock = (client: PoolClient, key: number): Effect.Effect<boolean, LeaderLockError> =>
  Effect.tryPromise({
    try: async () => {
      const result = await client.query<{ locked: boolean }>(
        "SELECT pg_try_advisory_lock($1) AS locked",
        [key],
      );
      return result.rows[0]?.locked ?? false;
    },
    catch: (cause) => lockError(`Could not acquire advisory lock ${key}`, cause),
  });

// The connection is returned to the pool either way; a failed unlock is not
// worth failing the tick, because releasing the session drops the lock too.
const unlockAndRelease = (client: PoolClient, key: number): Effect.Effect<void> =>
  Effect.tryPromise({
    try: () => client.query("SELECT pg_advisory_unlock($1)", [key]),
    catch: (cause) => lockError(`Could not release advisory lock ${key}`, cause),
  }).pipe(
    Effect.ignore,
    Effect.ensuring(
      Effect.sync(() => {
        client.release();
      }),
    ),
  );

const makePgLeaderLock = (pool: Pool): LeaderLockPort => {
  const runExclusive = <A, E, R>(
    key: number,
    effect: Effect.Effect<A, E, R>,
  ): Effect.Effect<Option.Option<A>, E | LeaderLockError, R> =>
    Effect.acquireUseRelease(
      acquireClient(pool),
      (client) =>
        Effect.gen(function* () {
          const acquired = yield* tryLock(client, key);
          if (!acquired) return Option.none<A>();
          const value = yield* effect;
          return Option.some(value);
        }),
      (client) => unlockAndRelease(client, key),
    );

  return { runExclusive };
};

/** Without a pool there is no second instance to compete with, so run normally. */
const alwaysLeader: LeaderLockPort = {
  runExclusive: (_key, effect) => effect.pipe(Effect.map(Option.some)),
};

export const leaderLockLayer: Layer.Layer<LeaderLock, never, PostgresConnectionPool> = Layer.effect(
  LeaderLock,
  Effect.gen(function* () {
    const pool = yield* PostgresConnectionPool;
    return LeaderLock.of(pool === null ? alwaysLeader : makePgLeaderLock(pool));
  }),
);

/**
 * A non-leader skips the effect. Callers keep their own error handling; this
 * only adds the optional lock, so a test or single-process runtime without a
 * LeaderLock in context still runs its background job.
 */
export const guardWithLeaderLock = <A, E, R>(
  key: number,
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<void, E | LeaderLockError, R> =>
  Effect.gen(function* () {
    const maybeLock = yield* Effect.serviceOption(LeaderLock);
    if (Option.isNone(maybeLock)) {
      yield* Effect.asVoid(effect);
      return;
    }
    yield* maybeLock.value.runExclusive(key, effect).pipe(Effect.asVoid);
  });
