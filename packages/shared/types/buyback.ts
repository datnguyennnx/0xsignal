/**
 * Protocol Revenue/Yield Types
 * Types for protocol fee analysis relative to market cap
 *
 * IMPORTANT: "Revenue" here means protocol fees collected.
 * This does NOT necessarily mean tokens are being "bought back" or burned.
 * Fee distribution varies by protocol:
 * - Some protocols burn fees (MKR, BNB)
 * - Some distribute to LPs (Uniswap, Curve)
 * - Some go to treasury (Aave, Compound)
 *
 * Use "Yield" terminology for user-facing labels for transparency.
 */

/**
 * Protocol fee/revenue data from DefiLlama
 */
export interface ProtocolBuyback {
  readonly protocol: string;
  readonly symbol: string;
  readonly geckoId: string | null;
  readonly revenue24h: number;
  readonly revenue7d: number;
  readonly revenue30d: number;
  readonly fees24h: number;
  readonly fees7d: number;
  readonly fees30d: number;
  readonly average1y: number | null; // historical daily average
  readonly total1y: number | null; // yearly total fees
  readonly change30d: number | null; // 30d vs prior 30d trend %
  readonly chains: readonly string[];
  readonly category: string;
  readonly logo: string | null;
  readonly url: string | null;
}

/**
 * Buyback signal with market cap context
 */
export interface BuybackSignal {
  readonly protocol: string;
  readonly symbol: string;
  readonly geckoId: string | null;
  readonly marketCap: number;
  readonly price: number;
  readonly revenue24h: number;
  readonly revenue7d: number;
  readonly revenue30d: number;
  readonly buybackRate24h: number;
  readonly buybackRate7d: number;
  readonly buybackRate30d: number;
  readonly annualizedBuybackRate: number;
  readonly category: string;
  readonly chains: readonly string[];
  readonly logo: string | null;
  readonly url: string | null;
  readonly signal: BuybackStrength;
  readonly timestamp: Date;
  // Quant metrics
  readonly revenueToMcap: number;
  readonly annualizedRevenue: number;
  readonly impliedPE: number;
  readonly revenueGrowth7d: number;
  // Historical benchmarks
  readonly average1y: number | null;
  readonly change30d: number | null;
}

/**
 * Buyback strength classification
 */
export type BuybackStrength = "NONE" | "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH";

/**
 * Buyback market overview
 */
export interface BuybackOverview {
  readonly totalProtocols: number;
  readonly totalRevenue24h: number;
  readonly totalRevenue7d: number;
  readonly averageBuybackRate: number;
  readonly topBuybackProtocols: readonly BuybackSignal[];
  readonly byCategory: Record<string, CategoryBuybackStats>;
  readonly timestamp: Date;
}

/**
 * Daily revenue data point for charts
 */
export interface DailyRevenuePoint {
  readonly date: number; // Unix timestamp
  readonly revenue: number;
}

/**
 * Protocol historical data with chart
 */
export interface ProtocolBuybackDetail {
  readonly signal: BuybackSignal;
  readonly dailyRevenue: readonly DailyRevenuePoint[];
  readonly revenueSource: string | null;
  readonly methodology: string | null;
}

/**
 * Category-level buyback statistics
 */
export interface CategoryBuybackStats {
  readonly category: string;
  readonly protocolCount: number;
  readonly totalRevenue24h: number;
  readonly averageBuybackRate: number;
}
