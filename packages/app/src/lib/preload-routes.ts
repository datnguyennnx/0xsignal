import { useCallback, useEffect } from "react";
import { queryClient } from "@/lib/query-client";
import { matchRouteRecord, ROUTES } from "@/lib/routes";
import { queryKeys } from "@/lib/query-keys";
import { getMarkets, getMarketPrice, getTradeAnnotation } from "@/services/api/market";
import { normalizeSymbol, parseSymbol } from "@/features/trade/lib/symbol";
import { CHART_CANDLE_LIMIT } from "@/features/trade/lib/candle-limit";
import { mapToHLInterval, type HLInterval } from "@/core/utils/hyperliquid";

/** How long the idle scheduler may wait for a free window before forcing the run. */
const IDLE_TIMEOUT_MS = 2000;

const DEFAULT_CANDLE_INTERVAL = "1h";
// The price query outlives boot; keeping the hook's window avoids pinning a stale ticker.
const PRICE_STALE_MS = 60_000;

/**
 * The candle query the boot prefetch warms. It shares `CHART_CANDLE_LIMIT` with
 * the chart hook, so the prefetched key is exactly the one the chart reads.
 */
export function candlePrefetchTarget(rawCoin: string): {
  readonly queryKey: readonly unknown[];
  readonly symbol: string;
  readonly interval: HLInterval;
  readonly limit: number;
} {
  const symbol = normalizeSymbol(rawCoin);
  const interval = mapToHLInterval(DEFAULT_CANDLE_INTERVAL);
  return {
    queryKey: queryKeys.market.candles(symbol, interval, CHART_CANDLE_LIMIT),
    symbol,
    interval,
    limit: CHART_CANDLE_LIMIT,
  };
}

/** `/trade/BTC`, `/trade/PURR/USDC`, `/trade/xyz:TSLA`; other paths return null. */
function tradeCoinFromPath(pathname: string): string | null {
  const segments = pathname.split("/").filter((segment) => segment !== "");
  if (segments[0] !== "trade" || segments.length < 2) return null;
  return segments.length >= 3 ? `${segments[1]}/${segments[2]}` : segments[1];
}

/**
 * Fires the page's first requests before React mounts. Every call is deduped by
 * React Query against the hook that mounts a tick later, and nothing is awaited:
 * a slow network must never delay the first paint.
 */
export function prefetchCriticalQueries(pathname: string): void {
  void queryClient
    .query({ queryKey: queryKeys.market.meta(), queryFn: getMarkets, staleTime: "static" })
    .catch(() => null);

  const rawCoin = tradeCoinFromPath(pathname);
  if (rawCoin === null) return;

  void queryClient
    .query({
      queryKey: queryKeys.asset.price(rawCoin),
      queryFn: () => getMarketPrice(rawCoin),
      staleTime: PRICE_STALE_MS,
    })
    .catch(() => null);

  // Spot shows no annotation panel, so do not spend a request on it.
  const coin = parseSymbol(rawCoin).coin;
  if (coin !== "" && !rawCoin.includes("/")) {
    void queryClient
      .query({
        queryKey: queryKeys.asset.annotation(coin),
        queryFn: async () => (await getTradeAnnotation(coin)).annotation ?? null,
        staleTime: "static",
      })
      .catch(() => null);
  }

  const target = candlePrefetchTarget(rawCoin);
  // Loaded on demand: the candle stack (HL REST client) must not sit in the entry chunk.
  void import("@/features/trade/hooks/use-candle-history")
    .then(({ fetchHistorical }) =>
      queryClient.query({
        queryKey: target.queryKey,
        queryFn: () => fetchHistorical(target.symbol, target.interval, target.limit),
        staleTime: "static",
      }),
    )
    .catch(() => null);
}

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

/** Runs after first paint at the first idle window, never inside the load. */
function scheduleIdle(run: () => void): () => void {
  const idleWindow = window as IdleWindow;
  if (typeof idleWindow.requestIdleCallback !== "function") {
    const timer = setTimeout(run, IDLE_TIMEOUT_MS);
    return () => {
      clearTimeout(timer);
    };
  }
  const handle = idleWindow.requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS });
  return () => {
    idleWindow.cancelIdleCallback?.(handle);
  };
}

/**
 * Warms the chunk for a link the user is about to follow. The registry is derived
 * from the route records, so a path can never point at a stale chunk.
 */
export function preloadRoute(pathname: string): void {
  void matchRouteRecord(pathname)
    ?.handle.preload()
    .catch(() => null);
}

/** Idle-time warm of every route chunk; the dynamic imports dedupe themselves. */
export function preloadAll(): void {
  for (const record of ROUTES) void record.handle.preload().catch(() => null);
}

interface IntentEvent {
  currentTarget: HTMLElement;
}

/**
 * One handler for enter/focus/pointerdown on any link carrying `data-preload-path`.
 * A single closure serves every link, so the shell does not allocate three per item.
 */
export function usePreloadOnIntent(): (event: IntentEvent) => void {
  return useCallback((event: IntentEvent) => {
    const path = event.currentTarget.dataset.preloadPath;
    if (path !== undefined) preloadRoute(path);
  }, []);
}

/**
 * Warms every route chunk after first paint. Market data is owned by the query
 * client's boot prefetch and coin-index loader, so this hook never fetches.
 */
export function usePreloadRoutes(): void {
  useEffect(() => scheduleIdle(preloadAll), []);
}
