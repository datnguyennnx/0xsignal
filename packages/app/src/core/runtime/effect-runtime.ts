import { Effect, Layer, Runtime, Exit, Fiber, ManagedRuntime, Schedule, Duration } from "effect";
import { ApiServiceLive, ApiServiceTag } from "../api/client";
import { CacheServiceLive, CacheServiceTag } from "../cache/effect-cache";

const BaseAppLayer = Layer.mergeAll(
  ApiServiceLive,
  CacheServiceLive.pipe(Layer.provide(ApiServiceLive))
);

export type AppContext = ApiServiceTag | CacheServiceTag;
export const AppLayer = BaseAppLayer;

let managedRuntime: ManagedRuntime.ManagedRuntime<AppContext, never> | null = null;
let runtimePromise: Promise<Runtime.Runtime<AppContext>> | null = null;

const getSingletonRuntime = async (): Promise<Runtime.Runtime<AppContext>> => {
  if (!managedRuntime) {
    managedRuntime = ManagedRuntime.make(BaseAppLayer);
  }
  return managedRuntime.runtime();
};

runtimePromise = getSingletonRuntime();

export const getAppRuntime = (): Promise<Runtime.Runtime<AppContext>> =>
  runtimePromise ?? getSingletonRuntime();

export const runEffect = async <A, E>(effect: Effect.Effect<A, E, AppContext>): Promise<A> => {
  const runtime = await getAppRuntime();
  return Runtime.runPromise(runtime)(effect);
};

export const runEffectExit = async <A, E>(
  effect: Effect.Effect<A, E, AppContext>
): Promise<Exit.Exit<A, E>> => {
  const runtime = await getAppRuntime();
  return Runtime.runPromise(runtime)(Effect.exit(effect));
};

export const forkEffect = <A, E>(
  effect: Effect.Effect<A, E, AppContext>
): Fiber.RuntimeFiber<A, E> => Effect.runFork(effect.pipe(Effect.provide(BaseAppLayer)));

export const runEffectWithTimeout = async <A, E>(
  effect: Effect.Effect<A, E, AppContext>,
  timeoutMs: number
): Promise<A | null> => {
  const runtime = await getAppRuntime();
  return Runtime.runPromise(runtime)(
    effect.pipe(
      Effect.timeoutTo({
        duration: Duration.millis(timeoutMs),
        onSuccess: (a) => a as A | null,
        onTimeout: () => null as A | null,
      })
    )
  );
};

export const runConcurrent = async <A, E>(
  effects: readonly Effect.Effect<A, E, AppContext>[]
): Promise<A[]> => {
  const runtime = await getAppRuntime();
  return Runtime.runPromise(runtime)(Effect.all(effects, { concurrency: "unbounded" }));
};

export const runBatched = async <A, E>(
  effects: Effect.Effect<A, E, AppContext>[]
): Promise<A[]> => {
  const runtime = await getAppRuntime();
  return Runtime.runPromise(runtime)(
    Effect.forEach(effects, (e) => e, { concurrency: "unbounded" })
  );
};

export const runWithConcurrencyLimit = async <A, E>(
  effects: readonly Effect.Effect<A, E, AppContext>[],
  limit: number
): Promise<A[]> => {
  const runtime = await getAppRuntime();
  return Runtime.runPromise(runtime)(Effect.all(effects, { concurrency: limit }));
};

export const runWithRetry = async <A, E>(
  effect: Effect.Effect<A, E, AppContext>,
  maxRetries = 3,
  baseDelayMs = 100
): Promise<A> => {
  const runtime = await getAppRuntime();
  return Runtime.runPromise(runtime)(
    effect.pipe(
      Effect.retry(
        Schedule.exponential(Duration.millis(baseDelayMs)).pipe(
          Schedule.intersect(Schedule.recurs(maxRetries))
        )
      )
    )
  );
};

export const runResilient = async <A, E>(
  effect: Effect.Effect<A, E, AppContext>,
  options: { timeoutMs?: number; retries?: number; baseDelayMs?: number } = {}
): Promise<A | null> => {
  const { timeoutMs = 10000, retries = 2, baseDelayMs = 200 } = options;
  const runtime = await getAppRuntime();
  return Runtime.runPromise(runtime)(
    effect.pipe(
      Effect.timeout(Duration.millis(timeoutMs)),
      Effect.retry(
        Schedule.exponential(Duration.millis(baseDelayMs)).pipe(
          Schedule.intersect(Schedule.recurs(retries))
        )
      ),
      Effect.catchAll(() => Effect.succeed(null))
    )
  );
};

export interface FiberController<A, E> {
  readonly fiber: Fiber.RuntimeFiber<A, E>;
  readonly interrupt: () => Promise<void>;
  readonly await: () => Promise<Exit.Exit<A, E>>;
  readonly isRunning: () => boolean;
}

export const createFiberController = <A, E>(
  effect: Effect.Effect<A, E, AppContext>
): FiberController<A, E> => {
  const fiber = forkEffect(effect);
  let running = true;
  fiber.addObserver(() => {
    running = false;
  });

  return {
    fiber,
    interrupt: async () => {
      await Effect.runPromise(Fiber.interrupt(fiber).pipe(Effect.asVoid));
      running = false;
    },
    await: () => Effect.runPromise(Fiber.await(fiber)),
    isRunning: () => running,
  };
};

export interface DeferredEffect<A> {
  readonly run: () => Promise<A>;
  readonly reset: () => void;
  readonly isExecuted: () => boolean;
}

export const createDeferred = <A, E>(
  effect: Effect.Effect<A, E, AppContext>
): DeferredEffect<A> => {
  let result: Promise<A> | null = null;
  return {
    run: async () => {
      if (!result) result = runEffect(effect);
      return result;
    },
    reset: () => {
      result = null;
    },
    isExecuted: () => result !== null,
  };
};

export const createMemoizedEffect = <A, B, E>(
  fn: (a: A) => Effect.Effect<B, E, never>
): Effect.Effect<(a: A) => Effect.Effect<B, E, never>, never, never> => Effect.cachedFunction(fn);

export const createCachedEffect = <A, E, R>(
  effect: Effect.Effect<A, E, R>
): Effect.Effect<Effect.Effect<A, E, R>, never, R> => Effect.cached(effect);

export const createCachedEffectWithTTL = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  ttlMs: number
): Effect.Effect<Effect.Effect<A, E, R>, never, R> =>
  Effect.cachedWithTTL(effect, Duration.millis(ttlMs));

export const disposeRuntime = async (): Promise<void> => {
  if (managedRuntime) {
    await managedRuntime.dispose();
    managedRuntime = null;
    runtimePromise = null;
  }
};
