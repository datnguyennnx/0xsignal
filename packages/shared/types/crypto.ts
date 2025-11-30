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
  readonly change24h: number;
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

export interface MarketMetrics {
  readonly symbol: string;
  readonly volatility: number;
  readonly liquidityScore: number;
  readonly marketDominance?: number;
  readonly priceToATH?: number;
  readonly priceToATL?: number;
  readonly volumeToMarketCapRatio: number;
  readonly timestamp: Date;
}

/**
 * CoinGecko API response for markets endpoint
 */
export interface CoinGeckoCoinResponse {
  readonly id: string;
  readonly symbol: string;
  readonly name: string;
  readonly current_price: number;
  readonly market_cap: number;
  readonly market_cap_rank: number;
  readonly fully_diluted_valuation: number | null;
  readonly total_volume: number;
  readonly high_24h: number;
  readonly low_24h: number;
  readonly price_change_24h: number;
  readonly price_change_percentage_24h: number;
  readonly market_cap_change_24h: number;
  readonly market_cap_change_percentage_24h: number;
  readonly circulating_supply: number;
  readonly total_supply: number | null;
  readonly max_supply: number | null;
  readonly ath: number;
  readonly ath_change_percentage: number;
  readonly ath_date: string;
  readonly atl: number;
  readonly atl_change_percentage: number;
  readonly atl_date: string;
  readonly last_updated: string;
}
