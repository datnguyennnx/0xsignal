import { useEffect, useState, useRef, startTransition } from "react";
import { Effect, Exit, Fiber, pipe, Runtime, Schedule } from "effect";
import { getAppRuntime, type AppContext } from "../effect-runtime";
import { initialState, extractError, type QueryState, type ResilientQueryOptions } from "./types";

export function useResilientQuery<A, E>(
  makeEffect: () => Effect.Effect<A, E, AppContext>,
  deps: React.DependencyList = [],
  options: ResilientQueryOptions = {}
): QueryState<A, E> {
  const { timeoutMs = 15000, retries = 2, retryDelayMs = 500 } = options;
  const [state, setState] = useState<QueryState<A, E>>(initialState);
  const fiberRef = useRef<Fiber.RuntimeFiber<A, E | null> | null>(null);
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

      const resilientEffect = makeEffect().pipe(
        Effect.timeoutFail({
          duration: `${timeoutMs} millis`,
          onTimeout: () => null as E,
        }),
        Effect.retry(
          Schedule.exponential(`${retryDelayMs} millis`).pipe(
            Schedule.intersect(Schedule.recurs(retries))
          )
        ),
        Effect.catchAll(() =>
          prevDataRef.current !== null
            ? Effect.succeed(prevDataRef.current)
            : Effect.fail(null as E)
        )
      );

      const fiber = Runtime.runFork(runtime)(resilientEffect);
      fiberRef.current = fiber as Fiber.RuntimeFiber<A, E | null>;

      fiber.addObserver((exit) => {
        if (!mountedRef.current) return;
        pipe(
          exit,
          Exit.match({
            onFailure: (cause) => {
              setState((prev) => ({
                data: prev.data,
                error: extractError(cause),
                isLoading: false,
                isSuccess: false,
                isError: true,
                isStale: prev.data !== null,
              }));
            },
            onSuccess: (data) => {
              prevDataRef.current = data;
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
    });

    return () => {
      mountedRef.current = false;
      if (fiberRef.current) Effect.runFork(Fiber.interrupt(fiberRef.current));
    };
  }, deps);

  return state;
}
