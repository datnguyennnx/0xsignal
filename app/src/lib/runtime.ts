import { useEffect, useState } from "react";
import { Effect, Exit, pipe } from "effect";
import { ApiServiceLive } from "./api";

// Simple bridge between Effect and React
// Uses Effect's built-in Exit type for proper error handling
export function useEffect_<A, E, R>(
  makeEffect: () => Effect.Effect<A, E, R>,
  deps: React.DependencyList = []
) {
  const [state, setState] = useState<Exit.Exit<A, E> | null>(null);

  useEffect(() => {
    const program = pipe(
      makeEffect(),
      Effect.provide(ApiServiceLive),
      Effect.exit
    ) as Effect.Effect<Exit.Exit<A, E>, never, never>;

    Effect.runPromise(program).then(setState);
  }, deps);

  return state;
}

export function useEffectInterval<A, E, R>(
  makeEffect: () => Effect.Effect<A, E, R>,
  intervalMs: number
) {
  const [state, setState] = useState<Exit.Exit<A, E> | null>(null);

  useEffect(() => {
    const run = () => {
      const program = pipe(
        makeEffect(),
        Effect.provide(ApiServiceLive),
        Effect.exit
      ) as Effect.Effect<Exit.Exit<A, E>, never, never>;

      Effect.runPromise(program).then(setState);
    };

    run();
    const interval = setInterval(run, intervalMs);
    return () => clearInterval(interval);
  }, [makeEffect, intervalMs]);

  return state;
}
