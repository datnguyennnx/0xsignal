/** Treasury Domain Types - Institutional holding models */

import { Data } from "effect";

/** Branded type for coin identifiers */
export type CoinId = string & { readonly _brand: unique symbol };
export const CoinId = (id: string): CoinId => id as CoinId;

/** Branded type for entity identifiers */
export type EntityId = string & { readonly _brand: unique symbol };
export const EntityId = (id: string): EntityId => id as EntityId;

/** Transaction type discriminant */
export type TransactionType = "buy" | "sell";

/** Treasury entity holding record */
export interface TreasuryHolding {
  readonly entityId: EntityId;
  readonly entityName: string;
  readonly symbol: string;
  readonly country: string;
  readonly totalHoldings: number;
  readonly entryValueUsd: number;
  readonly currentValueUsd: number;
  readonly percentOfSupply: number;
  readonly unrealizedPnlUsd: number;
  readonly unrealizedPnlPercent: number;
}

/** Treasury transaction record */
export interface TreasuryTx {
  readonly date: Date;
  readonly coinId: CoinId;
  readonly type: TransactionType;
  readonly holdingNetChange: number;
  readonly txValueUsd: number;
  readonly holdingBalance: number;
  readonly avgEntryUsd: number;
  readonly sourceUrl: string | null;
}

/** Aggregated treasury summary for a coin */
export interface TreasurySummary {
  readonly coinId: CoinId;
  readonly totalHoldings: number;
  readonly totalValueUsd: number;
  readonly marketCapDominance: number;
  readonly entityCount: number;
  readonly netChange30d: number;
  readonly netChangePercent30d: number;
  readonly topHolders: readonly TreasuryHolding[];
  readonly recentTransactions: readonly TreasuryTx[];
  readonly lastUpdated: Date;
}

/** Historical data point for charting */
export interface TreasuryChartPoint {
  readonly timestamp: number;
  readonly holdings: number;
  readonly valueUsd: number;
}

/** Treasury errors */
export class TreasuryNotFoundError extends Data.TaggedError("TreasuryNotFoundError")<{
  readonly coinId: string;
}> {}

export class TreasuryFetchError extends Data.TaggedError("TreasuryFetchError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}
