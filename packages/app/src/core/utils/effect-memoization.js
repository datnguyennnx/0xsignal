// Pure functions for data transformations - React Compiler handles memoization
import { Effect } from "effect";
// Signal Filtering
export const filterBySignal = (analyses, signalType) =>
  analyses.filter((a) => a.overallSignal === signalType);
export const getBuySignals = (analyses) =>
  analyses.filter((a) => a.overallSignal === "STRONG_BUY" || a.overallSignal === "BUY");
export const getSellSignals = (analyses) =>
  analyses.filter((a) => a.overallSignal === "STRONG_SELL" || a.overallSignal === "SELL");
export const getHoldSignals = (analyses) => analyses.filter((a) => a.overallSignal === "HOLD");
export const categorizeSignals = (analyses) => {
  const buySignals = [];
  const sellSignals = [];
  const holdSignals = [];
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
// Sorting Functions
export const sortByConfidence = (analyses) =>
  [...analyses].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
export const sortByChange24h = (analyses) =>
  [...analyses].sort((a, b) => (b.price?.change24h || 0) - (a.price?.change24h || 0));
export const sortByRisk = (analyses) =>
  [...analyses].sort((a, b) => (a.riskScore || 0) - (b.riskScore || 0));
export const sortByVolume = (analyses) =>
  [...analyses].sort((a, b) => (b.price?.volume24h || 0) - (a.price?.volume24h || 0));
// Buyback Processing
export const sortBuybackByYield = (signals) =>
  [...signals].sort((a, b) => (b.annualizedBuybackRate || 0) - (a.annualizedBuybackRate || 0));
export const filterBuybackByMinYield = (signals, minYield) =>
  signals.filter((s) => (s.annualizedBuybackRate || 0) >= minYield);
export const groupBuybackByCategory = (signals) => {
  const groups = new Map();
  for (const signal of signals) {
    const category = signal.category || "Other";
    const existing = groups.get(category) || [];
    groups.set(category, [...existing, signal]);
  }
  return groups;
};
// Effect-based Memoization
export const createMemoizedCategorizer = () =>
  Effect.cachedFunction((analyses) => Effect.succeed(categorizeSignals(analyses)));
export const createMemoizedSorter = () =>
  Effect.cachedFunction((args) => {
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
export const paginate = (items, page, pageSize) => {
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
// Search/Filter
export const searchBySymbol = (analyses, query) => {
  if (!query.trim()) return [...analyses];
  const lowerQuery = query.toLowerCase();
  return analyses.filter((a) => a.symbol.toLowerCase().includes(lowerQuery));
};
export const filterAnalyses = (analyses, criteria) => {
  let result = [...analyses];
  if (criteria.signals?.length) {
    result = result.filter((a) => criteria.signals.includes(a.overallSignal));
  }
  if (criteria.minConfidence !== undefined) {
    result = result.filter((a) => (a.confidence || 0) >= criteria.minConfidence);
  }
  if (criteria.maxRisk !== undefined) {
    result = result.filter((a) => (a.riskScore || 0) <= criteria.maxRisk);
  }
  if (criteria.searchQuery) {
    const query = criteria.searchQuery.toLowerCase();
    result = result.filter((a) => a.symbol.toLowerCase().includes(query));
  }
  return result;
};
export const computeMarketStats = (analyses) => {
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
//# sourceMappingURL=effect-memoization.js.map
