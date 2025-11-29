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
// SINGLETON: Build the layer ONCE and reuse the runtime
// This ensures the Effect Cache instances are shared across all requests
let singletonScope = null;
let singletonRuntime = null;
const getSingletonRuntime = async () => {
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
export const getAppRuntime = () => runtimePromise;
// Effect Execution - uses singleton runtime
export const runEffect = async (effect) => {
  const runtime = await runtimePromise;
  return Runtime.runPromise(runtime)(effect);
};
export const runEffectExit = async (effect) => {
  const runtime = await runtimePromise;
  return Runtime.runPromise(runtime)(Effect.exit(effect));
};
export const forkEffect = (effect) => Effect.runFork(effect.pipe(Effect.provide(BaseAppLayer)));
export const runEffectWithTimeout = async (effect, timeoutMs) => {
  const runtime = await runtimePromise;
  return Runtime.runPromise(runtime)(
    effect.pipe(
      Effect.timeoutTo({
        duration: `${timeoutMs} millis`,
        onSuccess: (a) => a,
        onTimeout: () => null,
      })
    )
  );
};
// Concurrent Execution - unbounded concurrency for maximum performance
export const runConcurrent = async (effects) => {
  const runtime = await runtimePromise;
  return Runtime.runPromise(runtime)(Effect.all(effects, { concurrency: "unbounded" }));
};
export const runBatched = async (effects) => {
  const runtime = await runtimePromise;
  return Runtime.runPromise(runtime)(
    Effect.forEach(effects, (e) => e, { concurrency: "unbounded", batching: true })
  );
};
// Run all effects with unbounded concurrency and request deduplication
export const runAllUnbounded = async (effects) => {
  const runtime = await runtimePromise;
  return Runtime.runPromise(runtime)(
    Effect.all(effects, { concurrency: "unbounded", batching: true })
  );
};
export const createFiberController = (effect) => {
  const fiber = forkEffect(effect);
  return {
    fiber,
    interrupt: () => Effect.runPromise(Fiber.interrupt(fiber).pipe(Effect.asVoid)),
    await: () => Effect.runPromise(Fiber.await(fiber)),
  };
};
// Deferred Execution
export const createDeferred = (effect) => {
  let result = null;
  return {
    run: async () => {
      if (!result) result = runEffect(effect);
      return result;
    },
    reset: () => {
      result = null;
    },
  };
};
// Effect Memoization
export const createMemoizedEffect = (fn) => Effect.cachedFunction(fn);
export const createCachedEffect = (effect) => Effect.cached(effect);
export const createCachedEffectWithTTL = (effect, ttlMs) =>
  Effect.cachedWithTTL(effect, `${ttlMs} millis`);
//# sourceMappingURL=effect-runtime.js.map
