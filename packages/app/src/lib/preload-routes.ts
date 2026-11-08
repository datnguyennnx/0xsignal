import { useEffect } from "react";
import { queryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";
import { getMarkets, getMarketPrice, getTradeAnnotation } from "@/services/api/market";
import { normalizeSymbol, parseSymbol } from "@/features/trade/lib/symbol";
import { mapToHLInterval } from "@/core/utils/hyperliquid";

/** How long the idle scheduler may wait for a free window before forcing the run. */
const IDLE_TIMEOUT_MS = 2000;

const DEFAULT_CANDLE_INTERVAL = "1h";
const DEFAULT_CANDLE_LIMIT = 200;
// The price query outlives boot; keeping the hook's window avoids pinning a stale ticker.
const PRICE_STALE_MS = 60_000;

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

  const hlInterval = mapToHLInterval(DEFAULT_CANDLE_INTERVAL);
  const normalizedSymbol = normalizeSymbol(rawCoin);
  // Loaded on demand: the candle stack (HL REST client) must not sit in the entry chunk.
  void import("@/features/trade/hooks/use-candle-history")
    .then(({ fetchHistorical }) =>
      queryClient.query({
        queryKey: queryKeys.market.candles(normalizedSymbol, hlInterval, DEFAULT_CANDLE_LIMIT),
        queryFn: () => fetchHistorical(normalizedSymbol, hlInterval, DEFAULT_CANDLE_LIMIT),
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

// The chart route is deliberately absent: its chunk statically pulls the
// charting library and would parse inside the first load's idle window.
const ROUTE_CHUNKS: ReadonlyArray<readonly [string, () => Promise<unknown>]> = [
  ["/trade", () => import("@/pages/asset-detail")],
  ["/whales/", () => import("@/pages/whale-detail")],
  ["/whales", () => import("@/pages/whales")],
  ["/portfolio", () => import("@/pages/portfolio")],
  ["/calendar", () => import("@/pages/calendar")],
  ["/settings", () => import("@/pages/settings")],
  ["/login", () => import("@/pages/login")],
  ["/auth/callback", () => import("@/pages/auth-callback")],
];

/**
 * Warms the chunk for a link the user is about to follow. Safe to call repeatedly:
 * the dynamic import is cached, so navigation never waits on a second request.
 */
export function preloadRoute(pathname: string): void {
  const match = ROUTE_CHUNKS.find(([prefix]) => pathname.startsWith(prefix));
  if (match !== undefined) void match[1]();
}

function preloadHeavyRoutes(): void {
  preloadRoute("/trade");
  preloadRoute("/whales");
}

/**
 * Warms the heaviest route chunks after first paint. Market data is owned by the
 * query client's boot prefetch and coin-index loader, so this hook never issues a
 * competing fetch.
 */
export function usePreloadRoutes(): void {
  useEffect(() => scheduleIdle(preloadHeavyRoutes), []);
}
