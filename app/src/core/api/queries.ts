import { Effect, pipe } from "effect";
import { ApiService, type ChartDataPoint } from "./client";
import type { EnhancedAnalysis } from "@0xsignal/shared";
import type { ApiError, NetworkError } from "./errors";

export const getTopAnalysis = (
  limit = 20
): Effect.Effect<EnhancedAnalysis[], ApiError | NetworkError> =>
  pipe(
    ApiService,
    Effect.flatMap((api) => api.getTopAnalysis(limit))
  );

export const getOverview = (): Effect.Effect<any, ApiError | NetworkError> =>
  pipe(
    ApiService,
    Effect.flatMap((api) => api.getOverview())
  );

export const getSignals = (): Effect.Effect<EnhancedAnalysis[], ApiError | NetworkError> =>
  pipe(
    ApiService,
    Effect.flatMap((api) => api.getSignals())
  );

export const getAnalysis = (
  symbol: string
): Effect.Effect<EnhancedAnalysis, ApiError | NetworkError> =>
  pipe(
    ApiService,
    Effect.flatMap((api) => api.getAnalysis(symbol))
  );

export const getChartData = (
  symbol: string,
  interval: string,
  timeframe: string
): Effect.Effect<ChartDataPoint[], ApiError | NetworkError> =>
  pipe(
    ApiService,
    Effect.flatMap((api) => api.getChartData(symbol, interval, timeframe))
  );
