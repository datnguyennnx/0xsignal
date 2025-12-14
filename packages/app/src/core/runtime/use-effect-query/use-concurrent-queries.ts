import { useEffect, useState, useRef, startTransition } from "react";
import { Effect, Exit, pipe, Runtime } from "effect";
import { getAppRuntime, type AppContext } from "../effect-runtime";
import { initialState, extractError, type QueryState } from "./types";

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
