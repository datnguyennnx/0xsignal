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
    orderbook: {
      all: ["market", "orderbook"] as const,
      snapshot: (symbol: string) => [...queryKeys.market.orderbook.all, symbol] as const,
    },
  },

  asset: {
    all: ["asset"] as const,
    price: (symbol: string) => [...queryKeys.asset.all, "price", symbol] as const,
    annotation: (coin: string) => [...queryKeys.asset.all, "annotation", coin] as const,
    logo: (symbol: string) => [...queryKeys.asset.all, "logo", symbol.toUpperCase()] as const,
  },

  user: {
    all: ["user"] as const,
    clearinghouseState: (address: string) => ["user", "clearinghouseState", address] as const,
    spotClearinghouseState: (address: string) =>
      ["user", "spotClearinghouseState", address] as const,
    openOrders: (address: string) => ["user", "openOrders", address] as const,
    historicalOrders: (address: string) => ["user", "historicalOrders", address] as const,
    fills: (address: string) => ["user", "fills", address] as const,
    portfolio: (address: string) => ["user", "portfolio", address] as const,
    vaultEquities: (address: string) => ["user", "vaultEquities", address] as const,
    userFunding: (address: string, startTime?: number, endTime?: number) =>
      ["user", "userFunding", address, startTime, endTime] as const,
  },

  exchange: {
    all: ["exchange"] as const,
  },
} as const;
