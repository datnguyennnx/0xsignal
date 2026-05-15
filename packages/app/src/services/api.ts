/**
 * Frontend HTTP client for backend market data APIs.
 */
import type {
  ChartDataPoint,
  AggregatedMarket,
  MarketTicker,
  ApiEnvelope,
  ClearinghouseState,
  SpotClearinghouseState,
  OpenOrder,
  FrontendOpenOrder,
  HistoricalOrderEntry,
  UserFill,
  PlaceOrderRequest,
  UpdateLeverageRequest,
  CancelOrdersRequest,
} from "@0xsignal/shared";
import { normalizeCandle, normalizeChartDataPoints } from "@0xsignal/shared";
import { resolveApiBase } from "@/lib/api-base";
import { normalizeSymbol } from "@/features/trade/lib/symbol";

/**
 * normalizeSymbol handles all types:
 *   perps: "BTCUSDT" → "BTC"
 *   builder perps: "XYZ:YEETI" → "xyz:YEETI"
 *   spot: "PURR/USDC" → "PURR/USDC" (passes through)
 */

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const API_BASE = resolveApiBase(configuredApiUrl, import.meta.env.DEV);

// Re-export shared boundary types for consumers that import from this module.
export type { ChartDataPoint, AggregatedMarket, MarketTicker } from "@0xsignal/shared";
export type {
  ClearinghouseState,
  SpotClearinghouseState,
  OpenOrder,
  FrontendOpenOrder,
  HistoricalOrderEntry,
  UserFill,
} from "@0xsignal/shared";
export type {
  PlaceOrderRequest,
  UpdateLeverageRequest,
  CancelOrdersRequest,
} from "@0xsignal/shared";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly statusText?: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}

function toNumberOrNull(value: unknown): number | null {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function extractRawCandlePayload(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.candles)) return obj.candles as Record<string, unknown>[];
    if (Array.isArray(obj.lane)) return obj.lane as Record<string, unknown>[];
    if (Array.isArray(obj.data)) return obj.data as Record<string, unknown>[];
  }
  return [];
}

import type { ApiErrorBody } from "@0xsignal/shared";

async function parseErrorBody(response: Response): Promise<ApiErrorBody | null> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    return body;
  } catch {
    return null;
  }
}

function unwrapEnvelope<T>(json: unknown): T {
  if (json && typeof json === "object" && "data" in json) {
    return (json as ApiEnvelope<T>).data;
  }
  return json as T;
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      const errorBody = await parseErrorBody(response);
      throw new ApiError(
        errorBody?.error ?? `API request failed: ${response.statusText}`,
        response.status,
        response.statusText,
        errorBody?.code
      );
    }

    const body = await response.json();
    return unwrapEnvelope<T>(body);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new NetworkError(error instanceof Error ? error.message : "Network request failed");
  }
}

/**
 * MarketPrice — frontend-specific computed DTO.
 * Derived from ticker data + additional rendering logic.
 * This is NOT a backend response type; it's assembled locally.
 */
export interface MarketPrice {
  readonly symbol: string;
  readonly price: number;
  readonly change24h: number;
  readonly volume24h: number;
  readonly openInterest: number;
  readonly funding: number;
  readonly markPx: number;
  readonly midPx: number;
  readonly prevDayPx: number;
  readonly high24h?: number;
  readonly low24h?: number;
  readonly timestamp: Date;
}

