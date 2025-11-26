import { Effect } from "effect";
import type { AssetAnalysis, MarketOverview, ChartDataPoint } from "@0xsignal/shared";
import { ApiServiceTag } from "./client";
import type { ApiError, NetworkError } from "./errors";

type ApiEffect<T> = Effect.Effect<T, ApiError | NetworkError, ApiServiceTag>;

export const getTopAnalysis = (limit = 20): ApiEffect<AssetAnalysis[]> =>
  Effect.flatMap(ApiServiceTag, (api) => api.getTopAnalysis(limit));

export const getOverview = (): ApiEffect<MarketOverview> =>
  Effect.flatMap(ApiServiceTag, (api) => api.getOverview());

export const getSignals = (): ApiEffect<AssetAnalysis[]> =>
  Effect.flatMap(ApiServiceTag, (api) => api.getSignals());

export const getAnalysis = (symbol: string): ApiEffect<AssetAnalysis> =>
  Effect.flatMap(ApiServiceTag, (api) => api.getAnalysis(symbol));

export const getChartData = (
  symbol: string,
  interval: string,
  timeframe: string
): ApiEffect<ChartDataPoint[]> =>
  Effect.flatMap(ApiServiceTag, (api) => api.getChartData(symbol, interval, timeframe));
