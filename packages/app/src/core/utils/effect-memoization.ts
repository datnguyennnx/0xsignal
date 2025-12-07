import { Effect } from "effect";
import type { AssetAnalysis, BuybackSignal } from "@0xsignal/shared";

export type SignalType = "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";

export const filterBySignal = (
  analyses: readonly AssetAnalysis[],
  signalType: SignalType
): AssetAnalysis[] => analyses.filter((a) => a.overallSignal === signalType);

export const getBuySignals = (analyses: readonly AssetAnalysis[]): AssetAnalysis[] =>
  analyses.filter((a) => a.overallSignal === "STRONG_BUY" || a.overallSignal === "BUY");

export const getSellSignals = (analyses: readonly AssetAnalysis[]): AssetAnalysis[] =>
  analyses.filter((a) => a.overallSignal === "STRONG_SELL" || a.overallSignal === "SELL");

export const getHoldSignals = (analyses: readonly AssetAnalysis[]): AssetAnalysis[] =>
  analyses.filter((a) => a.overallSignal === "HOLD");

export const categorizeSignals = (analyses: readonly AssetAnalysis[]) => {
  const buySignals: AssetAnalysis[] = [];
  const sellSignals: AssetAnalysis[] = [];
  const holdSignals: AssetAnalysis[] = [];

  for (const analysis of analyses) {
    switch (analysis.overallSignal) {
      case "STRONG_BUY":
      case "BUY":
        buySignals.push(analysis);
        break;
      case "STRONG_SELL":
      case "SELL":
        sellSignals.push(analysis);
        break;
      case "HOLD":
        holdSignals.push(analysis);
        break;
    }
  }
  return { buySignals, sellSignals, holdSignals };
};

export const getCrashWarnings = (analyses: readonly AssetAnalysis[]): AssetAnalysis[] =>
  analyses.filter((a) => a.crashSignal?.isCrashing);

export const getCrashBySeverity = (
  analyses: readonly AssetAnalysis[],
  severity: "LOW" | "MEDIUM" | "HIGH" | "EXTREME"
): AssetAnalysis[] => analyses.filter((a) => a.crashSignal?.severity === severity);

