import { candleToChartDataPoint, normalizeChartDataPoints } from "@0xsignal/shared";
import type {
  CandleResponse,
  RecentCandleResponse,
  WsMarketInterval,
  OrderBook,
} from "@0xsignal/shared";
import { normalizeSymbol } from "@/features/trade/lib/symbol";
import { API_BASE, fetchJson, toNumberOrNull } from "./client";
import type { AggregatedMarket, ChartDataPoint, MarketTicker, MarketPrice } from "./types";

export function getMarkets() {
  return fetchJson<AggregatedMarket[]>(`${API_BASE}/markets`);
}

export async function getCandles(params: {
  symbol: string;
  interval: WsMarketInterval;
  exchange?: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
}): Promise<ChartDataPoint[]> {
  const query = new URLSearchParams({
    symbol: normalizeSymbol(params.symbol),
    interval: params.interval,
  });

  if (params.exchange !== undefined) {
    query.set("exchange", params.exchange);
  }
  if (params.startTime !== undefined) {
    query.set("start_time", new Date(params.startTime).toISOString());
  }
  if (params.endTime !== undefined) {
    query.set("end_time", new Date(params.endTime).toISOString());
  }
  if (params.limit !== undefined) {
    query.set("limit", String(params.limit));
  }

  const payload = await fetchJson<CandleResponse>(`${API_BASE}/candles?${query.toString()}`);
  return normalizeChartDataPoints(payload.candles.map(candleToChartDataPoint));
}

export async function getRecentChartLane(params: {
  symbol: string;
  interval: WsMarketInterval;
  limit?: number;
  endTime?: number;
}): Promise<ChartDataPoint[]> {
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

  const payload = await fetchJson<RecentCandleResponse>(
    `${API_BASE}/candles/recent?${query.toString()}`,
  );
  return normalizeChartDataPoints(payload.candles.map(candleToChartDataPoint));
}

export function getTicker(symbol: string) {
  return fetchJson<MarketTicker>(
    `${API_BASE}/ticker?symbol=${encodeURIComponent(normalizeSymbol(symbol))}`,
  );
}

export function getOrderbook(symbol: string, depth?: 2 | 3 | 4 | 5): Promise<OrderBook> {
  const query = new URLSearchParams({ symbol: normalizeSymbol(symbol) });
  if (depth !== undefined) query.set("depth", String(depth));
  return fetchJson<OrderBook>(`${API_BASE}/orderbook?${query.toString()}`);
}

export function getTradeAnnotation(symbol: string) {
  return fetchJson<{
    symbol: string;
    annotation?: {
      category?: string;
      description?: string;
      displayName?: string;
      keywords?: string[];
    } | null;
  }>(`${API_BASE}/trade-annotation?symbol=${encodeURIComponent(normalizeSymbol(symbol))}`);
}

export async function getMarketPrice(symbol: string): Promise<MarketPrice> {
  const normalizedSymbol = normalizeSymbol(symbol);
  let markPx = 0;
  let midPx = 0;
  let prevDayPx = 0;
  let volume24h = 0;
  let openInterest = 0;
  let funding = 0;
  let resolvedSymbol = normalizedSymbol;

  try {
    const ticker = await getTicker(normalizedSymbol);

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
    // Logged
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
}
