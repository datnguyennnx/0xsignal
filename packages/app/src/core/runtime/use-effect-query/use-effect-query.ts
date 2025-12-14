import { useEffect, useState, useRef } from "react";
import { Effect, Exit, Fiber, pipe, Runtime } from "effect";
import { getAppRuntime, type AppContext } from "../effect-runtime";
import { initialState, extractError, handleSuccess, handleFailure, type QueryState } from "./types";

export function useEffectQuery<A, E>(
  makeEffect: () => Effect.Effect<A, E, AppContext>,
  deps: React.DependencyList = []
): QueryState<A, E> {
  const [state, setState] = useState<QueryState<A, E>>(initialState);
  const fiberRef = useRef<Fiber.RuntimeFiber<A, E> | null>(null);
  const mountedRef = useRef(true);
  const prevDataRef = useRef<A | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    const hasCachedData = prevDataRef.current !== null;
    setState((prev) => ({
      ...prev,
      isLoading: true,
      isStale: hasCachedData,
      data: prev.data ?? prevDataRef.current,
    }));

    getAppRuntime().then((runtime) => {
      if (!mountedRef.current) return;

      const fiber = Runtime.runFork(runtime)(makeEffect());
      fiberRef.current = fiber;

      fiber.addObserver((exit) => {
        if (!mountedRef.current) return;
        pipe(
          exit,
          Exit.match({
            onFailure: (cause) => handleFailure(cause, setState),
            onSuccess: (data) => handleSuccess(data, setState, prevDataRef),
          })
        );
      });
    });

    return () => {
      mountedRef.current = false;
      if (fiberRef.current) Effect.runFork(Fiber.interrupt(fiberRef.current));
    };
  }, deps);

  return state;
}
