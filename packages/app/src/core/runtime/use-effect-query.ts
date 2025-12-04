// React Hooks for Effect-TS - bridges Effect layer with React components
// CRITICAL: Uses singleton runtime to ensure cache is shared across all queries
// Optimized for React 19.2 with startTransition for non-blocking updates

import { useEffect, useState, useRef, useCallback, startTransition } from "react";
import { Effect, Exit, Fiber, pipe, Runtime } from "effect";
import { getAppRuntime, type AppContext } from "./effect-runtime";

export interface QueryState<A, E> {
  readonly data: A | null;
  readonly error: E | null;
  readonly isLoading: boolean;
  readonly isSuccess: boolean;
  readonly isError: boolean;
  readonly isStale: boolean; // New: indicates showing cached data while revalidating
}

const initialState = <A, E>(): QueryState<A, E> => ({
  data: null,
  error: null,
  isLoading: true,
  isSuccess: false,
  isError: false,
  isStale: false,
});

// Primary query hook with fiber cancellation - uses singleton runtime
// Implements stale-while-revalidate: shows cached data while fetching fresh data
// Uses startTransition for non-blocking UI updates (React 19.2)
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

    // Stale-while-revalidate: keep previous data while loading, mark as stale
    const hasCachedData = prevDataRef.current !== null;
    setState((prev) => ({
      ...prev,
      isLoading: true,
      isStale: hasCachedData,
      data: prev.data ?? prevDataRef.current,
    }));

    // Use singleton runtime to ensure cache is shared
    getAppRuntime().then((runtime) => {
      if (!mountedRef.current) return;

      const effect = makeEffect();
      const fiber = Runtime.runFork(runtime)(effect);
      fiberRef.current = fiber;

      fiber.addObserver((exit) => {
        if (!mountedRef.current) return;
        pipe(
          exit,
          Exit.match({
            onFailure: (cause) => {
              const error = cause._tag === "Fail" ? cause.error : null;
              setState((prev) => ({
                data: prev.data, // Keep stale data on error
                error: error as E,
                isLoading: false,
                isSuccess: false,
                isError: true,
                isStale: prev.data !== null,
              }));
            },
            onSuccess: (data) => {
              prevDataRef.current = data;
              // Use startTransition for non-blocking UI update
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

// Polling hook with interval - uses singleton runtime
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

      const effect = makeEffect().pipe(Effect.exit);
      const exit = await Runtime.runPromise(runtime)(effect);

      if (!mountedRef.current) return;
      pipe(
        exit,
        Exit.match({
          onFailure: (cause) => {
            const error = cause._tag === "Fail" ? cause.error : null;
            setState((prev) => ({
              ...prev,
              error: error as E,
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

// Lazy query hook for user-triggered actions - uses singleton runtime
export interface LazyQueryResult<A, E> extends QueryState<A, E> {
  readonly execute: () => void;
  readonly reset: () => void;
}

export function useLazyEffectQuery<A, E>(
  makeEffect: () => Effect.Effect<A, E, AppContext>
): LazyQueryResult<A, E> {
  const [state, setState] = useState<QueryState<A, E>>({
    data: null,
    error: null,
    isLoading: false,
    isSuccess: false,
    isError: false,
    isStale: false,
  });
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

    const effect = makeEffect();
    const fiber = Runtime.runFork(runtime)(effect);
    fiberRef.current = fiber;

    fiber.addObserver((exit) => {
      if (!mountedRef.current) return;
      pipe(
        exit,
        Exit.match({
          onFailure: (cause) => {
            const error = cause._tag === "Fail" ? cause.error : null;
            setState({
              data: null,
              error: error as E,
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
    setState({
      data: null,
      error: null,
      isLoading: false,
      isSuccess: false,
      isError: false,
      isStale: false,
    });
  }, []);

  return { ...state, execute, reset };
}

// Concurrent queries hook - uses singleton runtime
export function useConcurrentQueries<
  T extends Record<string, () => Effect.Effect<any, any, AppContext>>,
>(
  queries: T,
  deps: React.DependencyList = []
): QueryState<
  { [K in keyof T]: Effect.Effect.Success<ReturnType<T[K]>> },
  { [K in keyof T]: Effect.Effect.Error<ReturnType<T[K]>> }[keyof T]
> {
  type ResultType = { [K in keyof T]: Effect.Effect.Success<ReturnType<T[K]>> };
  type ErrorType = { [K in keyof T]: Effect.Effect.Error<ReturnType<T[K]>> }[keyof T];

  const [state, setState] = useState<QueryState<ResultType, ErrorType>>(initialState);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    setState(initialState());

    const runQueries = async () => {
      const runtime = await getAppRuntime();
      if (!mountedRef.current) return;

      const keys = Object.keys(queries) as (keyof T)[];
      const effects = keys.map((key) => queries[key]());

      const program = Effect.all(effects, { concurrency: "unbounded" }).pipe(
        Effect.map((results) => {
          const data = {} as ResultType;
          keys.forEach((key, index) => {
            data[key] = results[index];
          });
          return data;
        }),
        Effect.exit
      );

      const exit = await Runtime.runPromise(runtime)(program);

      if (!mountedRef.current) return;
      pipe(
        exit,
        Exit.match({
          onFailure: (cause) => {
            const error = cause._tag === "Fail" ? cause.error : null;
            setState({
              data: null,
              error: error as ErrorType,
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
    };

    runQueries();

    return () => {
      mountedRef.current = false;
    };
  }, deps);

  return state;
}

// Legacy Exit hook (deprecated - use useEffectQuery)
export function useEffectExit<A, E>(
  makeEffect: () => Effect.Effect<A, E, AppContext>,
  deps: React.DependencyList = []
): Exit.Exit<A, E> | null {
  const [exit, setExit] = useState<Exit.Exit<A, E> | null>(null);
  const fiberRef = useRef<Fiber.RuntimeFiber<Exit.Exit<A, E>, never> | null>(null);

  useEffect(() => {
    setExit(null);

    getAppRuntime().then((runtime) => {
      const program = makeEffect().pipe(Effect.exit);
      const fiber = Runtime.runFork(runtime)(program);
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
