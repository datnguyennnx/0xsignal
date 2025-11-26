import { useEffect, useState, useRef } from "react";
import { Effect, Exit, Fiber } from "effect";
import { ApiServiceLive } from "../api/client";

export function useEffect_<A, E, R>(
  makeEffect: () => Effect.Effect<A, E, R>,
  deps: React.DependencyList = []
) {
  const [state, setState] = useState<Exit.Exit<A, E> | null>(null);
  const fiberRef = useRef<Fiber.RuntimeFiber<Exit.Exit<A, E>, never> | null>(null);

  useEffect(() => {
    setState(null); // Reset on deps change

    const program = makeEffect().pipe(Effect.provide(ApiServiceLive), Effect.exit) as Effect.Effect<
      Exit.Exit<A, E>,
      never,
      never
    >;

    const fiber = Effect.runFork(program);
    fiberRef.current = fiber;

    fiber.addObserver((exit) => {
      if (Exit.isSuccess(exit)) {
        setState(exit.value);
      }
    });

    return () => {
      if (fiberRef.current) {
        Effect.runFork(Fiber.interrupt(fiberRef.current));
      }
    };
  }, deps);

  return state;
}
