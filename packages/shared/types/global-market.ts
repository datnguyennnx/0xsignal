/**
 * Global market data types
 */

export interface GlobalMarketData {
  readonly totalMarketCap: number;
  readonly totalVolume24h: number;
  readonly btcDominance: number;
  readonly ethDominance: number;
  readonly marketCapChange24h: number;
  readonly activeCryptocurrencies: number;
  readonly markets: number;
  readonly updatedAt: number;
}
