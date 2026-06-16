export const queryKeys = {
  // Chart domain
  chart: {
    all: ["chart"] as const,
    candles: (symbol: string, interval: string, limit: number) =>
      [...queryKeys.chart.all, "candles", symbol, interval, limit] as const,
  },

  // Market data domain
  marketData: {
    all: ["marketData"] as const,
    markets: () => [...queryKeys.marketData.all, "markets"] as const,
  },

  // Asset/Analysis domain
  asset: {
    all: ["asset"] as const,
    bySymbol: (symbol: string) => [...queryKeys.asset.all, symbol] as const,
  },

  // User data domain
  userData: {
    all: ["userData"] as const,
    clearinghouseState: () => [...queryKeys.userData.all, "clearinghouseState"] as const,
    spotClearinghouseState: () => [...queryKeys.userData.all, "spotClearinghouseState"] as const,
    openOrders: () => [...queryKeys.userData.all, "openOrders"] as const,
    historicalOrders: () => [...queryKeys.userData.all, "historicalOrders"] as const,
    fills: () => [...queryKeys.userData.all, "fills"] as const,
    portfolio: () => [...queryKeys.userData.all, "portfolio"] as const,
    vaultEquities: () => [...queryKeys.userData.all, "vaultEquities"] as const,
    userFunding: () => [...queryKeys.userData.all, "userFunding"] as const,
  },

  // Exchange domain (order placement, leverage)
  exchange: {
    all: ["exchange"] as const,
    order: () => [...queryKeys.exchange.all, "order"] as const,
    leverage: () => [...queryKeys.exchange.all, "leverage"] as const,
  },

  // Orderbook domain (REST seed)
  orderbook: {
    snapshot: (symbol: string) => ["orderbook", "snapshot", symbol] as const,
  },

  // Hyperliquid domain
  hyperliquid: {
    all: ["hyperliquid"] as const,
    tradeAnnotation: (coin: string) =>
      [...queryKeys.hyperliquid.all, "tradeAnnotation", coin] as const,
    symbolLogo: (symbol: string) =>
      [...queryKeys.hyperliquid.all, "symbolLogo", symbol.toUpperCase()] as const,
  },
} as const;
