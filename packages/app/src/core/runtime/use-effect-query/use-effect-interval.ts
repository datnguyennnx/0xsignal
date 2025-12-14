import { useEffect, useState, useRef, startTransition } from "react";
import { Effect, Exit, pipe, Runtime } from "effect";
import { getAppRuntime, type AppContext } from "../effect-runtime";
import { initialState, extractError, type QueryState } from "./types";

export function useEffectInterval<A, E>(
  makeEffect: () => Effect.Effect<A, E, AppContext>,
  intervalMs: number,
  deps: React.DependencyList = []
): QueryState<A, E> {
  const [state, setState] = useState<QueryState<A, E>>(initialState);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const runQuery = async () => {
      const runtime = await getAppRuntime();
      if (!mountedRef.current) return;

      const exit = await Runtime.runPromise(runtime)(makeEffect().pipe(Effect.exit));
      if (!mountedRef.current) return;

      pipe(
        exit,
        Exit.match({
          onFailure: (cause) => {
            setState((prev) => ({
              ...prev,
              error: extractError(cause),
              isLoading: false,
              isError: true,
              isStale: false,
            }));
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
    };

    runQuery();
    const interval = setInterval(runQuery, intervalMs);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [intervalMs, ...deps]);

  return state;
}
