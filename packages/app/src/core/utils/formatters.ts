export const MAX_SIG_FIGS = 5;

/**
 * The order book's "Raw" selector renders at this fixed sig-fig count, not at
 * unbounded precision: every book surface substitutes it when no aggregation
 * is requested. Chart prices are pinned to it so the selector never restyles
 * the chart.
 */
export const RAW_PRICE_NSIG_FIGS = MAX_SIG_FIGS;

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

  return price.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: config.min,
    maximumFractionDigits: config.max,
  });
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
  if (price <= 0 || n <= 0) return price.toLocaleString("en-US", { maximumFractionDigits: 6 });
  const decimals = Math.max(0, n - Math.floor(Math.log10(Math.abs(price))) - 1);
  return price.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

const isFiniteNumber = (value: number | null | undefined): value is number =>
  value != null && Number.isFinite(value);

export const formatCompactUsd = (value: number | null | undefined): string => {
  if (!isFiniteNumber(value)) return "—";
  if (Math.abs(value) < 10_000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
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
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
};

export const formatFundingPercent = (value: number | null | undefined): string => {
  if (!isFiniteNumber(value)) return "—";
  const pct = value * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(4)}%`;
};
