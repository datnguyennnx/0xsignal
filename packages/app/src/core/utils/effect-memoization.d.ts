import { Effect } from "effect";
import type { AssetAnalysis, BuybackSignal } from "@0xsignal/shared";
export type SignalType = "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
export declare const filterBySignal: (
  analyses: readonly AssetAnalysis[],
  signalType: SignalType
) => AssetAnalysis[];
export declare const getBuySignals: (analyses: readonly AssetAnalysis[]) => AssetAnalysis[];
export declare const getSellSignals: (analyses: readonly AssetAnalysis[]) => AssetAnalysis[];
export declare const getHoldSignals: (analyses: readonly AssetAnalysis[]) => AssetAnalysis[];
export declare const categorizeSignals: (analyses: readonly AssetAnalysis[]) => {
  buySignals: AssetAnalysis[];
  sellSignals: AssetAnalysis[];
  holdSignals: AssetAnalysis[];
};
export declare const sortByConfidence: (analyses: readonly AssetAnalysis[]) => AssetAnalysis[];
export declare const sortByChange24h: (analyses: readonly AssetAnalysis[]) => AssetAnalysis[];
export declare const sortByRisk: (analyses: readonly AssetAnalysis[]) => AssetAnalysis[];
export declare const sortByVolume: (analyses: readonly AssetAnalysis[]) => AssetAnalysis[];
export declare const sortBuybackByYield: (signals: readonly BuybackSignal[]) => BuybackSignal[];
export declare const filterBuybackByMinYield: (
  signals: readonly BuybackSignal[],
  minYield: number
) => BuybackSignal[];
export declare const groupBuybackByCategory: (
  signals: readonly BuybackSignal[]
) => Map<string, BuybackSignal[]>;
export declare const createMemoizedCategorizer: () => Effect.Effect<
  (a: readonly AssetAnalysis[]) => Effect.Effect<
    {
      buySignals: AssetAnalysis[];
      sellSignals: AssetAnalysis[];
      holdSignals: AssetAnalysis[];
    },
    never,
    never
  >,
  never,
  never
>;
export type SortKey = "confidence" | "change24h" | "risk" | "volume";
export declare const createMemoizedSorter: () => Effect.Effect<
  (a: {
    analyses: readonly AssetAnalysis[];
    sortKey: SortKey;
  }) => Effect.Effect<AssetAnalysis[], never, never>,
  never,
  never
>;
export interface PaginationResult<T> {
  readonly items: T[];
  readonly totalItems: number;
  readonly totalPages: number;
  readonly currentPage: number;
  readonly hasNextPage: boolean;
  readonly hasPrevPage: boolean;
}
export declare const paginate: <T>(
  items: readonly T[],
  page: number,
  pageSize: number
) => PaginationResult<T>;
export declare const searchBySymbol: (
  analyses: readonly AssetAnalysis[],
  query: string
) => AssetAnalysis[];
export interface FilterCriteria {
  readonly signals?: SignalType[];
  readonly minConfidence?: number;
  readonly maxRisk?: number;
  readonly searchQuery?: string;
}
export declare const filterAnalyses: (
  analyses: readonly AssetAnalysis[],
  criteria: FilterCriteria
) => AssetAnalysis[];
export interface MarketStats {
  readonly totalAssets: number;
  readonly avgConfidence: number;
  readonly avgRisk: number;
  readonly bullishCount: number;
  readonly bearishCount: number;
  readonly neutralCount: number;
  readonly bullishPercent: number;
  readonly bearishPercent: number;
}
export declare const computeMarketStats: (analyses: readonly AssetAnalysis[]) => MarketStats;
//# sourceMappingURL=effect-memoization.d.ts.map
