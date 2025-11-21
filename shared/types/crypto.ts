// Crypto market data types for bubble signal detection using CoinGecko API

export interface CryptoPrice {
  symbol: string;
  price: number;
  marketCap: number;
  volume24h: number;
  change24h: number;
  timestamp: Date;
  // Additional CoinGecko fields for enhanced analysis
  high24h?: number;
  low24h?: number;
  circulatingSupply?: number;
  totalSupply?: number;
  maxSupply?: number;
  ath?: number; // All-time high
  athChangePercentage?: number;
  atl?: number; // All-time low
  atlChangePercentage?: number;
}

export interface MarketMetrics {
  symbol: string;
  volatility: number; // Calculated from price movements
  liquidityScore: number; // Based on volume/market cap ratio
  marketDominance?: number; // Market cap share percentage
  priceToATH?: number; // Current price / All-time high
  priceToATL?: number; // Current price / All-time low
  volumeToMarketCapRatio: number; // Volume / Market Cap
  timestamp: Date;
}

export interface BubbleSignal {
  symbol: string;
  signalType: 'PRICE_SPIKE' | 'VOLUME_SURGE' | 'VOLATILITY_SPIKE' | 'ATH_APPROACH' | 'EXTREME_DOMINANCE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
  indicators: BubbleIndicator[];
  timestamp: Date;
  metadata: Record<string, unknown>;
}

export interface BubbleIndicator {
  name: string;
  value: number;
  threshold: number;
  triggered: boolean;
  description: string;
}

export interface CryptoBubbleAnalysis {
  symbol: string;
  isBubble: boolean;
  bubbleScore: number; // 0-100, higher = more likely bubble
  signals: BubbleSignal[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  analysisTimestamp: Date;
  nextCheckTime: Date;
}

// API response types - CoinGecko focused
export interface CoinGeckoCoinResponse {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  fully_diluted_valuation: number | null;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  market_cap_change_24h: number;
  market_cap_change_percentage_24h: number;
  circulating_supply: number;
  total_supply: number | null;
  max_supply: number | null;
  ath: number;
  ath_change_percentage: number;
  ath_date: string;
  atl: number;
  atl_change_percentage: number;
  atl_date: string;
  last_updated: string;
  sparkline_in_7d?: {
    price: number[];
  };
  price_change_percentage_7d_in_currency?: number;
  price_change_percentage_14d_in_currency?: number;
  price_change_percentage_30d_in_currency?: number;
}

export interface CoinGeckoGlobalResponse {
  active_cryptocurrencies: number;
  upcoming_icos: number;
  ongoing_icos: number;
  ended_icos: number;
  markets: number;
  total_market_cap: Record<string, number>;
  total_volume: Record<string, number>;
  market_cap_percentage: Record<string, number>;
  market_cap_change_percentage_24h_usd: number;
  updated_at: number;
}

export interface CoinGeckoTrendingResponse {
  coins: Array<{
    item: {
      id: string;
      coin_id: number;
      name: string;
      symbol: string;
      market_cap_rank: number;
      thumb: string;
      small: string;
      large: string;
      slug: string;
      price_btc: number;
      score: number;
    };
  }>;
}
