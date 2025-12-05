/**
 * Liquidation data types for aggregated market data
 */

/**
 * Single liquidation event
 */
export interface LiquidationEvent {
  readonly symbol: string;
  readonly side: "LONG" | "SHORT";
  readonly quantity: number;
  readonly price: number;
  readonly usdValue: number;
  readonly timestamp: Date;
  readonly exchange: string;
}

/**
 * Aggregated liquidation data for a symbol
 * NOTE: isEstimate=true means this is modeled from OI/volatility, not real liquidation tape
 */
export interface LiquidationData {
  readonly symbol: string;
  readonly longLiquidations: number;
  readonly shortLiquidations: number;
  readonly totalLiquidations: number;
  readonly longLiquidationUsd: number;
  readonly shortLiquidationUsd: number;
  readonly totalLiquidationUsd: number;
  readonly liquidationRatio: number; // long/short ratio
  readonly timestamp: Date;
  readonly timeframe: LiquidationTimeframe;
  readonly isEstimate?: boolean; // true = derived model, not real tape data
}

/**
 * Liquidation levels for heatmap
 */
export interface LiquidationLevel {
  readonly price: number;
  readonly longLiquidationUsd: number;
  readonly shortLiquidationUsd: number;
  readonly totalUsd: number;
  readonly intensity: number; // 0-100 normalized intensity
}

/**
 * Liquidation heatmap data
 * NOTE: isEstimate=true means this is modeled from price range, not real orderbook
 */
export interface LiquidationHeatmap {
  readonly symbol: string;
  readonly levels: readonly LiquidationLevel[];
  readonly currentPrice: number;
  readonly highestLiquidationPrice: number;
  readonly lowestLiquidationPrice: number;
  readonly totalLongLiquidationUsd: number;
  readonly totalShortLiquidationUsd: number;
  readonly timestamp: Date;
  readonly isEstimate?: boolean; // true = derived model, not real tape data
}

/**
 * Market-wide liquidation summary
 * NOTE: isEstimate=true means this is modeled from OI/volatility, not real liquidation tape
 */
export interface MarketLiquidationSummary {
  readonly totalLiquidations24h: number;
  readonly totalLiquidationUsd24h: number;
  readonly longLiquidationUsd24h: number;
  readonly shortLiquidationUsd24h: number;
  readonly largestLiquidation: LiquidationEvent | null;
  readonly topLiquidatedSymbols: readonly LiquidationData[];
  readonly timestamp: Date;
  readonly isEstimate?: boolean; // true = derived model, not real tape data
}

export type LiquidationTimeframe = "1h" | "4h" | "12h" | "24h";

/**
 * Open interest data
 */
export interface OpenInterestData {
  readonly symbol: string;
  readonly openInterest: number;
  readonly openInterestUsd: number;
  readonly change24h: number;
  readonly changePercent24h: number;
  readonly timestamp: Date;
}

/**
 * Funding rate data
 */
export interface FundingRateData {
  readonly symbol: string;
  readonly fundingRate: number;
  readonly nextFundingTime: Date;
  readonly predictedRate: number;
  readonly timestamp: Date;
}
