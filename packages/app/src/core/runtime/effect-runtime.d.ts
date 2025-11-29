import { Effect, Layer, Runtime, Exit, Fiber } from "effect";
import { ApiServiceTag } from "../api/client";
import { CacheServiceTag } from "../cache/effect-cache";
export type AppContext = ApiServiceTag | CacheServiceTag;
export declare const AppLayer: Layer.Layer<ApiServiceTag | CacheServiceTag, never, never>;
export declare const getAppRuntime: () => Promise<Runtime.Runtime<AppContext>>;
export declare const runEffect: <A, E>(effect: Effect.Effect<A, E, AppContext>) => Promise<A>;
export declare const runEffectExit: <A, E>(
  effect: Effect.Effect<A, E, AppContext>
) => Promise<Exit.Exit<A, E>>;
export declare const forkEffect: <A, E>(
  effect: Effect.Effect<A, E, AppContext>
) => Fiber.RuntimeFiber<A, E>;
export declare const runEffectWithTimeout: <A, E>(
  effect: Effect.Effect<A, E, AppContext>,
  timeoutMs: number
) => Promise<A | null>;
export declare const runConcurrent: <A, E>(
  effects: readonly Effect.Effect<A, E, AppContext>[]
) => Promise<A[]>;
export declare const runBatched: <A, E>(effects: Effect.Effect<A, E, AppContext>[]) => Promise<A[]>;
export declare const runAllUnbounded: <A, E>(
  effects: readonly Effect.Effect<A, E, AppContext>[]
) => Promise<A[]>;
export interface FiberController<A, E> {
  readonly fiber: Fiber.RuntimeFiber<A, E>;
  readonly interrupt: () => Promise<void>;
  readonly await: () => Promise<Exit.Exit<A, E>>;
}
export declare const createFiberController: <A, E>(
  effect: Effect.Effect<A, E, AppContext>
) => FiberController<A, E>;
export declare const createDeferred: <A, E>(
  effect: Effect.Effect<A, E, AppContext>
) => {
  run: () => Promise<A>;
  reset: () => void;
};
export declare const createMemoizedEffect: <A, B, E>(
  fn: (a: A) => Effect.Effect<B, E, never>
) => Effect.Effect<(a: A) => Effect.Effect<B, E, never>, never, never>;
export declare const createCachedEffect: <A, E, R>(
  effect: Effect.Effect<A, E, R>
) => Effect.Effect<Effect.Effect<A, E, R>, never, R>;
export declare const createCachedEffectWithTTL: <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  ttlMs: number
) => Effect.Effect<Effect.Effect<A, E, R>, never, R>;
//# sourceMappingURL=effect-runtime.d.ts.map
