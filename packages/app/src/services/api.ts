/**
 * @overview API Client Services
 *
 * Provides a central frontend client for backend-owned market data APIs.
 * It does not connect directly to Hyperliquid for canonical market data flows.
 *
 * @mechanism
 * - Uses native fetch for stateless HTTP requests
 * - Custom error classes (ApiError, NetworkError) for consistent error handling
 * - Maps backend payloads into app-friendly DTOs for render-local state (e.g. FuturesPrice)
 */
// API Client - Simple async functions
import type { ChartDataPoint } from "@0xsignal/shared";
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

export type { ChartDataPoint };

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly statusText?: string
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

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      throw new ApiError(
        `API request failed: ${response.statusText}`,
        response.status,
        response.statusText
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new NetworkError(error instanceof Error ? error.message : "Network request failed");
  }
}

export interface FuturesPrice {
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

// Backend AggregatedTradeAsset (discriminated union)

export type BackendMarketType = "perp" | "spot" | "outcome";

interface BackendBaseAsset {
  readonly coin: string;
  readonly rawCoin: string;
  readonly displaySymbol: string;
  readonly dexPrefix: string | null;
  readonly isHip3: boolean;
  readonly quoteCurrency: string;
  readonly name: string;
  readonly category: string;
  readonly displayCategory: string;
  readonly isDelisted: boolean;
  readonly dex: string;
  readonly assetId: number;
  readonly marketType: BackendMarketType;
}

export interface BackendPerpAsset extends BackendBaseAsset {
  readonly marketType: "perp";
  readonly markPx: string;
  readonly prevDayPx: string;
  readonly openInterest: string;
  readonly funding: string;
  readonly dayNtlVlm: string;
  readonly maxLeverage: number;
  readonly szDecimals: number;
}

export interface BackendSpotAsset extends BackendBaseAsset {
  readonly marketType: "spot";
  readonly markPx: string;
  readonly prevDayPx: string;
  readonly dayNtlVlm: string;
  readonly dayBaseVlm: string;
  readonly circulatingSupply?: string;
  readonly totalSupply?: string;
  readonly maxLeverage: 1;
  readonly szDecimals: number;
  readonly openInterest: "0";
  readonly funding: "0";
}

export interface BackendOutcomeAsset extends BackendBaseAsset {
  readonly marketType: "outcome";
  readonly markPx: "0";
  readonly prevDayPx: "0";
  readonly dayNtlVlm: "0";
  readonly maxLeverage: 1;
  readonly szDecimals: 0;
  readonly openInterest: "0";
  readonly funding: "0";
}

export type BackendTradeAsset = BackendPerpAsset | BackendSpotAsset | BackendOutcomeAsset;

export interface BackendTickerResponse {
  symbol?: string;
  mid?: number | string | null;
  markPx?: number | string | null;
  midPx?: number | string | null;
  prevDayPx?: number | string | null;
  dayNtlVlm?: number | string | null;
  openInterest?: number | string | null;
  funding?: number | string | null;
}

export interface BackendOrderbookResponse {
  symbol?: string;
  orderbook?: unknown;
}

export interface TradeAnnotation {
  category?: string;
  description?: string;
  displayName?: string;
  keywords?: string[];
}

export interface BackendTradeAnnotationResponse {
  symbol?: string;
  annotation?: TradeAnnotation | null;
}

// User data response types from Hyperliquid SDK
export interface ClearinghouseStateResponse {
  marginSummary: {
    accountValue: string;
    totalNtlPos: string;
    totalRawUsd: string;
    totalMarginUsed: string;
  };
  crossMarginSummary: {
    accountValue: string;
    totalNtlPos: string;
    totalRawUsd: string;
    totalMarginUsed: string;
  };
  crossMaintenanceMarginUsed: string;
  withdrawable: string;
  assetPositions: Array<{
    type: "oneWay";
    position: {
      coin: string;
      szi: string;
      leverage:
        | { type: "isolated"; value: number; rawUsd: string }
        | { type: "cross"; value: number };
      entryPx: string;
      positionValue: string;
      unrealizedPnl: string;
      returnOnEquity: string;
      liquidationPx: string | null;
      marginUsed: string;
      maxLeverage: number;
      cumFunding: { allTime: string; sinceOpen: string; sinceChange: string };
    };
  }>;
  time: number;
}

export interface OpenOrderSchema {
  coin: string;
  side: "A" | "B";
  sz: string;
  limitPx: string;
  oid: number;
  timestamp: number;
  origSz?: string;
  /** Legacy: nested object e.g. { limit: { tif } } or { trigger: { isMarket, triggerPx, tpsl } }.
   *  FrontendOpenOrderSchema: string e.g. "Limit", "Stop Market", "Take Profit Market". */
  orderType?: string | Record<string, unknown>;
  triggerCondition?: string;
  triggerPx?: string;
  isTrigger?: boolean;
  isPositionTpsl?: boolean;
  reduceOnly?: boolean;
  cloid?: string | null;
  tif?: string | null;
}

export type OpenOrdersResponse = OpenOrderSchema[];

/**
 * Order shape from Hyperliquid's `frontendOpenOrders` endpoint.
 * Includes `orderType` as a native string and `children` for TP/SL relationships.
 */
export interface FrontendOpenOrderSchema {
  coin: string;
  side: "A" | "B";
  sz: string;
  limitPx: string;
  oid: number;
  timestamp: number;
  origSz: string;
  orderType: string;
  triggerCondition: string;
  triggerPx: string;
  isTrigger: boolean;
  isPositionTpsl: boolean;
  reduceOnly: boolean;
  children: FrontendOpenOrderSchema[];
  cloid: `0x${string}` | null;
  tif: "Gtc" | "Ioc" | "Alo" | "FrontendMarket" | "LiquidationMarket" | null;
}

export type FrontendOpenOrdersResponse = FrontendOpenOrderSchema[];

export interface HistoricalOrderEntry {
  order: OpenOrderSchema;
  status: "filled" | "canceled";
  statusTimestamp: number;
}

export type HistoricalOrdersResponse = HistoricalOrderEntry[];

export interface UserFillSchema {
  coin: string;
  side: "A" | "B";
  sz: string;
  px: string;
  fee: string;
  hash: string;
  time: number;
  closedPnl?: string;
}

export type UserFillsResponse = UserFillSchema[];

// Spot clearinghouse state (source of truth for USDC balance)
export interface SpotClearinghouseStateResponse {
  balances: Array<{
    coin: string;
    token: number;
    total: string;
    hold: string;
    entryNtl: string;
  }>;
  evmEscrows?: Array<{
    coin: string;
    token: number;
    total: string;
  }>;
}

// Exchange API types
export interface PlaceOrderRequest {
  orders: Array<{
    a: number;
    b: boolean;
    p: string;
    s: string;
    r: boolean;
    t:
      | { limit: { tif: "Gtc" | "Ioc" | "Alo" | "FrontendMarket" } }
      | { trigger: { isMarket: boolean; triggerPx: string; tpsl: "tp" | "sl" } };
  }>;
  grouping?: "na" | "normalTpsl" | "positionTpsl";
}

export interface UpdateLeverageRequest {
  asset: number;
  isCross: boolean;
  leverage: number;
}

export interface CancelOrdersRequest {
  cancels: Array<{ coin: string; o: number }>;
}

export const api = {
  health: () => fetchJson(`${API_BASE}/health`),

  getMarkets: () => fetchJson<BackendTradeAsset[]>(`${API_BASE}/markets`),

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
    fetchJson<BackendTickerResponse>(
      `${API_BASE}/ticker?symbol=${encodeURIComponent(normalizeSymbol(symbol))}`
    ),

  getOrderbook: (symbol: string, depth?: number) => {
    const query = new URLSearchParams({ symbol: normalizeSymbol(symbol) });
    if (depth !== undefined) query.set("depth", String(depth));
    return fetchJson<BackendOrderbookResponse>(`${API_BASE}/orderbook?${query.toString()}`);
  },

  getTradeAnnotation: (symbol: string) =>
    fetchJson<BackendTradeAnnotationResponse>(
      `${API_BASE}/trade-annotation?symbol=${encodeURIComponent(normalizeSymbol(symbol))}`
    ),

  getUserClearinghouseState: () =>
    fetchJson<ClearinghouseStateResponse>(`${API_BASE}/user/clearinghouse-state`),

  getUserSpotClearinghouseState: () =>
    fetchJson<SpotClearinghouseStateResponse>(`${API_BASE}/user/spot-clearinghouse-state`),

  getUserOpenOrders: () => fetchJson<OpenOrdersResponse>(`${API_BASE}/user/open-orders`),

  getUserFrontendOpenOrders: () =>
    fetchJson<FrontendOpenOrdersResponse>(`${API_BASE}/user/frontend-open-orders`),

  getUserHistoricalOrders: () =>
    fetchJson<HistoricalOrdersResponse>(`${API_BASE}/user/historical-orders`),

  getUserFills: () => fetchJson<UserFillsResponse>(`${API_BASE}/user/fills`),

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

  getFuturesPrice: async (symbol: string): Promise<FuturesPrice> => {
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
