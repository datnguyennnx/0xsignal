// Core Module Exports

// API
export { ApiServiceTag, ApiServiceLive, type ApiService } from "./api/client";
export { ApiError, NetworkError } from "./api/errors";

// Cache
export {
  CacheServiceTag,
  CacheServiceLive,
  cachedTopAnalysis,
  cachedAnalysis,
  cachedChartData,
  cachedOverview,
  cachedHeatmap,
  cachedBuybackOverview,
  cachedBuybackDetail,
  cachedLiquidationHeatmap,
  cachedOpenInterest,
  cachedFundingRate,
  invalidateTopAnalysis,
  invalidateAnalysis,
  invalidateChartData,
  invalidateAll,
  getCacheStats,
} from "./cache/effect-cache";

// Runtime
export {
  AppLayer,
  type AppContext,
  getAppRuntime,
  runEffect,
  runEffectExit,
  forkEffect,
  runEffectWithTimeout,
  runConcurrent,
  runBatched,
  createFiberController,
  createDeferred,
  createMemoizedEffect,
  createCachedEffect,
  createCachedEffectWithTTL,
} from "./runtime/effect-runtime";

// Hooks
export {
  useEffectQuery,
  useEffectInterval,
  useLazyEffectQuery,
  useConcurrentQueries,
  useEffectExit,
  type QueryState,
  type LazyQueryResult,
} from "./runtime/use-effect-query";

// Memoization
export {
  filterBySignal,
  getBuySignals,
  getSellSignals,
  getHoldSignals,
  categorizeSignals,
  sortByConfidence,
  sortByChange24h,
  sortByRisk,
  sortByVolume,
  sortBuybackByYield,
  filterBuybackByMinYield,
  groupBuybackByCategory,
  paginate,
  searchBySymbol,
  filterAnalyses,
  computeMarketStats,
  type SignalType,
  type SortKey,
  type FilterCriteria,
  type PaginationResult,
  type MarketStats,
} from "./utils/effect-memoization";

// Utils
export { cn } from "./utils/cn";
export {
  formatPrice,
  formatVolume,
  formatCurrency,
  formatPercent,
  formatPercentChange,
  formatCompact,
  formatUSD,
  formatIntlCompact,
} from "./utils/formatters";

// Colors
export {
  colors,
  getChartColors,
  getCandlestickColors,
  getVolumeColor,
  getHeatmapColor,
  getIndicatorColors,
  isDarkMode,
} from "./utils/colors";
