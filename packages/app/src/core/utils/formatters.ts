/**
 * The order book's price-precision domain. Declared once here; every selector,
 * store and subscription guard imports it so the range cannot drift.
 */
export type Precision = 2 | 3 | 4 | 5;

export const MIN_SIG_FIGS = 2 as const;
export const MAX_SIG_FIGS = 5 as const;
export const DEFAULT_SIG_FIGS: Precision = MAX_SIG_FIGS;

export const isSigFigs = (value: unknown): value is Precision =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= MIN_SIG_FIGS &&
  value <= MAX_SIG_FIGS;

/**
 * The order book's "Raw" selector renders at this fixed sig-fig count, not at
 * unbounded precision: every book surface substitutes it when no aggregation
 * is requested. Chart prices are pinned to it so the selector never restyles
 * the chart.
 */
export const RAW_PRICE_NSIG_FIGS = MAX_SIG_FIGS;

const usdTwoDecimalsFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactUsdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

const compactNumberFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const MAX_FORMATTER_CACHE_SIZE = 64;

const formatterCache = new Map<string, Intl.NumberFormat>();

// Constructing an Intl.NumberFormat costs microseconds; price and axis
// formatting run per row per render, and their option sets are bounded.
const formatterCacheKey = (locale: string, options: Intl.NumberFormatOptions): string =>
  `${locale}|${options.style ?? ""}|${options.currency ?? ""}|${options.notation ?? ""}|${options.minimumFractionDigits ?? ""}|${options.maximumFractionDigits ?? ""}`;

const getFormatter = (locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat => {
  const key = formatterCacheKey(locale, options);
  const cached = formatterCache.get(key);
  if (cached !== undefined) return cached;

  const formatter = new Intl.NumberFormat(locale, options);
  if (formatterCache.size >= MAX_FORMATTER_CACHE_SIZE) {
    const oldestKey = formatterCache.keys().next().value;
    if (oldestKey !== undefined) formatterCache.delete(oldestKey);
  }
  formatterCache.set(key, formatter);
  return formatter;
};

/** @internal Test hook: the shared constructor the public formatters use. */
export const getFormatterForTest = getFormatter;

/** @internal Test hook: isolates cache-size assertions from other tests. */
export const resetFormatterCacheForTest = (): void => {
  formatterCache.clear();
};

/** @internal Test hook: exposes the cache bound without exporting the map. */
export const formatterCacheSizeForTest = (): number => formatterCache.size;

/** Re-exported so display-only consumers need a single formatting module. */
export { truncateAddress } from "./address";

export const formatPrice = (price: number, pxDecimals?: number): string => {
  const maxDec = pxDecimals ?? Math.min(MAX_SIG_FIGS, 6);
  const config =
    price >= 1000
      ? { min: Math.min(2, maxDec), max: Math.min(2, maxDec) }
      : price >= 1
        ? { min: Math.min(2, maxDec), max: Math.min(4, maxDec) }
        : { min: Math.min(4, maxDec), max: Math.min(6, maxDec) };

  return getFormatter("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: config.min,
    maximumFractionDigits: config.max,
  }).format(price);
};

export const formatSize = (size: number): string => {
  if (size >= 1_000_000) return `${(size / 1_000_000).toFixed(2)}M`;
  if (size >= 1_000) return `${(size / 1_000).toFixed(2)}K`;
  return size.toFixed(size < 1 ? 4 : 2);
};

/**
 * Format a price that has been rounded to N significant figures.
 * Determines the appropriate number of decimal places based on the
 * price magnitude and the nSigFigs value.
 */
export const formatPriceWithNSigFigs = (price: number, n: number): string => {
  if (price <= 0 || n <= 0) {
    return getFormatter("en-US", { maximumFractionDigits: 6 }).format(price);
  }
  const decimals = Math.max(0, n - Math.floor(Math.log10(Math.abs(price))) - 1);
  return getFormatter("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(price);
};

const isFiniteNumber = (value: number | null | undefined): value is number =>
  value != null && Number.isFinite(value);

export const formatCompactUsd = (value: number | null | undefined): string => {
  if (!isFiniteNumber(value)) return "—";
  if (Math.abs(value) < 10_000) {
    return usdTwoDecimalsFormatter.format(value);
  }
  return compactUsdFormatter.format(value);
};

/**
 * Calculate milliseconds remaining until the next funding interval (top of the hour).
 */
export const getNextFundingMs = (): number => {
  const now = new Date();
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setHours(next.getHours() + 1);
  }
  return next.getTime() - now.getTime();
};

export const formatSignedPercent = (value: number | null | undefined): string => {
  if (!isFiniteNumber(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
};

export const formatSignedUsd = (value: number | null | undefined): string => {
  if (!isFiniteNumber(value)) return "—";
  return `${value >= 0 ? "+" : "-"}${formatCompactUsd(Math.abs(value))}`;
};

export const formatAxis = (value: number | null | undefined): string => {
  if (!isFiniteNumber(value)) return "—";
  if (Math.abs(value) >= 10_000) {
    return compactNumberFormatter.format(value);
  }
  return getFormatter("en-US", { maximumFractionDigits: 2 }).format(value);
};

export const formatFundingPercent = (value: number | null | undefined): string => {
  if (!isFiniteNumber(value)) return "—";
  const pct = value * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(4)}%`;
};
