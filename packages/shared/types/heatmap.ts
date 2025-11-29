/**
 * Heatmap data types for market visualization
 */

/**
 * Single cell in the market heatmap
 */
export interface HeatmapCell {
  readonly symbol: string;
  readonly name: string;
  readonly price: number;
  readonly change24h: number;
  readonly change7d: number;
  readonly marketCap: number;
  readonly volume24h: number;
  readonly category: string;
  readonly intensity: number; // -100 to 100 (negative = red, positive = green)
}

/**
 * Market heatmap data
 */
export interface MarketHeatmap {
  readonly cells: readonly HeatmapCell[];
  readonly totalMarketCap: number;
  readonly totalVolume24h: number;
  readonly btcDominance: number;
  readonly ethDominance: number;
  readonly fearGreedIndex: number;
  readonly timestamp: Date;
}

/**
 * Sector/category heatmap
 */
export interface SectorHeatmap {
  readonly sector: string;
  readonly cells: readonly HeatmapCell[];
  readonly averageChange24h: number;
  readonly totalMarketCap: number;
  readonly totalVolume24h: number;
}

/**
 * Correlation heatmap cell
 */
export interface CorrelationCell {
  readonly symbolA: string;
  readonly symbolB: string;
  readonly correlation: number; // -1 to 1
  readonly timeframe: CorrelationTimeframe;
}

/**
 * Correlation heatmap
 */
export interface CorrelationHeatmap {
  readonly symbols: readonly string[];
  readonly correlations: readonly CorrelationCell[];
  readonly timeframe: CorrelationTimeframe;
  readonly timestamp: Date;
}

export type CorrelationTimeframe = "1d" | "7d" | "30d" | "90d";

/**
 * Volume heatmap by exchange
 */
export interface ExchangeVolumeCell {
  readonly exchange: string;
  readonly symbol: string;
  readonly volume24h: number;
  readonly volumePercent: number;
  readonly intensity: number;
}

export interface ExchangeVolumeHeatmap {
  readonly exchanges: readonly string[];
  readonly symbols: readonly string[];
  readonly cells: readonly ExchangeVolumeCell[];
  readonly timestamp: Date;
}

/**
 * Heatmap configuration
 */
export interface HeatmapConfig {
  readonly metric: "change24h" | "change7d" | "volume" | "marketCap";
  readonly limit: number;
  readonly category?: string;
  readonly sortBy: "marketCap" | "volume" | "change";
}
