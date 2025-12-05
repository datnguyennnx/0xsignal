/** Treasury Types - Shared between API and Frontend */

/** Accumulation signal from institutional activity */
export type AccumulationSignal = "strong_buy" | "buy" | "neutral" | "sell" | "strong_sell";

/** Holding of a specific coin by an entity */
export interface CoinHolding {
  readonly coinId: string;
  readonly coinSymbol: string;
  readonly holdings: number;
  readonly valueUsd: number;
  readonly percentOfSupply: number;
}

/** Aggregated entity (company/ETF) with all their crypto holdings */
export interface TreasuryEntity {
  readonly entityName: string;
  readonly symbol: string;
  readonly country: string;
  readonly totalValueUsd: number;
  readonly entryValueUsd: number;
  readonly unrealizedPnlPercent: number;
  readonly hasKnownEntry: boolean;
  readonly holdings: readonly CoinHolding[];
}

/** Response from entities endpoint */
export interface TreasuryEntitiesResponse {
  readonly entities: readonly TreasuryEntity[];
  readonly totalValueUsd: number;
  readonly entityCount: number;
}

/** Legacy: Treasury summary for a coin */
export interface TreasurySummary {
  readonly coinId: string;
  readonly totalHoldings: number;
  readonly totalValueUsd: number;
  readonly marketCapDominance: number;
  readonly entityCount: number;
  readonly netChange30d: number;
  readonly netChangePercent30d: number;
  readonly topHolders: readonly TreasuryHolder[];
  readonly recentTransactions: readonly TreasuryTransaction[];
  readonly lastUpdated: string;
  readonly signal: AccumulationSignal;
}

/** Legacy: Individual entity holder */
export interface TreasuryHolder {
  readonly entityName: string;
  readonly symbol: string;
  readonly country: string;
  readonly totalHoldings: number;
  readonly currentValueUsd: number;
  readonly entryValueUsd: number;
  readonly percentOfSupply: number;
  readonly unrealizedPnlPercent: number;
}

/** Legacy: Treasury transaction record */
export interface TreasuryTransaction {
  readonly date: string;
  readonly coinId: string;
  readonly type: "buy" | "sell";
  readonly holdingNetChange: number;
  readonly txValueUsd: number;
  readonly holdingBalance: number;
  readonly avgEntryUsd: number;
  readonly sourceUrl: string | null;
}

/** Legacy: Treasury overview item */
export interface TreasuryOverviewItem {
  readonly coinId: string;
  readonly totalHoldings: number;
  readonly totalValueUsd: number;
  readonly entityCount: number;
  readonly netChange30d: number;
  readonly netChangePercent30d: number;
  readonly signal: AccumulationSignal;
  readonly topHolders: readonly TreasuryHolder[];
}

/** Historical chart point */
export interface TreasuryChartPoint {
  readonly timestamp: number;
  readonly holdings: number;
  readonly valueUsd: number;
}
