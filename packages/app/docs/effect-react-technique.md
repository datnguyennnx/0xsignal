# Effect-TS + React 19.2 Integration Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    React Components                          │
│  (UI Layer - React 19.2 Compiler auto-optimizes)            │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                 useEffectQuery Hook                          │
│  (Bridge: React ↔ Effect-TS with Fiber cancellation)        │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│              Effect Cache Layer                              │
│  (TTL-based caching via Cache.make)                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│              ApiService (Context.Tag)                        │
│  (Dependency injection via Effect Layer)                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                  HTTP Fetch                                  │
│  (Effect.tryPromise with typed errors)                      │
└─────────────────────────────────────────────────────────────┘
```

## Core Concepts

### 1. Service Layer (Dependency Injection)

Effect-TS uses `Context.Tag` for type-safe dependency injection:

```typescript
// Define service interface
export interface ApiService {
  readonly getTopAnalysis: (limit?: number) => Effect.Effect<AssetAnalysis[], ApiError>;
}

// Create tag for DI
export class ApiServiceTag extends Context.Tag("ApiService")<ApiServiceTag, ApiService>() {}

// Implement service
export const ApiServiceLive = Layer.succeed(ApiServiceTag, {
  getTopAnalysis: (limit = 20) => fetchJson(`/api/analysis/top?limit=${limit}`),
});
```

### 2. Layer Composition

Layers compose services with their dependencies:

```typescript
// Compose all services into AppLayer
export const AppLayer = Layer.mergeAll(
  ApiServiceLive,
  CacheServiceLive.pipe(Layer.provide(ApiServiceLive)) // Cache depends on Api
);

export type AppContext = ApiServiceTag | CacheServiceTag;
```

### 3. Cache Layer (TTL-based)

Effect's `Cache.make` provides automatic TTL and capacity management:

```typescript
const CACHE_CONFIG = {
  SHORT_TTL: Duration.seconds(30), // Real-time data
  MEDIUM_TTL: Duration.minutes(2), // Analysis data
  LONG_TTL: Duration.minutes(10), // Static metadata
};

const makeTopAnalysisCache = Effect.gen(function* () {
  return yield* Cache.make({
    capacity: 10,
    timeToLive: CACHE_CONFIG.MEDIUM_TTL,
    lookup: (limit: number) =>
      pipe(
        ApiServiceTag,
        Effect.flatMap((api) => api.getTopAnalysis(limit))
      ),
  });
});
```

### 4. Cached Query Functions

Expose cache through simple functions:

```typescript
export const cachedTopAnalysis = (limit = 20) =>
  Effect.gen(function* () {
    const cache = yield* CacheServiceTag;
    return yield* cache.topAnalysis.get(limit);
  });
```

## React Integration

### useEffectQuery Hook

Primary hook for data fetching with automatic cleanup:

```typescript
export function useEffectQuery<A, E>(
  makeEffect: () => Effect.Effect<A, E, AppContext>,
  deps: React.DependencyList = []
): QueryState<A, E> {
  const [state, setState] = useState<QueryState<A, E>>(initialState);
  const fiberRef = useRef<Fiber.RuntimeFiber<A, E> | null>(null);

  useEffect(() => {
    // Fork effect as fiber
    const fiber = Effect.runFork(makeEffect().pipe(Effect.provide(AppLayer)));
    fiberRef.current = fiber;

    // Observe completion
    fiber.addObserver((exit) => {
      Exit.match(exit, {
        onFailure: (cause) => setState({ error: cause.error, isError: true, ... }),
        onSuccess: (data) => setState({ data, isSuccess: true, ... }),
      });
    });

    // Cleanup: interrupt fiber on unmount
    return () => {
      if (fiberRef.current) Effect.runFork(Fiber.interrupt(fiberRef.current));
    };
  }, deps);

  return state;
}
```

### Usage in Components

```typescript
function Dashboard() {
  // Effect-TS handles caching, React Compiler handles memoization
  const { data, isLoading, isError } = useEffectQuery(
    () => cachedTopAnalysis(100),
    []
  );

  if (isLoading) return <Loading />;
  if (isError) return <Error />;
  return <Content data={data} />;
}
```

### Available Hooks

| Hook                   | Purpose                                       |
| ---------------------- | --------------------------------------------- |
| `useEffectQuery`       | Primary data fetching with fiber cancellation |
| `useEffectInterval`    | Polling at fixed intervals                    |
| `useLazyEffectQuery`   | User-triggered queries (execute on demand)    |
| `useConcurrentQueries` | Parallel fetching of multiple queries         |

## React 19.2 Compiler Integration

### Auto-Optimized (No manual memo needed)

- Simple components with primitive props
- Event handlers
- Derived values from props/state
- Pure function calls in render

### Manual Optimization (Keep)

```typescript
// useMemo: Expensive computations
const chartOption = useMemo(() => buildChartConfig(data, isDark), [data, isDark]);

// useCallback: External library refs
const handleResize = useCallback(() => chart.resize(), []);

// memo: Dialog/Modal (prevent re-mount)
export const DetailDialog = memo(function DetailDialog(props) { ... });
```

## Error Handling

### Typed Errors

```typescript
// Define error types
export class ApiError extends Data.TaggedError("ApiError")<{
  message: string;
  status: number;
}> {}

export class NetworkError extends Data.TaggedError("NetworkError")<{
  message: string;
}> {}

// Handle in fetch
const fetchJson = <T>(url: string): Effect.Effect<T, ApiError | NetworkError> =>
  Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: () => fetch(url),
      catch: (e) => new NetworkError({ message: e.message }),
    });

    if (!response.ok) {
      return yield* Effect.fail(
        new ApiError({ message: response.statusText, status: response.status })
      );
    }

    return yield* Effect.tryPromise({
      try: () => response.json(),
      catch: () => new NetworkError({ message: "JSON parse failed" }),
    });
  });
```

## Concurrency Patterns

### Parallel Execution

```typescript
// Run multiple effects concurrently
const fetchDashboard = Effect.gen(function* () {
  const [analyses, overview] = yield* Effect.all([cachedTopAnalysis(50), cachedOverview()], {
    concurrency: "unbounded",
  });
  return { analyses, overview };
});
```

### Fiber Control

```typescript
// Create controllable fiber
export const createFiberController = <A, E>(effect: Effect.Effect<A, E, AppContext>) => {
  const fiber = Effect.runFork(effect.pipe(Effect.provide(AppLayer)));
  return {
    fiber,
    interrupt: () => Effect.runPromise(Fiber.interrupt(fiber).pipe(Effect.asVoid)),
    await: () => Effect.runPromise(Fiber.await(fiber)),
  };
};
```

## File Structure

```
src/core/
├── api/
│   ├── client.ts      # ApiService definition + implementation
│   └── errors.ts      # ApiError, NetworkError types
├── cache/
│   └── effect-cache.ts # CacheService with TTL configs
├── runtime/
│   ├── effect-runtime.ts   # AppLayer, runEffect utilities
│   └── use-effect-query.ts # React hooks bridge
└── utils/
    ├── formatters.ts  # formatPrice, formatCurrency, etc.
    └── colors.ts      # Chart color utilities
```

## Best Practices

1. **Cache at the Effect layer** - Not in React components
2. **Use generators** - `Effect.gen(function* () { ... })` for readability
3. **Type errors explicitly** - `Effect.Effect<A, E, R>` with proper E type
4. **Interrupt on unmount** - Always cleanup fibers in useEffect return
5. **Compose layers** - Use `Layer.provide` for dependencies
6. **Keep React pure** - Let Effect handle side effects, React handles UI
