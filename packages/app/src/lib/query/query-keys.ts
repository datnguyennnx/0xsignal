/**
 * @overview React Query Key Management
 *
 * Provides a type-safe central repository for all application query keys.
 * Ensures consistent caching and invalidation across the app.
 */
export const queryKeys = {
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

  // Hyperliquid domain
  hyperliquid: {
    all: ["hyperliquid"] as const,
    meta: (dex?: string) => [...queryKeys.hyperliquid.all, "meta", dex ?? "main"] as const,
    tradeList: () => [...queryKeys.hyperliquid.all, "tradeList"] as const,
    tradeAnnotation: (coin: string) =>
      [...queryKeys.hyperliquid.all, "tradeAnnotation", coin] as const,
    symbolLogo: (symbol: string) =>
      [...queryKeys.hyperliquid.all, "symbolLogo", symbol.toUpperCase()] as const,
  },
} as const;

// Type-safe query key builder
export type QueryKeys = typeof queryKeys;
