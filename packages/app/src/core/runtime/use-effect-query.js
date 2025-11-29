// React Hooks for Effect-TS - bridges Effect layer with React components
// CRITICAL: Uses singleton runtime to ensure cache is shared across all queries
import { useEffect, useState, useRef, useCallback } from "react";
import { Effect, Exit, Fiber, pipe, Runtime } from "effect";
import { getAppRuntime } from "./effect-runtime";
const initialState = () => ({
  data: null,
  error: null,
  isLoading: true,
  isSuccess: false,
  isError: false,
});
// Primary query hook with fiber cancellation - uses singleton runtime
export function useEffectQuery(makeEffect, deps = []) {
  const [state, setState] = useState(initialState);
  const fiberRef = useRef(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    setState(initialState());
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
              setState({
                data: null,
                error: error,
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
    });
    return () => {
      mountedRef.current = false;
      if (fiberRef.current) Effect.runFork(Fiber.interrupt(fiberRef.current));
    };
  }, deps);
  return state;
}
// Polling hook with interval - uses singleton runtime
export function useEffectInterval(makeEffect, intervalMs, deps = []) {
  const [state, setState] = useState(initialState);
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
            setState((prev) => ({ ...prev, error: error, isLoading: false, isError: true }));
          },
          onSuccess: (data) => {
            setState({ data, error: null, isLoading: false, isSuccess: true, isError: false });
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
export function useLazyEffectQuery(makeEffect) {
  const [state, setState] = useState({
    data: null,
    error: null,
    isLoading: false,
    isSuccess: false,
    isError: false,
  });
  const fiberRef = useRef(null);
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
              error: error,
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
  }, [makeEffect]);
  const reset = useCallback(() => {
    if (fiberRef.current) Effect.runFork(Fiber.interrupt(fiberRef.current));
    setState({ data: null, error: null, isLoading: false, isSuccess: false, isError: false });
  }, []);
  return { ...state, execute, reset };
}
// Concurrent queries hook - uses singleton runtime
export function useConcurrentQueries(queries, deps = []) {
  const [state, setState] = useState(initialState);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    setState(initialState());
    const runQueries = async () => {
      const runtime = await getAppRuntime();
      if (!mountedRef.current) return;
      const keys = Object.keys(queries);
      const effects = keys.map((key) => queries[key]());
      const program = Effect.all(effects, { concurrency: "unbounded" }).pipe(
        Effect.map((results) => {
          const data = {};
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
              error: error,
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
    };
    runQueries();
    return () => {
      mountedRef.current = false;
    };
  }, deps);
  return state;
}
// Legacy Exit hook (deprecated - use useEffectQuery)
export function useEffectExit(makeEffect, deps = []) {
  const [exit, setExit] = useState(null);
  const fiberRef = useRef(null);
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
//# sourceMappingURL=use-effect-query.js.map
