import { useEffect, useState, useRef } from "react";
import { Effect, Exit, Fiber, Runtime } from "effect";
import { getAppRuntime, type AppContext } from "../effect-runtime";

/** @deprecated Use useEffectQuery instead */
export function useEffectExit<A, E>(
  makeEffect: () => Effect.Effect<A, E, AppContext>,
  deps: React.DependencyList = []
): Exit.Exit<A, E> | null {
  const [exit, setExit] = useState<Exit.Exit<A, E> | null>(null);
  const fiberRef = useRef<Fiber.RuntimeFiber<Exit.Exit<A, E>, never> | null>(null);

  useEffect(() => {
    setExit(null);
    getAppRuntime().then((runtime) => {
      const fiber = Runtime.runFork(runtime)(makeEffect().pipe(Effect.exit));
      fiberRef.current = fiber;
      fiber.addObserver((result) => {
        if (Exit.isSuccess(result)) setExit(result.value);
      });
    });

    return () => {
      if (fiberRef.current) Effect.runFork(Fiber.interrupt(fiberRef.current));
    };
  }, deps);

  return exit;
}
