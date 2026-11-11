import { normalizeCandle } from "@0xsignal/shared";
import type {
  AggregatedMarket,
  Candle,
  CandleResponse,
  ChartDataPoint,
  MarketTicker,
  RecentCandleResponse,
  WsMarketInterval,
} from "@0xsignal/shared";
import { normalizeSymbol } from "@/features/trade/lib/symbol";
import { API_BASE, fetchJson, toNumberOrNull } from "./client";
import type { MarketPrice, MarketQuote } from "./types";

const toChartDataPoints = (candles: readonly Candle[]): ChartDataPoint[] =>
  candles.flatMap((candle) => normalizeCandle(candle) ?? []);

/** The one canonical price lookup; `null` means the ticker carried no price. */
const canonicalMid = (ticker: MarketTicker): number | null =>
  toNumberOrNull(ticker.mid) ?? toNumberOrNull(ticker.midPx) ?? toNumberOrNull(ticker.markPx);

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
  return toChartDataPoints(payload.candles);
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
  return toChartDataPoints(payload.candles);
}

export function getTicker(symbol: string) {
  return fetchJson<MarketTicker>(
    `${API_BASE}/ticker?symbol=${encodeURIComponent(normalizeSymbol(symbol))}`,
  );
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
  // A failed ticker must reject: fabricated zeros are indistinguishable from a real
  // price of 0 and they defeat the React Query error path that renders the retry state.
  const ticker = await getTicker(normalizedSymbol);

  const mid = canonicalMid(ticker);
  const markPx = toNumberOrNull(ticker.markPx);
  const midPx = toNumberOrNull(ticker.midPx);
  const prevDayPx = toNumberOrNull(ticker.prevDayPx);
  const volume24h = toNumberOrNull(ticker.dayNtlVlm);
  const openInterest = toNumberOrNull(ticker.openInterest);
  const funding = toNumberOrNull(ticker.funding);
  const resolvedSymbol =
    typeof ticker.symbol === "string" && ticker.symbol.trim().length > 0
      ? ticker.symbol
      : normalizedSymbol;

  const price =
    markPx !== null && markPx !== 0 ? markPx : midPx !== null && midPx !== 0 ? midPx : mid;
  const change24h =
    price !== null && prevDayPx !== null && prevDayPx !== 0
      ? ((price - prevDayPx) / prevDayPx) * 100
      : null;

  const quote: MarketQuote =
    price === null
      ? null
      : {
          price,
          change24h,
          volume24h,
          openInterest,
          funding,
          markPx,
          midPx,
          prevDayPx,
        };

  return {
    symbol: resolvedSymbol,
    quote,
    price: price ?? 0,
    change24h,
    volume24h,
    openInterest,
    funding,
    markPx,
    midPx,
    prevDayPx,
    timestamp: new Date(),
  };
}
