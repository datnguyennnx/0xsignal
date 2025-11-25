import { Effect, pipe } from "effect";
import type { AssetAnalysis, MarketOverview, ChartDataPoint } from "@0xsignal/shared";
import { ApiServiceTag } from "./client";
import type { ApiError, NetworkError } from "./errors";

export const getTopAnalysis = (
  limit = 20
): Effect.Effect<AssetAnalysis[], ApiError | NetworkError, ApiServiceTag> =>
  pipe(
    ApiServiceTag,
    Effect.flatMap((api) => api.getTopAnalysis(limit))
  );

export const getOverview = (): Effect.Effect<
  MarketOverview,
  ApiError | NetworkError,
  ApiServiceTag
> =>
  pipe(
    ApiServiceTag,
    Effect.flatMap((api) => api.getOverview())
  );

export const getSignals = (): Effect.Effect<
  AssetAnalysis[],
  ApiError | NetworkError,
  ApiServiceTag
> =>
  pipe(
    ApiServiceTag,
    Effect.flatMap((api) => api.getSignals())
  );

export const getAnalysis = (
  symbol: string
): Effect.Effect<AssetAnalysis, ApiError | NetworkError, ApiServiceTag> =>
  pipe(
    ApiServiceTag,
    Effect.flatMap((api) => api.getAnalysis(symbol))
  );

export const getChartData = (
  symbol: string,
  interval: string,
  timeframe: string
): Effect.Effect<ChartDataPoint[], ApiError | NetworkError, ApiServiceTag> =>
  pipe(
    ApiServiceTag,
    Effect.flatMap((api) => api.getChartData(symbol, interval, timeframe))
  );