export const api = {
  health: () => fetchJson(`${API_BASE}/health`),

  getMarkets: () => fetchJson<AggregatedMarket[]>(`${API_BASE}/markets`),

  getCandles: async (params: {
    symbol: string;
    interval: string;
    startTime?: number;
    endTime?: number;
    limit?: number;
  }): Promise<ChartDataPoint[]> => {
    const query = new URLSearchParams({
      symbol: normalizeSymbol(params.symbol),
      interval: params.interval,
    });

    if (params.startTime !== undefined) {
      query.set("start_time", new Date(params.startTime).toISOString());
    }
    if (params.endTime !== undefined) {
      query.set("end_time", new Date(params.endTime).toISOString());
    }
    if (params.limit !== undefined) {
      query.set("limit", String(params.limit));
    }

    const payload = await fetchJson(`${API_BASE}/candles?${query.toString()}`);
    const rawItems = extractRawCandlePayload(payload);
    return normalizeChartDataPoints(
      rawItems.map((item) => normalizeCandle(item)).filter((p): p is ChartDataPoint => p !== null)
    );
  },

  getRecentChartLane: async (params: {
    symbol: string;
    interval: string;
    limit?: number;
    endTime?: number;
  }): Promise<ChartDataPoint[]> => {
    const query = new URLSearchParams({
      symbol: normalizeSymbol(params.symbol),
      interval: params.interval,
    });

    if (params.limit !== undefined) {
      query.set("limit", String(params.limit));
    }
    if (params.endTime !== undefined) {
      query.set("end_time", new Date(params.endTime).toISOString());
    }

    const payload = await fetchJson(`${API_BASE}/candles/recent?${query.toString()}`);
    const rawItems = extractRawCandlePayload(payload);
    return normalizeChartDataPoints(
      rawItems.map((item) => normalizeCandle(item)).filter((p): p is ChartDataPoint => p !== null)
    );
  },

  getTicker: (symbol: string) =>
    fetchJson<MarketTicker>(
      `${API_BASE}/ticker?symbol=${encodeURIComponent(normalizeSymbol(symbol))}`
    ),

  getOrderbook: (symbol: string, depth?: number) => {
    const query = new URLSearchParams({ symbol: normalizeSymbol(symbol) });
    if (depth !== undefined) query.set("depth", String(depth));
    return fetchJson(`${API_BASE}/orderbook?${query.toString()}`);
  },

  getTradeAnnotation: (symbol: string) =>
    fetchJson<{
      symbol: string;
      annotation?: {
        category?: string;
        description?: string;
        displayName?: string;
        keywords?: string[];
      } | null;
    }>(`${API_BASE}/trade-annotation?symbol=${encodeURIComponent(normalizeSymbol(symbol))}`),

  getUserClearinghouseState: () =>
    fetchJson<ClearinghouseState>(`${API_BASE}/user/clearinghouse-state`),

  getUserSpotClearinghouseState: () =>
    fetchJson<SpotClearinghouseState>(`${API_BASE}/user/spot-clearinghouse-state`),

  getUserOpenOrders: () => fetchJson<OpenOrder[]>(`${API_BASE}/user/open-orders`),

  getUserFrontendOpenOrders: () =>
    fetchJson<FrontendOpenOrder[]>(`${API_BASE}/user/frontend-open-orders`),

  getUserHistoricalOrders: () =>
    fetchJson<HistoricalOrderEntry[]>(`${API_BASE}/user/historical-orders`),

  getUserFills: () => fetchJson<UserFill[]>(`${API_BASE}/user/fills`),

  placeOrder: (params: PlaceOrderRequest) =>
    fetchJson(`${API_BASE}/exchange/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    }),

  updateLeverage: (params: UpdateLeverageRequest) =>
    fetchJson(`${API_BASE}/exchange/leverage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    }),

  cancelOrders: (params: CancelOrdersRequest) =>
    fetchJson(`${API_BASE}/exchange/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    }),

  getMarketPrice: async (symbol: string): Promise<MarketPrice> => {
    const normalizedSymbol = normalizeSymbol(symbol);
    let markPx = 0;
    let midPx = 0;
    let prevDayPx = 0;
    let volume24h = 0;
    let openInterest = 0;
    let funding = 0;
    let resolvedSymbol = normalizedSymbol;

    try {
      const ticker = await api.getTicker(normalizedSymbol);

      const mid = toNumberOrNull(ticker.mid ?? ticker.midPx ?? ticker.markPx) ?? 0;
      markPx = toNumberOrNull(ticker.markPx) ?? mid;
      midPx = toNumberOrNull(ticker.midPx) ?? mid;
      prevDayPx = toNumberOrNull(ticker.prevDayPx) ?? markPx;
      volume24h = toNumberOrNull(ticker.dayNtlVlm) ?? 0;
      openInterest = toNumberOrNull(ticker.openInterest) ?? 0;
      funding = toNumberOrNull(ticker.funding) ?? 0;
      resolvedSymbol =
        typeof ticker.symbol === "string" && ticker.symbol.trim().length > 0
          ? ticker.symbol
          : normalizedSymbol;
    } catch (err) {
      // Gracefully handle 404/errors — return fallback data (e.g., builder perps not in main perp universe)
      console.warn("Ticker fetch failed for", normalizedSymbol, err);
    }

    const price = markPx || midPx;
    const change24h = prevDayPx > 0 ? ((price - prevDayPx) / prevDayPx) * 100 : 0;

    return {
      symbol: resolvedSymbol,
      price,
      change24h,
      volume24h,
      openInterest,
      funding,
      markPx,
      midPx,
      prevDayPx,
      high24h: undefined,
      low24h: undefined,
      timestamp: new Date(),
    };
  },
};