const SEVERITY_ORDER = { EXTREME: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;

export const sortByCrashSeverity = (analyses: readonly AssetAnalysis[]): AssetAnalysis[] =>
  [...analyses].sort((a, b) => {
    const aSeverity = a.crashSignal?.severity || "LOW";
    const bSeverity = b.crashSignal?.severity || "LOW";
    return SEVERITY_ORDER[aSeverity] - SEVERITY_ORDER[bSeverity];
  });

const MIN_ENTRY_CONFIDENCE = 30;

export const getOptimalLongEntries = (analyses: readonly AssetAnalysis[]): AssetAnalysis[] =>
  analyses.filter(
    (a) =>
      a.entrySignal?.isOptimalEntry &&
      a.entrySignal?.direction === "LONG" &&
      a.entrySignal?.confidence >= MIN_ENTRY_CONFIDENCE
  );

export const getOptimalShortEntries = (analyses: readonly AssetAnalysis[]): AssetAnalysis[] =>
  analyses.filter(
    (a) =>
      a.entrySignal?.isOptimalEntry &&
      a.entrySignal?.direction === "SHORT" &&
      a.entrySignal?.confidence >= MIN_ENTRY_CONFIDENCE
  );

export const getOptimalEntries = (analyses: readonly AssetAnalysis[]): AssetAnalysis[] =>
  analyses.filter(
    (a) =>
      a.entrySignal?.isOptimalEntry &&
      a.entrySignal?.direction !== "NEUTRAL" &&
      a.entrySignal?.confidence >= MIN_ENTRY_CONFIDENCE
  );

export const getEntriesByStrength = (
  analyses: readonly AssetAnalysis[],
  strength: "WEAK" | "MODERATE" | "STRONG" | "VERY_STRONG"
): AssetAnalysis[] => analyses.filter((a) => a.entrySignal?.strength === strength);

const STRENGTH_ORDER = {
  VERY_STRONG: 0,
  EXTREME: 0,
  STRONG: 1,
  MODERATE: 2,
  WEAK: 3,
  VERY_WEAK: 4,
} as const;

export const sortByEntryStrength = (analyses: readonly AssetAnalysis[]): AssetAnalysis[] =>
  [...analyses].sort((a, b) => {
    const aStrength = a.entrySignal?.strength || "WEAK";
    const bStrength = b.entrySignal?.strength || "WEAK";
    return STRENGTH_ORDER[aStrength] - STRENGTH_ORDER[bStrength];
  });

export const categorizeAllSignals = (analyses: readonly AssetAnalysis[]) => {
  const base = categorizeSignals(analyses);
  const crashWarnings = sortByCrashSeverity(getCrashWarnings(analyses));
  const longEntries = sortByEntryStrength(getOptimalLongEntries(analyses));
  const shortEntries = sortByEntryStrength(getOptimalShortEntries(analyses));
  return { ...base, crashWarnings, longEntries, shortEntries };
};

export const sortByConfidence = (analyses: readonly AssetAnalysis[]): AssetAnalysis[] =>
  [...analyses].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

export const sortByChange24h = (analyses: readonly AssetAnalysis[]): AssetAnalysis[] =>
  [...analyses].sort((a, b) => (b.price?.change24h || 0) - (a.price?.change24h || 0));

export const sortByRisk = (analyses: readonly AssetAnalysis[]): AssetAnalysis[] =>
  [...analyses].sort((a, b) => (a.riskScore || 0) - (b.riskScore || 0));

export const sortByVolume = (analyses: readonly AssetAnalysis[]): AssetAnalysis[] =>
  [...analyses].sort((a, b) => (b.price?.volume24h || 0) - (a.price?.volume24h || 0));

export const sortBuybackByYield = (signals: readonly BuybackSignal[]): BuybackSignal[] =>
  [...signals].sort((a, b) => (b.annualizedBuybackRate || 0) - (a.annualizedBuybackRate || 0));

export const filterBuybackByMinYield = (
  signals: readonly BuybackSignal[],
  minYield: number
): BuybackSignal[] => signals.filter((s) => (s.annualizedBuybackRate || 0) >= minYield);

export const groupBuybackByCategory = (
  signals: readonly BuybackSignal[]
): Map<string, BuybackSignal[]> => {
  const groups = new Map<string, BuybackSignal[]>();
  for (const signal of signals) {
    const category = signal.category || "Other";
    const existing = groups.get(category) || [];
    groups.set(category, [...existing, signal]);
  }
  return groups;
};

export const createMemoizedCategorizer = () =>
  Effect.cachedFunction((analyses: readonly AssetAnalysis[]) =>
    Effect.succeed(categorizeSignals(analyses))
  );

export type SortKey = "confidence" | "change24h" | "risk" | "volume";

export const createMemoizedSorter = () =>
  Effect.cachedFunction((args: { analyses: readonly AssetAnalysis[]; sortKey: SortKey }) => {
    const { analyses, sortKey } = args;
    switch (sortKey) {
      case "confidence":
        return Effect.succeed(sortByConfidence(analyses));
      case "change24h":
        return Effect.succeed(sortByChange24h(analyses));
      case "risk":
        return Effect.succeed(sortByRisk(analyses));
      case "volume":
        return Effect.succeed(sortByVolume(analyses));
    }
  });

export interface PaginationResult<T> {
  readonly items: T[];
  readonly totalItems: number;
  readonly totalPages: number;
  readonly currentPage: number;
  readonly hasNextPage: boolean;
  readonly hasPrevPage: boolean;
}

export const paginate = <T>(
  items: readonly T[],
  page: number,
  pageSize: number
): PaginationResult<T> => {
  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const currentPage = Math.max(1, Math.min(page, totalPages));
  const startIndex = (currentPage - 1) * pageSize;
  return {
    items: items.slice(startIndex, startIndex + pageSize),
    totalItems,
    totalPages,
    currentPage,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
  };
};

export const searchBySymbol = (
  analyses: readonly AssetAnalysis[],
  query: string
): AssetAnalysis[] => {
  if (!query.trim()) return [...analyses];
  const lowerQuery = query.toLowerCase();
  return analyses.filter((a) => a.symbol.toLowerCase().includes(lowerQuery));
};

export interface FilterCriteria {
  readonly signals?: SignalType[];
  readonly minConfidence?: number;
  readonly maxRisk?: number;
  readonly searchQuery?: string;
}

export const filterAnalyses = (
  analyses: readonly AssetAnalysis[],
  criteria: FilterCriteria
): AssetAnalysis[] => {
  let result = [...analyses];
  if (criteria.signals?.length) {
    result = result.filter((a) => criteria.signals!.includes(a.overallSignal));
  }
  if (criteria.minConfidence !== undefined) {
    result = result.filter((a) => (a.confidence || 0) >= criteria.minConfidence!);
  }
  if (criteria.maxRisk !== undefined) {
    result = result.filter((a) => (a.riskScore || 0) <= criteria.maxRisk!);
  }
  if (criteria.searchQuery) {
    const query = criteria.searchQuery.toLowerCase();
    result = result.filter((a) => a.symbol.toLowerCase().includes(query));
  }
  return result;
};

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

export const computeMarketStats = (analyses: readonly AssetAnalysis[]): MarketStats => {
  const totalAssets = analyses.length;
  if (totalAssets === 0) {
    return {
      totalAssets: 0,
      avgConfidence: 0,
      avgRisk: 0,
      bullishCount: 0,
      bearishCount: 0,
      neutralCount: 0,
      bullishPercent: 0,
      bearishPercent: 0,
    };
  }

  let totalConfidence = 0,
    totalRisk = 0,
    bullishCount = 0,
    bearishCount = 0,
    neutralCount = 0;

  for (const analysis of analyses) {
    totalConfidence += analysis.confidence || 0;
    totalRisk += analysis.riskScore || 0;
    switch (analysis.overallSignal) {
      case "STRONG_BUY":
      case "BUY":
        bullishCount++;
        break;
      case "STRONG_SELL":
      case "SELL":
        bearishCount++;
        break;
      case "HOLD":
        neutralCount++;
        break;
    }
  }

  return {
    totalAssets,
    avgConfidence: Math.round(totalConfidence / totalAssets),
    avgRisk: Math.round(totalRisk / totalAssets),
    bullishCount,
    bearishCount,
    neutralCount,
    bullishPercent: Math.round((bullishCount / totalAssets) * 100),
    bearishPercent: Math.round((bearishCount / totalAssets) * 100),
  };
};
