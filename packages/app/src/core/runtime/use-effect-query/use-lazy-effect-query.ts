import { useEffect, useState, useRef, useCallback, startTransition } from "react";
import { Effect, Exit, Fiber, pipe, Runtime } from "effect";
import { getAppRuntime, type AppContext } from "../effect-runtime";
import { idleState, extractError, type QueryState, type LazyQueryResult } from "./types";

export function useLazyEffectQuery<A, E>(
  makeEffect: () => Effect.Effect<A, E, AppContext>
): LazyQueryResult<A, E> {
  const [state, setState] = useState<QueryState<A, E>>(idleState);
  const fiberRef = useRef<Fiber.RuntimeFiber<A, E> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (fiberRef.current) Effect.runFork(Fiber.interrupt(fiberRef.current));
    };
  }, []);

  const execute = useCallback(async () => {
    if (fiberRef.current) Effect.runFork(Fiber.interrupt(fiberRef.current));
    setState((prev) => ({ ...prev, isLoading: true }));

    const runtime = await getAppRuntime();
    if (!mountedRef.current) return;

    const fiber = Runtime.runFork(runtime)(makeEffect());
    fiberRef.current = fiber;

    fiber.addObserver((exit) => {
      if (!mountedRef.current) return;
      pipe(
        exit,
        Exit.match({
          onFailure: (cause) => {
            setState({
              data: null,
              error: extractError(cause),
              isLoading: false,
              isSuccess: false,
              isError: true,
              isStale: false,
            });
          },
          onSuccess: (data) => {
            startTransition(() => {
              setState({
                data,
                error: null,
                isLoading: false,
                isSuccess: true,
                isError: false,
                isStale: false,
              });
            });
          },
        })
      );
    });
  }, [makeEffect]);

  const reset = useCallback(() => {
    if (fiberRef.current) Effect.runFork(Fiber.interrupt(fiberRef.current));
    setState(idleState());
  }, []);

  return { ...state, execute, reset };
}
