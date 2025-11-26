import { Effect } from "effect";
import type {
  AssetAnalysis,
  MarketOverview,
  ChartDataPoint,
  BuybackSignal,
  BuybackOverview,
  ProtocolBuybackDetail,
} from "@0xsignal/shared";
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

// Buyback queries
export const getBuybackSignals = (limit = 50): ApiEffect<BuybackSignal[]> =>
  Effect.flatMap(ApiServiceTag, (api) => api.getBuybackSignals(limit));

export const getBuybackOverview = (): ApiEffect<BuybackOverview> =>
  Effect.flatMap(ApiServiceTag, (api) => api.getBuybackOverview());

export const getProtocolBuyback = (protocol: string): ApiEffect<BuybackSignal> =>
  Effect.flatMap(ApiServiceTag, (api) => api.getProtocolBuyback(protocol));

export const getProtocolBuybackDetail = (protocol: string): ApiEffect<ProtocolBuybackDetail> =>
  Effect.flatMap(ApiServiceTag, (api) => api.getProtocolBuybackDetail(protocol));
