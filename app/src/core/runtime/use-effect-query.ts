// React Hooks for Effect-TS - bridges Effect layer with React components

import { useEffect, useState, useRef } from "react";
import { Effect, Exit, Fiber, pipe } from "effect";
import { AppLayer, type AppContext } from "./effect-runtime";

export interface QueryState<A, E> {
  readonly data: A | null;
  readonly error: E | null;
  readonly isLoading: boolean;
  readonly isSuccess: boolean;
  readonly isError: boolean;
}

const initialState = <A, E>(): QueryState<A, E> => ({
  data: null,
  error: null,
  isLoading: true,
  isSuccess: false,
  isError: false,
});

// Primary query hook with fiber cancellation
export function useEffectQuery<A, E>(
  makeEffect: () => Effect.Effect<A, E, AppContext>,
  deps: React.DependencyList = []
): QueryState<A, E> {
  const [state, setState] = useState<QueryState<A, E>>(initialState);
  const fiberRef = useRef<Fiber.RuntimeFiber<A, E> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    setState(initialState());

    const effect = makeEffect().pipe(Effect.provide(AppLayer));
    const fiber = Effect.runFork(effect);
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
            });
          },
          onSuccess: (data) => {
            setState({ data, error: null, isLoading: false, isSuccess: true, isError: false });
          },
        })
      );
    });

    return () => {
      mountedRef.current = false;
      if (fiberRef.current) Effect.runFork(Fiber.interrupt(fiberRef.current));
    };
  }, deps);

  return state;
}

// Polling hook with interval
export function useEffectInterval<A, E>(
  makeEffect: () => Effect.Effect<A, E, AppContext>,
  intervalMs: number,
  deps: React.DependencyList = []
): QueryState<A, E> {
  const [state, setState] = useState<QueryState<A, E>>(initialState);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const runQuery = () => {
      const effect = makeEffect().pipe(Effect.provide(AppLayer), Effect.exit);
      Effect.runPromise(effect).then((exit) => {
        if (!mountedRef.current) return;
        pipe(
          exit,
          Exit.match({
            onFailure: (cause) => {
              const error = cause._tag === "Fail" ? cause.error : null;
              setState((prev) => ({ ...prev, error: error as E, isLoading: false, isError: true }));
            },
            onSuccess: (data) => {
              setState({ data, error: null, isLoading: false, isSuccess: true, isError: false });
            },
          })
        );
      });
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

// Lazy query hook for user-triggered actions
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

  const execute = () => {
    if (fiberRef.current) Effect.runFork(Fiber.interrupt(fiberRef.current));
    setState((prev) => ({ ...prev, isLoading: true }));

    const effect = makeEffect().pipe(Effect.provide(AppLayer));
    const fiber = Effect.runFork(effect);
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
            });
          },
          onSuccess: (data) => {
            setState({ data, error: null, isLoading: false, isSuccess: true, isError: false });
          },
        })
      );
    });
  };

  const reset = () => {
    if (fiberRef.current) Effect.runFork(Fiber.interrupt(fiberRef.current));
    setState({ data: null, error: null, isLoading: false, isSuccess: false, isError: false });
  };

  return { ...state, execute, reset };
}

// Concurrent queries hook
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
      Effect.provide(AppLayer),
      Effect.exit
    );

    Effect.runPromise(program).then((exit) => {
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
            });
          },
          onSuccess: (data) => {
            setState({ data, error: null, isLoading: false, isSuccess: true, isError: false });
          },
        })
      );
    });

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
    const program = makeEffect().pipe(Effect.provide(AppLayer), Effect.exit);
    const fiber = Effect.runFork(program);
    fiberRef.current = fiber;

    fiber.addObserver((result) => {
      if (Exit.isSuccess(result)) setExit(result.value);
    });

    return () => {
      if (fiberRef.current) Effect.runFork(Fiber.interrupt(fiberRef.current));
    };
  }, deps);

  return exit;
}
