// Crypto market data types using CoinGecko API

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

// API response types - CoinGecko focused
// CoinGecko API response for markets endpoint
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
}

// Strategy-based analysis types
export interface StrategyResult {
  readonly regime: string;
  readonly signals: ReadonlyArray<StrategySignal>;
  readonly primarySignal: StrategySignal;
  readonly overallConfidence: number;
  readonly riskScore: number;
}

export interface StrategySignal {
  readonly strategy: string;
  readonly signal: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
  readonly confidence: number;
  readonly reasoning: string;
  readonly metrics: Record<string, number>;
}

export interface CrashSignal {
  readonly isCrashing: boolean;
  readonly severity: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  readonly confidence: number;
  readonly indicators: {
    readonly rapidDrop: boolean;
    readonly volumeSpike: boolean;
    readonly oversoldExtreme: boolean;
    readonly highVolatility: boolean;
  };
  readonly recommendation: string;
}

export interface BullEntrySignal {
  readonly isOptimalEntry: boolean;
  readonly strength: "WEAK" | "MODERATE" | "STRONG" | "VERY_STRONG";
  readonly confidence: number;
  readonly indicators: {
    readonly trendReversal: boolean;
    readonly volumeIncrease: boolean;
    readonly momentumBuilding: boolean;
    readonly bullishDivergence: boolean;
  };
  readonly entryPrice: number;
  readonly targetPrice: number;
  readonly stopLoss: number;
  readonly recommendation: string;
}

export interface StrategyBasedAnalysis {
  readonly symbol: string;
  readonly timestamp: Date;
  readonly strategyResult: StrategyResult;
  readonly crashSignal: CrashSignal;
  readonly bullEntrySignal: BullEntrySignal;
  readonly overallSignal: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
  readonly confidence: number;
  readonly riskScore: number;
  readonly actionableInsight: string;
}
