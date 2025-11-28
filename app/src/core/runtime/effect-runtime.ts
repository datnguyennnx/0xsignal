// Effect Runtime - Layer composition and execution utilities for React

import { Effect, Layer, Runtime, Exit, Fiber } from "effect";
import { ApiServiceLive, ApiServiceTag } from "../api/client";
import { CacheServiceLive, CacheServiceTag } from "../cache/effect-cache";

// Application Layer - all services composed
export const AppLayer = Layer.mergeAll(
  ApiServiceLive,
  CacheServiceLive.pipe(Layer.provide(ApiServiceLive))
);

export type AppContext = ApiServiceTag | CacheServiceTag;

// Runtime singleton
let runtimePromise: Promise<Runtime.Runtime<AppContext>> | null = null;

export const getAppRuntime = (): Promise<Runtime.Runtime<AppContext>> => {
  if (!runtimePromise) {
    runtimePromise = Effect.runPromise(
      Effect.gen(function* () {
        return yield* Effect.runtime<AppContext>();
      }).pipe(Effect.provide(AppLayer))
    );
  }
  return runtimePromise;
};

// Effect Execution
export const runEffect = <A, E>(effect: Effect.Effect<A, E, AppContext>): Promise<A> =>
  Effect.runPromise(effect.pipe(Effect.provide(AppLayer)));

export const runEffectExit = <A, E>(
  effect: Effect.Effect<A, E, AppContext>
): Promise<Exit.Exit<A, E>> =>
  Effect.runPromise(effect.pipe(Effect.provide(AppLayer), Effect.exit));

export const forkEffect = <A, E>(
  effect: Effect.Effect<A, E, AppContext>
): Fiber.RuntimeFiber<A, E> => Effect.runFork(effect.pipe(Effect.provide(AppLayer)));

export const runEffectWithTimeout = <A, E>(
  effect: Effect.Effect<A, E, AppContext>,
  timeoutMs: number
): Promise<A | null> =>
  Effect.runPromise(
    effect.pipe(
      Effect.timeoutTo({
        duration: `${timeoutMs} millis`,
        onSuccess: (a) => a as A | null,
        onTimeout: () => null as A | null,
      }),
      Effect.provide(AppLayer)
    )
  );

// Concurrent Execution
export const runConcurrent = <A, E>(
  effects: readonly Effect.Effect<A, E, AppContext>[]
): Promise<A[]> =>
  Effect.runPromise(
    Effect.all(effects, { concurrency: "unbounded" }).pipe(Effect.provide(AppLayer))
  );

export const runBatched = <A, E>(effects: Effect.Effect<A, E, AppContext>[]): Promise<A[]> =>
  Effect.runPromise(
    Effect.forEach(effects, (e) => e, { concurrency: "unbounded", batching: true }).pipe(
      Effect.provide(AppLayer)
    )
  );

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
    run: (): Promise<A> => {
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
