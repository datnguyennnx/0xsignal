/**
 * Crypto market data types - CoinGecko API focused
 */

export interface CryptoPrice {
  readonly id?: string;
  readonly symbol: string;
  readonly name?: string;
  readonly image?: string;
  readonly price: number;
  readonly marketCap: number;
  readonly volume24h: number;
  readonly change1h: number;
  readonly change24h: number;
  readonly change7d: number;
  readonly sparkline7d: readonly number[];
  readonly timestamp: Date;
  readonly high24h?: number;
  readonly low24h?: number;
  readonly circulatingSupply?: number;
  readonly totalSupply?: number;
  readonly maxSupply?: number;
  readonly ath?: number;
  readonly athChangePercentage?: number;
  readonly atl?: number;
  readonly atlChangePercentage?: number;
}
