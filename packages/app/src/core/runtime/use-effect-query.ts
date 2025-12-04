import { useEffect, useState, useRef, useCallback, startTransition } from "react";
import { Effect, Exit, Fiber, pipe, Runtime, Schedule } from "effect";
import { getAppRuntime, type AppContext } from "./effect-runtime";

export interface QueryState<A, E> {
  readonly data: A | null;
  readonly error: E | null;
  readonly isLoading: boolean;
  readonly isSuccess: boolean;
  readonly isError: boolean;
  readonly isStale: boolean;
}

export interface LazyQueryResult<A, E> extends QueryState<A, E> {
  readonly execute: () => void;
  readonly reset: () => void;
}

export interface ResilientQueryOptions {
  readonly timeoutMs?: number;
  readonly retries?: number;
  readonly retryDelayMs?: number;
}

const initialState = <A, E>(): QueryState<A, E> => ({
  data: null,
  error: null,
  isLoading: true,
  isSuccess: false,
  isError: false,
  isStale: false,
});

const idleState = <A, E>(): QueryState<A, E> => ({
  data: null,
  error: null,
  isLoading: false,
  isSuccess: false,
  isError: false,
  isStale: false,
});

const extractError = <E>(cause: { _tag: string; error?: E }): E | null =>
  cause._tag === "Fail" ? (cause.error as E) : null;

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
            setState({
              data: null,
              error: extractError(cause) as ErrorType,
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

export function useConcurrentQueriesResilient<
  T extends Record<string, () => Effect.Effect<any, any, AppContext>>,
>(
  queries: T,
  deps: React.DependencyList = []
): QueryState<{ [K in keyof T]: Effect.Effect.Success<ReturnType<T[K]>> | null }, null> {
  type ResultType = { [K in keyof T]: Effect.Effect.Success<ReturnType<T[K]>> | null };

  const [state, setState] = useState<QueryState<ResultType, null>>(initialState);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    setState(initialState());

    const runQueries = async () => {
      const runtime = await getAppRuntime();
      if (!mountedRef.current) return;

      const keys = Object.keys(queries) as (keyof T)[];
      const effects = keys.map((key) =>
        queries[key]().pipe(
          Effect.map((result) => ({ key, result, error: null })),
          Effect.catchAll(() => Effect.succeed({ key, result: null, error: true }))
        )
      );

      const results = await Runtime.runPromise(runtime)(
        Effect.all(effects, { concurrency: "unbounded" })
      );
      if (!mountedRef.current) return;

      const data = {} as ResultType;
      results.forEach(({ key, result }) => {
        data[key as keyof T] = result;
      });

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
    };

    runQueries();
    return () => {
      mountedRef.current = false;
    };
  }, deps);

  return state;
}

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
