import { Effect, Data, Context, Layer, pipe } from 'effect';
import type { CryptoBubbleAnalysis } from '@0xsignal/shared';

const API_BASE = import.meta.env.DEV ? '/api' : 'http://localhost:9006/api';

// ------------------------------ 
// Errors
// ------------------------------
export class ApiError extends Data.TaggedError('ApiError')<{
  readonly message: string;
  readonly status?: number;
  readonly statusText?: string;
}> {}

export class NetworkError extends Data.TaggedError('NetworkError')<{
  readonly message: string;
}> {}

// ------------------------------ 
// API Service
// ------------------------------
export class ApiService extends Context.Tag('ApiService')<
  ApiService,
  {
    readonly health: () => Effect.Effect<unknown, ApiError | NetworkError>;
    readonly getTopAnalysis: (
      limit?: number
    ) => Effect.Effect<CryptoBubbleAnalysis[], ApiError | NetworkError>;
    readonly getAnalysis: (
      symbol: string
    ) => Effect.Effect<CryptoBubbleAnalysis, ApiError | NetworkError>;
    readonly getOverview: () => Effect.Effect<any, ApiError | NetworkError>;
    readonly getSignals: () => Effect.Effect<CryptoBubbleAnalysis[], ApiError | NetworkError>;
  }
>() {}

// ------------------------------ 
// Implementation
// ------------------------------
const fetchJson = <T>(url: string, options?: RequestInit): Effect.Effect<T, ApiError | NetworkError> =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, options);

      if (!response.ok) {
        throw new ApiError({
          message: `API request failed: ${response.statusText}`,
          status: response.status,
          statusText: response.statusText,
        });
      }

      return (await response.json()) as T;
    },
    catch: (error) => {
      if (error instanceof ApiError) {
        return error;
      }
      return new NetworkError({
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    },
  });

export const ApiServiceLive = Layer.succeed(ApiService, {
  health: () => fetchJson(`${API_BASE}/health`),

  getTopAnalysis: (limit = 20) =>
    fetchJson<CryptoBubbleAnalysis[]>(`${API_BASE}/analysis/top?limit=${limit}`),

  getAnalysis: (symbol: string) =>
    fetchJson<CryptoBubbleAnalysis>(`${API_BASE}/analysis/${symbol}`),

  getOverview: () => fetchJson(`${API_BASE}/overview`),

  getSignals: () => fetchJson<CryptoBubbleAnalysis[]>(`${API_BASE}/signals`),
});

// ------------------------------ 
// Queries
// ------------------------------
export const getTopAnalysis = (limit = 20) =>
  pipe(
    ApiService,
    Effect.flatMap((api) => api.getTopAnalysis(limit))
  );

export const getOverview = () =>
  pipe(
    ApiService,
    Effect.flatMap((api) => api.getOverview())
  );

export const getSignals = () =>
  pipe(
    ApiService,
    Effect.flatMap((api) => api.getSignals())
  );

export const getAnalysis = (symbol: string) =>
  pipe(
    ApiService,
    Effect.flatMap((api) => api.getAnalysis(symbol))
  );
