import { useEffect, useState } from "react";
import { Effect, Exit, pipe } from "effect";
import { ApiServiceLive } from "../api/client";

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
