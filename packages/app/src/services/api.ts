/**
 * @overview API Client Services
 *
 * Provides a central frontend client for backend-owned market data APIs.
 * It does not connect directly to Hyperliquid for canonical market data flows.
 *
 * @mechanism
 * - Uses native fetch for stateless HTTP requests
 * - Custom error classes (ApiError, NetworkError) for consistent error handling
 * - Maps backend payloads into app-friendly DTOs for render-local state (e.g. MarketPrice)
 */
// API Client - Simple async functions
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

interface ApiCandle {
  timestamp?: string | number;
  time?: string | number;
  t?: number;
  open?: string | number;
  high?: string | number;
  low?: string | number;
  close?: string | number;
  volume?: string | number;
  o?: string | number;
  h?: string | number;
  l?: string | number;
  c?: string | number;
  v?: string | number;
}

interface ApiCandlePayload {
  candles?: ApiCandle[];
  lane?: ApiCandle[];
  data?: ApiCandle[];
}

export function normalizeChartDataPoints(points: readonly ChartDataPoint[]): ChartDataPoint[] {
  const dedupedByTime = new Map<number, ChartDataPoint>();

  for (const point of points) {
    if (Number.isFinite(point.time)) {
      dedupedByTime.set(point.time, point);
    }
  }

  return Array.from(dedupedByTime.values()).sort((a, b) => a.time - b.time);
}

function toNumericTimestampMs(value: string | number | undefined): number | null {
  if (typeof value === "number") {
    if (Number.isFinite(value)) {
      return value > 1_000_000_000_000 ? value : value * 1000;
    }
    return null;
  }
  if (typeof value !== "string") return null;
  const num = Number(value);
  if (Number.isFinite(num)) {
    return num > 1_000_000_000_000 ? num : num * 1000;
  }
  const dateMs = Date.parse(value);
  return Number.isFinite(dateMs) ? dateMs : null;
}

function toNumberOrNull(value: unknown): number | null {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function mapCandleToChartDataPoint(candle: ApiCandle): ChartDataPoint | null {
  const tsMs = toNumericTimestampMs(candle.timestamp ?? candle.time ?? candle.t);
  const open = toNumberOrNull(candle.open ?? candle.o);
  const high = toNumberOrNull(candle.high ?? candle.h);
  const low = toNumberOrNull(candle.low ?? candle.l);
  const close = toNumberOrNull(candle.close ?? candle.c);
  const volume = toNumberOrNull(candle.volume ?? candle.v);

  if (
    tsMs === null ||
    open === null ||
    high === null ||
    low === null ||
    close === null ||
    volume === null
  ) {
    return null;
  }

  return {
    time: Math.floor(tsMs / 1000),
    open,
    high,
    low,
    close,
    volume,
  };
}

function extractCandles(payload: ApiCandlePayload | ApiCandle[]): ApiCandle[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.candles)) return payload.candles;
  if (Array.isArray(payload.lane)) return payload.lane;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

/** Shape of backend error responses */
interface ApiErrorBody {
  readonly error?: string;
  readonly code?: string;
  readonly status?: number;
}

async function parseErrorBody(response: Response): Promise<ApiErrorBody | null> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    return body;
  } catch {
    return null;
  }
}

/**
 * Unwrap API envelope: backend returns `{ data: T, meta?: ... }`.
 * For backward compat, if the response has no `data` field, return it as-is.
 */
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

    const payload = await fetchJson<ApiCandlePayload>(`${API_BASE}/candles?${query.toString()}`);
    const candles = extractCandles(payload);
    return normalizeChartDataPoints(
      candles
        .map((candle) => mapCandleToChartDataPoint(candle))
        .filter((point): point is ChartDataPoint => point !== null)
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

    const payload = await fetchJson<ApiCandlePayload>(
      `${API_BASE}/candles/recent?${query.toString()}`
    );
    const candles = extractCandles(payload);
    return normalizeChartDataPoints(
      candles
        .map((candle) => mapCandleToChartDataPoint(candle))
        .filter((point): point is ChartDataPoint => point !== null)
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
