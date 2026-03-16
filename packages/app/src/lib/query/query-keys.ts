export const queryKeys = {
  // Prices domain
  prices: {
    all: ["prices"] as const,
    lists: () => [...queryKeys.prices.all, "list"] as const,
    list: (limit: number) => [...queryKeys.prices.lists(), limit] as const,
  },

  // Global market domain
  globalMarket: {
    all: ["global-market"] as const,
    overview: () => [...queryKeys.globalMarket.all, "overview"] as const,
  },

  // Chart domain
  chart: {
    all: ["chart"] as const,
    bySymbol: (symbol: string) => [...queryKeys.chart.all, symbol] as const,
    byParams: (symbol: string, interval: string, timeframe: string) =>
      [...queryKeys.chart.bySymbol(symbol), interval, timeframe] as const,
  },

  // Asset/Analysis domain
  asset: {
    all: ["asset"] as const,
    bySymbol: (symbol: string) => [...queryKeys.asset.all, symbol] as const,
  },
} as const;

// Type-safe query key builder
export type QueryKeys = typeof queryKeys;
