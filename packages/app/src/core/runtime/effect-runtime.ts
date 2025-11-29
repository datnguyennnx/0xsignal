// Effect Runtime - Layer composition and execution utilities for React
// CRITICAL: Uses a singleton layer to ensure cache is shared across all requests

import { Effect, Layer, Runtime, Exit, Fiber, Scope } from "effect";
import { ApiServiceLive, ApiServiceTag } from "../api/client";
import { CacheServiceLive, CacheServiceTag } from "../cache/effect-cache";

// Application Layer - all services composed
const BaseAppLayer = Layer.mergeAll(
  ApiServiceLive,
  CacheServiceLive.pipe(Layer.provide(ApiServiceLive))
);

export type AppContext = ApiServiceTag | CacheServiceTag;

// SINGLETON: Build the layer ONCE and reuse the runtime
// This ensures the Effect Cache instances are shared across all requests
let singletonScope: Scope.CloseableScope | null = null;
let singletonRuntime: Runtime.Runtime<AppContext> | null = null;

const getSingletonRuntime = async (): Promise<Runtime.Runtime<AppContext>> => {
  if (singletonRuntime) return singletonRuntime;

  // Create a scope that lives for the lifetime of the app
  singletonScope = Effect.runSync(Scope.make());

  // Build the layer once and get the runtime
  const runtimeEffect = Layer.toRuntime(BaseAppLayer).pipe(
    Effect.scoped,
    Effect.map((rt) => rt)
  );

  singletonRuntime = await Effect.runPromise(
    Effect.provide(runtimeEffect, Layer.succeed(Scope.Scope, singletonScope))
  );

  return singletonRuntime;
};

// Initialize runtime eagerly
const runtimePromise = getSingletonRuntime();

// For synchronous access after initialization
export const AppLayer = BaseAppLayer;

export const getAppRuntime = (): Promise<Runtime.Runtime<AppContext>> => runtimePromise;

// Effect Execution - uses singleton runtime
export const runEffect = async <A, E>(effect: Effect.Effect<A, E, AppContext>): Promise<A> => {
  const runtime = await runtimePromise;
  return Runtime.runPromise(runtime)(effect);
};

export const runEffectExit = async <A, E>(
  effect: Effect.Effect<A, E, AppContext>
): Promise<Exit.Exit<A, E>> => {
  const runtime = await runtimePromise;
  return Runtime.runPromise(runtime)(Effect.exit(effect));
};

export const forkEffect = <A, E>(
  effect: Effect.Effect<A, E, AppContext>
): Fiber.RuntimeFiber<A, E> => Effect.runFork(effect.pipe(Effect.provide(BaseAppLayer)));

export const runEffectWithTimeout = async <A, E>(
  effect: Effect.Effect<A, E, AppContext>,
  timeoutMs: number
): Promise<A | null> => {
  const runtime = await runtimePromise;
  return Runtime.runPromise(runtime)(
    effect.pipe(
      Effect.timeoutTo({
        duration: `${timeoutMs} millis`,
        onSuccess: (a) => a as A | null,
        onTimeout: () => null as A | null,
      })
    )
  );
};

// Concurrent Execution - unbounded concurrency for maximum performance
export const runConcurrent = async <A, E>(
  effects: readonly Effect.Effect<A, E, AppContext>[]
): Promise<A[]> => {
  const runtime = await runtimePromise;
  return Runtime.runPromise(runtime)(Effect.all(effects, { concurrency: "unbounded" }));
};

export const runBatched = async <A, E>(
  effects: Effect.Effect<A, E, AppContext>[]
): Promise<A[]> => {
  const runtime = await runtimePromise;
  return Runtime.runPromise(runtime)(
    Effect.forEach(effects, (e) => e, { concurrency: "unbounded", batching: true })
  );
};

// Run all effects with unbounded concurrency and request deduplication
export const runAllUnbounded = async <A, E>(
  effects: readonly Effect.Effect<A, E, AppContext>[]
): Promise<A[]> => {
  const runtime = await runtimePromise;
  return Runtime.runPromise(runtime)(
    Effect.all(effects, { concurrency: "unbounded", batching: true })
  );
};

// Fiber Controller for React lifecycle
export interface FiberController<A, E> {
  readonly fiber: Fiber.RuntimeFiber<A, E>;
  readonly interrupt: () => Promise<void>;
  readonly await: () => Promise<Exit.Exit<A, E>>;
}

export const createFiberController = <A, E>(
  effect: Effect.Effect<A, E, AppContext>
): FiberController<A, E> => {
  const fiber = forkEffect(effect);
  return {
    fiber,
    interrupt: () => Effect.runPromise(Fiber.interrupt(fiber).pipe(Effect.asVoid)),
    await: () => Effect.runPromise(Fiber.await(fiber)),
  };
};

// Deferred Execution
export const createDeferred = <A, E>(effect: Effect.Effect<A, E, AppContext>) => {
  let result: Promise<A> | null = null;
  return {
    run: async (): Promise<A> => {
      if (!result) result = runEffect(effect);
      return result;
    },
    reset: () => {
      result = null;
    },
  };
};

// Effect Memoization
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
  Effect.cachedWithTTL(effect, `${ttlMs} millis`);
