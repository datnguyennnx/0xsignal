import { Effect, Exit } from "effect";
import { type AppContext } from "./effect-runtime";
export interface QueryState<A, E> {
  readonly data: A | null;
  readonly error: E | null;
  readonly isLoading: boolean;
  readonly isSuccess: boolean;
  readonly isError: boolean;
}
export declare function useEffectQuery<A, E>(
  makeEffect: () => Effect.Effect<A, E, AppContext>,
  deps?: React.DependencyList
): QueryState<A, E>;
export declare function useEffectInterval<A, E>(
  makeEffect: () => Effect.Effect<A, E, AppContext>,
  intervalMs: number,
  deps?: React.DependencyList
): QueryState<A, E>;
export interface LazyQueryResult<A, E> extends QueryState<A, E> {
  readonly execute: () => void;
  readonly reset: () => void;
}
export declare function useLazyEffectQuery<A, E>(
  makeEffect: () => Effect.Effect<A, E, AppContext>
): LazyQueryResult<A, E>;
export declare function useConcurrentQueries<
  T extends Record<string, () => Effect.Effect<any, any, AppContext>>,
>(
  queries: T,
  deps?: React.DependencyList
): QueryState<
  {
    [K in keyof T]: Effect.Effect.Success<ReturnType<T[K]>>;
  },
  {
    [K in keyof T]: Effect.Effect.Error<ReturnType<T[K]>>;
  }[keyof T]
>;
export declare function useEffectExit<A, E>(
  makeEffect: () => Effect.Effect<A, E, AppContext>,
  deps?: React.DependencyList
): Exit.Exit<A, E> | null;
//# sourceMappingURL=use-effect-query.d.ts.map
