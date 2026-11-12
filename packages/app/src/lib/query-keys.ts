import type { CalendarQuery, WhalePositionsQuery } from "@0xsignal/shared";

/**
 * Query key hierarchy — single source of truth for all React Query keys.
 *
 * Convention:
 * - Each domain has a `leaf` for prefix matching and an `all` array for broad invalidation.
 * - User keys include `address` to scope per-wallet; invalidation uses `user.all` prefix.
 * - Market keys scope per-symbol for real-time data.
 * - Asset keys scope per-symbol for static/rarely-changing asset metadata.
 */
export const queryKeys = {
  market: {
    all: ["market"] as const,
    meta: () => [...queryKeys.market.all, "meta"] as const,
    candles: (symbol: string, interval: string, limit: number) =>
      [...queryKeys.market.all, "candles", symbol, interval, limit] as const,
    /** REST seed for the live book; keyed by the store key, not the raw coin. */
    orderbookSeed: (storeKey: string) =>
      [...queryKeys.market.all, "orderbook", "seed", storeKey] as const,
  },

  asset: {
    all: ["asset"] as const,
    price: (symbol: string) => [...queryKeys.asset.all, "price", symbol] as const,
    annotation: (coin: string) => [...queryKeys.asset.all, "annotation", coin] as const,
    logo: (symbol: string) => [...queryKeys.asset.all, "logo", symbol.toUpperCase()] as const,
    /** Predicted-funding epoch shared by every countdown for the same coin. */
    nextFunding: (coin: string) => [...queryKeys.asset.all, "next-funding", coin] as const,
  },

  user: {
    all: ["user"] as const,
    agentRegistrations: (address: string) =>
      [...queryKeys.user.all, "agentRegistrations", address] as const,
    clearinghouseState: (address: string) =>
      [...queryKeys.user.all, "clearinghouseState", address] as const,
    spotClearinghouseState: (address: string) =>
      [...queryKeys.user.all, "spotClearinghouseState", address] as const,
    openOrders: (address: string) => [...queryKeys.user.all, "openOrders", address] as const,
    historicalOrders: (address: string) =>
      [...queryKeys.user.all, "historicalOrders", address] as const,
    fills: (address: string) => [...queryKeys.user.all, "fills", address] as const,
    portfolio: (address: string) => [...queryKeys.user.all, "portfolio", address] as const,
    vaultEquities: (address: string) => [...queryKeys.user.all, "vaultEquities", address] as const,
    userFunding: (address: string, startTime?: number, endTime?: number) =>
      [...queryKeys.user.all, "userFunding", address, startTime, endTime] as const,
  },

  calendar: {
    all: ["calendar"] as const,
    list: (q: CalendarQuery) =>
      [
        ...queryKeys.calendar.all,
        "list",
        q.from,
        q.to,
        q.impact,
        q.category,
        q.currency,
        q.limit,
      ] as const,
  },

  whales: {
    all: ["whales"] as const,
    portfolio: (address: string) => [...queryKeys.whales.all, "portfolio", address] as const,
    clearinghouseState: (address: string) =>
      [...queryKeys.whales.all, "clearinghouseState", address] as const,
    spotClearinghouseState: (address: string) =>
      [...queryKeys.whales.all, "spotClearinghouseState", address] as const,
    openOrders: (address: string) => [...queryKeys.whales.all, "openOrders", address] as const,
    historicalOrders: (address: string) =>
      [...queryKeys.whales.all, "historicalOrders", address] as const,
    fills: (address: string) => [...queryKeys.whales.all, "fills", address] as const,
    userFunding: (address: string, startTime?: number, endTime?: number) =>
      [...queryKeys.whales.all, "userFunding", address, startTime, endTime] as const,
    vaultEquities: (address: string) =>
      [...queryKeys.whales.all, "vaultEquities", address] as const,
    positions: (q: WhalePositionsQuery) =>
      [
        ...queryKeys.whales.all,
        "positions",
        q.symbol,
        q.side,
        q.pnlMin,
        q.pnlMax,
        q.fundingMin,
        q.sort,
        q.limit,
        q.cursor,
      ] as const,
    coin: (coin: string) => [...queryKeys.whales.all, "coin", coin] as const,
  },

  exchange: {
    all: ["exchange"] as const,
  },
} as const;
