import { startTransition } from "react";
import { Effect, Exit, pipe } from "effect";
import type { AppContext } from "../effect-runtime";

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

export const initialState = <A, E>(): QueryState<A, E> => ({
  data: null,
  error: null,
  isLoading: true,
  isSuccess: false,
  isError: false,
  isStale: false,
});

export const idleState = <A, E>(): QueryState<A, E> => ({
  data: null,
  error: null,
  isLoading: false,
  isSuccess: false,
  isError: false,
  isStale: false,
});

export const extractError = <E>(cause: { _tag: string; error?: E }): E | null =>
  cause._tag === "Fail" ? (cause.error as E) : null;

export const handleSuccess = <A, E>(
  data: A,
  setState: React.Dispatch<React.SetStateAction<QueryState<A, E>>>,
  prevDataRef?: React.MutableRefObject<A | null>
) => {
  if (prevDataRef) prevDataRef.current = data;
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

export const handleFailure = <A, E>(
  cause: { _tag: string; error?: E },
  setState: React.Dispatch<React.SetStateAction<QueryState<A, E>>>
) => {
  setState((prev) => ({
    data: prev.data,
    error: extractError(cause),
    isLoading: false,
    isSuccess: false,
    isError: true,
    isStale: prev.data !== null,
  }));
};
